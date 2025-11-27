import { PAHE_HEADERS, EXTERNAL_APIS } from '@/lib/constants';

export function getProxiedSnapshotUrl(originalUrl: string): string {
  if (!originalUrl) return '';
  const filename = originalUrl.split('/').pop();
  return filename ? `/api/anime/pahe/snapshots/${filename}` : '';
}

export function extractPaheWinLinks(html: string): Array<{url: string; text: string}> {
  const links = [];
  const regex = /<a[^>]*href="(https:\/\/pahe\.win[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  
  while ((match = regex.exec(html)) !== null) {
    const url = match[1];
    const text = match[2].replace(/<[^>]*>/g, '').trim() || 'Download';
    links.push({ url, text });
  }

  return links;
}

export async function extractKwikLinks(html: string) {
  const links = [];
  const buttonRegex = /<button([^>]*data-src="https:\/\/kwik\.cx[^"]*"[^>]*)>([\s\S]*?)<\/button>/gi;
  let match;
  
  while ((match = buttonRegex.exec(html)) !== null) {
    const buttonAttributes = match[1];
    const buttonText = match[2].replace(/<[^>]*>/g, '').trim();
    const urlMatch = /data-src="(https:\/\/kwik\.cx[^"]*)"/i.exec(buttonAttributes);

    if (!urlMatch) continue;

    const fansubMatch = /data-fansub="([^"]*)"/i.exec(buttonAttributes);
    const resolutionMatch = /data-resolution="([^"]*)"/i.exec(buttonAttributes);
    
    const fansub = fansubMatch ? fansubMatch[1] : null;
    const resolution = resolutionMatch ? resolutionMatch[1] : null;

    let label = buttonText || 'Play';
    if (fansub && resolution) label = `${fansub} · ${resolution}`;
    else if (fansub) label = fansub;
    else if (resolution) label = resolution;
    
    links.push({
      url: urlMatch[1],
      direct_url: null,
      text: label,
      type: 'kwik',
      sub: fansub,
      resolution: resolution
    });
  }
  
  const dataSrcRegex = /data-src="(https:\/\/kwik\.cx[^"]*)"/gi;
  const uniqueUrls = new Set(links.map(link => link.url));
  
  while ((match = dataSrcRegex.exec(html)) !== null) {
    if (!uniqueUrls.has(match[1])) {
      uniqueUrls.add(match[1]);
      links.push({
        url: match[1],
        direct_url: null,
        text: 'Play',
        type: 'kwik'
      });
    }
  }
  
  return links;
}

export async function extractAllLinks(html: string) {
  const paheWinLinks = extractPaheWinLinks(html);
  const kwikLinks = await extractKwikLinks(html);
  
  return { kwik: kwikLinks, pahe: paheWinLinks };
}

export async function getEpisodeLinks(animeSession: string, episodeSession: string) {
  const response = await fetch(EXTERNAL_APIS.PAHE.PLAY(animeSession, episodeSession), {
    headers: {
      ...PAHE_HEADERS,
      "Referer": `${EXTERNAL_APIS.PAHE.BASE}/anime/${animeSession}`
    }
  });

  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  
  const html = await response.text();
  return await extractAllLinks(html);
}

export async function getAllEpisodes(session: string, page: number = 1) {
  const apiUrl = `${EXTERNAL_APIS.PAHE.API}?m=release&id=${session}&sort=episode_asc&page=${page}`;
  const response = await fetch(apiUrl, {
    headers: {
      ...PAHE_HEADERS,
      "Referer": `${EXTERNAL_APIS.PAHE.BASE}/anime/${session}`,
      "X-Requested-With": "XMLHttpRequest"
    }
  });

  if (!response.ok) throw new Error(`API error! status: ${response.status}`);

  const data = await response.json();

  const episodesWithLinks = await Promise.all(
    data.data.map(async (ep: any) => {
      try {
        const links = await getEpisodeLinks(session, ep.session);
        return {
          episode: ep.episode,
          duration: ep.duration,
          session: ep.session,
          snapshot: getProxiedSnapshotUrl(ep.snapshot) || ep.snapshot,
          links
        };
      } catch (error) {
        console.error(`Failed to get links for episode ${ep.episode}:`, error);
        return {
          episode: ep.episode,
          duration: ep.duration,
          session: ep.session,
          snapshot: getProxiedSnapshotUrl(ep.snapshot) || ep.snapshot,
          links: { kwik: [], pahe: [] }
        };
      }
    })
  );
  
  return {
    pagination: {
      current_page: page,
      last_page: data.last_page,
      total: data.total,
      has_next: data.current_page < data.last_page,
      has_prev: page > 1
    },
    episodes: episodesWithLinks
  };
}

export async function getAnime(session: string, page: number = 1) {
  const response = await fetch(`${EXTERNAL_APIS.PAHE.BASE}/anime/${session}`, {
    headers: PAHE_HEADERS,
    next: { revalidate: 3600 }
  });

  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  const html = await response.text();
  const malIdMatch = html.match(/<meta name="myanimelist" content="(\d+)">/);
  const malId = malIdMatch ? malIdMatch[1] : null;

  if (!malId) throw new Error('Could not extract MAL ID from anime page');

  const episodes = await getAllEpisodes(session, page);

  return { mal_id: malId, ...episodes };
}

export async function getPaheMalId(session: string) {
  const response = await fetch(`${EXTERNAL_APIS.PAHE.BASE}/anime/${session}`, {
    headers: PAHE_HEADERS
  });

  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  const html = await response.text();
  const malIdMatch = html.match(/<meta name="myanimelist" content="(\d+)">/);
  return malIdMatch ? malIdMatch[1] : null;
}

export async function searchAnimeOnPahe(title: string) {
  const searchUrl = `${EXTERNAL_APIS.PAHE.API}?m=search&q=${encodeURIComponent(title)}`;
  const response = await fetch(searchUrl, {
    headers: {
      ...PAHE_HEADERS,
      "X-Requested-With": "XMLHttpRequest"
    }
  });

  if (!response.ok) throw new Error(`Search API error! status: ${response.status}`);
  return response.json();
}
