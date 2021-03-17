const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const serveStatic = require('serve-static');
const finalhandler = require('finalhandler');
const puppeteer = require('puppeteer');
const chokidar = require('chokidar');
const { performance } = require('perf_hooks');

const log = console.log.bind(console); // eslint-disable-line no-console
const error = console.error.bind(console); // eslint-disable-line no-console

const commands = {
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
      .catch(() => {
        throw new Error("ERROR: tests failed")
      });
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

run.COMMANDS = Object.keys(commands);
module.exports = run;
