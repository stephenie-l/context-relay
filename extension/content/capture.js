(() => {
  // Avoid injecting the button more than once
  if (document.getElementById('context-relay-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'context-relay-btn';
  btn.textContent = 'Handoff ✦';
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: '99999',
    background: '#1a1a1a',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 18px',
    fontSize: '14px',
    fontWeight: '600',
    fontFamily: 'system-ui, sans-serif',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    transition: 'opacity 0.15s',
  });

  btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.85'; });
  btn.addEventListener('mouseleave', () => { btn.style.opacity = '1'; });

  btn.addEventListener('click', () => {
    const messages = captureConversation();
    if (messages.length === 0) {
      alert('No conversation messages found on this page.');
      return;
    }

    btn.textContent = 'Distilling…';
    btn.disabled = true;

    const source_model = detectSourceModel();
    chrome.runtime.sendMessage({ type: 'CAPTURE', messages, source_model }, (response) => {
      btn.textContent = 'Handoff ✦';
      btn.disabled = false;

      if (chrome.runtime.lastError) {
        console.error('[Context Relay]', chrome.runtime.lastError.message);
        alert('Error communicating with background script.');
        return;
      }

      if (response?.error) {
        console.error('[Context Relay]', response.error);
        alert(`Distillation failed: ${response.error}`);
        return;
      }

      if (response?.packet) {
        injectModal(response.packet);
      }
    });
  });

  document.body.appendChild(btn);

  // Re-inject if React re-renders wipe the button from the DOM
  const observer = new MutationObserver(() => {
    if (!document.body.contains(btn)) {
      document.body.appendChild(btn);
    }
  });
  observer.observe(document.body, { childList: true });

  // ---------------------------------------------------------------------------
  // Conversation capture
  // ---------------------------------------------------------------------------

  function captureConversation() {
    if (location.hostname.includes('chatgpt.com')) {
      const elements = document.querySelectorAll('[data-message-author-role]');
      return Array.from(elements).map(el => ({
        role: el.getAttribute('data-message-author-role'),
        content: el.innerText.trim(),
      }));
    }
    if (location.hostname.includes('gemini.google.com')) {
      const rawTurns = Array.from(document.querySelectorAll([
        'user-query',
        'model-response',
        '[data-response-role="user"]',
        '[data-response-role="model"]',
        '[data-test-id="user-message"]',
        '[data-test-id="model-response"]',
        '.user-query-bubble-with-background',
        '.model-response-text',
      ].join(', ')));

      const seen = new Set();
      const messages = [];
      rawTurns.forEach((el) => {
        const text = (el.innerText || '').trim();
        if (!text || seen.has(text)) return;
        seen.add(text);

        const isUser =
          el.tagName.toLowerCase() === 'user-query' ||
          el.getAttribute('data-response-role') === 'user' ||
          el.getAttribute('data-test-id') === 'user-message' ||
          el.classList.contains('user-query-bubble-with-background');

        messages.push({
          role: isUser ? 'user' : 'assistant',
          content: text,
        });
      });

      return messages;
    }
    // claude.ai
    const elements = document.querySelectorAll('[data-test-render-count]');
    return Array.from(elements).map((el, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: el.innerText.trim(),
    }));
  }

  function detectSourceModel() {
    if (location.hostname.includes('chatgpt.com')) return 'chatgpt';
    if (location.hostname.includes('gemini.google.com')) return 'gemini';
    return 'claude';
  }

  // ---------------------------------------------------------------------------
  // Modal injection (defined here so it has access to the page DOM)
  // ---------------------------------------------------------------------------

  function injectModal(packet) {
    // Remove any existing modal
    document.getElementById('context-relay-modal-root')?.remove();

    const root = document.createElement('div');
    root.id = 'context-relay-modal-root';

    const style = document.createElement('style');
    style.textContent = `
      #context-relay-modal-root * { box-sizing: border-box; font-family: system-ui, sans-serif; }
      #cr-overlay {
        position: fixed; inset: 0; z-index: 999999;
        background: rgba(0,0,0,0.55); display: flex;
        align-items: center; justify-content: center;
      }
      #cr-modal {
        background: #fff; border-radius: 12px; padding: 32px;
        max-width: 560px; width: 90vw; max-height: 85vh;
        overflow-y: auto; box-shadow: 0 24px 64px rgba(0,0,0,0.3);
        color: #111;
      }
      #cr-modal h2 { margin: 0 0 20px; font-size: 18px; font-weight: 700; }
      .cr-field { margin-bottom: 16px; }
      .cr-field label {
        display: block; font-size: 11px; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.08em;
        color: #666; margin-bottom: 4px;
      }
      .cr-field p {
        margin: 0; font-size: 14px; line-height: 1.6; color: #222;
        background: #f5f5f5; border-radius: 6px; padding: 10px 12px;
      }
      .cr-field ul {
        margin: 0; padding: 0 0 0 18px; font-size: 14px;
        line-height: 1.7; color: #222;
        background: #f5f5f5; border-radius: 6px; padding: 10px 12px 10px 28px;
      }
      #cr-actions {
        display: flex; align-items: center; gap: 12px;
        margin-top: 24px; padding-top: 20px;
        border-top: 1px solid #eee;
      }
      .cr-select-wrap {
        position: relative;
        flex: 1;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: #fff;
      }
      .cr-select-wrap::after {
        content: '';
        position: absolute;
        top: 50%;
        right: 12px;
        width: 10px;
        height: 6px;
        transform: translateY(-50%);
        pointer-events: none;
        background-repeat: no-repeat;
        background-size: 10px 6px;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath fill='%23666' d='M1 1l4 4 4-4'/%3E%3C/svg%3E");
      }
      #cr-destination {
        width: 100%;
        padding: 8px 32px 8px 12px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        background: transparent;
        color: #111;
        -webkit-appearance: none;
        appearance: none;
      }
      #cr-send {
        padding: 9px 22px; border-radius: 6px; border: none;
        background: #1a1a1a; color: #fff; font-size: 14px;
        font-weight: 600; cursor: pointer;
      }
      #cr-send:hover { background: #333; }
      #cr-send:disabled { opacity: 0.5; cursor: default; }
      #cr-close {
        position: absolute; top: 16px; right: 20px;
        background: none; border: none; font-size: 22px;
        cursor: pointer; color: #888; line-height: 1;
      }
    `;
    root.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'cr-overlay';

    const modal = document.createElement('div');
    modal.id = 'cr-modal';
    modal.style.position = 'relative';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.id = 'cr-close';
    closeBtn.textContent = '×';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', () => root.remove());
    modal.appendChild(closeBtn);

    // Title
    const title = document.createElement('h2');
    title.textContent = packet.topic || 'Distilled Conversation';
    modal.appendChild(title);

    // Fields
    const fields = [
      { key: 'summary', label: 'Summary' },
      { key: 'decisions', label: 'Decisions', list: true },
      { key: 'open_questions', label: 'Open Questions', list: true },
      { key: 'next_task', label: 'Next Task' },
    ];

    for (const { key, label, list } of fields) {
      const value = packet[key];
      if (!value || (Array.isArray(value) && value.length === 0)) continue;

      const wrap = document.createElement('div');
      wrap.className = 'cr-field';

      const lbl = document.createElement('label');
      lbl.textContent = label;
      wrap.appendChild(lbl);

      if (list && Array.isArray(value)) {
        const ul = document.createElement('ul');
        value.forEach(item => {
          const li = document.createElement('li');
          li.textContent = item;
          ul.appendChild(li);
        });
        wrap.appendChild(ul);
      } else {
        const p = document.createElement('p');
        p.textContent = Array.isArray(value) ? value.join(', ') : value;
        wrap.appendChild(p);
      }

      modal.appendChild(wrap);
    }

    // Actions
    const actions = document.createElement('div');
    actions.id = 'cr-actions';

    const select = document.createElement('select');
    select.id = 'cr-destination';
    [
      { value: 'chatgpt', label: 'ChatGPT' },
      { value: 'claude', label: 'Claude' },
      { value: 'gemini', label: 'Gemini' },
    ].forEach(({ value, label }) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      select.appendChild(opt);
    });

    const sendBtn = document.createElement('button');
    sendBtn.id = 'cr-send';
    sendBtn.textContent = 'Send';
    sendBtn.addEventListener('click', () => {
      const dest = select.value;
      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending…';
      chrome.runtime.sendMessage(
        { type: 'SEND', packetId: packet.id, destination: dest },
        (res) => {
          sendBtn.disabled = false;
          sendBtn.textContent = 'Send';
          if (res?.error) { alert(`Send failed: ${res.error}`); return; }
          root.remove();
        }
      );
    });

    const selectWrap = document.createElement('div');
    selectWrap.className = 'cr-select-wrap';
    selectWrap.appendChild(select);
    actions.appendChild(selectWrap);
    actions.appendChild(sendBtn);
    modal.appendChild(actions);

    overlay.appendChild(modal);

    // Close on overlay click (outside modal)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) root.remove();
    });

    root.appendChild(overlay);
    document.body.appendChild(root);
  }
})();
