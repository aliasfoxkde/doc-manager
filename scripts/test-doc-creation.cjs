const puppeteer = require('puppeteer');

async function testDocumentCreation() {
  console.log('Testing Doc Manager - Document Creation\n');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  const errors = [];
  
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') errors.push(text);
  });
  
  page.on('pageerror', error => {
    errors.push(error.toString());
  });
  
  try {
    // 1. Load the app
    console.log('1. Loading app...');
    await page.goto('http://192.168.1.201:3002/', { waitUntil: 'networkidle0', timeout: 15000 });
    console.log('   ✓ App loaded');
    
    // 2. Click New Document
    console.log('2. Creating new document...');
    // Navigate directly to /new route
    await page.goto('http://192.168.1.201:3002/new', { waitUntil: 'networkidle0', timeout: 10000 });
    console.log('   ✓ Navigated to new document');
    
    // 3. Check if editor is loaded
    console.log('3. Checking editor...');
    const hasRichTextEditor = await page.$('.rich-text-editor');
    const hasToolbar = await page.$('.toolbar-btn');
    const hasTitleInput = await page.$('.title-input');
    console.log('   Rich Text Editor:', hasRichTextEditor ? '✓' : '✗');
    console.log('   Toolbar:', hasToolbar ? '✓' : '✗');
    console.log('   Title input:', hasTitleInput ? '✓' : '✗');

    // 4. Enter content
    console.log('4. Entering content...');
    await page.type('.title-input', 'Test Document from Puppeteer');
    await new Promise(r => setTimeout(r, 500));

    // Type in the rich text editor
    const editorContent = await page.evaluate(() => {
      const editor = document.querySelector('.ProseMirror');
      if (editor) {
        editor.textContent = '# Test Document\n\nThis is a test.';
        return true;
      }
      return false;
    });
    console.log('   ✓ Content entered');
    
    // 5. Try to save
    console.log('5. Saving document...');
    const saveButton = await page.$('button.btn-primary');
    if (!saveButton) {
      console.log('   ✗ Save button not found');
    } else {
      await saveButton.click();
      await new Promise(r => setTimeout(r, 3000));

      // Check for alert dialogs
      const alertText = await page.evaluate(() => {
        const alert = document.querySelector('.alert, [role="alert"]');
        return alert ? alert.textContent : null;
      });

      if (alertText) {
        console.log('   Alert:', alertText);
      }

      // Check if navigation happened (would indicate successful save)
      const currentUrl = page.url();
      if (currentUrl !== 'http://192.168.1.201:3002/new') {
        console.log('   ✓ Document saved, navigated to: ' + currentUrl);
      } else {
        console.log('   ✗ Still on /new, checking errors...');
      }
    }
    
    // 6. Check for errors
    if (errors.length > 0) {
      console.log('\n   ERRORS:');
      errors.slice(0, 5).forEach(e => console.log('   -', e));
    }
    
  } catch (error) {
    console.error('   ✗ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testDocumentCreation().catch(console.error);
