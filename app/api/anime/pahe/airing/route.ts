import { NextRequest, NextResponse } from 'next/server';

const pheaders = { 
  "Accept": "application/json, text/javascript, */*; q=0.0",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0",
  "Cookie": process.env.PAHE_COOKIE,
  "X-Requested-With": "XMLHttpRequest"
};

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://meowani.vercel.app',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

let cache: { data: any; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') || '1';
  const refresh = searchParams.get('refresh');

  try {
    if (page === '1' && cache && !refresh && (Date.now() - cache.timestamp) < CACHE_DURATION) {
      return NextResponse.json(cache.data, { headers: corsHeaders });
    }

    const response = await fetch(`https://animepahe.si/api?m=airing&page=${page}`, {
      headers: pheaders,
    });

    if (!response.ok) {
      throw new Error(`AnimePahe API error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (page === '1') {
      cache = {
        data,
        timestamp: Date.now()
      };
    }
    
    return NextResponse.json(data, { headers: corsHeaders });
    
  } catch (error) {
    console.error('Airing proxy API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch airing data from AnimePahe',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 502, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}
