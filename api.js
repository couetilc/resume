const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const serveStatic = require('serve-static');
const finalhandler = require('finalhandler');
const puppeteer = require('puppeteer');
const chokidar = require('chokidar');
const { performance } = require('perf_hooks');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const WebpackDevServer = require('webpack-dev-server');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const log = console.log.bind(console); // eslint-disable-line no-console
const error = console.error.bind(console); // eslint-disable-line no-console
const warn = console.warn.bind(console); // eslint-disable-line no-console
let VERBOSE = false;
const PORT = 61000;
const HOST = 'localhost';

const commands = {
  dev({ infile, outdir, outhtml, outpdf,  }) {
    const config = getWebpackConfig({
      mode: 'development', infile, outdir, outhtml, outpdf,
    });
    const compiler = webpack(config);
    const devServer = new WebpackDevServer(compiler, config.devServer);
    const fileWatcher = chokidar.watch(path.join(outdir, outhtml, 'index.html'));
    fileWatcher.on('change', () => pdf({
      fromUrl: `http://${config.devServer.host}:${config.devServer.port}`,
      toFile: path.join(outdir, outpdf)
    }));
    devServer.listen(config.devServer.port, config.devServer.host);
  },
  test() {
    spawnWrapper('npx', ['eslint', '.'])
      .catch(() => {
        throw new Error("ERROR: tests failed")
      });
  },
  build({ infile, outdir, outhtml, outpdf, publicUrl }) {
    const compiler = webpack(
      getWebpackConfig({ infile, outdir, outhtml, outpdf, publicUrl })
    );
    compiler.run((err, stats) => {
      if (handleWebpackCompileErrors(err, stats)) return;
      const server = startStaticServer(outdir);
      server.on('listening', async () => {
        try {
          await pdf({
            fromUrl: `http://localhost:${server.address().port}${publicUrl}`,
            toFile: path.join(outdir, outpdf)
          });
        } catch (e) {
          error(e);
        } finally {
          server.close();
        }
      });
    });
  },
  serve({ outdir }) {
    const server = startStaticServer(path.join(__dirname, outdir), PORT, HOST);
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

  if (options.verbose) VERBOSE = true;

  if (VERBOSE) {
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

function startStaticServer(dir, port = PORT, host = HOST) {
  const serve = serveStatic(dir);
  const server = http.createServer((req, res) => {
    serve(req, res, finalhandler(req, res));
  });
  server.listen(port, host);
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
        if (VERBOSE) error({ code, signal, args });
        resolve();
      } else {
        reject(signal);
      }
    });
    proc.on('exit', (code, signal) => {
      if (code === 0) {
        if (VERBOSE) error({ code, signal, args });
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

function handleWebpackCompileErrors(err, stats) {
  if (err) {
    error(err.stack || err);
    if (err.details) {
      error(err.details);
    }
    return true;
  }
  const info = stats.toJson();
  if (VERBOSE) log(info);
  if (stats.hasErrors()) {
    error(info.errors);
  }
  if (stats.hasWarnings()) {
    warn(info.warnings);
  }
  return false;
}

function getWebpackConfig({
  mode = 'production', infile, outdir, outhtml, outpdf, publicUrl
}) {
  // TODO what ot do with outpdf and publicUrl?
  return {
    entry: path.join(path.dirname(infile), 'index.js'),
    mode,
    output: {
      path: path.resolve(__dirname, outdir),
      filename: 'index.js',
    },
    module: {
      rules: [
        {
          test: /\.s[ac]ss$/ui,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader',
            'sass-loader'
          ]
        },
        {
          test: /\.(png|jpe?g|gif|webp|svg)$/ui, // eslint-disable-line prefer-named-capture-group
          use: [
            'file-loader',
            'image-webpack-loader'
          ],
        },
      ]
    },
    plugins: [
      new MiniCssExtractPlugin(),
      new HtmlWebpackPlugin({
        filename: /\.html$/iu.test(outhtml) ? outhtml : path.join(outhtml, 'index.html'), // TODO test?
        template: infile,
        inject: true,
      })
    ],
    stats: 'verbose',
    devServer: {
      open: true,
      host: HOST,
      port: PORT,
      writeToDisk: file => /index.html/ui.test(file),
      useLocalIp: false,
      contentBase: outdir,
    }
  };
}

run.COMMANDS = Object.keys(commands);
module.exports = run;
