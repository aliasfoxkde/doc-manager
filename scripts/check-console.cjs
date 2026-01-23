const puppeteer = require('puppeteer');

async function checkConsole() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  const messages = [];
  
  page.on('console', msg => messages.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => messages.push({ type: 'error', text: err.toString() }));
  
  try {
    // Load a document that should have content
    await page.goto('http://192.168.1.201:3002/documents/fw-documents-Test2', { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('Console messages:');
    if (messages.length === 0) {
      console.log('  (no console messages)');
    } else {
      messages.forEach(m => {
        console.log('  [' + m.type + '] ' + m.text);
      });
    }
    
    // Check ProseMirror content
    const proseMirror = await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror');
      if (!pm) return 'ProseMirror not found';
      return {
        exists: true,
        content: pm.textContent,
        innerHTML: pm.innerHTML.substring(0, 200)
      };
    });
    console.log('\nProseMirror:', proseMirror);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

checkConsole();
