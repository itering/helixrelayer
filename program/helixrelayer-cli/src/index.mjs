import {ethers} from 'ethers'
import Safe, {EthersAdapter} from '@safe-global/protocol-kit'
import SafeApiKit from '@safe-global/api-kit'

const BIN_PATH = path.resolve(__filename, '../');
const WORK_PATH = path.resolve(BIN_PATH, '../../');

// console.log(BIN_PATH);
// console.log(WORK_PATH);

// console.log(argv);
const ENVIRONMENTS = argv._;

function _readArg(long, short = '') {
  const fargs = _readArgs(long, short);
  return fargs.length ? fargs[0] : undefined;
}

function _readArgs(long, short = '') {
  let largs = argv[long] ?? [];
  let sargs = argv[short] ? argv[short] : [];
  if (typeof largs === 'string') {
    largs = [largs];
  }
  if (typeof sargs === 'string') {
    sargs = [sargs];
  }
  return [...largs, ...sargs];
}

function _dataFilePath(file) {
  const datadir = _readArg('datadir', 'd');
  return `${datadir}${file}`
}

async function check() {
  if (!ENVIRONMENTS || !ENVIRONMENTS.length) {
    console.log(chalk.red('missing network [mainnet|testnet]'));
    process.exit(1);
  }
  const datadir = _readArg('datadir', 'd');
  if (!datadir) {
    console.log(chalk.red('missing datadir, please add --datadir=/path/to/data or -d=/path/to/data'));
    process.exit(1);
  }
  if (!await fs.pathExists(datadir)) {
    console.log(chalk.red(`the datadir [${datadir}] not exists`));
    process.exit(1);
  }
  if (!$.env['SIGNER']) {
    console.log(chalk.red('missing signer'));
    process.exit(1);
  }
}

async function initialize() {
  const defYmlRaw = await fs.readFile(_dataFilePath('/definition.yml'), 'utf8');
  const definition = YAML.parse(defYmlRaw);

  return {definition};
}


async function initSafe(options) {
  const {register} = options;
  if (!(register.safeWalletUrl && register.safeWalletAddress)) {
    return;
  }
  const provider = new ethers.JsonRpcProvider(register.sourceChainRpc);
  const wallet = new ethers.Wallet($.env['SIGNER'], provider);
  const ethAdapter = new EthersAdapter({
    ethers,
    signerOrProvider: wallet,
  });
  const safeSdk = await Safe.default.create({ethAdapter: ethAdapter, safeAddress: register.safeWalletAddress});

  const network = await provider.getNetwork();
  const safeService = new SafeApiKit.default({
    chainId: network.chainId,
    // txServiceUrl: register.safeWalletUrl,
    txServiceUrl: 'https://httpbin.org/anything',
  })

  options.safeSdk = safeSdk;
  options.safeService = safeService;
  options.signer = wallet;
}

async function handle(options) {
  const {environment} = options;
  const bridgeConfigRaw = await fs.readFile(_dataFilePath(`/bridges.${environment}.yml`), 'utf8');
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

  await initSafe(options);
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

  // generate transaction data
  const setFeeFlags = [
    // `--rpc-url=${rpc}`,
    // // `--private-key=${SIGNER}`,
    // register.contract,
    'registerLnProvider(uint256,address,address,uint112,uint16,uint112)()',
    register.targetChainId,
    register.sourceTokenAddress,
    register.targetTokenAddress,
    baseFee,
    liquidityFeeRate,
    transferLimit,
  ];
  const txSetFee = await $`cast calldata ${setFeeFlags}`;
  const depositFlags = [
    'depositPenaltyReserve(address,uint256)()',
    register.sourceTokenAddress,
    BigInt(register.deposit) * (10n ** decimals),
  ];
  const txDeposit = await $`cast calldata ${depositFlags}`;


  // call safe
  if (register.safeWalletAddress && register.safeWalletUrl) {
    // const respSafeWallet = await fetch(`${register.safeWalletUrl}/v1/safes/${register.safeWalletAddress}`);
    // const {nonce} = await respSafeWallet.json();
    // const safeCallData = {
    //   safe: "string",
    //   to: "string",
    //   value: 0,
    //   data: "string",
    //   operation: 0,
    //   gasToken: "string",
    //   safeTxGas: 0,
    //   baseGas: 0,
    //   gasPrice: 0,
    //   refundReceiver: "string",
    //   nonce,
    //   contractTransactionHash: "string",
    //   sender: "string",
    //   signature: "string",
    //   origin: "string"
    // };
    // const respPropose = await fetch(
    //   'https://httpbin.org/post',
    //   // `${register.safeWalletUrl}/v1/safes/${register.safeWalletAddress}/multisig-transactions`,
    //   {
    //     method: 'post',
    //     body: JSON.stringify(safeCallData),
    //     headers: {'Content-Type': 'application/json'}
    //   });
    // const body = await respPropose.json();
    // console.log(body);
    const {safeSdk, safeService} = options;
    const safeTransactionData = {
      to: register.contract,
      value: '0',
      data: txSetFee.stdout.trim(),
    };
    const safeTransaction = await safeSdk.createTransaction({
      transactions: [safeTransactionData]
    });
    const safeTxHash = await safeSdk.getTransactionHash(safeTransaction);
    const senderSignature = await safeSdk.signTransaction(safeTransaction);
    const proposeTransactionProps = {
      safeAddress: register.safeWalletAddress,
      safeTransactionData: safeTransaction.data,
      safeTxHash,
      senderAddress: options.signer.address,
      senderSignature: senderSignature.signatures.get(options.signer.address.toLowerCase()).data,
    };
    console.log(safeTransaction);
    console.log(safeTxHash);
    console.log(senderSignature);
    console.log(proposeTransactionProps);
    const d = await safeService.proposeTransaction(proposeTransactionProps);
    console.log(d);
  }

  // call contract

  // console.log(baseFee, transferLimit, liquidityFeeRate)
  // console.log(register)
}

async function ensureLock(options, write = false) {
  const {register} = options;
  const irn = _identifyRegisterName(register);
  const LOCK_PATH = _dataFilePath('/lock');
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

