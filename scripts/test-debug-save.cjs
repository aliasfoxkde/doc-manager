const puppeteer = require('puppeteer');

async function debugSave() {
  console.log('DEBUGGING SAVE FUNCTIONALITY\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Capture ALL console messages
  page.on('console', msg => {
    console.log('[CONSOLE]', msg.type(), msg.text());
  });

  page.on('pageerror', err => console.error('[ERROR]', err.message));

  try {
    console.log('1. Loading document...');
    await page.goto('http://192.168.1.201:3002/documents/fw-documents-Test2', {
      waitUntil: 'networkidle0',
      timeout: 20000
    });

    console.log('\n2. Waiting for app to initialize...');
    await new Promise(r => setTimeout(r, 3000));

    // Check initial state
    console.log('\n3. Checking initial editor state...');
    const initialState = await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror');
      const titleInput = document.querySelector('.title-input');
      return {
        title: titleInput?.value || 'no title',
        editorHTML: pm?.innerHTML || 'no editor',
        editorText: pm?.textContent || 'no editor'
      };
    });
    console.log('   Title:', initialState.title);
    console.log('   Editor HTML:', initialState.editorHTML);
    console.log('   Editor Text:', initialState.editorText);

    // Focus and click the editor
    console.log('\n4. Focusing editor...');
    await page.click('.ProseMirror');
    await new Promise(r => setTimeout(r, 500));

    // Select all and delete
    console.log('\n5. Clearing content (Ctrl+A, Backspace)...');
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await new Promise(r => setTimeout(r, 100));
    await page.keyboard.press('Backspace');
    await new Promise(r => setTimeout(r, 500));

    // Type new content
    console.log('\n6. Typing new content...');
    await page.type('.ProseMirror', 'UPDATED: This is new content', { delay: 50 });
    await new Promise(r => setTimeout(r, 1000));

    // Check state after editing
    console.log('\n7. Checking state after editing...');
    const editedState = await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror');
      return {
        editorHTML: pm?.innerHTML || 'no editor',
        editorText: pm?.textContent || 'no editor'
      };
    });
    console.log('   Editor HTML:', editedState.editorHTML);
    console.log('   Editor Text:', editedState.editorText);

    // Check for unsaved indicator
    console.log('\n8. Checking for unsaved indicator...');
    const hasUnsaved = await page.evaluate(() => {
      const indicator = document.querySelector('.unsaved-indicator');
      return indicator ? indicator.textContent : 'no indicator';
    });
    console.log('   Unsaved indicator:', hasUnsaved);

    // Click Save button
    console.log('\n9. Finding Save button...');
    const allButtons = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.btn-primary, button'));
      return buttons.map(btn => ({
        text: btn.textContent.trim(),
        class: btn.className,
        disabled: btn.disabled
      }));
    });
    console.log('   All buttons:', JSON.stringify(allButtons, null, 2));

    // Find the button with "Save" and "💾" in its text (exact match)
    const saveButtonIndex = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      // Find button that contains both "💾" and "Save"
      const saveBtn = buttons.find(b =>
        b.textContent.includes('💾') && b.textContent.includes('Save')
      );
      if (saveBtn) {
        return Array.from(document.querySelectorAll('button')).indexOf(saveBtn);
      }
      return -1;
    });

    if (saveButtonIndex === -1) {
      throw new Error('Save button not found!');
    }

    console.log('   Clicking Save button at index:', saveButtonIndex);
    await page.evaluate((index) => {
      document.querySelectorAll('button')[index].click();
    }, saveButtonIndex);
    await new Promise(r => setTimeout(r, 2000));

    // Check for any dialogs
    console.log('\n10. Checking for dialogs...');
    const dialogState = await page.evaluate(() => {
      // Check for any modal or dialog
      const dialogs = document.querySelectorAll('dialog, [role="dialog"], .modal, .dialog');
      return {
        count: dialogs.length,
        innerText: dialogs.length > 0 ? Array.from(dialogs).map(d => d.textContent).join(' | ') : 'none'
      };
    });
    console.log('   Dialogs:', JSON.stringify(dialogState));

    // Check IndexedDB after save
    console.log('\n11. Checking IndexedDB after save...');
    const idbCheck = await page.evaluate(async () => {
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
        hasDoc: !!doc,
        content: doc?.content || 'no doc',
        contentLength: doc?.content?.length || 0
      };
    });
    console.log('   IndexedDB content:', idbCheck.content);
    console.log('   Content length:', idbCheck.contentLength);

    // Check file on disk
    console.log('\n12. Checking file on disk...');
    const { execSync } = require('child_process');
    try {
      const fileContent = execSync('cat docs/documents/Test2.md').toString().trim();
      console.log('   File content:', fileContent);
    } catch (e) {
      console.log('   Error reading file:', e.message);
    }

    // Final result
    console.log('\n13. RESULT:');
    if (idbCheck.content.includes('UPDATED') || idbCheck.content.includes('new content')) {
      console.log('   ✅ SAVE WORKED! Content was updated.');
    } else {
      console.log('   ❌ SAVE FAILED! Content not updated.');
      console.log('   Expected: content with "UPDATED" or "new content"');
      console.log('   Actual:', idbCheck.content);
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

debugSave().catch(console.error);
