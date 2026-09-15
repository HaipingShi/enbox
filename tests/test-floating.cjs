const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const appRequire = require('node:module').createRequire(require('node:path').resolve('main.js'));

// Exercise the real renderer handlers with pointer capture and animation frames.
const handlers = {};
const frames = [];
const moves = [];
let expanded = 0;
const ball = { addEventListener: (name, fn) => { handlers[name] = fn; }, setPointerCapture() {} };
const renderer = fs.readFileSync('ui/app.js', 'utf8');
vm.runInNewContext(renderer.slice(renderer.indexOf('let ballDrag'), renderer.indexOf('/* ── 流式输出')),
  { $: () => ball, window: { enbox: { moveBy: (x, y) => moves.push([x, y]), expand: () => expanded++, quit() {} }, addEventListener() {} },
    requestAnimationFrame: fn => frames.push(fn) });
handlers.pointerdown({ button: 0, screenX: 100, screenY: 100, pointerId: 1 });
for (const x of [110, 120, 130]) {
  handlers.pointermove({ screenX: x, screenY: 100 });
  while (frames.length) frames.shift()();
}
handlers.pointerup({});
assert.equal(moves.reduce((sum, [x]) => sum + x, 0), 30, '30px cursor movement must move the ball exactly 30px');
assert.equal(expanded, 0, 'drag must not expand');
handlers.pointerdown({ button: 0, screenX: 100, screenY: 100, pointerId: 2 });
handlers.pointerup({});
assert.equal(expanded, 1, 'click must expand');

// Exercise main-process transitions against a window enforcing native minimum sizes.
const calls = [];
let bounds = { x: 400, y: 200, width: 420, height: 540 };
let minimum = [320, 400];
const wa = { x: 0, y: 25, width: 1440, height: 875 };
const secondary = { x: -1280, y: 25, width: 1280, height: 775 };
const fakeWin = {
  getBounds: () => ({ ...bounds }),
  setBounds: r => { bounds = { ...r, width: Math.max(r.width, minimum[0]), height: Math.max(r.height, minimum[1]) }; },
  setMinimumSize: (w, h) => { minimum = [w, h]; },
  getPosition: () => [bounds.x, bounds.y],
  setPosition: (x, y) => { bounds.x = x; bounds.y = y; },
  setAlwaysOnTop() {}, setVisibleOnAllWorkspaces: value => calls.push(value),
  show() {}, focus() {}, isMinimized: () => false,
  webContents: { send() {} },
};
const ipc = {};
const electron = {
  app: { whenReady: () => ({ then() {} }), on() {} },
  ipcMain: { handle() {}, on: (name, fn) => { ipc[name] = fn; } },
  screen: { getDisplayNearestPoint: p => ({ workArea: p.x < 0 ? secondary : wa }), getPrimaryDisplay: () => ({ workArea: wa }), getCursorScreenPoint: () => ({ x: -500, y: 200 }) },
};
const context = vm.createContext({ require: name => name === 'electron' ? electron : name === './lib/sse' ? {} : appRequire(name), __dirname: process.cwd(), process, setTimeout, clearTimeout });
vm.runInContext(fs.readFileSync('main.js', 'utf8') + '\nwin = globalThis.fakeWin; config = {};', Object.assign(context, { fakeWin }));
vm.runInContext('fold()', context);
assert.equal(bounds.width, 48, 'fold must release main-window minimum width');
assert.equal(bounds.height, 48);
vm.runInContext("dock('left'); homeBall()", context);
assert.equal(bounds.width, 48, 'restore must turn a docked strip into a ball');
assert.equal(bounds.height, 48);
assert.ok(bounds.x >= secondary.x && bounds.x + bounds.width <= 0, 'restore must use the display under the cursor');
assert.ok(!calls.includes(false), 'show must not detach the window from all Spaces');
vm.runInContext('expand()', context);
assert.equal(bounds.width, 420);
assert.deepEqual(minimum, [320, 400]);
console.log('✅ Floating window regression tests passed');
