import {ethers} from "ethers";
import Safe, {EthersAdapter} from "@safe-global/protocol-kit";
import SafeApiKit from "@safe-global/api-kit";


export async function init(options) {
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

