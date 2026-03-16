// modal.js — runs inside popup/modal.html
// Reads the current packet from chrome.storage.session and renders it.

document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status');

  // Retrieve the packet stored by the background script
  let packet;
  try {
    const result = await chrome.storage.session.get('pendingPacket');
    packet = result.pendingPacket;
  } catch (err) {
    statusEl.textContent = `Could not load packet: ${err.message}`;
    return;
  }

  if (!packet) {
    statusEl.textContent = 'No packet data found.';
    return;
  }

  renderPacket(packet);

  document.getElementById('close-btn').addEventListener('click', () => window.close());

  document.getElementById('send-btn').addEventListener('click', async () => {
    const destination = document.getElementById('destination').value;
    const sendBtn = document.getElementById('send-btn');
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending…';
    statusEl.textContent = '';

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SEND',
        packetId: packet.id,
        destination,
      });

      if (response?.error) {
        statusEl.textContent = `Error: ${response.error}`;
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
        return;
      }

      if (response?.url) {
        await chrome.tabs.create({ url: response.url });
      }

      window.close();
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send';
    }
  });
});

// ---------------------------------------------------------------------------

function renderPacket(packet) {
  setText('topic', packet.topic || 'Distilled Conversation');
  setText('summary', packet.summary);
  renderList('decisions', packet.decisions);
  renderList('open_questions', packet.open_questions);
  setText('next_task', packet.next_task);
}

function setText(id, value) {
  const el = document.getElementById(id);
  const field = document.getElementById(`field-${id}`);
  if (!value) {
    if (field) field.style.display = 'none';
    return;
  }
  el.textContent = value;
}

function renderList(id, items) {
  const ul = document.getElementById(id);
  const field = document.getElementById(`field-${id}`);
  if (!items || items.length === 0) {
    if (field) field.style.display = 'none';
    return;
  }
  ul.innerHTML = '';
  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    ul.appendChild(li);
  });
}
