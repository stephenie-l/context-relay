const API_BASE = 'https://context-relay-production.up.railway.app';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CAPTURE') {
    handleCapture(message.messages).then(sendResponse);
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

async function handleCapture(messages) {
  try {
    const res = await fetch(`${API_BASE}/distill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, session_id: 'sess_' + Date.now(), source_model: 'claude' }),
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
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: injectPacket,
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
function injectPacket(text) {
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
      return waitFor('button[data-testid="send-button"]');
    })
    .then(function (btn) {
      setTimeout(function () { btn.click(); }, 500);
    })
    .catch(function (err) {
      console.error('[Context Relay] inject failed:', err.message);
    });
}
