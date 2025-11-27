import { EXTERNAL_APIS } from '@/lib/constants';
import { getPaheMalId } from './anime-scraper';

export async function fetchMALAnimeInfo(malId: string, fields: string = EXTERNAL_APIS.MAL.FIELDS.FULL) {
  const response = await fetch(`${EXTERNAL_APIS.MAL.BASE}/${malId}?fields=${fields}`, {
    headers: {
      'X-MAL-CLIENT-ID': process.env.MAL_CLIENT_ID!
    }
  });

  if (!response.ok) {
    const message = await response.json();
    throw new Error(`MAL API error! ${message.error}. status: ${response.status}`);
  }

  return response.json();
}

export async function getBasicAnimeInfo(session: string) {
  try {
    const malId = await getPaheMalId(session);
    if (!malId) return null;

    const malData = await fetchMALAnimeInfo(malId, EXTERNAL_APIS.MAL.FIELDS.BASIC);
    
    return {
      mal_id: malData.id,
      session: session,
      title: malData.title,
      eng_title: malData.alternative_titles?.en || malData.title,
      poster: malData.main_picture?.large || malData.main_picture?.medium || '',
      type: malData.media_type?.toUpperCase() || 'TV',
      rating: malData.rating || 'g',
      episode_count: malData.num_episodes || 0,
      duration: malData.average_episode_duration || 0,
      status: malData.status || 'unknown'
    };
  } catch (error) {
    console.error('Error getting basic anime info:', error);
    return null;
  }
}

export { getPaheMalId };
