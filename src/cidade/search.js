import logger from '../logger.js';

const cache = new Map();
const CACHE_TTL = 3600000;

function cacheGet(key) {
  const entry = cache.get(key.toLowerCase());
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function cacheSet(key, data) {
  if (cache.size > 100) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(key.toLowerCase(), { data, ts: Date.now() });
}

async function callWikiAPI(params) {
  const qs = new URLSearchParams({ ...params, format: 'json', redirects: '1', origin: '*' });
  try {
    const r = await fetch(`https://pt.wikipedia.org/w/api.php?${qs}`, {
      headers: { 'User-Agent': 'NovaBot/3.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (r.status === 429) return { rateLimited: true };
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function isCityByCategories(title) {
  const d = await callWikiAPI({
    action: 'query', titles: title,
    prop: 'categories', cllimit: '200',
  });
  if (!d?.query?.pages) return null;
  const page = Object.values(d.query.pages)[0];
  if (!page?.categories) return null;
  const cats = page.categories.map(c => c.title.toLowerCase()).filter(c => !c.startsWith('categoria:!'));
  const cityKw = ['cidade', 'município', 'municipio', 'capital', 'freguesia', 'localidade', 'distrito', 'bairro', 'povoado', 'vila'];
  const nonCityKw = ['empresa', 'rádio', 'radio', 'emissora', 'site', 'canal', 'produto', 'marca', 'loja', 'banda', 'programa', 'jornal', 'revista', 'editora'];
  const hasCity = cats.some(c => cityKw.some(k => c.includes(k)));
  const hasNonCity = cats.some(c => nonCityKw.some(k => c.includes(k)));
  if (hasCity && !hasNonCity) return true;
  if (hasNonCity && !hasCity) return false;
  return null;
}

async function fetchCityData(title) {
  let d = await callWikiAPI({
    action: 'query', titles: title,
    prop: 'extracts|coordinates|pageimages|pageprops',
    explaintext: '', pithumbsize: '800', piprop: 'original|thumbnail',
    exchars: '8000',
  });

  if (d?.rateLimited) return { rateLimited: true };

  let foundPage = null;
  if (d?.query?.pages) {
    for (const p of Object.values(d.query.pages)) {
      if (p.missing !== undefined) continue;
      if (!p.extract || p.extract.length < 10) continue;
      foundPage = p;
      break;
    }
  }

  if (!foundPage) {
    d = await callWikiAPI({
      action: 'query', list: 'search', srsearch: title, srlimit: '8', srprop: '',
    });
    if (d?.rateLimited) return { rateLimited: true };
    if (d?.query?.search?.length) {
      for (const result of d.query.search) {
        const isValid = await isCityByCategories(result.title);
        if (isValid === false) continue;
        const rd = await callWikiAPI({
          action: 'query', titles: result.title,
          prop: 'extracts|coordinates|pageimages|pageprops',
          explaintext: '', pithumbsize: '800', piprop: 'original|thumbnail',
          exchars: '8000',
        });
        if (rd?.query?.pages) {
          for (const p of Object.values(rd.query.pages)) {
            if (p.missing !== undefined) continue;
            if (!p.extract || p.extract.length < 10) continue;
            foundPage = p;
            break;
          }
        }
        if (foundPage) break;
      }
    }
  }

  if (foundPage) {
    const imgs = [];
    const seen = new Set();
    for (const src of [foundPage.original?.source, foundPage.thumbnail?.source]) {
      if (src && !seen.has(src)) { seen.add(src); imgs.push(src); }
    }
    return {
      pageid: foundPage.pageid,
      title: foundPage.title,
      extract: foundPage.extract || null,
      intro: foundPage.extract?.split('\n')[0] || null,
      description: foundPage.description || null,
      coordinates: foundPage.coordinates?.[0] || null,
      images: imgs,
      wikidataId: foundPage.pageprops?.wikibase_item || null,
      lang: 'pt',
    };
  }

  try {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
      headers: { 'User-Agent': 'NovaBot/3.0' }, signal: AbortSignal.timeout(7000),
    });
    if (r.ok) {
      const ed = await r.json();
      if (ed?.title && ed?.extract && !ed.type?.startsWith('https://mediawiki.org/wiki/HyperSwitch/errors/')) {
        return {
          title: ed.title, extract: ed.extract, intro: ed.extract?.split('\n')[0],
          description: ed.description, coordinates: ed.coordinates || null,
          images: ed.thumbnail?.source ? [ed.thumbnail.source] : [],
          lang: 'en',
        };
      }
    }
  } catch {}

  return null;
}

async function wikidataInfo(qid) {
  if (!qid) return null;
  try {
    const r = await fetch(
      `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`,
      { headers: { 'User-Agent': 'NovaBot/3.0' }, signal: AbortSignal.timeout(7000) }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const entity = d.entities?.[qid];
    if (!entity) return null;
    const claims = entity.claims || {};

    const itemProps = ['P6', 'P17', 'P131', 'P421', 'P1549', 'P2196'];
    const itemIds = new Set();
    for (const pid of itemProps) {
      const c = claims[pid];
      const id = c?.[0]?.mainsnak?.datavalue?.value?.id;
      if (id) itemIds.add(id);
    }
    const labels = {};
    if (itemIds.size > 0) {
      try {
        const lr = await fetch(
          `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${[...itemIds].join('|')}&props=labels&languages=pt|en&format=json&origin=*`,
          { headers: { 'User-Agent': 'NovaBot/3.0' }, signal: AbortSignal.timeout(5000) }
        );
        if (lr.ok) {
          const ld = await lr.json();
          for (const [id, ent] of Object.entries(ld.entities || {})) {
            labels[id] = ent.labels?.pt?.value || ent.labels?.en?.value || id;
          }
        }
      } catch {}
    }

    const getVal = (pid) => {
      const c = claims[pid];
      if (!c?.[0]) return null;
      const mainsnak = c[0].mainsnak;
      if (mainsnak?.datatype === 'quantity') {
        const q = mainsnak.datavalue?.value;
        if (!q) return null;
        let v = `${q.amount}`.replace(/^\+/, '');
        if (q.unit?.includes('Q712226') || q.unit?.includes('Q11570')) v += ' km²';
        return v;
      }
      if (mainsnak?.datatype === 'string') return mainsnak.datavalue?.value;
      if (mainsnak?.datatype === 'wikibase-item') {
        const id = mainsnak.datavalue?.value?.id;
        if (!id) return null;
        return labels[id] || id;
      }
      if (mainsnak?.datatype === 'globe-coordinate') {
        const coord = mainsnak.datavalue?.value;
        if (coord) return `${coord.latitude}, ${coord.longitude}`;
      }
      if (mainsnak?.datatype === 'time') return mainsnak.datavalue?.value?.time?.replace(/^\+/, '').replace(/T00:00:00Z/, '') || null;
      if (mainsnak?.datatype === 'monolingualtext') return mainsnak.datavalue?.value?.text;
      if (mainsnak?.datatype === 'external-id') return mainsnak.datavalue?.value;
      if (mainsnak?.datavalue?.value) return String(mainsnak.datavalue.value);
      return null;
    };
    return {
      population: getVal('P1082'),
      area: getVal('P2046'),
      founded: getVal('P571'),
      elevation: getVal('P2044'),
      country: getVal('P17'),
      state: getVal('P131'),
      postalCode: getVal('P281'),
      website: getVal('P856'),
      timezone: getVal('P421'),
      demonym: getVal('P1549'),
      density: getVal('P2196'),
      mayor: getVal('P6'),
    };
  } catch { return null; }
}

async function getWeather(lat, lon) {
  try {
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto&forecast_days=3`,
      { signal: AbortSignal.timeout(7000) }
    );
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function fmtNum(n) {
  if (!n) return null;
  const s = String(n).replace(/[^\d]/g, '');
  if (!s) return n;
  return parseInt(s, 10).toLocaleString('pt-BR');
}

function extractDataPoints(text) {
  const data = {};
  if (!text) return data;

  const popMatch = text.match(/(?:população|habitantes|pop\.)[^.]*?(?:é|de|cerca de|aproximadamente|tem)\s*(\d[\d\s.]*(?:milh[ãa]o|milhões|mil|bilhão|bilhões)?)/i);
  if (popMatch) data.population = popMatch[1].trim();

  const pop2 = text.match(/(\d[\d\s.]*\d+)\s*(?:habitantes|pessoas|moradores|pessoas vivem)/i);
  if (pop2 && !data.population) data.population = pop2[1].trim();

  const areaMatch = text.match(/[áa]rea[^.]{0,60}?(?:é|de|tem|total)\s*[^.]{0,30}?(\d[\d\s.,]*(?:km²|km2|quilômetros|quilometros))/i);
  if (areaMatch) data.area = areaMatch[1].trim();

  const dataMatch = text.match(/fundad[ao][^.]{0,50}(?:em|no|na|a)[^.]{0,40}(\d{4})/i);
  if (dataMatch) data.founded = dataMatch[1].trim();

  const altMatch = text.match(/altitude[^.]{0,60}(?:de|média)[^.]{0,40}(\d[\d.]*)\s*m(?:etros)?/i);
  if (altMatch) data.elevation = altMatch[1].trim();

  const estadoMatch = text.match(/(?:estado do|estado da|estado de|do estado)\s+([A-Z][a-zA-Záéíóúãõçâêô\s]+?)(?:\s*[,.]|\s+na|\s+em|\s+no|\s+à|\s+a\s)/i);
  if (estadoMatch) data.state = estadoMatch[1].trim();

  return data;
}

function extractCountry(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (lower.includes('brasil') || lower.includes('brasileir')) return 'Brasil';
  if (lower.includes('portugal') || lower.includes('português') || lower.includes('portuguesa') || lower.includes('luso')) return 'Portugal';
  if (lower.includes('angola') || lower.includes('angolano')) return 'Angola';
  if (lower.includes('moçambique') || lower.includes('mocambique')) return 'Moçambique';
  if (lower.includes('cabo verde') || lower.includes('caboverdiano')) return 'Cabo Verde';
  if (lower.includes('guiné-bissau') || lower.includes('guine-bissau')) return 'Guiné-Bissau';
  if (lower.includes('são tomé') || lower.includes('sao tome')) return 'São Tomé e Príncipe';
  if (lower.includes('timor-leste') || lower.includes('timor leste')) return 'Timor-Leste';
  if (lower.includes('frança') || lower.includes('francesa')) return 'França';
  if (lower.includes('espanha') || lower.includes('espanhol')) return 'Espanha';
  if (lower.includes('itália') || lower.includes('italia')) return 'Itália';
  if (lower.includes('alemanha') || lower.includes('alemã')) return 'Alemanha';
  if (lower.includes('inglaterra') || lower.includes('inglês') || lower.includes('ingles') || lower.includes('reino unido')) return 'Reino Unido';
  if (lower.includes('estados unidos') || lower.includes('americano')) return 'Estados Unidos';
  if (lower.includes('argentina') || lower.includes('argentino')) return 'Argentina';
  if (lower.includes('méxico') || lower.includes('mexico') || lower.includes('mexicano')) return 'México';
  if (lower.includes('canadá') || lower.includes('canada')) return 'Canadá';
  if (lower.includes('japão') || lower.includes('japao') || lower.includes('japonês')) return 'Japão';
  return null;
}

export async function getCityReport(cityName) {
  const cached = cacheGet(cityName);
  if (cached) return { report: cached.report, images: cached.images };

  const wiki = await fetchCityData(cityName);
  if (wiki?.rateLimited) return { rateLimited: true };
  if (!wiki) return { error: `Cidade "${cityName}" não encontrada no Wikipedia. Verifique o nome e tente novamente.` };

  let report = '';
  const images = wiki.images || [];
  let weather = null;
  let weatherTz = null;
  if (wiki.coordinates) {
    weather = await getWeather(wiki.coordinates.lat, wiki.coordinates.lon);
    if (weather) weatherTz = weather.timezone;
  }

  const extractIntro = wiki.extract || '';
  const datapoints = extractDataPoints(extractIntro);
  const wd = wiki.wikidataId ? await wikidataInfo(wiki.wikidataId) : null;

  report += `━━━━━━━━━━━━━━━━━━\n`;
  report += `🏙️ *${wiki.title.toUpperCase()}*\n`;
  if (wiki.description) report += `📝 ${wiki.description}\n`;
  report += `━━━━━━━━━━━━━━━━━━\n\n`;

  report += `📍 *INFORMAÇÕES GERAIS*\n`;
  report += `🌎 País: ${wd?.country || extractCountry(extractIntro) || '❌ Informação indisponível.'}\n`;
  report += `🏛️ Estado: ${wd?.state || datapoints.state || '❌ Informação indisponível.'}\n`;
  report += `👥 População: ${fmtNum(wd?.population) || datapoints.population || '❌ Informação indisponível.'}\n`;
  report += `📏 Área: ${wd?.area || datapoints.area || '❌ Informação indisponível.'}\n`;
  report += `📐 Altitude: ${wd?.elevation || datapoints.elevation || '❌ Informação indisponível.'} m\n`;
  report += `🌐 Coordenadas: ${wiki.coordinates ? `${wiki.coordinates.lat.toFixed(4)}, ${wiki.coordinates.lon.toFixed(4)}` : '❌ Informação indisponível.'}\n`;
  report += `🕐 Fuso: ${wd?.timezone || weatherTz || '❌ Informação indisponível.'}\n`;
  if (wd?.founded || datapoints.founded) report += `📅 Fundação: ${wd?.founded || datapoints.founded}\n`;
  if (wd?.demonym) report += `👤 Gentílico: ${wd.demonym}\n`;
  if (wd?.mayor) report += `👤 Prefeito: ${wd.mayor}\n`;
  if (wd?.density) report += `📈 Densidade: ${wd.density}\n`;
  if (wd?.postalCode) report += `📮 CEP: ${wd.postalCode}\n`;

  const intro = extractIntro.slice(0, 1200);
  if (intro) report += `\n📖 *SOBRE*\n${intro}\n`;

  if (weather && weather.current) {
    report += `\n🌦️ *CLIMA ATUAL*\n`;
    report += `🌡️ Temperatura: ${weather.current.temperature_2m}°C\n`;
    report += `🤔 Sensação: ${weather.current.apparent_temperature}°C\n`;
    report += `💧 Umidade: ${weather.current.relative_humidity_2m}%\n`;
    report += `💨 Vento: ${weather.current.wind_speed_10m} km/h\n`;
    if (weather.daily) {
      report += `🌅 Nascer: ${weather.daily.sunrise?.[0]?.split('T')[1] || 'N/A'}\n`;
      report += `🌇 Pôr: ${weather.daily.sunset?.[0]?.split('T')[1] || 'N/A'}\n`;
      report += `\n📅 *PREVISÃO*\n`;
      for (let i = 1; i < weather.daily.time.length; i++) {
        const date = weather.daily.time[i].split('-').slice(1).join('/');
        report += `  ${date}: 🌡️ ${weather.daily.temperature_2m_min[i]}~${weather.daily.temperature_2m_max[i]}°C\n`;
      }
    }
  }

  cacheSet(cityName, { report, images });
  return { report, images };
}

export async function cidade(sock, jid, args) {
  if (!args.length) {
    await sock.sendMessage(jid, { text: '❌ Use: !cidade <nome da cidade>\nExemplo: !cidade Paris' });
    return;
  }

  const cityName = args.join(' ').trim();
  const result = await getCityReport(cityName);

  if (result.rateLimited) {
    await sock.sendMessage(jid, { text: '⏳ Muitas consultas seguidas! Aguarde alguns segundos e tente novamente.' });
    return;
  }
  if (result.error) {
    await sock.sendMessage(jid, { text: `❌ ${result.error}` });
    return;
  }

  await sock.sendMessage(jid, { text: `🔍 Pesquisando *${cityName}*...` });

  const MAX = 4000;
  if (result.report.length > MAX) {
    let r = result.report;
    while (r.length > 0) {
      let cut = r.slice(0, MAX);
      const brk = cut.lastIndexOf('\n\n');
      if (brk > 50 && r.length > MAX) cut = r.slice(0, brk);
      await sock.sendMessage(jid, { text: cut });
      r = r.slice(cut.length);
    }
  } else {
    await sock.sendMessage(jid, { text: result.report });
  }

  for (const img of (result.images || []).slice(0, 3)) {
    try {
      const r = await fetch(img, { signal: AbortSignal.timeout(7000) });
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        await sock.sendMessage(jid, { image: buf });
      }
    } catch (err) {
      logger.error(`Cidade image error: ${err.message}`);
    }
  }
}

export async function searchCityReport(cityName) {
  return getCityReport(cityName);
}
