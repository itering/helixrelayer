
import * as arg from '../ecosys/arg.js'

export async function register(options) {
  const {register, lifecycle} = options;


  const _sourceTokenDecimal = await $`cast call --rpc-url=${lifecycle.sourceChainRpc} ${register.sourceTokenAddress} 'decimals()()'`;
  // const _targetTokenDecimal = await $`cast call --rpc-url=${targetChainRpc} ${register.targetTokenAddress} 'decimals()()'`;

  const sourceTokenDecimal = BigInt(_sourceTokenDecimal);
  const callOptions = {
    decimals: sourceTokenDecimal,
    baseFee: BigInt(register.baseFee) * (10n ** sourceTokenDecimal),
    transferLimit: BigInt(register.transferLimit) * (10n ** sourceTokenDecimal),
    liquidityFeeRate: Number(register.liquidityFeeRate) * (10 ** 3),
  };

  // call safe
  if (register.safeWalletAddress && register.safeWalletUrl) {
    await registerWithSafe(options, callOptions);
    return;
  }

  await registerWithCall(options, callOptions);

  // call contract

  // console.log(baseFee, transferLimit, liquidityFeeRate)
  // console.log(register)
}


async function registerWithCall(options, callOptions) {
  const {register, lifecycle, signer} = options;
  const setFeeFlags = [
    `--rpc-url=${lifecycle.sourceChainRpc}`,
    `--private-key=${signer}`,
    register.contract,
    'registerLnProvider(uint256,address,address,uint112,uint16,uint112)()',
    register.targetChainId,
    register.sourceTokenAddress,
    register.targetTokenAddress,
    callOptions.baseFee,
    callOptions.liquidityFeeRate,
    callOptions.transferLimit,
  ];

  const txSetFee = await $`echo cast send ${setFeeFlags}`;
  const depositFlags = [
    `--rpc-url=${lifecycle.sourceChainRpc}`,
    `--private-key=${signer}`,
    register.contract,
    'depositPenaltyReserve(address,uint256)()',
    register.sourceTokenAddress,
    BigInt(register.deposit) * (10n ** callOptions.decimals),
  ];
  const txDeposit = await $`echo cast send ${depositFlags}`;
}


async function registerWithSafe(options, callOptions) {
  const {register, lifecycle, safeSdk, safeService} = options;
  // generate transaction data
  const setFeeFlags = [
    // `--rpc-url=${rpc}`,
    // // `--private-key=${SIGNER}`,
    // register.contract,
    'registerLnProvider(uint256,address,address,uint112,uint16,uint112)()',
    register.targetChainId,
    register.sourceTokenAddress,
    register.targetTokenAddress,
    callOptions.baseFee,
    callOptions.liquidityFeeRate,
    callOptions.transferLimit,
  ];
  const txSetFee = await $`cast calldata ${setFeeFlags}`;
  const depositFlags = [
    'depositPenaltyReserve(address,uint256)()',
    register.sourceTokenAddress,
    BigInt(register.deposit) * (10n ** callOptions.decimals),
  ];
  const txDeposit = await $`cast calldata ${depositFlags}`;

  const safeTransaction = await safeSdk.createTransaction({
    transactions: [
      {
        to: register.contract,
        value: '0',
        data: txSetFee.stdout.trim(),
      },
      {
        to: register.contract,
        value: '0',
        data: txDeposit.stdout.trim(),
      },
    ]
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
  const p0 = await safeService.proposeTransaction(proposeTransactionProps);
  console.log(
    chalk.green('proposed register transaction to'),
    `${lifecycle.sourceChainName}: ${register.safeWalletAddress} (safe)`
  );
  if (p0 && arg.isDebug()) {
    console.log(p0);
  }
}
