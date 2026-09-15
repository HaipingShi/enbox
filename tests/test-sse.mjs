import assert from 'node:assert';
import { startMockServer } from './mock-server.mjs';
import { streamChat } from '../lib/sse.js';
import { buildTranslationPrompt } from '../lib/translation.js';

const requests = [];
const { server, port } = await startMockServer(0, body => requests.push(body));
let deltas = 0;
const full = await streamChat({
  baseUrl: `http://127.0.0.1:${port}/v1`,
  apiKey: 'test-key',
  model: 'mock-model',
  systemPrompt: buildTranslationPrompt('Use concise language.', '我想测试一下'),
  userText: '我想测试一下',
  onDelta: () => deltas++,
});
await streamChat({
  baseUrl: `http://127.0.0.1:${port}/v1`,
  apiKey: 'test-key', model: 'mock-model',
  systemPrompt: buildTranslationPrompt('Use concise language.', 'Please explain this error.'),
  userText: 'Please explain this error.',
});
server.close();
assert.equal(requests.length, 2);
assert.equal(requests[0].messages[1].content, '我想测试一下');
assert.equal(requests[1].messages[1].content, 'Please explain this error.');
for (const request of requests) {
  assert.equal(request.messages[0].role, 'system');
  assert.equal(request.messages[0].content, buildTranslationPrompt('Use concise language.', request.messages[1].content));
}

assert.ok(deltas >= 6, `应收到多个 delta，实际 ${deltas}`);
assert.ok(full.startsWith('Hello'), '全文应以 Hello 开头');
assert.ok(full.includes('💡'), '全文应包含学习笔记标记');
console.log(`✅ SSE 链路测试通过：${deltas} 个增量，全文 ${full.length} 字符`);
