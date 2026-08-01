import crypto from 'crypto';
import WebSocket from 'ws';
import logger from '../logger.js';

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const CHROMIUM_FULL_VERSION = '143.0.3650.75';
const WINDOWS_FILE_TIME_EPOCH = 11644473600n;
const WSS_URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';

function generateSecMsGecToken() {
  const ticks = BigInt(Math.floor(Date.now() / 1000 + Number(WINDOWS_FILE_TIME_EPOCH))) * 10000000n;
  const roundedTicks = ticks - (ticks % 3000000000n);
  const strToHash = `${roundedTicks}${TRUSTED_CLIENT_TOKEN}`;
  return crypto.createHash('sha256').update(strToHash, 'ascii').digest('hex').toUpperCase();
}

function generateMuid() {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}

function connectId() {
  return crypto.randomBytes(16).toString('hex');
}

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&apos;';
      default: return c;
    }
  });
}

function dateToString() {
  const d = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const wd = days[d.getUTCDay()];
  const mon = months[d.getUTCMonth()];
  const day = String(d.getUTCDate()).padStart(2, '0');
  const year = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${wd} ${mon} ${day} ${year} ${hh}:${mm}:${ss} GMT+0000 (Coordinated Universal Time)`;
}

export async function synthesizeSpeech(text, voice = 'pt-BR-FranciscaNeural', lang = 'pt-BR') {
  const gec = generateSecMsGecToken();
  const muid = generateMuid();
  const connId = connectId();
  const outputFormat = 'audio-24khz-48kbitrate-mono-mp3';

  return new Promise((resolve, reject) => {
    const url = `${WSS_URL}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=1-${CHROMIUM_FULL_VERSION}&ConnectionId=${connId}`;
    const ws = new WebSocket(url, {
      host: 'speech.platform.bing.com',
      origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
        'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_FULL_VERSION.split('.')[0]}.0.0.0 Safari/537.36 Edg/${CHROMIUM_FULL_VERSION.split('.')[0]}.0.0.0`,
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': `muid=${muid};`,
      },
    });

    const chunks = [];
    let finished = false;
    const timeout = setTimeout(() => {
      if (!finished) {
        try { ws.close(); } catch {}
        reject(new Error('Edge-TTS timeout'));
      }
    }, 30000);

    ws.on('open', () => {
      const ts = dateToString();
      ws.send(`X-Timestamp:${ts}Z\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"${outputFormat}"}}}}\r\n`);

      const requestId = crypto.randomBytes(16).toString('hex');
      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}"><voice name="${voice}"><prosody rate="+0%" pitch="+0Hz" volume="+0%">${escapeXml(text)}</prosody></voice></speak>`;
      ws.send(`X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts}Z\r\nPath:ssml\r\n\r\n${ssml}`);
    });

    ws.on('message', (data, isBinary) => {
      if (finished) return;
      if (isBinary) {
        const separator = 'Path:audio\r\n';
        const idx = data.indexOf(separator);
        if (idx !== -1) {
          chunks.push(data.subarray(idx + separator.length));
        }
      } else {
        const message = data.toString();
        if (message.includes('Path:turn.end')) {
          finished = true;
          clearTimeout(timeout);
          try { ws.close(); } catch {}
          resolve(Buffer.concat(chunks));
        }
      }
    });

    ws.on('error', (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      reject(err);
    });
  });
}
