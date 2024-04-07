import * as arg from './arg.js'

export async function init() {
  const defYmlRaw = await fs.readFile(arg.datapath('/definition.yml'), 'utf8');
  const definition = YAML.parse(defYmlRaw);

  const signer = $.env['SIGNER'];
  return {definition, signer};
}
