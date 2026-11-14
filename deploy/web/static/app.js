// Copyright (c) 2026 Luca Martinetti (MIT License)
// Modifications and additions (c) 2026 SCTG Development - Ronan Le Meillat (MIT License)
// See the LICENSE file in the project root.

// --- State ---
let currentCode = null;
let qrModeWeb = true; // true = web URL, false = wormhole-transfer:
let transferActive = false;
let lastReceivedText = null;
let lastReceivedFilename = 'message.txt';

// --- Analytics: none. track() is a no-op kept so call sites stay simple. ---
function track() {}

function sizeBucket(bytes) {
  if (bytes < 1024 * 1024) return '<1MB';
  if (bytes < 10 * 1024 * 1024) return '1-10MB';
  if (bytes < 100 * 1024 * 1024) return '10-100MB';
  if (bytes < 1024 * 1024 * 1024) return '100MB-1GB';
  return '>1GB';
}

// --- Beforeunload warning ---
window.addEventListener('beforeunload', function(e) {
  if (transferActive) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// --- Helpers ---
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }

// --- Tab Switching ---
function switchTab(tab) {
  var sendTab = document.getElementById('main-tab-send');
  var recvTab = document.getElementById('main-tab-receive');
  var sendPanel = document.getElementById('panel-send');
  var recvPanel = document.getElementById('panel-receive');
  if (tab === 'send') {
    sendTab.classList.add('active');
    sendTab.setAttribute('aria-selected', 'true');
    recvTab.classList.remove('active');
    recvTab.setAttribute('aria-selected', 'false');
    sendPanel.classList.remove('hidden');
    recvPanel.classList.add('hidden');
  } else {
    recvTab.classList.add('active');
    recvTab.setAttribute('aria-selected', 'true');
    sendTab.classList.remove('active');
    sendTab.setAttribute('aria-selected', 'false');
    recvPanel.classList.remove('hidden');
    sendPanel.classList.add('hidden');
  }
}

// --- Dark Mode Toggle ---
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : (current === 'light' ? 'dark' :
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark'));
  html.setAttribute('data-theme', next);
  updateThemeToggle(next === 'dark');
  try { localStorage.setItem('theme', next); } catch (_) {}
}

function updateThemeToggle(isDark) {
  document.getElementById('theme-icon-sun').style.display = isDark ? 'none' : '';
  document.getElementById('theme-icon-moon').style.display = isDark ? '' : 'none';
  const btn = document.getElementById('theme-toggle');
  btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  btn.setAttribute('aria-checked', String(isDark));
}

// Initialize theme
(function() {
  let theme;
  try { theme = localStorage.getItem('theme'); } catch (_) {}
  if (theme) {
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeToggle(theme === 'dark');
  } else {
    updateThemeToggle(window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
})();

// --- QR ---
function renderQr(text) {
  const container = document.getElementById('qr-display');
  container.innerHTML = '';
  if (typeof qrcode === 'undefined') return;
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  // cellSize=6 for better scannability on phone cameras
  container.innerHTML = qr.createSvgTag(6, 0);
}

function getReceiveUrl() {
  return window.location.origin + '/receive/' + currentCode;
}

function updateCodeDisplay() {
  const box = document.getElementById('send-code');
  if (qrModeWeb) {
    box.textContent = getReceiveUrl();
  } else {
    box.textContent = currentCode;
  }
}

function setQrMode(web) {
  qrModeWeb = web;
  document.getElementById('tab-web').classList.toggle('active', web);
  document.getElementById('tab-wormhole').classList.toggle('active', !web);
  document.getElementById('tab-web').setAttribute('aria-selected', String(web));
  document.getElementById('tab-wormhole').setAttribute('aria-selected', String(!web));
  if (web) {
    renderQr(getReceiveUrl());
  } else {
    renderQr('wormhole-transfer:' + currentCode);
  }
  updateCodeDisplay();
}

function copyCode() {
  const text = qrModeWeb ? getReceiveUrl() : currentCode;
  track('code-copy', { mode: qrModeWeb ? 'web' : 'wormhole' });
  navigator.clipboard.writeText(text).then(() => {
    const label = document.getElementById('copy-label');
    label.textContent = 'Copied!';
    setTimeout(() => { label.textContent = 'Copy'; }, 1000);
  });
}

function shareCode() {
  track('code-share', { mode: qrModeWeb ? 'web' : 'wormhole' });
  const text = qrModeWeb ? getReceiveUrl() : 'wormhole receive ' + currentCode;
  const data = { text: text };
  if (qrModeWeb) {
    data.title = 'Receive file via wormhole';
    data.url = getReceiveUrl();
  } else {
    data.title = 'Receive file via wormhole';
  }
  navigator.share(data).catch(() => {});
}

// --- Send ---
// Accepts a single File or an array of Files
function startSend(fileOrFiles) {
  if (!window.wasmClient || !window.wasmClient.ready) {
    // WASM not loaded -- can't proceed
    return;
  }
  // Clean up any previous send to avoid leaking relay connections
  window.wasmClient.cancelSend();
  var files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
  if (files.length === 0) return;
  startSendWasm(files.length === 1 ? files[0] : files);
}

function startSendWasm(fileOrFiles) {
  hide('send-initial');
  show('send-status');

  var files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
  var isMulti = files.length > 1;

  if (isMulti) {
    var totalSize = files.reduce(function(sum, f) { return sum + f.size; }, 0);
    document.getElementById('send-filename').textContent = files.length + ' files';
    document.getElementById('send-filesize').textContent = formatSize(totalSize) + ' total (will be sent as zip)';
  } else {
    document.getElementById('send-filename').textContent = files[0].name;
    document.getElementById('send-filesize').textContent = formatSize(files[0].size);
  }
  document.getElementById('send-status-text').textContent = 'allocating code...';
  document.getElementById('send-status-text').className = 'status-text';
  document.getElementById('send-progress').style.width = '0%';
  document.getElementById('send-progress').className = 'progress-bar';
  document.getElementById('send-progress').setAttribute('aria-valuenow', '0');
  hide('send-code-section');
  hide('send-transfer-info');
  show('send-keep-open');

  document.getElementById('send-status-text').focus();

  var totalSize = files.reduce(function(sum, f) { return sum + f.size; }, 0);
  track('send-start', { files: files.length, size: sizeBucket(totalSize) });

  window.wasmClient.send(fileOrFiles, {
    onCode(code) {
      currentCode = code;
      show('send-code-section');
      setQrMode(true);
      if (navigator.share) {
        document.getElementById('btn-share').style.display = '';
      }
    },
    onStatus(text) {
      document.getElementById('send-status-text').textContent = text;
    },
    onProgress(pct, speed, connType) {
      transferActive = true;
      document.getElementById('send-progress').style.width = pct + '%';
      document.getElementById('send-progress').setAttribute('aria-valuenow', String(pct));
      if (speed) {
        var info = speed + (connType ? ' \u00b7 ' + connType : '');
        document.getElementById('send-transfer-info').textContent = info;
        show('send-transfer-info');
      }
    },
    onError(msg) {
      transferActive = false;
      hide('send-keep-open');
      track('send-error', { error: msg });
      document.getElementById('send-status-text').textContent = msg;
      document.getElementById('send-status-text').className = 'status-text error';
      var btn = document.getElementById('send-cancel-btn');
      btn.textContent = 'New Transfer';
      btn.className = 'btn';
      btn.style.width = '100%';
      btn.style.marginTop = '8px';
      btn.focus();
    },
    onComplete() {
      transferActive = false;
      track('send-complete');
      markSendComplete();
    },
  });
}

function markSendComplete() {
  hide('send-code-section');
  hide('send-keep-open');
  document.getElementById('send-progress').style.width = '100%';
  document.getElementById('send-progress').className = 'progress-bar done';
  document.getElementById('send-progress').setAttribute('aria-valuenow', '100');
  document.getElementById('send-status-text').textContent = '\u2714 Transfer complete!';
  document.getElementById('send-status-text').className = 'status-text done';
  // Change cancel to New Transfer with primary style
  var btn = document.getElementById('send-cancel-btn');
  btn.textContent = 'New Transfer';
  btn.className = 'btn';
  btn.style.width = '100%';
  btn.style.marginTop = '8px';
  btn.focus();
}

function cancelSend() {
  if (window.wasmClient) window.wasmClient.cancelSend();
  transferActive = false;
  currentCode = null;
  hide('send-status');
  show('send-initial');
  document.getElementById('file-input').value = '';
  document.getElementById('folder-input').value = '';
  // Reset button
  var btn = document.getElementById('send-cancel-btn');
  btn.textContent = 'Cancel';
  btn.className = 'btn btn-cancel';
  btn.style.width = '';
  btn.style.marginTop = '';
  // Update progress bar ARIA
  var prog = document.getElementById('send-progress');
  if (prog) prog.setAttribute('aria-valuenow', '0');
}

// --- Receive ---
function startReceive() {
  var input = document.getElementById('receive-code');
  var code = input.value.trim().toLowerCase().replace(/\s+/g, '');
  if (!code) return;
  input.value = ''; // code is single-use — clear it immediately
  if (!window.wasmClient || !window.wasmClient.ready) return;
  // Clean up any previous receive to avoid leaking relay connections
  window.wasmClient.cancelReceive();
  startReceiveWasm(code);
}

function startReceiveWasm(code) {
  hide('receive-initial');
  show('receive-status');
  hide('receive-file-info');
  hide('receive-text-panel');
  hide('receive-progress-section');
  hide('receive-transfer-info');
  lastReceivedText = null;
  lastReceivedFilename = 'message.txt';
  document.getElementById('receive-spinner').style.display = '';
  document.getElementById('receive-status-text').textContent = 'establishing encrypted connection...';
  document.getElementById('receive-status-text').className = 'status-text';


  document.getElementById('receive-status-text').focus();

  var isDirectLink = window.location.pathname.match(/^\/receive\/.+$/);
  track('receive-start', { method: isDirectLink ? 'link' : 'code' });

  window.wasmClient.receive(code, {
    onFileInfo(filename, filesize) {
      lastReceivedFilename = filename;
      document.getElementById('receive-filename').textContent = filename;
      var sizeText = formatSize(filesize);
      if (filename.endsWith('.zip')) {
        sizeText += ' (zip archive — extract after download)';
      }
      document.getElementById('receive-filesize').textContent = sizeText;
      show('receive-file-info');
      document.getElementById('receive-spinner').style.display = 'none';
    },
    onText(text) {
      lastReceivedText = text;
      const pre = document.getElementById('receive-text-content');
      pre.textContent = text;
      document.getElementById('receive-filename').textContent = lastReceivedFilename + ' (text)';
      show('receive-text-panel');
    },
    onStatus(text) {
      document.getElementById('receive-status-text').textContent = text;
    },
    onProgress(pct, speed, connType) {
      transferActive = true;
      show('receive-progress-section');
      document.getElementById('receive-progress').style.width = pct + '%';
      document.getElementById('receive-progress').setAttribute('aria-valuenow', String(pct));
      if (speed) {
        var info = speed + (connType ? ' \u00b7 ' + connType : '');
        document.getElementById('receive-transfer-info').textContent = info;
        show('receive-transfer-info');
      }
    },
    onError(msg) {
      transferActive = false;
      track('receive-error', { error: msg });
      document.getElementById('receive-status-text').textContent = msg;
      document.getElementById('receive-status-text').className = 'status-text error';
      document.getElementById('receive-spinner').style.display = 'none';
      var btn = document.getElementById('receive-cancel-btn');
      btn.textContent = 'New Transfer';
      btn.className = 'btn';
      btn.style.width = '100%';
      btn.style.marginTop = '8px';
      btn.focus();
    },
    onComplete() {
      transferActive = false;
      track('receive-complete');
      document.getElementById('receive-progress').style.width = '100%';
      document.getElementById('receive-progress').className = 'progress-bar done';
      document.getElementById('receive-progress').setAttribute('aria-valuenow', '100');
      document.getElementById('receive-status-text').textContent = '\u2714 Transfer complete!';
      document.getElementById('receive-status-text').className = 'status-text done';
      // Change cancel to New Transfer
      var btn = document.getElementById('receive-cancel-btn');
      btn.textContent = 'New Transfer';
      btn.className = 'btn';
      btn.style.width = '100%';
      btn.style.marginTop = '8px';
      btn.focus();
    },
  });
}

function cancelReceive() {
  if (window.wasmClient) window.wasmClient.cancelReceive();
  transferActive = false;
  hide('receive-text-panel');
  // If on a /receive/<code> URL, redirect to clean root
  if (window.location.pathname.match(/^\/receive\/.+$/)) {
    window.history.replaceState(null, '', '/');
  }
  hide('receive-status');
  show('receive-initial');
  // Reset button
  var btn = document.getElementById('receive-cancel-btn');
  btn.textContent = 'Cancel';
  btn.className = 'btn btn-cancel';
  btn.style.width = '';
  btn.style.marginTop = '';
  // Update progress bar ARIA
  var prog = document.getElementById('receive-progress');
  if (prog) prog.setAttribute('aria-valuenow', '0');
}

// --- Drag and drop ---
var dz = document.getElementById('dropzone');

dz.addEventListener('click', function(e) {
  if (e.target.id !== 'file-input' && e.target.id !== 'folder-input') {
    document.getElementById('file-input').click();
  }
});

dz.addEventListener('dragover', function(e) {
  e.preventDefault();
  dz.classList.add('dragover');
});

dz.addEventListener('dragleave', function() {
  dz.classList.remove('dragover');
});

dz.addEventListener('drop', function(e) {
  e.preventDefault();
  dz.classList.remove('dragover');
  var items = e.dataTransfer.items;
  // Check if any item is a directory (use webkitGetAsEntry for folder detection)
  var hasEntries = items && items.length > 0 && items[0].webkitGetAsEntry;
  if (hasEntries) {
    // Use entry API to traverse directories
    window.wasmClient.traverseEntries(items).then(function(files) {
      if (files.length > 0) {
        startSend(files.length === 1 ? files[0] : files);
      }
    }).catch(function() {
      // Fallback to flat file list
      var files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        startSend(files.length === 1 ? files[0] : files);
      }
    });
  } else if (e.dataTransfer.files.length > 0) {
    var files = Array.from(e.dataTransfer.files);
    startSend(files.length === 1 ? files[0] : files);
  }
});

dz.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    document.getElementById('file-input').click();
  }
});

