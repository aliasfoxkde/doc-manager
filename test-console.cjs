#!/usr/bin/env node
/**
 * Console Test Script for Doc Manager
 * Uses Puppeteer to load the page and capture console output/errors
 *
 * Usage: node test-console.cjs [url]
 * Default: http://192.168.1.201:3002/
 */

const puppeteer = require('puppeteer');

async function testConsole(url) {
  const targetUrl = url || 'http://192.168.1.201:3002/';

  console.log('🧪 Testing Doc Manager Console');
  console.log('📍 URL:', targetUrl);
  console.log('');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Track all console messages
  const consoleMessages = {
    log: [],
    warn: [],
    error: [],
    info: [],
    debug: []
  };

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    consoleMessages[type] = consoleMessages[type] || [];
    consoleMessages[type].push(text);

    // Print errors immediately
    if (type === 'error') {
      console.log('❌ [Console Error] ' + text);
    } else if (type === 'warn') {
      console.log('⚠️  [Console Warn] ' + text);
    }
  });

  // Track page errors
  const pageErrors = [];
  page.on('pageerror', error => {
    const errStr = error.toString();
    pageErrors.push(errStr);
    console.log('💥 [Page Error] ' + errStr);
  });

  // Track failed requests
  const failedRequests = [];
  page.on('requestfailed', request => {
    const failure = request.failure();
    if (failure) {
      const reqInfo = request.url() + ': ' + failure.text;
      failedRequests.push(reqInfo);
      console.log('🔴 [Request Failed] ' + reqInfo);
    }
  });

  try {
    console.log('⏳ Loading page...');
    await page.goto(targetUrl, {
      waitUntil: 'networkidle0',
      timeout: 15000
    });

    // Get page info
    const title = await page.title();
    const url = page.url();

    console.log('\n📊 Test Results');
    console.log('═══════════════════════════════════');
    console.log('📍 URL:', url);
    console.log('📄 Title:', title);

    // Check if app rendered
    const rootContent = await page.$eval('#root', el => el.innerHTML).catch(() => '');
    const appRendered = rootContent && rootContent.length > 0;

    console.log('🎨 App Rendered:', appRendered ? '✅ Yes (' + rootContent.length + ' chars)' : '❌ No');

    // Summary
    console.log('\n📋 Console Summary');
    console.log('═══════════════════════════════════');
    console.log('  Errors:   ' + (consoleMessages.error?.length || 0));
    console.log('  Warnings: ' + (consoleMessages.warn?.length || 0));
    console.log('  Logs:     ' + (consoleMessages.log?.length || 0));
    console.log('  Page Err: ' + pageErrors.length);
    console.log('  Fail Req: ' + failedRequests.length);

    // Verdict
    const hasErrors = (consoleMessages.error?.length || 0) > 0 || pageErrors.length > 0;
    console.log('\n' + (hasErrors ? '❌ TEST FAILED' : '✅ TEST PASSED'));

    // Save screenshot
    const screenshotPath = '/tmp/doc-manager-test-' + Date.now() + '.png';
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log('📸 Screenshot: ' + screenshotPath);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Get URL from command line or use default
const url = process.argv[2];
testConsole(url).catch(err => {
  console.error(err);
  process.exit(1);
});
