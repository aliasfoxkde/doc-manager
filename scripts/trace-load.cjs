const puppeteer = require('puppeteer');

async function traceLoad() {
  console.log('TRACING DOCUMENT LOAD\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Intercept all requests
  page.on('request', req => {
    const url = req.url();
    if (url.includes('/api/') || url.includes('/documents/')) {
      console.log('[REQUEST]', req.method(), url);
    }
  });

  page.on('response', res => {
    const url = res.url();
    if (url.includes('/api/') || url.includes('/documents/')) {
      console.log('[RESPONSE]', res.status(), url);
    }
  });

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Loading document') ||
        text.includes('Document loaded') ||
        text.includes('error') ||
        text.includes('Error') ||
        text.includes('currentDocument')) {
      console.log('[CONSOLE]', msg.type(), text);
    }
  });

  page.on('pageerror', err => console.error('[PAGE ERROR]', err.message));

  try {
    console.log('\n1. Navigating to document...');
    await page.goto('http://192.168.1.201:3002/documents/fw-documents-Test2', {
      waitUntil: 'networkidle0',
      timeout: 20000
    });

    console.log('\n2. Waiting for document to load...');
    await new Promise(r => setTimeout(r, 5000));

    // Check IndexedDB
    console.log('\n3. Checking IndexedDB...');
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
        hasDocument: !!doc,
        doc: doc ? {
          id: doc.metadata.id,
          title: doc.metadata.title,
          contentLength: doc.content.length,
          contentPreview: doc.content.substring(0, 100)
        } : null
      };
    });

    console.log('  Has document in IndexedDB:', idbData.hasDocument);
    if (idbData.doc) {
      console.log('  Title:', idbData.doc.title);
      console.log('  Content length:', idbData.doc.contentLength);
      console.log('  Content preview:', idbData.doc.contentPreview);
    }

    // Check React state
    console.log('\n4. Checking React state...');
    const reactState = await page.evaluate(() => {
      // Try to find the currentDocument through React DevTools
      const rootElement = document.querySelector('#root');
      if (!rootElement) return { error: 'No root element' };

      // Check if we can access the document editor
      const editor = document.querySelector('.editor-container');
      if (!editor) return { error: 'No editor container' };

      // Check title input
      const titleInput = document.querySelector('.title-input');
      const title = titleInput ? titleInput.value : 'no title input';

      // Check ProseMirror
      const proseMirror = document.querySelector('.ProseMirror');
      const pmContent = proseMirror ? proseMirror.innerHTML : 'no prose mirror';

      return {
        title,
        proseMirrorExists: !!proseMirror,
        proseMirrorHTML: pmContent.substring(0, 200)
      };
    });

    console.log('  React state:', JSON.stringify(reactState, null, 2));

    // Check network tab manually
    console.log('\n5. Testing file watcher API directly...');
    const apiTest = await page.evaluate(async () => {
      try {
        const response = await fetch('http://192.168.1.201:3100/api/files/documents/Test2.md');
        const data = await response.json();
        return {
          success: true,
          hasContent: !!data.content,
          contentLength: data.content ? data.content.length : 0,
          contentPreview: data.content ? data.content.substring(0, 100) : 'no content'
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    console.log('  API test:', JSON.stringify(apiTest, null, 2));

  } catch (error) {
    console.error('FAILED:', error.message);
    console.error(error.stack);
  } finally {
    console.log('\nWaiting 5 seconds before closing...');
    await new Promise(r => setTimeout(r, 5000));
    await browser.close();
  }
}

traceLoad().catch(console.error);
