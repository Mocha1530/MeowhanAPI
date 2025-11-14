import { NextRequest, NextResponse } from 'next/server';

function decodeJSStyle(encoded: string, alphabet: string, offset: number, base: number): string {
  let result = '';
  
  for (let i = 0; i < encoded.length; i++) {
    let segment = '';
    
    while (i < encoded.length && encoded[i] !== alphabet[base]) {
      segment += encoded[i];
      i++;
    }
    
    let decodedNum = 0;
    for (let j = 0; j < segment.length; j++) {
      const char = segment[j];
      const position = alphabet.indexOf(char);
      if (position === -1) continue;
      
      decodedNum = decodedNum * base + position;
    }
    
    decodedNum -= offset;
    result += String.fromCharCode(decodedNum);
  }
  
  return result;
}

async function getDirectKwikLink(kwikUrl: string): Promise<string> {
  try {
    const response = await fetch(kwikUrl);
    const html = await response.text();
    
    const paramRegex = /\(\s*"([^"]*)"\s*,\s*(\d+)\s*,\s*"([^"]*)"\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*\d+\s*\)/;
    const match = html.match(paramRegex);
    
    if (!match) {
      throw new Error('Could not extract encoded parameters');
    }
    
    const [, encoded, , alphabet, offsetStr, baseStr] = match;
    const offset = parseInt(offsetStr);
    const base = parseInt(baseStr);
    
    const decoded = decodeJSStyle(encoded, alphabet, offset, base);
    
    const urlMatch = decoded.match(/"((https?:\/\/kwik\.cx\/[^"]*))"/);
    const tokenMatch = decoded.match(/name="_token" value="([^"]*)"/);
    
    if (!urlMatch || !tokenMatch) {
      throw new Error('Could not extract URL or token from decoded data');
    }
    
    const postUrl = urlMatch[1];
    const token = tokenMatch[1];
    
    const cookies = response.headers.get('set-cookie') || '';
    const sessionMatch = cookies.match(/kwik_session=([^;]+)/);
    const kwikSession = sessionMatch ? sessionMatch[1] : '';
    
    const postResponse = await fetch(postUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': `kwik_session=${kwikSession}`,
        'Referer': kwikUrl
      },
      body: `_token=${token}`,
      redirect: 'manual'
    });
    
    const location = postResponse.headers.get('location');
    if (!location) {
      throw new Error('No redirect location found');
    }
    
    return location;
  } catch (error) {
      throw error;
  }
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

  await Promise.all(
    links.map(async (link) => {
      try {
        link.direct_url = await getDirectKwikLink(link.url);
      } catch (error) {
        console.error(`Failed to get direct URL for ${link.url}:`, error);
      }
    })
  );
    
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

function extractPaheLinks(html: string) {
  const links = [];
  const regex = /<a[^>]*href="(https:\/\/pahe\.win[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  
  while ((match = regex.exec(html)) !== null) {
    links.push({
      url: match[1],
      text: match[2].replace(/<[^>]*>/g, '').trim() || 'Download',
      type: 'pahe'
    });
  }

  return links;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  
  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  const pheaders = { 
    "Accept": "application/json, text/javascript, */*; q=0.0",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": url,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0",
    "Cookie": process.env.PAHE_COOKIE
  };
  
  try {
    const response = await fetch(url, {
      headers: pheaders,
      next: { revalidate: 3600 }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const kwikLinks = await extractKwikLinks(html);
    const paheLinks = extractPaheLinks(html);

    return NextResponse.json({
      success: true,
      kwik_links: kwikLinks || [],
      download_links: paheLinks || [],
      totalFound: kwikLinks.length + paheLinks.length
    });

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