document.getElementById('file-input').addEventListener('change', function() {
  if (this.files.length > 0) {
    var files = Array.from(this.files);
    startSend(files.length === 1 ? files[0] : files);
  }
});

document.getElementById('folder-input').addEventListener('change', function() {
  if (this.files.length > 0) {
    startSend(Array.from(this.files));
  }
});

// Click code box to copy
document.getElementById('send-code').addEventListener('click', copyCode);

// --- WASM initialization ---
if (window.wasmClient) {
  window.wasmClient.initWasm();
}

// --- Pre-filled receive from URL ---
(function() {
  var match = window.location.pathname.match(/^\/receive\/(.+)$/);
  if (match) {
    var code = decodeURIComponent(match[1]);
    // Wait for WASM to be ready (up to 3 seconds), then start
    var attempts = 0;
    var tryStart = function() {
      if (window.wasmClient && window.wasmClient.ready) {
        switchTab('receive');
        document.getElementById('receive-code').value = code;
        startReceive();
      } else if (attempts < 30) {
        attempts++;
        setTimeout(tryStart, 100);
      } else {
        // Fallback: fill the code input and let user click
        switchTab('receive');
        document.getElementById('receive-code').value = code;
      }
    };
    tryStart();
  }
})();

// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// --- Event Listeners (replacing inline handlers for CSP compliance) ---
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
document.getElementById('main-tab-send').addEventListener('click', function() { switchTab('send'); });
document.getElementById('main-tab-receive').addEventListener('click', function() { switchTab('receive'); });
document.getElementById('btn-folder').addEventListener('click', function() { document.getElementById('folder-input').click(); });
document.getElementById('btn-copy').addEventListener('click', copyCode);
document.getElementById('btn-share').addEventListener('click', shareCode);
document.getElementById('tab-web').addEventListener('click', function() { setQrMode(true); });
document.getElementById('tab-wormhole').addEventListener('click', function() { setQrMode(false); });
document.getElementById('send-cancel-btn').addEventListener('click', cancelSend);
document.getElementById('receive-code').addEventListener('keydown', function(e) { if (e.key === 'Enter') startReceive(); });
document.getElementById('receive-btn').addEventListener('click', startReceive);
document.getElementById('receive-cancel-btn').addEventListener('click', cancelReceive);

