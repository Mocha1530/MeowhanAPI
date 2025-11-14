import { NextRequest, NextResponse } from 'next/server';
//import chromium from '@sparticuz/chromium';
//import puppeteer from 'puppeteer-core';

const baseAlphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/";

function decodeBase(encodedString: string, fromBase: number, toBase: number): number {
  const fromAlphabet = baseAlphabet.substring(0, fromBase);
  const toAlphabet = baseAlphabet.substring(0, toBase);

  let decimalValue = 0;
  for (let i = 0; i < encodedString.length; i++) {
    const char = encodedString[encodedString.length - 1 - i];
    const position = fromAlphabet.indexOf(char);
    if (position === -1) continue;
    
    decimalValue += position * Math.pow(fromBase, i);
  }

  if (decimalValue === 0) return parseInt(toAlphabet[0]);

  let result = '';
  let tempValue = decimalValue;
  
  while (tempValue > 0) {
    result = toAlphabet[tempValue % toBase] + result;
    tempValue = Math.floor(tempValue / toBase);
  }

  return parseInt(result);
}

function decodeJSStyle(encoded: string, alphabet: string, offset: number, base: number): string {
  let result = '';
  let i = 0;

  while (i < encoded.length) {
    let segment = '';
    
    while (i < encoded.length && encoded[i] !== alphabet[base]) {
      segment += encoded[i];
      i++;
    }
    
    i++;

    if (!segment) continue;

    let numericString = '';
    for (const char of segment) {
      const position = alphabet.indexOf(char);
      if (position !== -1) {
        numericString += position.toString();
      }
    }

    const decodedNumber = decodeBase(numericString, base, 10) - offset;
    
    if (decodedNumber > 0 && decodedNumber < 65536) {
      result += String.fromCharCode(decodedNumber);
    }
  }

  return result;
}

/*async function getDirectKwikLink(kwikUrl: string): Promise<string> {
  let browser = null;
  
  try {
    const executablePath = await chromium.executablePath();
      
    browser = await puppeteer.launch({
      args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
    });
  
    const page = await browser.newPage();
      
    await page.setViewport({ 
      width: 1280, 
      height: 720,
      deviceScaleFactor: 1 
    });
  
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0');
  
    await page.goto(kwikUrl, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
  
    await page.waitForFunction(
      () => document.readyState === 'complete',
      { timeout: 10000 }
    );

    const html = await page.content();
    await browser.close();
    //const response = await fetch(kwikUrl);
    //const html = await response.text();
    console.log(html);
    const cleanHtml = html.replace(/(\r\n|\r|\n)/g, '');
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    const regexP = [
        /\(\s*"([^",]*)"\s*,\s*(\d+)\s*,\s*"([^",]*)"\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*\d+[a-zA-Z]?\s*\)/,
        /\(\s*'([^',]*)'\s*,\s*(\d+)\s*,\s*'([^',]*)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*\d+[a-zA-Z]?\s*\)/,
    ];

    const scripts = [];
    let scriptMatch;

    while ((scriptMatch = scriptRegex.exec(html)) !== null) {
      scripts.push(scriptMatch[1]);
    }
    
    for (const script of scripts) {
      const cleanScript = script.replace(/(\r\n|\r|\n)/g, '');

      for (const pattern of regexP) {
        const match = cleanScript.match(pattern);
        if (match && match[1] && match[1].length > 10) {
          const encoded = match[1];
          const alphabet = match[3];
          const offset = parseInt(match[4]);
          const base = parseInt(match[5]);
          const decoded = decodeJSStyle(encoded, alphabet, offset, base);
          
          const urlMatch = decoded.match(/"((https?:\/\/kwik\.cx\/[^"]*))"/);
          const tokenMatch = decoded.match(/name="_token" value="([^"]*)"/);
          
          if (urlMatch && tokenMatch) {
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
            if (location) {
              return location;
            }
          }
        }
      }
    }

    throw new Error('Could not extract direct link from any script');
    
    let match = null;
    let usedPattern = -1;

    for (let i = 0; i < regexP.length; i++) {
      match = cleanHtml.match(regexP[i]);
      if (match) {
        usedPattern = i;
        console.log(`Found encoded parameters with pattern ${i}`);
        break;
      }
    }

    if (!match) {
      throw new Error('Could not extract encoded parameters');
    }

    const encoded = match[1];
    const alphabet = match[3];
    const offset = parseInt(match[4]);
    const base = parseInt(match[5]);

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
}*/

