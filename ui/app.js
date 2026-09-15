const $ = (s) => document.querySelector(s);
const inputEl = $('#input');
const outputEl = $('#output');
const statusEl = $('#status');
const sendBtn = $('#sendBtn');
const stopBtn = $('#stopBtn');

let cfg = null;
let streaming = false;
let pinned = true;
let lastStatus = '就绪';

function setStatus(t) {
  lastStatus = t;
  statusEl.textContent = t;
}
function flashStatus(t) {
  setStatus(t);
  setTimeout(() => setStatus(lastStatus), 1600);
}

function englishPart(t) {
  const i = t.search(/^💡/m);
  return (i > 0 ? t.slice(0, i) : t).trim();
}

/* ── 视图切换：main / ball / docked ── */
window.enbox.onView((v) => {
  const main = v === 'main';
  $('#mainView').classList.toggle('hidden', !main);
  $('#ballView').classList.toggle('hidden', main);
  document.body.classList.toggle('docked', v === 'docked');
});

/* 小球/贴边条：手动拖拽 + 点击判定（拖动距离 <5px 视为点击 → 还原）
   mousedown 里同步记录坐标，禁止 await，避免快速点击时 mouseup 抢在 IPC 之前 */
let ballDrag = null;
let movePending = false;
$('#ballView').addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  ballDrag = { sx: e.screenX, sy: e.screenY, moved: false };
});
window.addEventListener('mousemove', (e) => {
  if (!ballDrag) return;
  const dx = e.screenX - ballDrag.sx;
  const dy = e.screenY - ballDrag.sy;
  if (!ballDrag.moved && Math.hypot(dx, dy) > 4) ballDrag.moved = true;
  if (ballDrag.moved && !movePending) {
    movePending = true;
    window.enbox.moveBy(dx, dy);
    requestAnimationFrame(() => {
      movePending = false;
    });
  }
});
window.addEventListener('mouseup', () => {
  if (ballDrag && !ballDrag.moved) window.enbox.expand();
  ballDrag = null;
});
$('#ballView').addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.enbox.quit();
});

/* ── 流式输出 ── */
window.enbox.onDelta((d) => {
  outputEl.value += d;
  outputEl.scrollTop = outputEl.scrollHeight;
});

async function doSend() {
  const text = inputEl.value.trim();
  if (!text || streaming) return;
  if (!cfg.apiKey || !cfg.baseUrl) {
    openSettings();
    setStatus('请先配置 API 地址和 Key');
    return;
  }
  streaming = true;
  outputEl.value = '';
  sendBtn.disabled = true;
  stopBtn.classList.remove('hidden');
  setStatus('翻译中…');
  const res = await window.enbox.send(text);
  streaming = false;
  sendBtn.disabled = false;
  stopBtn.classList.add('hidden');
  if (res.ok) {
    setStatus(`完成 · ${(res.ms / 1000).toFixed(1)}s`);
    if (cfg.autoCopy) {
      await window.enbox.copy(englishPart(res.text));
      flashStatus('已复制英文 ✓');
    }
  } else if (res.error === '已停止') {
    outputEl.value += '\n[已停止]';
    setStatus('已停止');
  } else {
    setStatus('失败：' + res.error.slice(0, 120));
    if (!outputEl.value) outputEl.value = '⚠️ ' + res.error;
  }
}

sendBtn.addEventListener('click', doSend);
stopBtn.addEventListener('click', () => window.enbox.abort());
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    doSend();
  }
});
$('#copyBtn').addEventListener('click', async () => {
  const t = englishPart(outputEl.value);
  if (!t) return;
  await window.enbox.copy(t);
  flashStatus('已复制 ✓');
});

/* ── 标题栏按钮 ── */
$('#pinBtn').addEventListener('click', async () => {
  pinned = !pinned;
  await window.enbox.setPin(pinned);
  $('#pinBtn').classList.toggle('off', !pinned);
});
$('#foldBtn').addEventListener('click', () => window.enbox.fold());
$('#hideBtn').addEventListener('click', () => window.enbox.hide());

/* ── 设置面板 ── */
function openSettings() {
  $('#fBaseUrl').value = cfg.baseUrl || '';
  $('#fApiKey').value = cfg.apiKey || '';
  $('#fModel').value = cfg.model || '';
  $('#fSystem').value = cfg.systemPrompt || '';
  $('#fAutoCopy').checked = !!cfg.autoCopy;
  $('#settingsPanel').classList.remove('hidden');
}
$('#settingsBtn').addEventListener('click', openSettings);
$('#cancelSettings').addEventListener('click', () => $('#settingsPanel').classList.add('hidden'));
$('#saveSettings').addEventListener('click', async () => {
  cfg = {
    ...cfg,
    baseUrl: $('#fBaseUrl').value.trim() || cfg.baseUrl,
    apiKey: $('#fApiKey').value.trim(),
    model: $('#fModel').value.trim() || cfg.model,
    systemPrompt: $('#fSystem').value,
    autoCopy: $('#fAutoCopy').checked,
  };
  await window.enbox.saveConfig({
    baseUrl: cfg.baseUrl,
    apiKey: cfg.apiKey,
    model: cfg.model,
    systemPrompt: cfg.systemPrompt,
    autoCopy: cfg.autoCopy,
  });
  $('#settingsPanel').classList.add('hidden');
  setStatus(`就绪 · ${cfg.model}`);
});

/* ── 初始化 ── */
(async function init() {
  cfg = await window.enbox.getConfig();
  pinned = true;
  setStatus(cfg.model ? `就绪 · ${cfg.model}` : '就绪');
  inputEl.focus();
})();
