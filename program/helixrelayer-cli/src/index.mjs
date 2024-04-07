import * as initialize from './ecosys/initialize.js'
import * as arg from './ecosys/arg.js'
import * as reg from './register/index.js'

// const BIN_PATH = path.resolve(__filename, '../');
// const WORK_PATH = path.resolve(BIN_PATH, '../../');

async function check() {
  const environments = arg.programArguments();
  if (!environments || !environments.length) {
    console.log(chalk.red('missing network [mainnet|testnet]'));
    process.exit(1);
  }
  const datadir = arg.datadir();
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
  const deps = ['cast', 'sha256sum', 'cut'];
  for (const dep of deps) {
    const depath = await which(dep);
    if (!depath) {
      console.log(chalk.red(`missing ${dep}`));
      process.exit(1);
    }
  }
}

async function main() {
  const options = await initialize.init();
  const pargs = arg.programArguments();
  const cmd = pargs[0];
  switch (cmd) {
    case 'register':
      await reg.register(options);
      break
    default:
      console.log(`unsupported command: ${cmd}`);
      process.exit(1);
  }
}

await check();
await main();
