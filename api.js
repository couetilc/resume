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
const { spawn } = require('child_process');

const log = console.log.bind(console); // eslint-disable-line no-console
const error = console.error.bind(console); // eslint-disable-line no-console
const warn = console.warn.bind(console); // eslint-disable-line no-console
let VERBOSE = false;
const PORT = 61000;
const HOST = '0.0.0.0';

const commands = {
  dev({ inFile, buildDir, outDir, }) {
    const config = getWebpackConfig({
      mode: 'development', inFile, buildDir, outDir,
    });
    const compiler = webpack(config);
    const devServer = new WebpackDevServer(compiler, config.devServer);
    const fileWatcher = chokidar.watch(path.join(buildDir, outDir, 'index.html'));
    fileWatcher.on('change', () => pdf({
      fromUrl: `http://${config.devServer.host}:${config.devServer.port}`,
      toFile: path.join(buildDir, outDir, 'resume.pdf')
    }));
    devServer.listen(config.devServer.port, config.devServer.host);
  },
  test() {
    const proc = spawn('npx', ['cc-lint', '.'], { stdio: ['inherit', 'inherit', 'inherit'] });
    proc.on('close', code => process.exit(code));
    proc.on('error', err => err && console.error(err)); // eslint-disable-line no-console
  },
  build({ inFile, buildDir, outDir, publicUrl }) {
    const compiler = webpack(
      getWebpackConfig({ inFile, buildDir, outDir, publicUrl })
    );
    compiler.run((err, stats) => {
      if (handleWebpackCompileErrors(err, stats)) {
        process.exitCode = 1;
        return;
      }
      const server = startStaticServer(buildDir);
      server.on('listening', async () => {
        try {
          await pdf({
            fromUrl: `http://localhost:${server.address().port}${publicUrl}`,
            toFile: path.join(buildDir, outDir, 'resume.pdf')
          });
        } catch (e) {
          error(e);
          process.exitCode = 1;
        } finally {
          server.close();
        }
      });
    });
  },
  serve({ buildDir }) {
    const server = startStaticServer(path.join(__dirname, buildDir), PORT, HOST);
    server.on('listening', () => {
      log('listening at %o', server.address());
    });
  }
}

function run(command, options = {}) {
  const {
    inFile = path.join(__dirname, 'src/index.html'),
    buildDir = 'dist',
    outDir = '.',
    publicUrl = '/',
    verbose = 0,
  } = options;

  if (options.verbose) VERBOSE = true;

  if (VERBOSE) {
    log('node version %o', process.version);
    log('arguments: %o', { command, inFile, buildDir, outDir, publicUrl, verbose });
  }

  return commands[command]({ inFile, buildDir, outDir, publicUrl, verbose });
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
  let browser;
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });
    const page = await browser.newPage();
    await page.goto(fromUrl, {waitUntil: 'networkidle2'});
    await page.pdf({path: toFile, format: 'A4'});
    await browser.close();
  } catch (carried) {
    await browser.close();
    throw carried;
  }
  timer.end();
  log('🖨️  %o created in %o', toFile, timer.seconds + 's');
}

function startStaticServer(dir, port, host) {
  const serve = serveStatic(dir);
  const server = http.createServer((req, res) => {
    serve(req, res, finalhandler(req, res));
  });
  server.listen(port, host);
  return server;
}

function handleWebpackCompileErrors(err, stats) {
  if (err) {
    error(err.stack || err);
    if (err.details) {
      error(err.details);
    }
    return true;
  }
  const { errors, warnings, ...info } = stats.toJson();
  if (VERBOSE) log(info);
  if (stats.hasErrors()) {
    error(errors);
    return true;
  }
  if (stats.hasWarnings()) {
    warn(warnings);
  }
  return false;
}

function getWebpackConfig({
  mode = 'production', inFile, buildDir, outDir, publicUrl
}) {
  return {
    entry: path.join(path.dirname(inFile), 'index.js'),
    mode,
    output: {
      path: path.resolve(buildDir, outDir),
      filename: 'index.js',
      publicPath: publicUrl,
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
          test: /\.(png|jpe?g|gif|webp|svg)$/ui,
          use: [
            'file-loader',
            {
              loader: 'image-webpack-loader',
              options: {
                disable: true,
	      }
            }
          ],
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/ui,
          type: 'asset/resource',
        },
      ]
    },
    plugins: [
      new MiniCssExtractPlugin(),
      new HtmlWebpackPlugin({
        filename: 'index.html',
        template: inFile,
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
      contentBase: buildDir,
      watchContentBase: false,
    },
    optimization: {
      minimize: false,
    }
  };
}

run.COMMANDS = Object.keys(commands);
module.exports = run;