async function fetchKwikDirect(
  kwikLink: string, 
  token: string, 
  kwikSession: string
): Promise<string> {
  const response = await fetch(kwikLink, {
    method: 'POST',
    headers: {
      'Referer': kwikLink,
      'Cookie': `kwik_session=${kwikSession}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    redirect: 'manual',
  });

  if (response.status === 302) {
    const location = response.headers.get('location');
    if (location) {
      return location;
    }
  }

  throw new Error(`Redirect location not found in response from ${kwikLink}`);
}

async function fetchKwikDirectLink(kwikLink: string, retries = 3): Promise<string> {
  if (retries <= 0) {
    throw new Error(`Kwik fetch failed: exceeded retry limit: ${kwikLink}`);
  }

  const response = await fetch(kwikLink);
  if (!response.ok) {
    throw new Error(`Failed to get Kwik from ${kwikLink}, Status: ${response.status}`);
  }

  const html = await response.text();
  const cleanHtml = html.replace(/(\r\n|\r|\n)/g, '');

  const cookies = response.headers.get('set-cookie') || '';
  const sessionMatch = cookies.match(/kwik_session=([^;]*);/);
  const kwikSession = sessionMatch ? sessionMatch[1] : '';

  const regexP = [
    /\(\s*"([^",]*)"\s*,\s*\d+\s*,\s*"([^",]*)"\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*\d+[a-zA-Z]?\s*\)/,
    /\(\s*'([^',]*)'\s*,\s*\d+\s*,\s*'([^',]*)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*\d+[a-zA-Z]?\s*\)/,
  ];

  let encoded: string | null = null;
  let alphabet: string | null = null;
  let offset: number | null = null;
  let base: number | null = null;

  for (const pattern of regexP) {
    const match = cleanHtml.match(pattern);
    if (match && match[1] && match[1].length > 10) {
      encoded = match[1];
      alphabet = match[2];
      offset = parseInt(match[3]);
      base = parseInt(match[4]);
      break;
    }
  }

  if (!encoded || !alphabet || offset === null || base === null) {
    return fetchKwikDirectLink(kwikLink, retries - 1);
  }

  try {
    const decodedString = decodeJSStyle(encoded, alphabet, offset, base);
    
    const urlMatch = decodedString.match(/"((https?:\/\/kwik\.[^/\s"]+\/[^/\s"]+\/[^"\s]*))"/);
    const tokenMatch = decodedString.match(/name="_token"[^>]*value="([^"]*)"/);

    if (!urlMatch || !tokenMatch) {
      return fetchKwikDirectLink(kwikLink, retries - 1);
    }

    let postUrl = urlMatch[1];
    const token = tokenMatch[1];

    postUrl = postUrl.replace(/(https:\/\/kwik\.[^\/]+\/)d\//, '$1f/');

    const directLink = await fetchKwikDirect(postUrl, token, kwikSession);
    return directLink;
  } catch (error) {
    return fetchKwikDirectLink(kwikLink, retries - 1);
  }
}

function parseLinkText(text: string): {
  label: string;
  sub: string | null;
  resolution: string | null;
  fileSize: string | null;
} {
  let cleanedText = text.replace(/&middot;/g, '·').trim();
  const match = cleanedText.match(/^([^·]+?)\s*·\s*(\d+p)\s*\(([^)]+MB)\)/);
  
  if (match) {
    const [, sub, resolution, fileSize] = match;
    // Create a clean label like "SubsPlease · 1080p (143MB)"
    const label = `${sub.trim()} · ${resolution} (${fileSize})`;
    
    return {
      label,
      sub: sub.trim(),
      resolution,
      fileSize
    };
  }
  
  const resolutionMatch = cleanedText.match(/(\d+p)/);
  const fileSizeMatch = cleanedText.match(/\(([^)]+MB)\)/);
  
  let sub = null;
  let resolution = resolutionMatch ? resolutionMatch[1] : null;
  let fileSize = fileSizeMatch ? fileSizeMatch[1] : null;
  
  let label = cleanedText;
  if (resolution && fileSize) {
    label = `${sub || 'Download'} · ${resolution} (${fileSize})`;
  } else if (resolution) {
    label = `${sub || 'Download'} · ${resolution}`;
  }
  
  return {
    label,
    sub,
    resolution,
    fileSize
  };
}

async function extractKwikFLinks(paheWinUrl: string): Promise<Array<{
  url: string;
  direct_url: string | null;
  text: string;
  type: string;
  sub: string | null;
  resolution: string | null;
  fileSize: string | null;
}>> {
  const response = await fetch(paheWinUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch pahe.win page: ${response.status}`);
  }

  const html = await response.text();
  const cleanHtml = html.replace(/(\r\n|\r|\n)/g, '');

  const links = [];
  const regex = /<a[^>]*href="(https:\/\/kwik\.cx\/f\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = regex.exec(cleanHtml)) !== null) {
    const kwikUrl = match[1];
    const rawText = match[2].replace(/<[^>]*>/g, '').trim();

    const { label, sub, resolution, fileSize } = parseLinkText(rawText);

    links.push({
      url: kwikUrl,
      direct_url: null,
      text: label,
      type: 'kwik',
      sub,
      resolution,
      fileSize
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

function extractPaheWinLinks(html: string): Array<{url: string; text: string}> {
  const links = [];
  const regex = /<a[^>]*href="(https:\/\/pahe\.win\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
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

async function extractAllLinks(html: string) {
  const paheWinLinks = extractPaheWinLinks(html);
  const allKwikLinks = [];

  for (const paheLink of paheWinLinks) {
    try {
      const kwikFLinks = await extractKwikFLinks(paheLink.url);
      
      for (const kwikLink of kwikFLinks) {
        try {
          const directUrl = await fetchKwikDirectLink(kwikLink.url);
          allKwikLinks.push({
            ...kwikLink,
            direct_url: directUrl,
          });
        } catch (error) {
          console.error(`Failed to get direct URL for ${kwikLink.url}:`, error);
          allKwikLinks.push({
            ...kwikLink,
            direct_url: null,
          });
        }
      }
    } catch (error) {
      console.error(`Failed to extract Kwik links from ${paheLink.url}:`, error);
    }
  }

  return allKwikLinks;
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
    const kwikLinks = await extractAllLinks(html);
    //const paheLinks = extractPaheLinks(html);

    return NextResponse.json({
      success: true,
      kwik_links: kwikLinks || [],
      totalFound: kwikLinks.length
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
