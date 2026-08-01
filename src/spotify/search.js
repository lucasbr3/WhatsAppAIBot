import crypto from 'crypto';
import logger from '../logger.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0';
const SECRET = '376136387538459893883312310911992847112448894410210511297108';
const TOTP_VERSION = 61;
const APP_VERSION = '1.2.92.50.g97692e81';
const FALLBACK_HASHES = [
  'eff59fa0a3d026b88b56fddbcf4bdfa16a186b8175a5c1a358c072e053c2e5b0',
  '21b3fe49546912ba782db5c47e9ef5a7dbd20329520ba0c7d0fcfadee671d24e',
];

const base = { referer: 'https://open.spotify.com/', origin: 'https://open.spotify.com', 'user-agent': UA, 'accept-language': 'pt' };
const session = { token: null, clientToken: null, expires: 0 };
let discoveredHash = null;

function totp(tsms) {
  const counter = Math.floor(tsms / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', Buffer.from(SECRET, 'utf8')).update(buf).digest();
  const offset = digest[digest.length - 1] & 0xf;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
}

async function getAuth(force) {
  if (!force && session.token && Date.now() < session.expires - 60000) return session;
  const now = Date.now();
  const params = new URLSearchParams({ reason: 'init', productType: 'web-player', totp: totp(now), totpServer: totp(now), totpVer: String(TOTP_VERSION) });
  const res = await fetch(`https://open.spotify.com/api/token?${params}`, { headers: base });
  const token = await res.json();
  if (!token?.accessToken) throw new Error('token request failed');

  const client = await (await fetch('https://clienttoken.spotify.com/v1/clienttoken', {
    method: 'POST',
    headers: { ...base, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      client_data: {
        client_version: APP_VERSION,
        client_id: token.clientId,
        js_sdk_data: { device_brand: 'unknown', device_model: 'unknown', os: 'windows', os_version: 'NT 10.0', device_id: crypto.randomUUID(), device_type: 'computer' },
      },
    }),
  })).json();
  if (!client?.granted_token?.token) throw new Error('client token request failed');

  session.token = token.accessToken;
  session.clientToken = client.granted_token.token;
  session.expires = token.accessTokenExpirationTimestampMs || now + 3000000;
  return session;
}

async function discoverHash() {
  if (discoveredHash !== null) return discoveredHash || null;
  discoveredHash = '';
  try {
    const html = await (await fetch('https://open.spotify.com/', { headers: { 'user-agent': UA } })).text();
    const mainUrl = (html.match(/https:\/\/open\.spotifycdn\.com\/cdn\/build\/web-player\/web-player\.[0-9a-f]+\.js/) || [])[0];
    if (!mainUrl) return null;
    const mainJs = await (await fetch(mainUrl, { headers: { 'user-agent': UA, referer: 'https://open.spotify.com/' } })).text();
    const candidates = [...new Set([...mainJs.matchAll(/https:\/\/open\.spotifycdn\.com\/cdn\/build\/web-player\/[\w.\-]*search[\w.\-]*\.js/g)].map(x => x[0]))];
    for (const url of candidates) {
      const chunkJs = await (await fetch(url, { headers: { 'user-agent': UA, referer: 'https://open.spotify.com/' } })).text();
      const hash = (chunkJs.match(/"searchDesktop","query","([a-f0-9]{64})"/) || [])[1];
      if (hash) { discoveredHash = hash; break; }
    }
  } catch {}
  return discoveredHash || null;
}

async function runQuery(term, hash, limit, auth) {
  const params = new URLSearchParams({
    operationName: 'searchDesktop',
    variables: JSON.stringify({ searchTerm: term, offset: 0, limit, numberOfTopResults: 1, includeAudiobooks: false }),
    extensions: JSON.stringify({ persistedQuery: { version: 1, sha256Hash: hash } }),
  });
  return fetch(`https://api-partner.spotify.com/pathfinder/v1/query?${params}`, {
    headers: { ...base, accept: 'application/json', 'app-platform': 'WebPlayer', authorization: `Bearer ${auth.token}`, 'client-token': auth.clientToken, 'spotify-app-version': APP_VERSION },
  });
}

async function searchData(term, limit) {
  let auth = await getAuth(false);
  const tryHashes = async (hashes) => {
    for (const hash of hashes) {
      if (!hash) continue;
      let res = await runQuery(term, hash, limit, auth);
      if (res.status === 401) {
        auth = await getAuth(true);
        res = await runQuery(term, hash, limit, auth);
      }
      const json = await res.json().catch(() => null);
      if (json?.data?.searchV2) return json.data.searchV2;
    }
    return null;
  };
  const primary = discoveredHash ? [discoveredHash, ...FALLBACK_HASHES] : FALLBACK_HASHES;
  let data = await tryHashes(primary);
  if (!data) {
    const fresh = await discoverHash();
    if (fresh && !primary.includes(fresh)) data = await tryHashes([fresh]);
  }
  return data;
}

export async function searchSpotify(searchTerm, limit = 3) {
  const term = String(searchTerm || '').trim();
  if (!term) return [];
  try {
    const data = await searchData(term, limit);
    if (!data) return [];
    return (data.tracksV2?.items || [])
      .map(i => i.item?.data)
      .filter(Boolean)
      .slice(0, limit)
      .map(d => ({
        id: (d.uri || '').split(':')[2] || null,
        artist: (d.artists?.items || []).map(a => a.profile?.name).filter(Boolean).join(', '),
        title: d.name || null,
        duration: d.duration?.totalMilliseconds || 0,
      }));
  } catch (e) {
    logger.error(`Spotify search error: ${e.message}`);
    return [];
  }
}
