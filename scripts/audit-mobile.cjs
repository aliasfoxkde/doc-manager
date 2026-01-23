const puppeteer = require('puppeteer');

async function auditMobile() {
  console.log('MOBILE AUDIT - Doc Manager\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // Mobile viewport
  const mobile = {
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  };

  const page = await browser.newPage();
  await page.emulate(mobile);

  // Capture all console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text()
    });
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error('[PAGE ERROR]', err.message);
  });

  // Capture network requests
  const networkRequests = [];
  page.on('request', req => {
    networkRequests.push({ url: req.url(), method: req.method() });
  });

  page.on('response', res => {
    const url = res.url();
    if (res.status() >= 400) {
      console.error(`[HTTP ${res.status()}] ${url}`);
    }
  });

  try {
    console.log('1. Loading page on mobile viewport...');
    await page.goto('http://192.168.1.201:3002/', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    console.log('\n2. Waiting for app to initialize...');
    await new Promise(r => setTimeout(r, 5000));

    // Check page state
    const pageState = await page.evaluate(() => {
      const root = document.querySelector('#root');
      return {
        hasRoot: !!root,
        rootHTML: root ? root.innerHTML.substring(0, 500) : 'no root',
        rootChildren: root ? root.children.length : 0,
        bodyClass: document.body.className,
        title: document.title
      };
    });

    console.log('\n3. Page State:');
    console.log('   Title:', pageState.title);
    console.log('   Has #root:', pageState.hasRoot);
    console.log('   Body class:', pageState.bodyClass);
    console.log('   Root children:', pageState.rootChildren);
    console.log('   Root HTML preview:', pageState.rootHTML.substring(0, 200));

    // Check for React app
    const reactCheck = await page.evaluate(() => {
      // Check if React is loaded
      const hasReact = typeof window.React !== 'undefined' ||
                      document.querySelector('[data-reactroot]') !== null;

      // Check for common loading indicators
      const loading = document.querySelector('.loading, .spinner, [class*="loading"]');
      const error = document.querySelector('.error, [class*="error"]');

      return {
        hasReact,
        hasLoadingIndicator: !!loading,
        hasErrorElement: !!error,
        loadingText: loading ? loading.textContent : null,
        errorText: error ? error.textContent : null
      };
    });

    console.log('\n4. React Check:');
    console.log('   Has React:', reactCheck.hasReact);
    console.log('   Has loading indicator:', reactCheck.hasLoadingIndicator);
    console.log('   Has error element:', reactCheck.hasErrorElement);

    // Take screenshot
    console.log('\n5. Taking screenshot...');
    await page.screenshot({
      path: '/tmp/doc-manager-mobile-audit.png',
      fullPage: true
    });
    console.log('   Screenshot saved to: /tmp/doc-manager-mobile-audit.png');

    // Check computed styles
    const styles = await page.evaluate(() => {
      const root = document.querySelector('#root');
      if (!root) return { error: 'No root element' };

      const computed = window.getComputedStyle(root);
      return {
        display: computed.display,
        height: computed.height,
        backgroundColor: computed.backgroundColor,
        color: computed.color
      };
    });

    console.log('\n6. Root Styles:');
    console.log('   ', JSON.stringify(styles, null, 2));

    // Check for script errors
    console.log('\n7. Console Summary:');
    const errors = consoleMessages.filter(m => m.type === 'error');
    const warnings = consoleMessages.filter(m => m.type === 'warning');
    console.log(`   Errors: ${errors.length}`);
    console.log(`   Warnings: ${warnings.length}`);

    if (errors.length > 0) {
      console.log('\n   Error Messages:');
      errors.slice(0, 5).forEach(e => console.log(`     - ${e.text}`));
    }

    console.log('\n8. Network Requests:');
    console.log(`   Total requests: ${networkRequests.length}`);
    const failedRequests = networkRequests.filter(r =>
      r.url.includes('assets') && !r.url.includes('favicon')
    );
    console.log(`   Asset requests: ${failedRequests.length}`);
    failedRequests.slice(0, 5).forEach(r => console.log(`     - ${r.url.split('/').pop()}`));

  } catch (error) {
    console.error('\n[AUDIT FAILED]', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

auditMobile().catch(console.error);
