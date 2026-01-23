const puppeteer = require('puppeteer');

async function testSave() {
  console.log('TESTING SAVE FUNCTIONALITY\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Track console messages
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('save') || text.includes('Save') || text.includes('error') || text.includes('Error')) {
      console.log('[CONSOLE]', msg.type(), text);
    }
  });

  page.on('pageerror', err => console.error('[PAGE ERROR]', err.message));

  // Track network requests
  const apiCalls = [];
  page.on('request', req => {
    const url = req.url();
    if (url.includes('/api/')) {
      apiCalls.push({ method: req.method(), url, type: 'request' });
    }
  });

  page.on('response', res => {
    const url = res.url();
    if (url.includes('/api/')) {
      apiCalls.push({ status: res.status(), url, type: 'response' });
    }
  });

  try {
    console.log('1. Loading document...');
    await page.goto('http://192.168.1.201:3002/documents/fw-documents-Test2', {
      waitUntil: 'networkidle0',
      timeout: 20000
    });

    console.log('2. Waiting for editor to load...');
    await new Promise(r => setTimeout(r, 3000));

    // Get initial content
    const initialContent = await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror');
      return pm ? pm.innerHTML : 'no editor';
    });
    console.log('   Initial content:', initialContent);

    // Click on ProseMirror to focus it
    console.log('\n3. Focusing editor...');
    await page.click('.ProseMirror');
    await new Promise(r => setTimeout(r, 500));

    // Clear existing content and type new content
    console.log('4. Editing content...');
    // Select all and delete using keyboard
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await new Promise(r => setTimeout(r, 200));

    // Type new content
    await page.type('.ProseMirror', 'This is updated content from the web interface.', { delay: 50 });
    await new Promise(r => setTimeout(r, 1000));

    // Get updated content
    const updatedContent = await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror');
      return pm ? pm.innerHTML : 'no editor';
    });
    console.log('   Updated content:', updatedContent);

    // Click Save button
    console.log('\n5. Clicking Save button...');
    const saveButton = await page.$('.btn-primary');
    if (!saveButton) {
      throw new Error('Save button not found');
    }
    await saveButton.click();

    // Wait for save to complete
    console.log('6. Waiting for save to complete...');
    await new Promise(r => setTimeout(r, 2000));

    // Handle alert dialog
    try {
      await page.waitForSelector('dialog, .alert, [role="alert"]', { timeout: 1000 });
      const alertText = await page.evaluate(() => {
        const dialog = document.querySelector('dialog');
        const alert = document.querySelector('.alert');
        const roleAlert = document.querySelector('[role="alert"]');
        return dialog?.textContent || alert?.textContent || roleAlert?.textContent || 'No alert text';
      });
      console.log('   Alert:', alertText);

      // Click OK on the alert if there's a button
      const okButton = await page.$('button');
      if (okButton) {
        await okButton.click();
      }
    } catch {
      console.log('   No alert dialog (might have used window.alert)');
    }

    // Check IndexedDB for updated content
    console.log('\n7. Checking IndexedDB for saved content...');
    const idbData = await page.evaluate(async () => {
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

      return {
        content: doc ? doc.content : 'no document',
        contentLength: doc ? doc.content.length : 0
      };
    });

    console.log('   Saved content:', idbData.content);
    console.log('   Content length:', idbData.contentLength);

    // Check if file was saved via file watcher
    console.log('\n8. Checking if file was saved to disk...');
    const { execSync } = require('child_process');
    try {
      const fileContent = execSync('cat docs/documents/Test2.md').toString();
      console.log('   File content on disk:', fileContent.trim());
    } catch (error) {
      console.log('   Could not read file from disk:', error.message);
    }

    // Check API calls
    console.log('\n9. API calls made during save:');
    const saveApiCalls = apiCalls.filter(call =>
      call.url.includes('/api/') && (
        call.method === 'PUT' ||
        call.url.includes('files')
      )
    );
    saveApiCalls.forEach(call => {
      console.log(`   ${call.type.toUpperCase()}: ${call.method || call.status} ${call.url}`);
    });

    // Verify results
    console.log('\n10. RESULTS:');
    const success = idbData.content.includes('updated content');
    console.log('   ✓ Content loaded:', initialContent !== 'no editor');
    console.log('   ✓ Content edited:', updatedContent.includes('updated content'));
    console.log('   ✓ Content saved to IndexedDB:', success);
    console.log('   ✓ API calls made:', saveApiCalls.length > 0);

    if (success) {
      console.log('\n✅ SAVE FUNCTIONALITY WORKING!');
    } else {
      console.log('\n❌ SAVE FUNCTIONALITY NOT WORKING - Content not saved to IndexedDB');
    }

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

testSave().catch(console.error);
