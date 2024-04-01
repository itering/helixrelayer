const BIN_PATH = path.resolve(__filename, '../');
const WORK_PATH = path.resolve(BIN_PATH, '../');

// console.log(BIN_PATH);
// console.log(WORK_PATH);

console.log(argv);

const yc = await fs.readFile(`${WORK_PATH}/helixrelayer/bridges.testnet.yml`, 'utf8');

console.log(YAML.parse(yc))

