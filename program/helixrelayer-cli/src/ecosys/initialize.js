import * as arg from './arg.js'
import {datapath} from "./arg.js";

export async function lifecycle() {
  const defYmlRaw = await fs.readFile(arg.datapath('/definition.yml'), 'utf8');
  const definition = YAML.parse(defYmlRaw);

  return {definition};
}
