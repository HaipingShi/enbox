import http from 'node:http';

// 本地 mock：OpenAI 兼容 /chat/completions，返回 SSE 流
export function startMockServer(port = 0) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url.endsWith('/chat/completions')) {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          res.writeHead(200, { 'content-type': 'text/event-stream' });
          const chunks = [
            'Hello',
            ', I want ',
            'to test this ',
            'flow.',
            '\n\n💡 "我想测试一下" 更自然的说法：',
            '"Let me run a quick test."',
          ];
          let i = 0;
          const timer = setInterval(() => {
            if (i < chunks.length) {
              res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunks[i++] } }] })}\n\n`);
            } else {
              res.write('data: [DONE]\n\n');
              res.end();
              clearInterval(timer);
            }
          }, 15);
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    srv.listen(port, '127.0.0.1', () => resolve({ server: srv, port: srv.address().port }));
  });
}