// --- Settings modal: per-user relay server overrides ---
// Stored in localStorage (this browser only, never sent to the server).
// Priority: localStorage override > /config.json from the server > built-in default.
const SETTINGS_KEY = 'wormhole-settings';
const settingsDefaultTransit = () => DEFAULT_TRANSIT_RELAY_URL;

function readSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function updateSettingsDot() {
  const s = readSettings();
  const custom = Boolean((s.mailboxUrl || '').trim() || (s.transitRelayUrl || '').trim());
  const dot = document.getElementById('settings-dot');
  if (dot) dot.classList.toggle('hidden', !custom);
}

function validateRelayUrl(raw) {
  const value = raw.trim();
  if (!value) return { ok: true, value: '' }; // empty = use default
  if (value.length > 2048) return { ok: false, error: 'URL is too long (max 2048 characters)' };
  let url;
  try {
    url = new URL(value);
  } catch (_) {
    return { ok: false, error: 'Not a valid URL' };
  }
  if (url.protocol !== 'wss:' && url.protocol !== 'ws:') {
    return { ok: false, error: 'URL must start with ws:// or wss://' };
  }
  if (!url.hostname) return { ok: false, error: 'URL has no host' };
  return { ok: true, value };
}

function settingsElements() {
  return {
    overlay: document.getElementById('settings-overlay'),
    mailbox: document.getElementById('settings-mailbox-url'),
    transit: document.getElementById('settings-transit-url'),
    error: document.getElementById('settings-error'),
    save: document.getElementById('settings-save'),
    reset: document.getElementById('settings-reset'),
    cancel: document.getElementById('settings-cancel'),
    closeBtn: document.getElementById('settings-close'),
    toggle: document.getElementById('settings-toggle'),
  };
}

