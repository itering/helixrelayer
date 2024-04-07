import {ethers} from "ethers";
import Safe, {EthersAdapter} from "@safe-global/protocol-kit";
import SafeApiKit from "@safe-global/api-kit";


export async function init(options) {
  const {register, lifecycle, signer} = options;
  if (!(register.safeWalletUrl && register.safeWalletAddress)) {
    return;
  }
  const provider = new ethers.JsonRpcProvider(lifecycle.sourceChainRpc);
  const wallet = new ethers.Wallet(signer, provider);
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


export async function propose(options = {safeSdk, safeService, transactions, safeAddress, senderAddress}) {
  const {safeSdk, safeService, transactions, safeAddress, senderAddress} = options;
  const safeTransaction = await safeSdk.createTransaction({
    transactions
  });
  const safeTxHash = await safeSdk.getTransactionHash(safeTransaction);
  const senderSignature = await safeSdk.signTransaction(safeTransaction);
  const proposeTransactionProps = {
    safeAddress,
    safeTransactionData: safeTransaction.data,
    safeTxHash,
    senderAddress,
    senderSignature: senderSignature.signatures.get(senderAddress.toLowerCase()).data,
  };
  return await safeService.proposeTransaction(proposeTransactionProps);
}
