import * as arg from '../ecosys/arg.js'
import * as safe from '../ecosys/safe.js'
import * as lnv3 from './lnv3.js'

export async function register(options) {
  const {environment} = options;
  const bridgeConfigRaw = await fs.readFile(arg.datapath(`/bridges.${environment}.yml`), 'utf8');
  const bridgeConfig = YAML.parse(bridgeConfigRaw);
  const registers = bridgeConfig.registers;

  for (const register of registers) {
    console.log(`==> start register [${register.type}] [${register.symbol}] ${register.bridge}`);
    await handle({
      ...options,
      register,
    });
    console.log('-----------------------')
    console.log('')
    console.log('')
  }
}

async function handle(options) {
  const {definition, register} = options;
  const [sourceChainName, targetChainName] = register.bridge.split('->');
  const sourceChainRpc = definition.rpc[sourceChainName];
  const targetChainRpc = definition.rpc[targetChainName];
  if (!sourceChainRpc) {
    console.log(chalk.red(`unidentified chain: ${sourceChainName}`));
    process.exit(1);
  }
  if (!targetChainRpc) {
    console.log(chalk.red(`unidentified chain: ${targetChainName}`));
    process.exit(1);
  }
  register.sourceChainRpc = sourceChainRpc;
  register.targetChainRpc = targetChainRpc;

  await safe.init(options);
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

  const registerOptions = {
    ...options,
    rpc: sourceChainRpc,
    decimals: sourceTokenDecimal,
  };
  switch (register.type) {
    case 'lnv3': {
      await lnv3.register(registerOptions);
      break;
    }
  }
  await ensureLock(ensureLockOptions, true);
  console.log(chalk.green(`the bridge ${_identifyRegisterName(register)} registered`));
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

async function ensureLock(options, write = false) {
  const {register} = options;
  const irn = _identifyRegisterName(register);
  const LOCK_PATH = arg.datapath('/lock');
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

