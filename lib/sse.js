// 纯 Node 模块：调用 OpenAI 兼容 /chat/completions，流式解析 SSE。
// 不依赖 electron，方便在 Node 里直接做链路测试。
async function streamChat({ baseUrl, apiKey, model, systemPrompt, userText, onDelta, signal, temperature }) {
  const url = baseUrl.replace(/\/+$/, '') + '/chat/completions';
  const messages = [{ role: 'system', content: systemPrompt }];
  if (userText) messages.push({ role: 'user', content: userText });
  const body = { model, stream: true, messages };
  if (typeof temperature === 'number') body.temperature = temperature;

  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${t.slice(0, 300)}`);
  }

  const decoder = new TextDecoder();
  let buf = '';
  let full = '';
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trimEnd();
      buf = buf.slice(idx + 1);
      if (!line.startsWith('data:')) continue; // 跳过注释/空行/keep-alive
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const j = JSON.parse(data);
        const delta = j.choices?.[0]?.delta?.content || '';
        if (delta) {
          full += delta;
          if (onDelta) onDelta(delta);
        }
      } catch {
        // 单个分片 JSON 不完整时忽略，等下一个分片
      }
    }
  }
  return full;
}

module.exports = { streamChat };
