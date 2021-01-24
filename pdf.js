const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:1234', {waitUntil: 'networkidle2'});
  await page.pdf({path: 'dist/resume.pdf', format: 'A4'});
  await browser.close();
})();
