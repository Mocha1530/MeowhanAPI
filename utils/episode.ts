import { Db } from 'mongodb';
import { EXTERNAL_APIS, DATABASE_CONFIG } from '@/lib/constants';
import { getAllEpisodes } from './anime-scraper';

export async function getEpisodeData(
  animeSession: string,
  episode: { 
    episode_session: string;
    episode_number: number 
  },
  db: Db
) {
  const collection = db.collection(DATABASE_CONFIG.COLLECTION_NAME);
  const { episode_session, episode_number } = episode;
  
  const anime = await collection.findOne({ session: animeSession });
  if (!anime) throw new Error('Anime not found in database');
  
  let episodeData;
  
  if (anime.use_api) {
    const page = Math.ceil(episode_number / 30);
    const episodesData = await getAllEpisodes(animeSession, page);
    episodeData = episodesData.episodes.find(ep => ep.session === episode_session);
    
    if (!episodeData) throw new Error('Episode not found in API');
  } else {
    episodeData = anime.episodes.find(ep => ep.session === episode_session);
    if (!episodeData) throw new Error('Episode not found in database');
  }
  
  return await fetchAndUpdateDirectUrls(anime, episodeData, episode_session, db);
}

export async function fetchAndUpdateDirectUrls(anime: any, episodeData: any, episodeSession: string, db: Db) {
  const collection = db.collection(DATABASE_CONFIG.COLLECTION_NAME);
  
  const workerResponse = await fetch(EXTERNAL_APIS.WORKERS.EPISODE(anime.session, episodeSession));
  if (!workerResponse.ok) throw new Error('Failed to fetch from worker API');
  
  const workerData = await workerResponse.json();
  
  const updatedKwikLinks = await Promise.all(
    episodeData.links.kwik.map(async (kwikLink: any) => {
      const workerLink = workerData.find((wl: any) => {
        const name = wl.name.toLowerCase();
        const hasSub = kwikLink.sub && name.includes(kwikLink.sub.toLowerCase());
        const hasResolution = kwikLink.resolution && name.includes(kwikLink.resolution.replace('p', '').toLowerCase());
        return hasSub && hasResolution;
      });
      
      if (!workerLink || kwikLink.direct_url) return kwikLink;
      
      try {
        const directUrlResponse = await fetch(EXTERNAL_APIS.WORKERS.ACCESS_KWIK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service: 'kwik',
            action: 'fetch',
            content: { kwik: workerLink.link },
            auth: process.env.KWIK_ACCESS_TOKEN
          })
        });
        
        if (!directUrlResponse.ok) throw new Error('Failed to fetch direct URL');
        
        const directUrlData = await directUrlResponse.json();
        if (directUrlData.status && directUrlData.content.url) {
          return { ...kwikLink, direct_url: directUrlData.content.url };
        }
      } catch (error) {
        console.error(`Failed to get direct URL for ${workerLink.link}:`, error);
      }
      
      return kwikLink;
    })
  );
  
  const hasDirectUrlsChanged = episodeData.links.kwik.some((oldLink: any, index: number) => 
    oldLink.direct_url !== updatedKwikLinks[index].direct_url
  );
  
  const updatedEpisode = {
    ...episodeData,
    links: { ...episodeData.links, kwik: updatedKwikLinks }
  };
  
  if (!anime.use_api && hasDirectUrlsChanged) {
    const updatedEpisodes = anime.episodes.map((ep: any) =>
      ep.session === episodeSession ? updatedEpisode : ep
    );
    
    await collection.updateOne(
      { session: anime.session },
      { $set: { episodes: updatedEpisodes } }
    );
    
    console.log(`Updated direct URLs for episode ${episodeSession}`);
  }
  
  return updatedEpisode;
}
