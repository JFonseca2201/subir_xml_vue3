const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

async function getPageWsUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json/list', res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const pages = JSON.parse(data);
        const page = pages.find(p => p.url && p.url.includes('5173') && p.type === 'page');
        if (page) resolve(page.webSocketDebuggerUrl);
        else reject(new Error('Page not found'));
      });
    }).on('error', reject);
  });
}

function cdpSend(wsUrl, method, params = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(wsUrl);
    const key = crypto.randomBytes(16).toString('base64');
    
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      headers: {
        'Connection': 'Upgrade',
        'Upgrade': 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': key
      }
    });

    req.on('upgrade', (res, socket, head) => {
      const payload = JSON.stringify({
        id: Math.floor(Math.random() * 100000),
        method,
        params
      });
      const payloadBuf = Buffer.from(payload);
      const mask = crypto.randomBytes(4);
      let header;
      if (payloadBuf.length < 126) {
        header = Buffer.alloc(6);
        header[0] = 0x81;
        header[1] = 0x80 | payloadBuf.length;
        mask.copy(header, 2);
      } else {
        header = Buffer.alloc(8);
        header[0] = 0x81;
        header[1] = 0x80 | 126;
        header.writeUInt16BE(payloadBuf.length, 2);
        mask.copy(header, 4);
      }
      
      const maskedPayload = Buffer.alloc(payloadBuf.length);
      for (let i = 0; i < payloadBuf.length; i++) {
        maskedPayload[i] = payloadBuf[i] ^ mask[i % 4];
      }
      
      socket.write(Buffer.concat([header, maskedPayload]));

      let responseBuf = Buffer.alloc(0);
      socket.on('data', chunk => {
        responseBuf = Buffer.concat([responseBuf, chunk]);
        if (responseBuf.length >= 2) {
          const payloadLen = responseBuf[1] & 0x7F;
          let offset = 2;
          let len = payloadLen;
          if (payloadLen === 126) {
            len = responseBuf.readUInt16BE(2);
            offset = 4;
          } else if (payloadLen === 127) {
            len = Number(responseBuf.readBigUInt64BE(2));
            offset = 10;
          }
          if (responseBuf.length >= offset + len) {
            const framePayload = responseBuf.slice(offset, offset + len).toString();
            socket.end();
            try {
              const parsed = JSON.parse(framePayload);
              resolve(parsed.result);
            } catch (e) {
              resolve(framePayload);
            }
          }
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const wsUrl = await getPageWsUrl();

  // Scroll down 500px
  console.log('Scrolling down 500px...');
  await cdpSend(wsUrl, 'Runtime.evaluate', {
    expression: 'window.scrollTo({ top: 500, behavior: "instant" })'
  });
  await new Promise(r => setTimeout(r, 600));

  // Capture screenshot scrolled down
  const snap1 = await cdpSend(wsUrl, 'Page.captureScreenshot', { format: 'png' });
  if (snap1 && snap1.data) {
    fs.writeFileSync('scratch/screenshot_scrolled_down.png', Buffer.from(snap1.data, 'base64'));
    console.log('Saved scratch/screenshot_scrolled_down.png');
  }

  // Scroll back up to 0px
  console.log('Scrolling back up to 0px...');
  await cdpSend(wsUrl, 'Runtime.evaluate', {
    expression: 'window.scrollTo({ top: 0, behavior: "instant" })'
  });
  await new Promise(r => setTimeout(r, 600));

  // Capture screenshot scrolled up
  const snap2 = await cdpSend(wsUrl, 'Page.captureScreenshot', { format: 'png' });
  if (snap2 && snap2.data) {
    fs.writeFileSync('scratch/screenshot_scrolled_up.png', Buffer.from(snap2.data, 'base64'));
    console.log('Saved scratch/screenshot_scrolled_up.png');
  }
})();
