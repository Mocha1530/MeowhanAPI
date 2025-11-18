import { NextRequest, NextResponse } from 'next/server';

const pheaders = { 
  "Accept": "application/json, text/javascript, */*; q=0.0",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0",
  "Cookie": process.env.PAHE_COOKIE
};

function extractPaheWinLinks(html: string): Array<{url: string; text: string}> {
  const links = [];
  const regex = /<a[^>]*href="(https:\/\/pahe\.win[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  
  while ((match = regex.exec(html)) !== null) {
    const url = match[1];
    const text = match[2].replace(/<[^>]*>/g, '').trim() || 'Download';
    
    links.push({
      url,
      text
    });
  }

  return links;
}

async function extractKwikLinks(html: string) {
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
    if (fansub && resolution) {
      label = `${fansub} · ${resolution}`;
    } else if (fansub) {
      label = fansub;
    } else if (resolution) {
      label = resolution;
    }
    
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

async function extractAllLinks(html: string) {
  const paheWinLinks = extractPaheWinLinks(html);
  const kwikLinks = await extractKwikLinks(html);
  
  return {
    kwik: kwikLinks,
    pahe: paheWinLinks
  };
}

async function getEpisodeLinks(animeSession: string, episodeSession: string) {
  const response = await fetch(`https://animepahe.si/play/${animeSession}/${episodeSession}`, {
    headers: {
      ...pheaders,
      "Referer": `https://animepahe.si/anime/${animeSession}`
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const html = await response.text();
  const links = await extractAllLinks(html);
  
  return links;
}

async function getAllEpisodes(session: string, page: number = 1) {
  let allEpisodes: any[] = [];
  const apiUrl = `https://animepahe.si/api?m=release&id=${session}&sort=episode_asc&page=${page}`;
  const response = await fetch(apiUrl, {
    headers: {
      ...pheaders,
      "Referer": `https://animepahe.si/anime/${session}`,
      "X-Requested-With": "XMLHttpRequest"
    }
  });

  if (!response.ok) {
    throw new Error(`API error! status: ${response.status}`);
  }

  const data = await response.json();

  const episodesWithLinks = await Promise.all(
    data.data.map(async (ep: any) => {
      try {
        const links = await getEpisodeLinks(session, ep.session);
        return {
          episode: ep.episode,
          session: ep.session,
          snapshot: ep.snapshot,
          links
        };
      } catch (error) {
        console.error(`Failed to get links for episode ${ep.episode}:`, error);
        return {
          episode: ep.episode,
          session: ep.session,
          snapshot: ep.snapshot,
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
  }
}

async function getAnime(session: string, page: number = 1) {
  const response = await fetch(`https://animepahe.si/anime/${session}`, {
    headers: pheaders,
    next: { revalidate: 3600 }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const html = await response.text();
  const malIdMatch = html.match(/<meta name="myanimelist" content="(\d+)">/);
  const malId = malIdMatch ? malIdMatch[1] : null;

  if (!malId) {
    throw new Error('Could not extract MAL ID from anime page');
  }

  const episodes = await getAllEpisodes(session, page);

  return {
    mal_id: malId,
    ...episodes
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const method = searchParams.get('method');
  const session = searchParams.get('session');
  const page = searchParams.get('page');
  
  if (!method) {
    return NextResponse.json({ error: 'method parameter is required' }, { status: 400 });
  }
  
  try {
    if (method === 'links' && session) {
      const pageNum = page ? parseInt(page) : 1;
      if (isNaN(pageNum) || pageNum < 1) {
        return NextResponse.json({ error: 'Invalid page number' }, { status: 400 });
      }
      
      const animeData = await getAnime(session, pageNum);
      return NextResponse.json({
        ...animeData
      });
    } else {
      return NextResponse.json({ error: 'Invalid method or missing session' }, { status: 400 });
    }
  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to scrape links',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
