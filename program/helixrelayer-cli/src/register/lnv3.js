

export async function register(options) {
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
