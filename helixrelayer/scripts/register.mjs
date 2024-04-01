const BIN_PATH = path.resolve(__filename, '../');
const WORK_PATH = path.resolve(BIN_PATH, '../../');

const LOCK_PATH = path.resolve(WORK_PATH, 'helixrelayer/lock');

// console.log(BIN_PATH);
// console.log(WORK_PATH);

// console.log(argv);
const ENVIRONMENTS = argv._;

async function check() {
  if (!ENVIRONMENTS || !ENVIRONMENTS.length) {
    console.log(chalk.red('missing network [mainnet|testnet]'));
    process.exit(1);
  }
}

async function initialize() {
  const defYmlRaw = await fs.readFile(`${WORK_PATH}/helixrelayer/definition.yml`, 'utf8');
  const definition = YAML.parse(defYmlRaw);
  return { definition };
}

async function handle(options) {
  const {environment} = options;
  const bridgeConfigRaw = await fs.readFile(`${WORK_PATH}/helixrelayer/bridges.${environment}.yml`, 'utf8');
  const bridgeConfig = YAML.parse(bridgeConfigRaw);
  const registers = bridgeConfig.registers;

  for (const register of registers) {
    console.log(`==> start register [${register.type}] [${register.symbol}] ${register.bridge}`);
    await registerRelayer({
      ...options,
      register,
    });
    console.log('-----------------------')
    console.log('')
    console.log('')
  }
}


async function registerRelayer(options) {
  const {definition, register} = options;
  const [sourceChainName, targetChainName] = register.bridge.split('->');
  const sourceChainRpc = definition.rpc[sourceChainName];
  const targetChainRpc =  definition.rpc[targetChainName];
  if (!sourceChainRpc) {
    console.log(chalk.red(`unidentified chain: ${sourceChainName}`));
    process.exit(1);
  }
  if (!targetChainRpc) {
    console.log(chalk.red(`unidentified chain: ${targetChainName}`));
    process.exit(1);
  }

  const hash = await hashRegister(register);
  const ensureLockOptions = {
    register,
    hash,
  };
  if (await ensureLock(ensureLockOptions)) {
    console.log(chalk.yellow(`the bridge ${_identifyRegisterName(register)} already registered.`));
    return;
  }

  const _sourceTokenDecimal = await $`cast call --rpc-url=${sourceChainRpc} ${register.sourceTokenAddress} 'decimals()()'`;
  // const _targetTokenDecimal = await $`cast call --rpc-url=${targetChainRpc} ${register.targetTokenAddress} 'decimals()()'`;
  const sourceTokenDecimal = BigInt(_sourceTokenDecimal);

  switch (register.type) {
    case 'lnv3': {
      await registerV3({
        ...options,
        rpc: sourceChainRpc,
        decimals: sourceTokenDecimal,
      });
    }
  }
  await ensureLock(ensureLockOptions, true);
  console.log(chalk.green(`the bridge ${_identifyRegisterName(register)} registered`));
}

async function registerV3(options) {
  const {register, rpc, decimals} = options;
  const baseFee = BigInt(register.baseFee) * (10n ** decimals);
  const transferLimit = BigInt(register.transferLimit) * (10n ** decimals);
  const liquidityFeeRate = Number(register.liquidityFeeRate) * (10 ** 3);

  const flags = [
    `--rpc-url=${rpc}`,
    // `--private-key=${SIGNER}`,
    register.contract,
    '"registerLnProvider(uint256,address,address,uint112,uint16,uint112)()"',
    register.targetChainId,
    register.sourceTokenAddress,
    register.targetTokenAddress,
    baseFee,
    liquidityFeeRate,
    transferLimit,
  ];
  await $`echo cast send ${flags}`;
  // console.log(baseFee, transferLimit, liquidityFeeRate)
  // console.log(register)
}

async function ensureLock(options, write = false) {
  const {register} = options;
  const irn = _identifyRegisterName(register);
  const lockName = `${LOCK_PATH}/${irn}.lock.json`;
  if (write) {
    await $`mkdir -p ${LOCK_PATH}`;
    const outputJson = JSON.stringify(options, null, 2);
    await fs.writeFile(lockName, outputJson);
    console.log(`write lock: ${lockName}`);
    return true;
  }

  if (!await fs.pathExists(lockName)) {
    return false;
  }

  const lockedRegisterData = await fs.readJson(lockName);
  if (lockedRegisterData.hash.hash !== options.hash.hash) {
    console.log(chalk.magenta(`detect changes for bridge ${irn} register it again`));
    return false;
  }

  return true;
}

function _identifyRegisterName(register) {
  return `${register.type}__${register.symbol}__${register.bridge.replace('->', '_')}`;
}


async function hashRegister(register) {
  const keys = Object.keys(register);
  keys.sort();
  let merged = '';
  for (const key of keys) {
    merged += register[key];
  }
  const hash = await $`echo "${merged}" | sha256sum | cut -d ' ' -f1`;
  return {
    origin: merged,
    hash: hash.stdout.trim(),
  }
}

async function main() {
  const lifecycle = await initialize();
  for (const env of ENVIRONMENTS) {
    await handle({
      ...lifecycle,
      environment: env,
    })
  }
}

await check();
await main();

