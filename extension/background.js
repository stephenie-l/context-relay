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
      body: JSON.stringify({ messages }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `Server error ${res.status}: ${text}` };
    }

    const packet = await res.json();
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

    // Derive a destination URL to open in a new tab
    const url = destinationUrl(destination, data);
    return { url };
  } catch (err) {
    return { error: err.message };
  }
}

function destinationUrl(destination, _data) {
  if (destination === 'chatgpt') return 'https://chat.openai.com/';
  if (destination === 'claude') return 'https://claude.ai/new';
  return null;
}
