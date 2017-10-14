const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');
const init = require('./init');
const bootstrap = require('./bootstrap');
const modules = require('./modules');
const version = global.__WEBPACK__ ? global.__VERSION__ : require('../package.json').version;

const examples = [
  ['Generate json file with minimal options', '$ blinksocks init --minimal'],
  ['Start blinksocks client', '$ blinksocks --config blinksocks.client.json'],
  ['Start blinksocks server', '$ blinksocks --config blinksocks.server.json'],
  ['List all built-in presets', '$ blinksocks --list-presets']
];

const usage = `
  ${chalk.bold.underline(`blinksocks v${version}`)}

  Usage: blinksocks [command] [options] ...

  Commands:

    init    generate configuration pair

  Options:

    -h, --help          output usage information
    -v, --version       output blinksocks version
    -c, --config        file json file with configuration
    -m, --minimal       generate minimal json files
    --list-presets      list all built-in presets

  Examples:

${examples.map(([description, example]) => `  ${chalk.gray('-')} ${description}${os.EOL}    ${chalk.blue(example)}`).join(os.EOL)}

  About & Help: ${chalk.underline('https://github.com/blinksocks/blinksocks')}
`;

const argv = process.argv;
const options = argv.slice(2);

function hasOption(opt) {
  return options.indexOf(opt) !== -1;
}

function getOptionValue(opt) {
  const index = options.indexOf(opt);
  if (index !== -1) {
    return options[index + 1];
  }
  return undefined;
}

function main() {
  if (argv.length < 3) {
    return console.log(usage);
  }

  // try to treat the first argument as conf
  const opt0 = options[0];
  const maybeConfPath = path.resolve(process.cwd(), opt0);
  if (fs.existsSync(maybeConfPath) && path.extname(maybeConfPath) === '.json') {
    return bootstrap(maybeConfPath, modules);
  }

  // parse Commands

  if (options[0] === 'init') {
    const isMinimal = hasOption('-m') || hasOption('--minimal');
    return init({isMinimal});
  }

  // parse options

  if (hasOption('-h') || hasOption('--help')) {
    return console.log(usage);
  }

  if (hasOption('-v') || hasOption('--version')) {
    return console.log(version);
  }

  if (hasOption('-c') || hasOption('--config')) {
    let configPath = getOptionValue('-c') || getOptionValue('--config');

    if (configPath === undefined) {
      return console.log(chalk.red('config file must be provided'));
    }

    configPath = path.resolve(process.cwd(), configPath);

    if (!fs.existsSync(configPath)) {
      return console.log(chalk.red('config file is not found'));
    }

    return bootstrap(configPath, modules);
  }

  if (hasOption('--list-presets')) {
    const {presets: {presets, legacyPresets}} = modules;
    console.log(presets.join(os.EOL));
    console.log(legacyPresets.map((name) => `${chalk.gray(name)} -> ${name.substr(4)}`).join(os.EOL));
    return;
  }

  // other cases
  console.log(usage);
}

// libsodium-wrappers need to be loaded asynchronously
// so we must wait for it ready before run main().
// https://github.com/jedisct1/libsodium.js#usage-as-a-module
const _sodium = require('libsodium-wrappers');
_sodium.ready
  // a handy way to access libsodium without fighting with Promise
  .then(() => global.libsodium = _sodium)
  .then(main);
