const LABELS = {
  hungerstation: 'هنقرستيشن',
  ninja: 'نينجا',
  toyou: 'تو يو',
  mrsool: 'مرسول',
};

function render(channels) {
  const list = document.getElementById('list');
  list.innerHTML = '';
  for (const [key, label] of Object.entries(LABELS)) {
    const connected = Boolean(channels?.[key]);
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML =
      `<span class="name">${label}</span>` +
      `<span class="badge ${connected ? 'ok' : 'off'}">${connected ? 'متصل' : 'غير متصل'}</span>`;
    list.appendChild(row);
  }
}

function loadStatus() {
  document.getElementById('footer').textContent = 'جارٍ التحقق...';
  chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
    render(response?.channels || {});
    document.getElementById('footer').textContent =
      (response?.wsBase || 'ws://127.0.0.1:3000/ws') +
      ' · ' +
      new Date().toLocaleTimeString('ar-SA', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
  });
}

loadStatus();
setInterval(loadStatus, 5000);
