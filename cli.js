#!/usr/bin/env node

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const serveStatic = require('serve-static');
const finalhandler = require('finalhandler');
const puppeteer = require('puppeteer');
const chokidar = require('chokidar');
const { performance } = require('perf_hooks');
const commands = ["help", "dev", "test", "serve", "build",];
const log = console.log.bind(console);

// TODO i think i need to get rid of bundling entirely, and turn my SASS file
// into a CSS file. any variables can use the new css var feature.
// How would HMR work then? I could write my websocket client/server that triggers
// a refresh whenever a change occurs, or I could just set up webpack and have
// that work. probably the good long term choice.
run.apply(null, parseCliArguments());

function parseCliArguments(argv = process.argv) {
  const args = argv.slice(2);
  const command = args[0];
  const options = {};

  if (!commands.includes(command)) {
    die("ERROR: unknown command %o", command);
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
          die('ERROR: "--in" requires an non-empty argument.');
        }
        break;
      case '--out':
        if (args[1]) {
          options.outdir = args[1];
          args.shift();
        } else {
          die('ERROR: "--out" requires an non-empty argument.');
        }
        break;
      case '--out-file':
        if (args[1]) {
          options.outfile = args[1];
          args.shift();
        } else {
          die('ERROR: "--out-file" requires an non-empty argument.');
        }
        break;
      case '--out-pdf':
        if (args[1]) {
          options.outpdf = args[1];
          args.shift();
        } else {
          die('ERROR: "--out-pdf" requires an non-empty argument.');
        }
        break;
      case '--public-url':
        if (args[1]) {
          options.publicUrl = args[1];
          args.shift();
        } else {
          die('ERROR: "--public-url" requires an non-empty argument.');
        }
        break;
      default:
        console.error("WARN: Uknown option (ignored): %o\n", args[0]);
        break;
    }
  }

  return [command, options];
}


async function run(command, options = {}) {
  const {
    infile = path.join(__dirname, 'src/index.html'),
    outdir = 'dist',
    outfile = 'index.html',
    outpdf = 'resume.pdf',
    publicUrl = '/',
    verbose = 0,
  } = options;

  if (options.verbose > 0) {
    console.log('node version %o', process.version);
    console.log('arguments: %o', { command, infile, outdir, outfile, outpdf, publicUrl, verbose });
  }

  // TODO these if statements should be an object and the includes test will
  // be a test for membership of the command in the commands object.
  if (command === 'help' || !commands.includes(command)) {
    help();
  }
  if (command === "dev") {
    const watcher = chokidar.watch(outputFile);
    watcher.on('change', () => pdf('http://localhost:1234', outputPdf));
    // TODO replace parcel with webpack, or use parcel's JS API
    await spawnWrapper('npx', ['parcel', infile]);
    await watcher.close();
  }
  if (command === "test") {
    die('ERROR: no tests specified');
  }
  if (command === "build") {
    const server = startStaticServer(outdir);
    server.on('listening', async () => {
      await spawnWrapper('npx', [
        'parcel', 'build', infile,
        '--dist-dir', path.join(outdir, path.dirname(outfile)),
        '--cache-dir', path.join(__dirname, '.parcel-cache'),
        '--public-url', publicUrl,
        '--no-cache'
      ]);
      await pdf(`http://localhost:${server.address().port}${publicUrl}`, path.join(outdir, outpdf));
      server.close();
    });
  }
  if (command === "serve") {
    const server = startStaticServer(path.join(__dirname, outdir));
    server.on('listening', () => {
      console.log('listening at %o', server.address());
    });
  }
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

async function pdf(fromUrl = 'http://localhost:1234', toFile = 'dist/resume.pdf') {
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
      if (code === 0) { return resolve(); }
      console.error('Closing %o', { args, code, signal });
      reject();
    });
    proc.on('exit', (code, signal) => {
      if (code === 0) { return resolve(); }
      console.error('Exiting %o', { args, code, signal });
      reject();
    });
    proc.on('error', (err) => {
      console.error('Error %o', error);
      reject();
    });
  });
}

function die(...messages) {
  console.error(...messages);
  process.exit(1);
}

function filename(path) {
  return path.slice(path.lastIndexOf('/') + 1);
}

function help() {
  console.log(`
Usage: ${filename(process.argv[1])} <command> [--in $INFILE] [--out $OUTFILE] [--out-pdf $OUTPDF]

Create a personal resume and publish it as a HTML page and PDF file.

Commands:

help        display this help and exit
dev         start the development server
build       generate an HTML and PDF file of the resume.
test        run tests
serve       start a web server to preview your files

Options:

--in        path to the resume HTML file. Defaults to "src/index.html"
--out       path to output the resume HTML file. Defaults to "dist/index.html"
--out-pdf   path to output the resume PDF file. Defaults to "dist/resume.pdf"
`)
}
