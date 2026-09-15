const { app, BrowserWindow, ipcMain, clipboard, globalShortcut, Menu, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { streamChat } = require('./lib/sse');

const DEFAULT_SYSTEM_PROMPT = `You are my English coach. I type my thoughts in Chinese (sometimes mixed with English or tech terms); you re-express them in English that I can send directly to an AI assistant or a coding agent.

Rules:
1. FIRST output the English version only — natural, concise, idiomatic, ready to send. Do NOT answer my question; only re-express it. Preserve technical terms, code identifiers and file paths as-is. If my input is already mostly English, polish it instead.
2. THEN, after one blank line, add 1-3 short learning notes in Chinese. Each note is a single line starting with "💡": a more idiomatic phrasing, a useful expression, or a small grammar point. Skip the notes if there is nothing worth pointing out.
The first block must stay clean and copy-paste ready — never merge it with the notes.`;

const DEFAULTS = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  autoCopy: true,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  windowBounds: null,
  fontSize: 14,
  opacity: 0.96,
  autoStart: false,
  alwaysOnTop: true,
  temperature: 0.4,
};

let win = null;
let quitting = false;
let view = 'main'; // main | ball | docked
let savedBounds = null;
let suppressMoveUntil = 0;
let inflight = null;
let config = null;

function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}
function loadConfig() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(configPath(), 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}
function saveConfig(patch) {
  config = { ...config, ...patch };
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2));
}

function setBoundsSafe(r) {
  suppressMoveUntil = Date.now() + 250;
  win.setBounds(r);
}

function workAreaOf(b) {
  return screen.getDisplayNearestPoint({ x: b.x, y: b.y }).workArea;
}

function dock(side) {
  if (!win || view === 'docked') return;
  const b = win.getBounds();
  if (view === 'main') savedBounds = b;
  const wa = workAreaOf(b);
  const rect =
    side === 'left'
      ? { x: wa.x, y: Math.round(wa.y + wa.height / 2 - 60), width: 14, height: 120 }
      : { x: wa.x + wa.width - 14, y: Math.round(wa.y + wa.height / 2 - 60), width: 14, height: 120 };
  setBoundsSafe(rect);
  view = 'docked';
  win.webContents.send('view', 'docked');
}

function fold() {
  if (!win) return;
  if (view === 'main') savedBounds = win.getBounds();
  const b = win.getBounds();
  const wa = workAreaOf(b);
  setBoundsSafe({
    x: Math.min(Math.max(b.x, wa.x), wa.x + wa.width - 48),
    y: Math.min(Math.max(b.y, wa.y), wa.y + wa.height - 48),
    width: 48,
    height: 48,
  });
  view = 'ball';
  win.webContents.send('view', 'ball');
}

function expand() {
  if (!win || view === 'main') return;
  const wa = workAreaOf(win.getBounds());
  const r = { ...(savedBounds || { x: wa.x + wa.width - 460, y: wa.y + 80, width: 420, height: 540 }) };
  // 恢复位置向内收一点，避免立刻再次触发贴边吸附
  if (r.x <= wa.x + 8) r.x = wa.x + 24;
  if (r.x + r.width >= wa.x + wa.width - 8) r.x = wa.x + wa.width - r.width - 24;
  r.x = Math.min(Math.max(r.x, wa.x), wa.x + wa.width - r.width);
  r.y = Math.min(Math.max(r.y, wa.y), wa.y + wa.height - r.height);
  setBoundsSafe(r);
  view = 'main';
  win.webContents.send('view', 'main');
}

function onMoved() {
  if (!win || view !== 'main') return;
  if (Date.now() < suppressMoveUntil) return;
  const b = win.getBounds();
  const wa = workAreaOf(b);
  const TH = 8;
  if (b.x <= wa.x + TH) dock('left');
  else if (b.x + b.width >= wa.x + wa.width - TH) dock('right');
}

let persistTimer = null;
function saveBoundsSoon() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    if (view !== 'main' || !win) return;
    try {
      saveConfig({ windowBounds: win.getBounds() });
    } catch {}
  }, 500);
}