function showSettingsError(msg, invalidField) {
  const { error, mailbox, transit } = settingsElements();
  error.textContent = msg || '';
  error.classList.toggle('hidden', !msg);
  mailbox.setAttribute('aria-invalid', String(invalidField === mailbox));
  transit.setAttribute('aria-invalid', String(invalidField === transit));
}

function openSettings() {
  const { overlay, mailbox, transit, toggle } = settingsElements();
  const s = readSettings();
  mailbox.value = (s.mailboxUrl || '');
  transit.value = (s.transitRelayUrl || '');
  transit.placeholder = settingsDefaultTransit();
  showSettingsError('', null);
  overlay.classList.remove('hidden');
  mailbox.focus();
  toggle.setAttribute('aria-expanded', 'true');
}

function closeSettings() {
  const { overlay, toggle } = settingsElements();
  overlay.classList.add('hidden');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.focus();
}

function saveSettings() {
  const { mailbox, transit } = settingsElements();
  const mb = validateRelayUrl(mailbox.value);
  if (!mb.ok) return showSettingsError('Mailbox server: ' + mb.error, mailbox);
  const tr = validateRelayUrl(transit.value);
  if (!tr.ok) return showSettingsError('Transit relay: ' + tr.error, transit);

  const next = {};
  if (mb.value) next.mailboxUrl = mb.value;
  if (tr.value) next.transitRelayUrl = tr.value;
  try {
    if (Object.keys(next).length === 0) localStorage.removeItem(SETTINGS_KEY);
    else localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch (_) {
    return showSettingsError('Could not save settings (browser storage unavailable)', null);
  }
  updateSettingsDot();
  closeSettings();
}

function resetSettings() {
  const { mailbox, transit } = settingsElements();
  mailbox.value = '';
  transit.value = '';
  try { localStorage.removeItem(SETTINGS_KEY); } catch (_) {}
  showSettingsError('', null);
  updateSettingsDot();
  mailbox.focus();
}

(function initSettings() {
  const { overlay, save, reset, cancel, closeBtn, toggle } = settingsElements();
  if (!overlay) return;
  toggle.setAttribute('aria-expanded', 'false');
  toggle.addEventListener('click', openSettings);
  closeBtn.addEventListener('click', closeSettings);
  cancel.addEventListener('click', closeSettings);
  save.addEventListener('click', saveSettings);
  reset.addEventListener('click', resetSettings);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSettings(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeSettings();
  });
  updateSettingsDot();
})();

