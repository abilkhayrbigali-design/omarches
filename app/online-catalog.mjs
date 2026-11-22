const endpoint = 'https://api.openverse.org/v1/audio/';
const pageSize = 12;
const cache = new Map();
const cacheLifetime = 10 * 60 * 1000;

function httpsLink(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function normalizeTrack(row) {
  if (!row || row.category !== 'music' || row.mature || !row.id || !row.title?.trim() || !row.creator?.trim()) return null;
  const sourceUrl = httpsLink(row.foreign_landing_url);
  const audioUrl = httpsLink(row.url);
  const licenseUrl = httpsLink(row.license_url?.replace(/^http:/i, 'https:'));
  if (!sourceUrl || !audioUrl || !licenseUrl) return null;

  const licensePath = new URL(licenseUrl);
  if (licensePath.host !== 'creativecommons.org') return null;
  const match = /^\/(licenses\/by|publicdomain\/zero)\/(\d+\.\d+)(?:\/[a-z]{2})?\/?$/.exec(licensePath.pathname);
  if (!match) return null;
  const code = match[1] === 'licenses/by' ? 'by' : 'cc0';
  if (row.license !== code || (row.license_version && row.license_version !== match[2])) return null;

  const title = row.title.trim();
  const artist = row.creator.trim();
  const license = (code === 'by' ? 'CC BY ' : 'CC0 ') + match[2];
  return {
    id: row.id, title, artist, audioUrl, sourceUrl, license, licenseUrl,
    licenseCode: code, provider: row.source || row.provider || 'Openverse',
    creatorUrl: httpsLink(row.creator_url),
    attribution: row.attribution || `«${title}» — ${artist}, ${license}.`,
    duration: Number.isFinite(row.duration) && row.duration > 0 ? Math.round(row.duration / 1000) : null,
    genres: (row.genres || []).filter(genre => typeof genre === 'string'),
    tags: (row.tags || []).map(tag => tag?.name).filter(name => typeof name === 'string')
  };
}

// Send only the musical search terms. Results remain in this tab's memory.
export async function searchMusic({query, page = 1, signal}) {
  const terms = String(query ?? '').trim().replace(/\s+/g, ' ').slice(0, 160);
  if (!terms || !Number.isSafeInteger(page) || page < 1) throw Error('Нужны музыкальная тема и номер страницы.');
  signal?.throwIfAborted();
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    q: terms, category: 'music', license: 'by,cc0', mature: 'false',
    page_size: String(pageSize), page: String(page)
  }).toString();

  const cached = cache.get(url.href);
  if (cached && cached.expires > Date.now()) return cached.result;

  const timeout = AbortSignal.timeout(18000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let response, data;
  try {
    response = await fetch(url, {
      signal: requestSignal, credentials: 'omit', referrerPolicy: 'no-referrer'
    });
    if (response.ok) data = await response.json();
  } catch {
    signal?.throwIfAborted();
    if (timeout.aborted) throw Error('Openverse долго отвечает. Повторите поиск.');
    throw Error('Не удалось загрузить музыку из Openverse. Проверьте интернет и повторите поиск.');
  }
  if (response.status === 429) throw Error('Лимит запросов Openverse исчерпан. Повторите поиск позже.');
  if (!response.ok || !Array.isArray(data?.results)) throw Error('Каталог Openverse временно недоступен. Повторите поиск.');

  const tracks = data.results.map(normalizeTrack).filter(Boolean);
  const result = {tracks, page, hasMore: page < data.page_count};
  if (cache.size >= 64) cache.delete(cache.keys().next().value);
  cache.set(url.href, {expires: Date.now() + cacheLifetime, result});
  return result;
}
