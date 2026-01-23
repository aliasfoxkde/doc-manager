const puppeteer = require('puppeteer');

async function debugLoad() {
  console.log('DEBUGGING DOCUMENT LOAD\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  const allMessages = [];
  
  page.on('console', msg => {
    const text = msg.text();
    allMessages.push({ type: msg.type(), text });
    console.log('[' + msg.type() + '] ' + text);
  });
  
  page.on('pageerror', err => console.error('ERROR:', err.message));
  
  try {
    // Go to a document
    console.log('\n1. Loading document fw-documents-Test2...');
    await page.goto('http://192.168.1.201:3002/documents/fw-documents-Test2', { waitUntil: 'networkidle0', timeout: 15000 });
    
    await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds for everything to load
    
    // Check currentDocument in the store
    const storeState = await page.evaluate(() => {
      // Try to access the store
      const appRoot = document.querySelector('#root');
      return {
        hasContent: !!appRoot,
        innerHTML: appRoot ? appRoot.innerHTML.substring(0, 500) : 'no root',
        title: document.title,
        url: window.location.href
      };
    });
    
    console.log('\n2. Store State:');
    console.log('  URL:', storeState.url);
    console.log('  Has content:', storeState.hasContent);
    console.log('  Title:', storeState.title);
    
    // Check ProseMirror
    const proseMirror = await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror');
      if (!pm) return { exists: false };
      return {
        exists: true,
        content: pm.textContent,
        innerHTML: pm.innerHTML.substring(0, 300)
      };
    });
    
    console.log('\n3. ProseMirror:');
    console.log('  Exists:', proseMirror.exists);
    console.log('  Content length:', proseMirror.content.length);
    console.log('  Content preview:', proseMirror.content.substring(0, 50));
    
    // Check toolbar
    const toolbar = await page.evaluate(() => {
      const buttons = document.querySelectorAll('.toolbar-btn');
      return {
        count: buttons.length,
        buttons: Array.from(buttons).map(b => b.textContent).slice(0, 5)
      };
    });
    console.log('\n4. Toolbar:');
    console.log('  Buttons count:', toolbar.count);
    console.log('  First buttons:', toolbar.buttons.join(', '));
    
  } catch (error) {
    console.error('FAILED:', error.message);
  } finally {
    console.log('\nWaiting 10 seconds before closing (manual inspection)...');
    await new Promise(r => setTimeout(r, 10000));
    await browser.close();
  }
}

debugLoad().catch(console.error);
