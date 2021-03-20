# Connor Couetil's résumé

My résumé, built using open web technologies. It is styled with
[SASS](https://sass-lang.com/) and uses [Webpack](https://webpack.js.org/) to
compile all assets for releases.  [Puppeteer](https://pptr.dev/) is then loaded
to render the resume from HTML to PDF.

## Installation

```
npm install cc-resume
```

You can use it for your own résumé using the CLI tool, see the [Usage](#Usage)
section below, or run `npx cc-resume help`. Provide a path to a HTML file to
use as a template, and link to an `index.js` file in the same directory using a
script tag that will `require` all your webpage's assets.

This package can also be used programmatically with the same API as the CLI tool:

```
const resume = require('cc-resume');
resume('build', { inFile, buildDir, outDir, publicUrl, verbose });
```

## Usage

```
Usage:

  cc-resume <command> [--in input-html-file] [--build root-build-directory] [--out output-html-directory] [--public-url url-or-path] [-v|--verbose]

Description:

  Create a personal resume and publish it as a HTML page and PDF file.

Commands:

  help        display this help and exit
  dev         start the development server
  build       generate an HTML and PDF file of the resume.
  test        run tests
  serve       start a web server to preview your files

Options:

  --in             Path to the resume HTML file used as a template by Webpack.
                   Defaults to Connor's resume.
  --build          Root build directory for the project. Defaults to "dist/"
  --out            Directory to output the built HTML/CSS/JS/IMG/PDF files,
                   relative to the root build directory. Defaults to ".".
  --public-url     URL or path where the resume's HTML/CSS/JS/IMG/PDF assets
                   will be hosted. Defaults to "/".
  -v,--verbose     Enable debug logging.
```
