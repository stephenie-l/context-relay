const API_BASE = 'https://context-relay-production.up.railway.app';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CAPTURE') {
    handleCapture(message.messages, message.source_model).then(sendResponse);
    return true; // keep channel open for async response
  }

  if (message.type === 'SEND') {
    handleSend(message.packetId, message.destination).then(sendResponse);
    return true;
  }
});

// ---------------------------------------------------------------------------
// Distill conversation → packet
// ---------------------------------------------------------------------------

async function handleCapture(messages, source_model) {
  try {
    const res = await fetch(`${API_BASE}/distill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, session_id: 'sess_' + Date.now(), source_model: source_model || 'claude' }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `Server error ${res.status}: ${text}` };
    }

    const raw = await res.json();
    const packet = { ...raw, id: raw.packet_id };
    return { packet };
  } catch (err) {
    return { error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Send packet to destination
// ---------------------------------------------------------------------------

async function handleSend(packetId, destination) {
  try {
    const res = await fetch(`${API_BASE}/packet/${packetId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `Server error ${res.status}: ${text}` };
    }

    const data = await res.json();
    const url = destinationUrl(destination);
    if (!url) return { error: 'Unknown destination' };

    const tab = await chrome.tabs.create({ url });

    if (data.formatted) {
      await waitForTabLoad(tab.id);
      const injector = destinationInjector(destination);
      if (!injector) return { error: 'Unknown destination' };
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: injector,
        args: [data.formatted],
      });
    }

    // Return no url — background already opened the tab, capture.js should not open a second one
    return {};
  } catch (err) {
    return { error: err.message };
  }
}

function destinationUrl(destination) {
  if (destination === 'chatgpt') return 'https://chatgpt.com/';
  if (destination === 'claude') return 'https://claude.ai/new';
  if (destination === 'gemini') return 'https://gemini.google.com/';
  return null;
}

function destinationInjector(destination) {
  if (destination === 'chatgpt') return injectPacketChatGPT;
  if (destination === 'claude') return injectPacketClaude;
  if (destination === 'gemini') return injectPacketGemini;
  return null;
}

function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.onUpdated.addListener(function listener(id, info) {
      if (id !== tabId || info.status !== 'complete') return;
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    });
  });
}

// Injected into the destination tab — must be self-contained (no closures over outer scope)
function injectPacketChatGPT(text) {
  function waitFor(selector, timeout) {
    timeout = timeout || 15000;
    return new Promise(function (resolve, reject) {
      var start = Date.now();
      function check() {
        var el = document.querySelector(selector);
        if (el) { resolve(el); return; }
        if (Date.now() - start > timeout) { reject(new Error('Timeout waiting for: ' + selector)); return; }
        setTimeout(check, 300);
      }
      check();
    });
  }

  function waitForEnabled(selector, timeout) {
    timeout = timeout || 15000;
    return new Promise(function (resolve, reject) {
      var start = Date.now();
      function check() {
        var el = document.querySelector(selector);
        if (el && !el.disabled) { resolve(el); return; }
        if (Date.now() - start > timeout) { reject(new Error('Timeout waiting for enabled: ' + selector)); return; }
        setTimeout(check, 300);
      }
      check();
    });
  }

  waitFor('#prompt-textarea')
    .then(function (textarea) {
      textarea.focus();
      // Use execCommand so React's synthetic event system picks up the change
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
      // Fallback: also set innerText and fire input event directly
      if (!textarea.innerText.trim()) {
        textarea.innerText = text;
        textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));
      }
      return waitForEnabled('button[data-testid="send-button"]');
    })
    .then(function (btn) {
      btn.click();
    })
    .catch(function (err) {
      console.error('[Context Relay] inject failed:', err.message);
    });
}

function injectPacketClaude(text) {
  function waitFor(selector, timeout) {
    timeout = timeout || 15000;
    return new Promise(function (resolve, reject) {
      var start = Date.now();
      function check() {
        var el = document.querySelector(selector);
        if (el) { resolve(el); return; }
        if (Date.now() - start > timeout) { reject(new Error('Timeout waiting for: ' + selector)); return; }
        setTimeout(check, 300);
      }
      check();
    });
  }

  waitFor('div[contenteditable="true"]')
    .then(function (editor) {
      editor.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
      if (!editor.innerText.trim()) {
        editor.innerText = text;
        editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
      }
      return waitFor('button[aria-label="Send message"]');
    })
    .then(function (btn) {
      setTimeout(function () { btn.click(); }, 500);
    })
    .catch(function (err) {
      console.error('[Context Relay] inject failed:', err.message);
    });
}

function injectPacketGemini(text) {
  function waitForAny(selectors, timeout) {
    timeout = timeout || 20000;
    return new Promise(function (resolve, reject) {
      var start = Date.now();
      function check() {
        for (var i = 0; i < selectors.length; i++) {
          var el = document.querySelector(selectors[i]);
          if (el) {
            resolve(el);
            return;
          }
        }
        if (Date.now() - start > timeout) {
          reject(new Error('Timeout waiting for Gemini input'));
          return;
        }
        setTimeout(check, 300);
      }
      check();
    });
  }

  function findEnabledSendButton() {
    var selectors = [
      'button[aria-label="Send message"]',
      'button[aria-label="Send"]',
      'button.send-button',
      'button[data-test-id="send-button"]',
    ];
    for (var i = 0; i < selectors.length; i++) {
      var btn = document.querySelector(selectors[i]);
      if (btn && !btn.disabled) return btn;
    }
    return null;
  }

  waitForAny([
    'rich-textarea div[contenteditable="true"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][aria-label]',
  ])
    .then(function (editor) {
      editor.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
      if (!editor.innerText.trim()) {
        editor.innerText = text;
        editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
      }

      var attempts = 0;
      var maxAttempts = 30;
      return new Promise(function (resolve, reject) {
        function checkSend() {
          var btn = findEnabledSendButton();
          if (btn) {
            resolve(btn);
            return;
          }
          attempts += 1;
          if (attempts >= maxAttempts) {
            reject(new Error('Timeout waiting for Gemini send button'));
            return;
          }
          setTimeout(checkSend, 300);
        }
        checkSend();
      });
    })
    .then(function (btn) {
      btn.click();
    })
    .catch(function (err) {
      console.error('[Context Relay] inject failed:', err.message);
    });
}
