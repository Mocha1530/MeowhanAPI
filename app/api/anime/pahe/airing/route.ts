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

    if (!data.data || data.data.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: data.pagination
      }, { headers: corsHeaders });
    }

    const enhancedEpisodes = await Promise.all(
      data.data.map(async (episode: any) => {
        try {
          const animeInfoResponse = await fetch(
            `https://meowhan.vercel.app/api/anime/pahe/links?method=mal_id&session=${episode.anime_session}&advanced=true`
          );
          
          if (animeInfoResponse.ok) {
            const animeInfo = await animeInfoResponse.json();
            return {
              ...episode,
              anime_info: animeInfo
            };
          } else {
            return {
              ...episode,
              anime_info: {
                session: episode.anime_session,
                title: episode.anime_title,
                eng_title: episode.anime_title,
                poster: '',
                type: 'TV',
                rating: 'g',
                duration: 0,
                status: 'unknown'
              }
            };
          }
        } catch (error) {
          console.error(`Error enhancing episode ${episode.episode}:`, error);
          return {
            ...episode,
            anime_info: {
              session: episode.anime_session,
              title: episode.anime_title,
              eng_title: episode.anime_title,
              poster: '',
              type: 'TV',
              rating: 'g',
              duration: 0,
              status: 'unknown'
            }
          };
        }
      })
    );

    if (page === '1') {
      cache = {
        data: enhancedEpisodes,
        pagination: {
          total: data.total,
          per_page: data.per_page,
          current_page: data.current_page,
          last_page: data.last_page
        },
        timestamp: Date.now()
      };
    }
    
    return NextResponse.json({
      data: enhancedEpisodes,
      pagination: {
        total: data.total,
        per_page: data.per_page,
        current_page: data.current_page,
        last_page: data.last_page
      }      
    }, { headers: corsHeaders });
    
  } catch (error) {
    console.error('Airing proxy API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch airing data',
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
