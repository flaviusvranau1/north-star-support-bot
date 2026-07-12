/*
 * UI layer — renders the conversation produced by NSFlows.
 * Messages are delivered sequentially with a typing indicator whose delay
 * scales with message length, so the pacing feels human (and reads well in
 * the demo video).
 */

(function () {
  'use strict';

  const messagesEl = document.getElementById('messages');
  const chipsEl = document.getElementById('chips');
  const composerEl = document.getElementById('composer');
  const inputEl = document.getElementById('input');
  const sendBtn = composerEl.querySelector('.send');
  const statusEl = document.getElementById('status');
  const restartBtn = document.getElementById('restart');

  let session = NSFlows.createSession();
  let busy = false;

  const AVATARS = { bot: '★', agent: 'A' };

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function scrollDown() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addMessage(author, text) {
    const msg = document.createElement('div');
    msg.className = 'msg ' + author;

    if (author !== 'system' && author !== 'user') {
      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      avatar.textContent = AVATARS[author] || '★';
      msg.appendChild(avatar);
    }

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = author === 'system' ? '— ' + text + ' —' : text;
    msg.appendChild(bubble);

    messagesEl.appendChild(msg);
    scrollDown();
    return msg;
  }

  function showTyping(author) {
    const msg = document.createElement('div');
    msg.className = 'msg typing ' + author;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = AVATARS[author] || '★';
    msg.appendChild(avatar);

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('span');
      dot.className = 't-dot';
      bubble.appendChild(dot);
    }
    msg.appendChild(bubble);

    messagesEl.appendChild(msg);
    scrollDown();
    return msg;
  }

  function clearChips() {
    chipsEl.innerHTML = '';
  }

  function renderChips(chips) {
    clearChips();
    (chips || []).forEach((chip) => {
      let el;
      if (chip.url) {
        el = document.createElement('a');
        el.className = 'chip chip-link';
        el.href = chip.url;
        el.target = '_blank';
        el.rel = 'noopener';
        el.textContent = chip.label + ' ↗';
      } else {
        el = document.createElement('button');
        el.type = 'button';
        el.className = 'chip';
        el.textContent = chip.label;
        el.addEventListener('click', () => send(chip.value, chip.label));
      }
      chipsEl.appendChild(el);
    });
    scrollDown();
  }

  function updateStatus(state) {
    if (state === 'LIVE_AGENT') {
      statusEl.innerHTML =
        '<span class="dot dot-agent" aria-hidden="true"></span> Live Agent — ' +
        NSData.brand.agentName +
        ' · simulated';
    } else {
      statusEl.innerHTML =
        '<span class="dot dot-online" aria-hidden="true"></span> ' +
        NSData.brand.bot +
        ' · Online';
    }
  }

  function setBusy(value) {
    busy = value;
    sendBtn.disabled = value;
  }

  async function deliver(response) {
    setBusy(true);
    clearChips();

    for (const m of response.messages) {
      if (m.author === 'system') {
        await wait(350);
        addMessage('system', m.text);
        continue;
      }
      const typing = showTyping(m.author);
      await wait(Math.min(400 + m.text.length * 7, 1500));
      typing.remove();
      addMessage(m.author, m.text);
      await wait(220);
    }

    renderChips(response.quickReplies);
    updateStatus(response.state);
    setBusy(false);
    inputEl.focus();
  }

  function send(value, display) {
    if (busy) return;
    const text = String(value || '').trim();
    if (!text) return;
    addMessage('user', display || text);
    deliver(NSFlows.respond(session, text));
  }

  composerEl.addEventListener('submit', (event) => {
    event.preventDefault();
    if (busy) return; // keep the draft — don't swallow input mid-delivery
    const text = inputEl.value;
    inputEl.value = '';
    send(text);
  });

  restartBtn.addEventListener('click', () => {
    if (busy) return;
    messagesEl.innerHTML = '';
    clearChips();
    session = NSFlows.createSession();
    deliver(NSFlows.greeting(session));
  });

  // kick off
  deliver(NSFlows.greeting(session));
})();
