import ffmpeg from '@ffmpeg-installer/ffmpeg';
import { spawn } from 'child_process';

const OPUS_RATE = 48000;
const OPUS_FRAME_SAMPLES = 960;

export function ffmpegPath() {
  return ffmpeg.path;
}

export async function mp3ToOpusFrames(mp3Buffer) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg.path, [
      '-hide_banner', '-loglevel', 'error',
      '-i', 'pipe:0',
      '-ac', '1', '-ar', String(OPUS_RATE),
      '-c:a', 'libopus', '-frame_size', String(OPUS_FRAME_SAMPLES),
      '-f', 'ogg', 'pipe:1',
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    const out = [];
    proc.stdout.on('data', (d) => out.push(d));
    let err = '';
    proc.stderr.on('data', (d) => { err += d.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg: ${err || code}`));
      try {
        resolve(parseOggAudioPackets(Buffer.concat(out)));
      } catch (e) {
        reject(e);
      }
    });
    proc.stdin.on('error', () => {});
    proc.stdin.write(mp3Buffer);
    proc.stdin.end();
  });
}

export function parseOggAudioPackets(oggBuffer) {
  const packets = [];
  let offset = 0;
  let continued = Buffer.alloc(0);
  let segmentCount = 0;
  let packetInProgress = null;

  while (offset < oggBuffer.length) {
    if (oggBuffer.readUInt32BE(offset) !== 0x4f676753) throw new Error('Invalid Ogg page');
    const headerType = oggBuffer[offset + 5];
    const granule = oggBuffer.readBigUInt64LE(offset + 6);
    const serial = oggBuffer.readUInt32LE(offset + 14);
    const pageSeq = oggBuffer.readUInt32LE(offset + 18);
    const segCount = oggBuffer[offset + 26];
    const segTable = offset + 27;
    let bodyStart = segTable + segCount;
    if (bodyStart > oggBuffer.length) throw new Error('Truncated Ogg page');

    let pos = segTable;
    let packet = continued;
    let packetSegs = 0;

    for (let i = 0; i < segCount; i++) {
      const lacing = oggBuffer[pos++];
      if (packetSegs === 0 && lacing === 255 && packetInProgress === null) {
        packetInProgress = { granule, serial };
      }
      packet = Buffer.concat([packet, oggBuffer.subarray(bodyStart, bodyStart + lacing)]);
      bodyStart += lacing;
      packetSegs += 1;

      if (lacing < 255) {
        if (packetInProgress) {
          packetInProgress.granule = granule;
          packets.push({ packet, granule: packetInProgress.granule, serial });
          packetInProgress = null;
        } else if (headerType !== 0x02 || packets.length === 0) {
          packets.push({ packet, granule, serial });
        }
        packet = Buffer.alloc(0);
        packetSegs = 0;
      }
    }

    if (packetSegs > 0 && packet.length > 0) {
      continued = packet;
    } else {
      continued = Buffer.alloc(0);
    }
    segmentCount += segCount;

    offset = bodyStart;
    void headerType;
    void pageSeq;
  }

  return packets.filter((p) => p.packet.length > 0 && p.granule > 0n);
}

export function buildOggOpus(frames) {
  const pages = [];
  let seq = 0;
  const headPage = pageFromPackets([buildOpusHead()], 0n, 1, seq++, 0x02);
  pages.push(headPage);
  const tagsPage = pageFromPackets([buildOpusTags()], 0n, 1, seq++, 0x00);
  pages.push(tagsPage);

  const packets = frames.map((f, i) => ({
    data: f,
    granule: BigInt(OPUS_FRAME_SAMPLES * (i + 1)),
  }));

  let granule = 0n;
  let pagePackets = [];
  let pageSegs = 0;
  const pagesData = [];
  for (const p of packets) {
    const segsFor = Math.ceil(p.data.length / 255);
    if (pageSegs + segsFor > 255 && pagePackets.length > 0) {
      pagesData.push(pagePackets);
      pagePackets = [];
      pageSegs = 0;
    }
    pagePackets.push(p);
    pageSegs += segsFor;
  }
  if (pagePackets.length > 0) {
    pagesData.push(pagePackets);
  }
  for (let i = 0; i < pagesData.length; i++) {
    const isLast = i === pagesData.length - 1;
    const headerType = isLast ? 0x04 : 0x00;
    const lastPkt = pagesData[i][pagesData[i].length - 1];
    pages.push(pageFromPackets(pagesData[i].map((x) => x.data), lastPkt.granule, 1, seq++, headerType));
  }
  return Buffer.concat(pages);
}

function pageFromPackets(packetDatas, granule, serial, seq, headerType = 0x00) {
  const segs = [];
  const body = [];
  for (const pkt of packetDatas) {
    let pos = 0;
    while (pos < pkt.length) {
      const remain = pkt.length - pos;
      const lacing = remain >= 255 ? 255 : remain;
      segs.push(lacing);
      pos += lacing;
    }
    if (pkt.length > 0 && pkt.length % 255 === 0) segs.push(0);
    body.push(pkt);
  }
  const bodyBuf = Buffer.concat(body);
  return buildPage(headerType, segs, granule, serial, seq, bodyBuf);
}

function buildPage(headerType, segs, granule, serial, seq, body) {
  const segTable = Buffer.from(segs);
  const headerSize = 27 + segTable.length;
  const page = Buffer.alloc(headerSize + body.length);
  page.writeUInt32BE(0x4f676753, 0);
  page[4] = 0;
  page[5] = headerType;
  page.writeBigUInt64LE(granule, 6);
  page.writeUInt32LE(serial, 14);
  page.writeUInt32LE(seq, 18);
  page.writeUInt32LE(0, 22);
  page[26] = segs.length;
  segTable.copy(page, 27);
  body.copy(page, headerSize);
  const crc = crc32(page);
  page.writeUInt32LE(crc, 22);
  return page;
}

const crcLookup = [];
for (let i = 0; i < 256; i++) {
  let r = i << 24;
  for (let j = 0; j < 8; j++) {
    r = (r & 0x80000000) ? ((r << 1) ^ 0x04c11db7) : (r << 1);
  }
  crcLookup[i] = r >>> 0;
}

export function crc32(buf) {
  let crc = 0;
  for (const byte of buf) {
    crc = ((crc << 8) & 0xffffffff) ^ crcLookup[((crc >>> 24) & 0xff) ^ byte];
  }
  return crc >>> 0;
}

function buildOpusHead() {
  const head = Buffer.alloc(19);
  head.write('OpusHead', 0, 'ascii');
  head[8] = 1;
  head[9] = 1;
  head.writeUInt16LE(312, 10);
  head.writeUInt32LE(OPUS_RATE, 12);
  head.writeInt16LE(0, 16);
  head[18] = 0;
  return head;
}

function buildOpusTags() {
  const vendor = 'WhatsAppAIBot';
  const vendorBuf = Buffer.from(vendor, 'utf8');
  const tags = Buffer.alloc(8 + 4 + vendorBuf.length + 4);
  tags.write('OpusTags', 0, 'ascii');
  tags.writeUInt32LE(vendorBuf.length, 8);
  vendorBuf.copy(tags, 12);
  tags.writeUInt32LE(0, 12 + vendorBuf.length);
  return tags;
}
