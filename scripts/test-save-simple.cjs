const puppeteer = require('puppeteer');

async function testSaveSimple() {
  console.log('SIMPLE SAVE TEST\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Handle dialogs/alerts automatically
  page.on('dialog', async dialog => {
    console.log('   [DIALOG]', dialog.message());
    await dialog.accept();
  });

  page.on('console', msg => {
    if (msg.text().includes('error') || msg.text().includes('Error') || msg.text().includes('saved')) {
      console.log('[CONSOLE]', msg.type(), msg.text());
    }
  });

  try {
    console.log('1. Loading document...');
    await page.goto('http://192.168.1.201:3002/documents/fw-documents-Test2', {
      waitUntil: 'networkidle0',
      timeout: 20000
    });
    await new Promise(r => setTimeout(r, 5000));

    // Wait for ProseMirror to appear
    await page.waitForSelector('.ProseMirror', { timeout: 5000 }).catch(() => {
      console.log('   Warning: ProseMirror not found after 5s');
    });

    console.log('2. Editing content...');
    await page.click('.ProseMirror');
    await new Promise(r => setTimeout(r, 500));

    // Select all, delete, type new content
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await new Promise(r => setTimeout(r, 200));
    await page.type('.ProseMirror', 'SIMPLE TEST: New content saved at ' + new Date().toISOString(), { delay: 50 });
    await new Promise(r => setTimeout(r, 1000));

    console.log('3. Clicking Save button...');
    // Click the Save button (not Save Local) - look for exact match
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      // Find button that contains "💾 Save" but NOT "Save Local"
      const saveBtn = buttons.find(b =>
        b.textContent.includes('💾') &&
        b.textContent.includes('Save') &&
        !b.textContent.includes('Save Local')
      );
      if (saveBtn) {
        saveBtn.click();
        console.log('   Clicked button:', saveBtn.textContent.trim());
      } else {
        console.log('   ERROR: Save button not found!');
      }
    });
    await new Promise(r => setTimeout(r, 2000));

    console.log('4. Checking IndexedDB...');
    const savedContent = await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('doc-manager', 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = db.transaction('documents', 'readonly');
      const store = tx.objectStore('documents');
      const doc = await new Promise((resolve, reject) => {
        const req = store.get('fw-documents-Test2');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return doc ? doc.content : null;
    });

    console.log('5. RESULT:');
    console.log('   Saved content:', savedContent);

    if (savedContent && savedContent.includes('SIMPLE TEST')) {
      console.log('\n✅ SAVE SUCCESSFUL!');
    } else {
      console.log('\n❌ SAVE FAILED!');
      console.log('   Expected content with "SIMPLE TEST"');
      console.log('   Actual:', savedContent);
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  } finally {
    await browser.close();
  }
}

testSaveSimple().catch(console.error);
