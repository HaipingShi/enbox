import assert from 'node:assert';
import { startMockServer } from './mock-server.mjs';
import { streamChat } from '../lib/sse.js';

const { server, port } = await startMockServer();
let deltas = 0;
const full = await streamChat({
  baseUrl: `http://127.0.0.1:${port}/v1`,
  apiKey: 'test-key',
  model: 'mock-model',
  systemPrompt: 'x',
  userText: '我想测试一下',
  onDelta: () => deltas++,
});
server.close();

assert.ok(deltas >= 6, `应收到多个 delta，实际 ${deltas}`);
assert.ok(full.startsWith('Hello'), '全文应以 Hello 开头');
assert.ok(full.includes('💡'), '全文应包含学习笔记标记');
console.log(`✅ SSE 链路测试通过：${deltas} 个增量，全文 ${full.length} 字符`);