// --- Send text messages ---
const MAX_TEXT_BYTES = 512 * 1024; // keep in sync with wasm-client.js MAX_INLINE_TEXT_SIZE
const sendTextPanel = document.getElementById('send-text-panel');
const sendTextInput = document.getElementById('send-text-input');
const sendTextSubmit = document.getElementById('send-text-submit');
const sendTextHint = document.getElementById('send-text-hint');

function setSendTextHint(msg) {
  if (!sendTextHint) return;
  sendTextHint.textContent = msg || '';
  sendTextHint.classList.toggle('hidden', !msg);
}

function updateSendTextSubmit() {
  if (sendTextSubmit) sendTextSubmit.disabled = sendTextInput.value.trim().length === 0;
  setSendTextHint('');
}

function toggleSendText(show) {
  sendTextPanel.classList.toggle('hidden', !show);
  document.getElementById('btn-text').classList.toggle('hidden', show);
  if (show) sendTextInput.focus();
  else {
    setSendTextHint('');
  }
}

if (sendTextPanel && document.getElementById('btn-text')) {
  document.getElementById('btn-text').addEventListener('click', function() { toggleSendText(true); });
  document.getElementById('send-text-cancel').addEventListener('click', function() {
    sendTextInput.value = '';
    updateSendTextSubmit();
    toggleSendText(false);
  });
  sendTextInput.addEventListener('input', updateSendTextSubmit);
  sendTextInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !sendTextSubmit.disabled) {
      sendTextSubmit.click();
    }
  });
  sendTextSubmit.addEventListener('click', function() {
    const text = sendTextInput.value;
    if (!text.trim()) return;
    if (new Blob([text]).size > MAX_TEXT_BYTES) {
      setSendTextHint('Text is too large (max 512 KB). Send a file instead.');
      return;
    }
    sendTextInput.value = '';
    updateSendTextSubmit();
    toggleSendText(false);
    track('send-text', { size: sizeBucket(new Blob([text]).size) });
    startSend(new File([text], 'message.txt', { type: 'text/plain' }));
  });
}

// --- Receive text messages ---
if (document.getElementById('btn-copy-text')) {
  document.getElementById('btn-copy-text').addEventListener('click', function() {
    if (lastReceivedText === null) return;
    navigator.clipboard.writeText(lastReceivedText).then(function() {
      var label = document.getElementById('copy-text-label');
      label.textContent = 'Copied!';
      setTimeout(function() { label.textContent = 'Copy'; }, 1000);
    });
  });
  document.getElementById('btn-download-text').addEventListener('click', function() {
    if (lastReceivedText === null) return;
    var url = URL.createObjectURL(new Blob([lastReceivedText], { type: 'text/plain' }));
    var a = document.createElement('a');
    a.href = url;
    a.download = lastReceivedFilename || 'message.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 60000);
  });
}

// --- "Get entangle" link: the target is configurable on the server ---
loadConfig().then(function(cfg) {
  const link = document.getElementById('entangle-link');
  if (link && /^https?:\/\//.test(cfg.entangleUrl)) link.href = cfg.entangleUrl;
});
