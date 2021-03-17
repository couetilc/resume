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

  if (command === 'help' || !run.COMMANDS.includes(command)) {
    dieWithHelp("ERROR: unknown command %o", command);
  }

  for (args.shift(); args.length > 0; args.shift()) {
    switch (args[0]) {
      case '-v':
      case '--verbose':
        options.verbose = 1;
        break;
      case '--in':
        if (args[1]) {
          options.infile = args[1];
          args.shift();
        } else {
          dieWithHelp('ERROR: "--in" requires an non-empty argument.');
        }
        break;
      case '--out':
        if (args[1]) {
          options.outdir = args[1];
          args.shift();
        } else {
          dieWithHelp('ERROR: "--out" requires an non-empty argument.');
        }
        break;
      case '--out-html':
        if (args[1]) {
          options.outhtml = args[1];
          args.shift();
        } else {
          dieWithHelp('ERROR: "--out-html" requires an non-empty argument.');
        }
        break;
      case '--out-pdf':
        if (args[1]) {
          options.outpdf = args[1];
          args.shift();
        } else {
          dieWithHelp('ERROR: "--out-pdf" requires an non-empty argument.');
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

function dieWithHelp(...messages) {
  error(...messages);
  help()
  process.exit(1);
}

function filename(path) {
  return path.slice(path.lastIndexOf('/') + 1);
}

function help() {
  log(`
Usage:

  ${filename(process.argv[1])} <command> [--in ${ul('input-html-file')}] [--out ${ul('root-build-directory')}] [--out-html ${ul('output-html-directory')}] [--out-pdf ${ul('output-pdf-file')}] [--public-url ${ul('url')}] [--verbose]

Description:

  Create a personal resume and publish it as a HTML page and PDF file.

Commands:

  help        display this help and exit
  dev         start the development server
  build       generate an HTML and PDF file of the resume.
  test        run tests
  serve       start a web server to preview your files

Options:

  --in          path to the resume HTML file. Defaults to Connor's resume
  --out         root build directory for the project. Defaults to "dist/"
  --out-html    directory to output the built HTML file, relative to the root
                build directory. Defaults to "."
  --out-pdf     path to output the resume PDF file, relative to the root build
                directory. Defaults to "resume.pdf"
  --public-url  path where the resume's HTML assets will be hosted.
  --verbose     enable debug logging
`)
}
