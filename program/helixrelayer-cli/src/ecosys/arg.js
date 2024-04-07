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

export function programArguments() {
  return argv._;
}

export function option(long, short) {
  return _readArg(long, short);
}

export function options(long, short) {
  return _readArgs(long, short);
}

export function isDebug() {
  return option('debug');
}

export function datadir() {
  return option('datadir', 'd');
}

export function datapath(file) {
  return `${datadir()}${file}`
}

