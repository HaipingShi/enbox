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

/* ── 外观（字体大小 / 不透明度） ── */
function applyAppearance() {
  document.documentElement.style.setProperty('--fs', (cfg.fontSize || 14) + 'px');
  document.documentElement.style.setProperty('--bg-a', String(cfg.opacity ?? 0.96));
}

/* ⌘/Ctrl + +/-/0 快速调字体 */
window.addEventListener('keydown', (e) => {
  if (!(e.metaKey || e.ctrlKey)) return;
  if (!['=', '+', '-', '0'].includes(e.key)) return;
  e.preventDefault();
  let s = cfg.fontSize || 14;
  if (e.key === '0') s = 14;
  else if (e.key === '-') s = Math.max(12, s - 1);
  else s = Math.min(20, s + 1);
  cfg.fontSize = s;
  applyAppearance();
  window.enbox.saveConfig({ fontSize: s });
  flashStatus(`字体 ${s}px`);
});

/* ── 视图切换：main / ball / docked ── */
window.enbox.onView((v) => {
  const main = v === 'main';
  $('#mainView').classList.toggle('hidden', !main);
  $('#ballView').classList.toggle('hidden', main);
  document.body.classList.toggle('docked', v === 'docked');
});

/* 小球/贴边条：手动拖拽 + 点击判定（拖动距离 <5px 视为点击 → 还原）
   使用 Pointer Capture 确保拖拽结束事件必达，避免拖拽状态卡死导致浮球「跟鼠标跑」 */
let ballDrag = null;
let movePending = false;
const ballView = $('#ballView');
ballView.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  ballDrag = { sx: e.screenX, sy: e.screenY, moved: false };
  try {
    ballView.setPointerCapture(e.pointerId);
  } catch {}
});
ballView.addEventListener('pointermove', (e) => {
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
function endBallDrag() {
  if (ballDrag && !ballDrag.moved) window.enbox.expand();
  ballDrag = null;
}
ballView.addEventListener('pointerup', endBallDrag);
ballView.addEventListener('pointercancel', () => {
  ballDrag = null;
});
window.addEventListener('blur', () => {
  ballDrag = null;
});
ballView.addEventListener('contextmenu', (e) => {
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
  window.enbox.saveConfig({ alwaysOnTop: pinned });
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
  $('#fFontSize').value = cfg.fontSize || 14;
  $('#fontSizeVal').textContent = (cfg.fontSize || 14) + 'px';
  $('#fOpacity').value = Math.round((cfg.opacity ?? 0.96) * 100);
  $('#opacityVal').textContent = Math.round((cfg.opacity ?? 0.96) * 100) + '%';
  $('#fAutoCopy').checked = !!cfg.autoCopy;
  $('#fAutoStart').checked = !!cfg.autoStart;
  $('#fAlwaysTop').checked = cfg.alwaysOnTop !== false;
  $('#fTemp').value = cfg.temperature ?? 0.4;
  $('#settingsPanel').classList.remove('hidden');
}
$('#settingsBtn').addEventListener('click', openSettings);
$('#cancelSettings').addEventListener('click', () => {
  applyAppearance(); // 撤销滑块的实时预览
  $('#settingsPanel').classList.add('hidden');
});
$('#fFontSize').addEventListener('input', (e) => {
  const v = +e.target.value;
  $('#fontSizeVal').textContent = v + 'px';
  cfg.fontSize = v;
  applyAppearance();
});
$('#fOpacity').addEventListener('input', (e) => {
  const v = +e.target.value;
  $('#opacityVal').textContent = v + '%';
  cfg.opacity = v / 100;
  applyAppearance();
});
$('#saveSettings').addEventListener('click', async () => {
  const patch = {
    baseUrl: $('#fBaseUrl').value.trim() || cfg.baseUrl,
    apiKey: $('#fApiKey').value.trim(),
    model: $('#fModel').value.trim() || cfg.model,
    systemPrompt: $('#fSystem').value,
    autoCopy: $('#fAutoCopy').checked,
    fontSize: +$('#fFontSize').value,
    opacity: +$('#fOpacity').value / 100,
    autoStart: $('#fAutoStart').checked,
    alwaysOnTop: $('#fAlwaysTop').checked,
    temperature: Math.min(2, Math.max(0, +$('#fTemp').value || 0)),
  };
  cfg = { ...cfg, ...patch };
  await window.enbox.saveConfig(patch);
  applyAppearance();
  pinned = cfg.alwaysOnTop !== false;
  await window.enbox.setPin(pinned);
  $('#pinBtn').classList.toggle('off', !pinned);
  $('#settingsPanel').classList.add('hidden');
  setStatus(`就绪 · ${cfg.model}`);
});

/* ── 初始化 ── */
(async function init() {
  cfg = await window.enbox.getConfig();
  pinned = cfg.alwaysOnTop !== false;
  $('#pinBtn').classList.toggle('off', !pinned);
  applyAppearance();
  setStatus(cfg.model ? `就绪 · ${cfg.model}` : '就绪');
  inputEl.focus();
})();
