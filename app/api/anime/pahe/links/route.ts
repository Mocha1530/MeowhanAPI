import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';

const pheaders = { 
  "Accept": "application/json, text/javascript, */*; q=0.0",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0",
  "Cookie": process.env.PAHE_COOKIE
};

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://meowani.vercel.app',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MONGODB_URI = process.env.MEOW_MONGODB_URI!;
const DB_NAME = process.env.MEOW_ANI_MONGODB_DB;
const COLLECTION_NAME = 'allani';

async function connectToDatabase() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  return client.db(DB_NAME);
}

function getProxiedSnapshotUrl(originalUrl: string): string {
  if (!originalUrl) return '';
  
  const filename = originalUrl.split('/').pop();
  return filename ? `/api/anime/pahe/snapshots/${filename}` : '';
}

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

async function fetchMALAnimeInfo(malId: string) {
  const fields = "id,title,main_picture,alternative_titles,start_date,end_date,synopsis,mean,created_at,updated_at,media_type,status,genres,my_list_status,num_episodes,start_season,broadcast,average_episode_duration,rating,related_anime,recommendations,studios";
  const response = await fetch(`https://api.myanimelist.net/v2/anime/${malId}?fields=${fields}`, {
    headers: {
      'X-MAL-CLIENT-ID': process.env.MAL_CLIENT_ID!
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`MAL API error! status: ${message} ${response.status}`);
  }

  return response.json();
}

async function searchAnimeOnPahe(title: string) {
  const searchUrl = `https://animepahe.si/api?m=search&q=${encodeURIComponent(title)}`;
  const response = await fetch(searchUrl, {
    headers: {
      ...pheaders,
      "X-Requested-With": "XMLHttpRequest"
    }
  });

  if (!response.ok) {
    throw new Error(`Search API error! status: ${response.status}`);
  }

  return response.json();
}

async function getPaheMalId(session: string) {
  const response = await fetch(`https://animepahe.si/anime/${session}`, {
    headers: pheaders
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const html = await response.text();
  const malIdMatch = html.match(/<meta name="myanimelist" content="(\d+)">/);
  return malIdMatch ? malIdMatch[1] : null;
}

async function findMatchingPaheAnime(malId: string, title: string) {
  const searchResults = await searchAnimeOnPahe(title);

  if (!searchResults.data) {
    return null;
  }
  
  for (const anime of searchResults.data) {
    try {
      const paheMalId = await getPaheMalId(anime.session);
      if (paheMalId === malId) {
        return anime;
      }
    } catch (error) {
      console.error(`Error checking anime ${anime.title}:`, error);
      continue;
    }
  }
  
  return null;
}

function mapMALToDatabaseSchema(malData: any, paheData: any = null) {
  const statusMap: { [key: string]: string } = {
    'currently_airing': 'currently_airing',
    'finished_airing': 'finished_airing',
    'not_yet_aired': 'not_yet_aired'
  };

  const ratingMap: { [key: string]: string } = {
    'g': 'g',
    'pg': 'pg',
    'pg_13': 'pg_13',
    'r': 'r',
    'r+': 'r+',
    'rx': 'rx'
  };
  
  return {
    anime_id: malData.id,
    session: paheData?.session || null,
    title: malData.title,
    alternative_titles: {
      synonyms: malData.alternative_titles?.synonyms || [],
      en: malData.alternative_titles?.en || malData.title,
      jp: malData.alternative_titles?.ja || ''
    },
    synopsis: malData.synopsis || '',
    poster: malData.main_picture?.large || malData.main_picture?.medium || '',
    type: malData.media_type?.toUpperCase() || 'TV',
    score: malData.mean || 0,
    status: statusMap[malData.status] || malData.status,
    genres: malData.genres?.map((genre: any) => genre.name) || [],
    studios: malData.studios?.map((studio: any) => studio.name) || [],
    start_season: malData.start_season || null,
    start_date: malData.start_date || '',
    end_date: malData.end_date || '',
    episode_count: malData.num_episodes || 0,
    broadcast: malData.broadcast || null,
    duration: malData.average_episode_duration || 0,
    rating: ratingMap[malData.rating] || malData.rating || 'g',
    episodes: [],
    recommendations: malData.recommendations?.map((rec: any) => ({
      anime_id: rec.node.id,
      title: rec.node.title,
      poster: rec.node.main_picture?.large || rec.node.main_picture?.medium || ''
    })) || [],
    related_anime: malData.related_anime?.map((rel: any) => ({
      anime_id: rel.node.id,
      title: rel.node.title,
      poster: rel.node.main_picture?.large || rel.node.main_picture?.medium || ''
    })) || [],
    use_api: false
  };
}

function convertDecimalFields(obj: any): any {
  if (obj && typeof obj === 'object') {
    if (obj.$numberDecimal !== undefined) {
      return parseFloat(obj.$numberDecimal);
    }
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        obj[key] = convertDecimalFields(obj[key]);
      }
    }
  }
  return obj;
}

async function getAnimeInfo(malId: string) {
  const db = await connectToDatabase();
  const collection = db.collection(COLLECTION_NAME);
  
  let existingAnime = await collection.findOne({ anime_id: parseInt(malId) });
  const malData = await fetchMALAnimeInfo(malId);
  
  if (existingAnime) {
    existingAnime = convertDecimalFields(existingAnime);
    let needsUpdate = false;
    const updates: any = {};
    
    const fieldsToCheck = [
      'title', 'synopsis', 'status', 'episode_count', 
      'start_date', 'end_date', 'score', 'rating'
    ];

    for (const field of fieldsToCheck) {
      const malField = field === 'episode_count' ? 'num_episodes' : 
                      field === 'score' ? 'mean' : field;
      
      const currentValue = existingAnime[field];
      const newValue = malData[malField];
      
      if (JSON.stringify(currentValue) !== JSON.stringify(newValue)) {
        needsUpdate = true;
        updates[field] = newValue;
      }
    }

    const currentGenres = existingAnime.genres || [];
    const newGenres = malData.genres?.map((g: any) => g.name) || [];
    if (JSON.stringify(currentGenres.sort()) !== JSON.stringify(newGenres.sort())) {
      needsUpdate = true;
      updates.genres = newGenres;
    }
    
    const currentStudios = existingAnime.studios || [];
    const newStudios = malData.studios?.map((s: any) => s.name) || [];
    if (JSON.stringify(currentStudios.sort()) !== JSON.stringify(newStudios.sort())) {
      needsUpdate = true;
      updates.studios = newStudios;
    }
    
    const currentAltTitles = existingAnime.alternative_titles || {};
    const newAltTitles = {
      synonyms: malData.alternative_titles?.synonyms || [],
      en: malData.alternative_titles?.en || malData.title,
      jp: malData.alternative_titles?.ja || ''
    };
    if (JSON.stringify(currentAltTitles) !== JSON.stringify(newAltTitles)) {
      needsUpdate = true;
      updates.alternative_titles = newAltTitles;
    }
    
    const currentRecs = existingAnime.recommendations || [];
    const newRecs = malData.recommendations?.map((rec: any) => ({
      anime_id: rec.node.id,
      title: rec.node.title,
      poster: rec.node.main_picture?.large || rec.node.main_picture?.medium || ''
    })) || [];
    if (JSON.stringify(currentRecs) !== JSON.stringify(newRecs)) {
      needsUpdate = true;
      updates.recommendations = newRecs;
    }
    
    const currentRelated = existingAnime.related_anime || [];
    const newRelated = malData.related_anime?.map((rel: any) => ({
      anime_id: rel.node.id,
      title: rel.node.title,
      poster: rel.node.main_picture?.large || rel.node.main_picture?.medium || ''
    })) || [];
    if (JSON.stringify(currentRelated) !== JSON.stringify(newRelated)) {
      needsUpdate = true;
      updates.related_anime = newRelated;
    }
    
    if (needsUpdate) {
      await collection.updateOne(
        { anime_id: parseInt(malId) },
        { $set: updates }
      );
      console.log(`Updated anime ${malId} with new data`);
    }

    if (existingAnime.status === 'currently_airing' && existingAnime.session) {
      try {
        const latestEpisodesData = await getAllEpisodes(existingAnime.session, 1);
        const currentEpisodeCount = existingAnime.episodes?.length || 0;
        const newEpisodeCount = latestEpisodesData.pagination.total;
        
        if (newEpisodeCount > currentEpisodeCount) {
          console.log(`New episodes found for ${malId}. Updating from ${currentEpisodeCount} to ${newEpisodeCount} episodes`);
          
          if (newEpisodeCount > 30) {
            await collection.updateOne(
              { anime_id: parseInt(malId) },
              { $set: { use_api: true } }
            );
            existingAnime.use_api = true;
          } else {
            let allEpisodes = [...latestEpisodesData.episodes];
            let currentPage = 1;
            
            while (currentPage < latestEpisodesData.pagination.last_page) {
              currentPage++;
              const nextPageData = await getAllEpisodes(existingAnime.session, currentPage);
              allEpisodes = [...allEpisodes, ...nextPageData.episodes];
            }
            
            await collection.updateOne(
              { anime_id: parseInt(malId) },
              { $set: { episodes: allEpisodes } }
            );
            existingAnime.episodes = allEpisodes;
          }
        }
      } catch (error) {
        console.error('Error updating episodes for currently airing anime:', error);
      }
    }
    
    if (existingAnime.session && (!existingAnime.episodes || existingAnime.episodes.length === 0)) {
      try {
        const episodesData = await getAllEpisodes(existingAnime.session, 1);

        if (episodesData.pagination.total > 30) {
          await collection.updateOne(
            { anime_id: parseInt(malId) },
            { $set: { use_api: true } }
          );
          existingAnime.use_api = true;
        } else {
          let allEpisodes = [...episodesData.episodes];
          let currentPage = 1;
          
          while (currentPage < episodesData.pagination.last_page) {
            currentPage++;
            const nextPageData = await getAllEpisodes(existingAnime.session, currentPage);
            allEpisodes = [...allEpisodes, ...nextPageData.episodes];
          }
          
          await collection.updateOne(
            { anime_id: parseInt(malId) },
            { $set: { episodes: allEpisodes } }
          );
          existingAnime.episodes = allEpisodes;
        }
      } catch (error) {
        
      }
    }
    
    return existingAnime;
  }
  
  const paheAnime = await findMatchingPaheAnime(malId, malData.title);
  let animeDoc = mapMALToDatabaseSchema(malData, paheAnime);
  
  if (paheAnime) {
    try {
      const episodesData = await getAllEpisodes(paheAnime.session, 1);
      
      if (episodesData.pagination.total > 30) {
        animeDoc.use_api = true;
      } else {
        let allEpisodes = [...episodesData.episodes];
        let currentPage = 1;
        
        while (currentPage < episodesData.pagination.last_page) {
          currentPage++;
          const nextPageData = await getAllEpisodes(paheAnime.session, currentPage);
          allEpisodes = [...allEpisodes, ...nextPageData.episodes];
        }
        
        animeDoc.episodes = allEpisodes;
      }
    } catch (error) {
      console.error('Error fetching episodes:', error);
      animeDoc.use_api = true;
    }
  }
  
  const result = await collection.insertOne(animeDoc);
  animeDoc._id = result.insertedId;
  
  return animeDoc;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const method = searchParams.get('method');
  const session = searchParams.get('session');
  const page = searchParams.get('page');
  const mal_id = searchParams.get('mal_id');
  
  if (!method) {
    return NextResponse.json({ error: 'method parameter is required' }, { status: 400, headers: corsHeaders });
  }
  
  try {
    if (method === 'links' && session) {
      const pageNum = page ? parseInt(page) : 1;
      if (isNaN(pageNum) || pageNum < 1) {
        return NextResponse.json({ error: 'Invalid page number' }, { status: 400, headers: corsHeaders });
      }
      
      const animeData = await getAnime(session, pageNum);
      return NextResponse.json({
        ...animeData
      }, { headers: corsHeaders });
    } else if (method === 'info' && mal_id) {
      const animeInfo = await getAnimeInfo(mal_id);
      return NextResponse.json(animeInfo, { headers: corsHeaders });
    } else if (method === 'mal_id' && session) {
      const malId = await getPaheMalId(session);
      
      if (!malId) {
        return NextResponse.json({ 
          error: 'MAL ID not found for this session',
          session: session
        }, { status: 404, headers: corsHeaders });
      }
      
      return NextResponse.json({
        session: session,
        mal_id: malId
      }, { headers: corsHeaders });
    } else {
      return NextResponse.json({ error: 'Invalid method or missing session' }, { status: 400, headers: corsHeaders });
    }
  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to scrape links',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': 'https://meowani.vercel.app',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
