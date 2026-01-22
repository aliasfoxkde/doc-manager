#!/usr/bin/env node
/**
 * Audit script for Doc Manager
 * Tests actual functionality in browser
 */

const puppeteer = require('puppeteer');

async function auditApp() {
  console.log('🔍 Auditing Doc Manager...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Capture all console messages
  const consoleMessages = [];
  const errors = [];
  const warnings = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push({ type: msg.type(), text });
    if (msg.type() === 'error') errors.push(text);
  });

  page.on('pageerror', error => {
    errors.push(error.toString());
  });

  page.on('requestfailed', request => {
    const failure = request.failure();
    console.log('REQUEST FAILED: ' + request.url() + ' - ' + (failure ? failure.text : 'unknown'));
  });

  try {
    console.log('Loading page...');
    await page.goto('http://192.168.1.201:3002/', {
      waitUntil: 'networkidle0',
      timeout: 15000
    });

    console.log('\nPAGE INFO:');
    console.log('  URL: ' + page.url());
    console.log('  Title: ' + await page.title());

    // Get rendered HTML
    const bodyText = await page.evaluate(function() {
      return document.body.innerText;
    });
    console.log('\nVISIBLE TEXT:');
    console.log(bodyText.substring(0, 500));

    // Check for documents in the DOM
    console.log('\nCHECKING FOR DOCUMENT ELEMENTS:');
    const docCards = await page.evaluate(function() {
      const cards = document.querySelectorAll('.doc-card');
      return Array.from(cards).map(function(el) {
        return {
          title: el.querySelector('.doc-card-content h4') ? el.querySelector('.doc-card-content h4').textContent : 'no title',
          text: el.querySelector('.doc-card-content p') ? el.querySelector('.doc-card-content p').textContent : 'no text'
        };
      });
    });
    console.log('  Found ' + docCards.length + ' document cards');
    docCards.forEach(function(card) {
      console.log('    - ' + card.title);
    });

    // Check IndexedDB
    console.log('\nCHECKING IndexedDB:');
    const indexedDBContent = await page.evaluate(async function() {
      const request = indexedDB.open('doc-manager', 1);
      return new Promise(function(resolve, reject) {
        request.onsuccess = function() {
          const db = request.result;
          const transaction = db.transaction(['documents'], 'readonly');
          const objectStore = transaction.objectStore('documents');
          const getAll = objectStore.getAll();
          getAll.onsuccess = function() {
            const docs = getAll.result;
            db.close();
            resolve(docs);
          };
        };
        request.onerror = function() { reject(request.error); };
      });
    });
    console.log('  IndexedDB has ' + indexedDBContent.length + ' documents');
    indexedDBContent.forEach(function(doc) {
      var title = doc.metadata ? doc.metadata.title : '(no title)';
      var id = doc.metadata ? doc.metadata.id : '(no id)';
      console.log('    - ' + title + ' (' + id + ')');
    });

    // Try to fetch from file watcher API
    console.log('\nCHECKING FILE WATCHER API:');
    try {
      const fwResponse = await page.evaluate(async function() {
        try {
          const response = await fetch('http://192.168.1.201:3100/api/files');
          if (!response.ok) {
            throw new Error('HTTP ' + response.status);
          }
          const data = await response.json();
          return { success: true, data: data };
        } catch (e) {
          return { success: false, error: e.message };
        }
      });

      if (fwResponse.success) {
        console.log('  File watcher API: ' + (fwResponse.data.files ? fwResponse.data.files.length : 0) + ' files');
        if (fwResponse.data.files && fwResponse.data.files.length > 0) {
          fwResponse.data.files.forEach(function(f, i) {
            if (i < 5) {
              console.log('    - ' + f.filename + ' (' + f.category + ')');
            }
          });
        }
      } else {
        console.log('  File watcher API: FAILED - ' + fwResponse.error);
      }
    } catch (e) {
      console.log('  File watcher API: ERROR - ' + e.message);
    }

    // Check localStorage
    console.log('\nCHECKING LOCALSTORAGE:');
    const localStorageContent = await page.evaluate(function() {
      const items = {};
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        items[key] = localStorage.getItem(key);
      }
      return items;
    });
    console.log('  localStorage has ' + Object.keys(localStorageContent).length + ' items');
    Object.keys(localStorageContent).forEach(function(key) {
      if (key.indexOf('theme') >= 0 || key.indexOf('doc') >= 0) {
        console.log('    - ' + key + ': ' + localStorageContent[key]);
      }
    });

    // Console messages
    console.log('\nCONSOLE MESSAGES:');
    if (consoleMessages.length === 0) {
      console.log('  (no console messages)');
    } else {
      consoleMessages.forEach(function(msg) {
        console.log('  [' + msg.type + '] ' + msg.text);
      });
    }

    // Errors
    console.log('\nERRORS:');
    if (errors.length === 0) {
      console.log('  (no errors)');
    } else {
      errors.forEach(function(err) {
        console.log('  ' + err);
      });
    }

    // Test clicking on a document
    console.log('\nTESTING DOCUMENT CLICK:');
    if (docCards.length > 0) {
      console.log('  Clicking on first document: ' + docCards[0].title);

      // Get the document ID from the first card
      const firstDocId = await page.evaluate(function() {
        const cards = document.querySelectorAll('.doc-card');
        if (cards.length > 0) {
          // Trigger click to navigate
          cards[0].click();
          // Also try to extract the href from react-router
          return document.URL;
        }
        return null;
      });

      // Wait for navigation
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(function() {
        console.log('  (Navigation timeout or no navigation occurred)');
      });

      // Check current URL
      console.log('  Page URL after click: ' + page.url());

      // Check if editor loaded
      const editorContent = await page.evaluate(function() {
        const editor = document.querySelector('.monaco-editor');
        if (!editor) {
          // Check for content in the document view
          const contentArea = document.querySelector('.editor-container');
          return contentArea ? contentArea.innerText.substring(0, 500) : null;
        }

        // Try to get the editor content
        const lines = document.querySelectorAll('.view-line');
        if (lines.length > 0) {
          return Array.from(lines).map(function(line) {
            return line.textContent.trim();
          }).join('\n').substring(0, 500);
        }
        return null;
      });

      if (editorContent) {
        console.log('  ✓ Content loaded successfully!');
        console.log('    Preview: ' + editorContent.substring(0, 100) + (editorContent.length > 100 ? '...' : ''));
      } else {
        console.log('  ✗ No content found in editor');
      }

      // Check for Monaco editor
      const hasMonaco = await page.evaluate(function() {
        return document.querySelector('.monaco-editor') !== null;
      });
      console.log('  Monaco editor present: ' + (hasMonaco ? 'Yes' : 'No'));
    } else {
      console.log('  No documents to test');
    }

  } catch (error) {
    console.error('\nAUDIT FAILED:', error);
  } finally {
    await browser.close();
  }
}

auditApp().catch(console.error);
