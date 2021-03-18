#!/usr/bin/env node

const chalk = require('chalk');
const run = require('./api');

const log = console.log.bind(console); // eslint-disable-line no-console
const error = console.error.bind(console); // eslint-disable-line no-console
const warn = console.warn.bind(console); // eslint-disable-line no-console
const ul = chalk.underline;

run.apply(null, parseCliArguments());

function parseCliArguments(argv = process.argv) {
  const args = argv.slice(2);
  const command = args[0];
  const options = {};

  if (command === 'help') {
    exitWithHelp();
  }

  if (!run.COMMANDS.includes(command)) {
    dieWithHelp("ERROR: unknown command %o", command);
  }

  for (args.shift(); args.length > 0; args.shift()) {
    switch (args[0]) {
      case '-h':
      case '--help':
        exitWithHelp();
        break;
      case '-v':
      case '--verbose':
        options.verbose = 1;
        break;
      case '--in':
        if (args[1]) {
          options.inFile = args[1];
          args.shift();
        } else {
          dieWithHelp('ERROR: "--in" requires an non-empty argument.');
        }
        break;
      case '--build':
        if (args[1]) {
          options.buildDir = args[1];
          args.shift();
        } else {
          dieWithHelp('ERROR: "--build" requires an non-empty argument.');
        }
        break;
      case '--out':
        if (args[1]) {
          options.outDir = args[1];
          args.shift();
        } else {
          dieWithHelp('ERROR: "--out" requires an non-empty argument.');
        }
        break;
      case '--public-url':
        if (args[1]) {
          options.publicUrl = args[1];
          args.shift();
        } else {
          dieWithHelp('ERROR: "--public-url" requires an non-empty argument.');
        }
        break;
      default:
        warn("WARN: Uknown option (ignored): %o\n", args[0]);
        break;
    }
  }

  return [command, options];
}

function exitWithHelp(...messages) {
  if (messages.length) log(...messages);
  help()
  process.exit(0);
}

function dieWithHelp(...messages) {
  if (messages.length) error(...messages);
  help()
  process.exit(1);
}

function filename(path) {
  return path.slice(path.lastIndexOf('/') + 1);
}

function help() {
  log(`
Usage:

  ${filename(process.argv[1])} <command> [--in ${ul('input-html-file')}] [--build ${ul('root-build-directory')}] [--out ${ul('output-html-directory')}] [--public-url ${ul('url-or-path')}] [-v|--verbose]

Description:

  Create a personal resume and publish it as a HTML page and PDF file.

Commands:

  help        display this help and exit
  dev         start the development server
  build       generate an HTML and PDF file of the resume.
  test        run tests
  serve       start a web server to preview your files

Options:

  --in             path to the resume HTML file used as a template by Webpack.
                   Defaults to Connor's resume
  --build          root build directory for the project. Defaults to "dist/"
  --out            directory to output the built HTML file, relative to the root
                   build directory. Defaults to "."
  --public-url     url or path where the resume's HTML assets will be hosted.
                   Defaults to "/"
  -v,--verbose     enable debug logging
`)
}
