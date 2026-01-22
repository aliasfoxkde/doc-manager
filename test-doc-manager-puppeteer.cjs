const puppeteer = require('puppeteer');

async function testConsole() {
  console.log('Launching headless browser to test Doc Manager...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Capture console messages
  const consoleMessages = [];
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    consoleMessages.push({ type, text });
    if (type === 'error') {
      console.log('[Browser Console Error] ' + text);
    }
  });

  // Capture page errors
  const pageErrors = [];
  page.on('pageerror', error => {
    const errStr = error.toString();
    pageErrors.push(errStr);
    console.log('[Browser Page Error] ' + errStr);
  });

  // Also capture request failures
  page.on('requestfailed', request => {
    const failure = request.failure();
    if (failure) {
      console.log('[Request Failed] ' + request.url() + ': ' + failure.text);
    }
  });

  try {
    console.log('Loading page: http://192.168.1.201:3002/');
    await page.goto('http://192.168.1.201:3002/', {
      waitUntil: 'networkidle0',
      timeout: 15000
    });

    console.log('\n=== Console Messages ===');
    if (consoleMessages.length === 0) {
      console.log('No console messages');
    } else {
      consoleMessages.forEach(msg => {
        console.log('[' + msg.type + '] ' + msg.text);
      });
    }

    console.log('\n=== Page Errors ===');
    if (pageErrors.length === 0) {
      console.log('✓ No page errors!');
    } else {
      pageErrors.forEach(err => console.log(err));
    }

    console.log('\n=== Page Title ===');
    const title = await page.title();
    console.log(title);

    console.log('\n=== Checking if app rendered ===');
    const rootContent = await page.$eval('#root', el => el.innerHTML);
    if (rootContent && rootContent.length > 0) {
      console.log('✓ App rendered! Root has ' + rootContent.length + ' characters of HTML');
    } else {
      console.log('✗ Root div is empty - app did not render');
    }

    // Take a screenshot for debugging
    await page.screenshot({ path: '/tmp/doc-manager-screenshot.png' });
    console.log('\nScreenshot saved to: /tmp/doc-manager-screenshot.png');

  } catch (error) {
    console.error('\n✗ Test failed: ' + error.message);
  } finally {
    await browser.close();
  }
}

testConsole().catch(console.error);
