import { NextRequest, NextResponse } from 'next/server';
import { CORS_HEADERS } from '@/lib/constants';
import { getAnime, getPaheMalId } from '@/utils/anime-scraper';
import { getBasicAnimeInfo } from '@/utils/mal';
import { getAnimeInfo } from '@/utils/anime';
import { getEpisodeData } from '@/utils/episode';
import { connectToDatabase } from '@/utils/database';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const method = searchParams.get('method');
  const session = searchParams.get('session');
  const page = searchParams.get('page');
  const malId = searchParams.get('mal_id');
  const advanced = searchParams.get('advanced');
  const animeSession = searchParams.get('anime_session');
  const episodeSession = searchParams.get('episode_session');
  const episodeNumber = searchParams.get('episode_number');
  
  if (!method) {
    return NextResponse.json({ error: 'method parameter is required' }, { status: 400, headers: CORS_HEADERS });
  }
  
  try {
    switch (method) {
      case 'links':
        if (!session) throw new Error('Session parameter required');
        const pageNum = page ? parseInt(page) : 1;
        if (isNaN(pageNum) || pageNum < 1) throw new Error('Invalid page number');
        const animeData = await getAnime(session, pageNum);
        return NextResponse.json(animeData, { headers: CORS_HEADERS });
        
      case 'info':
        if (!malId) throw new Error('mal_id parameter required');
        const animeInfo = await getAnimeInfo(malId);
        return NextResponse.json(animeInfo, { headers: CORS_HEADERS });
        
      case 'mal_id':
        if (!session) throw new Error('Session parameter required');
        if (advanced === 'true') {
          const basicInfo = await getBasicAnimeInfo(session);
          if (!basicInfo) throw new Error('Could not fetch basic anime info');
          return NextResponse.json(basicInfo, { headers: CORS_HEADERS });
        }
        const mal_id = await getPaheMalId(session);
        if (!mal_id) throw new Error('MAL ID not found for this session');
        return NextResponse.json({ session, mal_id }, { headers: CORS_HEADERS });
        
      case 'episode_data':
        if (!animeSession || !episodeSession || !episodeNumber) {
          throw new Error('anime_session, episode_session, and episode_number parameters required');
        }
        const episode = { episode_session: episodeSession, episode_number: parseInt(episodeNumber) };
        const episodeData = await getEpisodeData(animeSession, episode);
        return NextResponse.json(episodeData, { headers: CORS_HEADERS });
        
      default:
        return NextResponse.json({ error: 'Invalid method' }, { status: 400, headers: CORS_HEADERS });
    }
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}
