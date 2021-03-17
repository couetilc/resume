#!/usr/bin/env node

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const serveStatic = require('serve-static');
const finalhandler = require('finalhandler');
const puppeteer = require('puppeteer');
const chokidar = require('chokidar');
const { performance } = require('perf_hooks');
const chalk = require('chalk');
const log = console.log.bind(console); // eslint-disable-line no-console
const error = console.error.bind(console); // eslint-disable-line no-console
const warn = console.warn.bind(console); // eslint-disable-line no-console
const ul = chalk.underline;

const commands = {
  help() {
    help();
  },
  async dev({ infile, outdir, outhtml, outpdf,  }) {
    const watcher = chokidar.watch(path.join(outdir, outhtml, 'index.html'));
    watcher.on('change', () => pdf({
      fromUrl: 'http://localhost:1234',
      toFile: path.join(outdir, outpdf)
    }));
    await spawnWrapper('npx', ['parcel', infile]);
    await watcher.close();
  },
  test() {
    spawnWrapper('npx', ['eslint', '.'])
      .catch(() => die("ERROR: tests failed"));
  },
  build({ infile, outdir, outhtml, outpdf, publicUrl }) {
    const server = startStaticServer(outdir);
    server.on('listening', async () => {
      await spawnWrapper('npx', [
        'parcel', 'build', infile,
        '--dist-dir', path.join(outdir, outhtml),
        '--cache-dir', path.join(__dirname, '.parcel-cache'),
        '--public-url', publicUrl,
        '--no-cache'
      ]);
      await pdf({
        fromUrl: `http://localhost:${server.address().port}${publicUrl}`,
        toFile: path.join(outdir, outpdf)
      });
      server.close();
    });
  },
  serve({ outdir }) {
    const server = startStaticServer(path.join(__dirname, outdir));
    server.on('listening', () => {
      log('listening at %o', server.address());
    });
  }
}

run.apply(null, parseCliArguments());

function parseCliArguments(argv = process.argv) {
  const args = argv.slice(2);
  const command = args[0];
  const options = {};

  if (!Object.keys(commands).includes(command)) {
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


function run(command, options = {}) {
  const {
    infile = path.join(__dirname, 'src/index.html'),
    outdir = 'dist',
    outhtml = '.',
    outpdf = 'resume.pdf',
    publicUrl = '/',
    verbose = 0,
  } = options;

  if (options.verbose > 0) {
    log('node version %o', process.version);
    log('arguments: %o', { command, infile, outdir, outhtml, outpdf, publicUrl, verbose });
  }

  return commands[command]({ infile, outdir, outhtml, outpdf, publicUrl, verbose });
}

class Timer {
  constructor() {
    this.milliseconds = null;
    this.seconds = null;
  }
  start() {
    this.milliseconds = performance.now();
    this.seconds = (this.milliseconds / 1000).toFixed(3);
  }
  end() {
    this.milliseconds = performance.now() - this.milliseconds;
    this.seconds = (this.milliseconds / 1000).toFixed(3);
  }
  reset() {
    this.milliseconds = null;
    this.seconds = null;
  }
}

async function pdf({ fromUrl, toFile }) {
  const timer = new Timer();
  log('🖨️  creating pdf from %o', fromUrl);
  timer.start();
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(fromUrl, {waitUntil: 'networkidle2'});
  await page.pdf({path: toFile, format: 'A4'});
  await browser.close();
  timer.end();
  log('🖨️  %o created in %o', toFile, timer.seconds + 's');
}

function startStaticServer(dir, port = 0) {
  const serve = serveStatic(dir);
  const server = http.createServer((req, res) => {
    serve(req, res, finalhandler(req, res));
  });
  server.listen(port);
  return server;
}

function spawnWrapper(...args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(...args);
    proc.stdout.on('data', data => {
      process.stdout.write(data.toString());
    });
    proc.stderr.on('data', data => {
      process.stderr.write(data.toString());
    });
    proc.on('close', (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(signal);
      }
    });
    proc.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(signal);
      }
    });
    proc.on('error', (err) => {
      error('Error %o', err);
      reject(err);
    });
  });
}

function die(...messages) {
  error(...messages);
  process.exit(1);
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
