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
}

async function main() {
  const lifecycle = await initialize.lifecycle();
  const environments = arg.programArguments();
  for (const env of environments) {
    await reg.register({
      ...lifecycle,
      environment: env,
    });
  }
}

await check();
await main();
