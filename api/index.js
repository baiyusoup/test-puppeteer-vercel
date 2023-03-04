const chromeAwsLambda = require("chrome-aws-lambda");
const puppeteer = require('puppeteer-core');
const compression = require('compression');
const minifier = require('html-minifier').minify;
const app = require('express')();
app.use(compression);

const disabledResourceType = [
  ["stylesheet", true],
  ["image",true],
  ["media",true],
  ["font",true],
  ["manifest",true],
];
const disabledMap = new Map(disabledResourceType);

const LOCAL_CHROME_EXECUTABLE = process.platform === "win32"
  ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
  : "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const USER_DATA_DIR = "./node_modules/.remCache";
const DEFAULT_TIMEOUT = 4000;

const isServeless = !!process.env.FUNCTION_NAME;

let browser = null;
(async () => {
  const options = {
    args: chromeAwsLambda.args,
    executablePath: isServeless ? await chromeAwsLambda.executablePath : LOCAL_CHROME_EXECUTABLE,
    headless: isServeless ? chromeAwsLambda.headless : true,
    userDataDir: USER_DATA_DIR
  }
  browser = await puppeteer.launch(options);
  browser.on("disconnected", () => {
    browser = null;
  });
  // const context = await browser.createIncognitoBrowserContext();
  // for(let i = 0; i < 10; i++) {
  //   const page = await context.newPage();
  //   page.setDefaultTimeout(DEFAULT_TIMEOUT);
  //   pageTools.push(page);
  // }
})();

app.get('/api', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.end(`<h1>Hello!</h1>`);
});

app.get('/api/html', async (req, res) => {
  const url = req.query.t;
  const wait = req.query.wait;
  console.log(req.url);
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (interceptionReq) => {
    if (interceptionReq._interceptionHandled) return;
    if (disabledMap.has(interceptionReq.resourceType())) {
      interceptionReq.abort();
    } else {
      interceptionReq.continue();
    }
  })
  await page.goto(url);
  if (wait) {
    await page.waitForSelector(wait, { visible: true });
  }
  const html = await page.evaluate(() => document.body.innerHTML);
  page.close();
  res.end(minifier(html, { removeTagWhitespace: true, removeComments: true }));
});

module.exports = app;