function createWindow() {
  win = new BrowserWindow({
    width: 420,
    height: 540,
    minWidth: 320,
    minHeight: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (config.windowBounds) {
    try {
      // 恢复上次位置，但保证至少 40px 留在屏幕内
      const wa = screen.getPrimaryDisplay().workArea;
      const b = { ...config.windowBounds };
      b.width = Math.min(b.width, wa.width);
      b.height = Math.min(b.height, wa.height);
      b.x = Math.min(Math.max(b.x, wa.x - b.width + 40), wa.x + wa.width - 40);
      b.y = Math.min(Math.max(b.y, wa.y), wa.y + wa.height - 40);
      win.setBounds(b);
    } catch {}
  }
  win.loadFile(path.join(__dirname, 'ui', 'index.html'));
  win.once('ready-to-show', () => win.show());
  // 跨空间悬浮：桌面空间和全屏应用之上都可见
  win.setAlwaysOnTop(config.alwaysOnTop !== false, 'floating');
  try {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } catch {}
  win.on('moved', onMoved);
  win.on('move', saveBoundsSoon);
  win.on('resize', saveBoundsSoon);
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

function toggleWindow() {
  if (!win) return;
  if (win.isVisible()) win.hide();
  else {
    win.show();
    win.focus();
  }
}

ipcMain.handle('settings:get', () => config);
ipcMain.handle('settings:save', (e, patch) => {
  saveConfig(patch || {});
  if (patch && 'autoStart' in patch) {
    try {
      app.setLoginItemSettings({ openAtLogin: !!patch.autoStart });
    } catch {}
  }
  return true;
});
ipcMain.handle('copy:text', (e, t) => {
  clipboard.writeText(String(t ?? ''));
  return true;
});
ipcMain.handle('win:fold', () => fold());
ipcMain.handle('win:expand', () => expand());
ipcMain.on('win:moveBy', (e, dx, dy) => {
  if (!win) return;
  const p = win.getPosition();
  const b = win.getBounds();
  const wa = workAreaOf(b);
  // 留 20px 可见部分，防止小球被拖出屏幕找不回
  const cx = Math.min(Math.max(p[0] + Math.round(dx), wa.x - b.width + 20), wa.x + wa.width - 20);
  const cy = Math.min(Math.max(p[1] + Math.round(dy), wa.y), wa.y + wa.height - 20);
  win.setPosition(cx, cy);
});
ipcMain.handle('win:dock', (e, side) => dock(side === 'right' ? 'right' : 'left'));
ipcMain.handle('win:pin', (e, on) => {
  win.setAlwaysOnTop(!!on, 'floating');
  return !!on;
});
ipcMain.handle('win:hide', () => win.hide());
ipcMain.on('app:quit', () => {
  quitting = true;
  app.quit();
});
ipcMain.on('chat:abort', () => {
  if (inflight) inflight.abort();
});
ipcMain.handle('chat:send', async (e, userText) => {
  if (inflight) return { ok: false, error: '正在翻译中，请稍候' };
  const ctl = new AbortController();
  inflight = ctl;
  const t0 = Date.now();
  try {
    const full = await streamChat({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      systemPrompt: config.systemPrompt,
      userText,
      temperature: typeof config.temperature === 'number' ? config.temperature : undefined,
      signal: ctl.signal,
      onDelta: (d) => {
        if (!e.sender.isDestroyed()) e.sender.send('chat:delta', d);
      },
    });
    return { ok: true, text: full, ms: Date.now() - t0 };
  } catch (err) {
    const msg = err && err.name === 'AbortError' ? '已停止' : String((err && err.message) || err);
    return { ok: false, error: msg };
  } finally {
    inflight = null;
  }
});

app.whenReady().then(() => {
  config = loadConfig();
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { type: 'separator' }, { role: 'quit' }],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'close' }] },
    ])
  );
  try {
    app.dock.setIcon(path.join(__dirname, 'assets', 'icon.png'));
  } catch {}
  createWindow();
  const hk = process.platform === 'darwin' ? 'Control+Command+E' : 'Control+Alt+E';
  try {
    globalShortcut.register(hk, toggleWindow);
  } catch {}
  app.on('activate', () => {
    if (win) win.show();
  });
});

app.on('before-quit', () => {
  quitting = true;
});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {
  // 关窗只是隐藏，保持常驻
});
