import { Db } from 'mongodb';
import { convertDecimalFields } from './database';
import { DATABASE_CONFIG } from '@/lib/constants';
import { fetchMALAnimeInfo, getPaheMalId } from './mal';
import { searchAnimeOnPahe, getAllEpisodes } from './anime-scraper';

export async function findMatchingPaheAnime(malId: string, title: string) {
  const searchResults = await searchAnimeOnPahe(title);
  if (!searchResults.data) return null;
  
  for (const anime of searchResults.data) {
    try {
      const paheMalId = await getPaheMalId(anime.session);
      if (paheMalId === malId) return anime;
    } catch (error) {
      console.error(`Error checking anime ${anime.title}:`, error);
      continue;
    }
  }
  
  return null;
}

export function mapMALToDatabaseSchema(malData: any, paheData: any = null) {
  const statusMap: { [key: string]: string } = {
    'currently_airing': 'currently_airing',
    'finished_airing': 'finished_airing',
    'not_yet_aired': 'not_yet_aired'
  };

  const ratingMap: { [key: string]: string } = {
    'g': 'g', 'pg': 'pg', 'pg_13': 'pg_13', 'r': 'r', 'r+': 'r+', 'rx': 'rx'
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
    current_episode_count: 0,
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
      anime: {
        anime_id: rel.node.id,
        title: rel.node.title,
        poster: rel.node.main_picture?.large || rel.node.main_picture?.medium || '',
        type: '',
        duration: 0
      },
      type: rel.relation_type,
      type_formatted: rel.relation_type_formatted
    })) || [],
    use_api: false
  };
}

export async function getAnimeInfo(malId: string, db: Db) {
  const collection = db.collection('allani');
  
  let existingAnime = await collection.findOne({ anime_id: parseInt(malId) });
  const malData = await fetchMALAnimeInfo(malId);
  
  if (existingAnime) {
    return await updateExistingAnime(existingAnime, malData, collection, db);
  }
  
  return await createNewAnime(malData, collection, db);
}

async function updateExistingAnime(existingAnime: any, malData: any, collection: any, db: Db) {
  existingAnime = convertDecimalFields(existingAnime);
  let needsUpdate = false;
  const updates: any = {};
    
  const fieldsToCheck = [
    'title', 'synopsis', 'status', 'episode_count', 
    'start_date', 'end_date', 'score', 'rating', 
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
    
  // const currentRelated = existingAnime.related_anime || [];
  // const newRelated = malData.related_anime?.map((rel: any) => ({
  //   anime_id: rel.node.id,
  //   title: rel.node.title,
  //   poster: rel.node.main_picture?.large || rel.node.main_picture?.medium || ''
  // })) || [];
  // if (JSON.stringify(currentRelated) !== JSON.stringify(newRelated)) {
  //   needsUpdate = true;
  //   updates.related_anime = newRelated;
  // }

  const currentRelated = existingAnime.related_anime || [];
  const normalizedCurrentRelated = currentRelated.map((rel: any) => {
    if (rel.anime) {
      return rel;
    } else {
      return {
        anime: {
          anime_id: rel.anime_id || rel.id,
          title: rel.title,
          poster: rel.poster,
          type: '',
          duration: 0
        },
        type: rel.relation_type || rel.type,
        type_formatted: rel.relation_type_formatted || rel.type_formatted || ''
      };
    }
  });

  const newRelated = await Promise.all((malData.related_anime || []).map( async (rel: any) => {
    try {
      const relatedDetails = await fetchMALAnimeInfo(
        rel.node.id.toString(),
        'media_type,average_episode_duration'
      );

      return {
        anime: {
          anime_id: rel.node.id,
          title: rel.node.title,
          poster: rel.node.main_picture?.large || rel.node.main_picture?.medium || '',
          type: relatedDetails.media_type?.toUpperCase() || '',
          duration: relatedDetails.average_episode_duration || 0
        },
        type: rel.relation_type,
        type_formatted: rel.relation_type_formatted
      };
    } catch (error) {
      return { 
          anime: {
            anime_id: rel.node.id,
            title: rel.node.title,
            poster: rel.node.main_picture?.large || rel.node.main_picture?.medium || '',
            type: '',
            duration: 0
          },
          type: rel.relation_type,
          type_formatted: rel.relation_type_formatted
        };
      }
    })
  );

  const areRelatedAnimeEqual = (current: any[], updated: any[]) => {
    if (current.length !== updated.length) return false;
    
    for (let i = 0; i < current.length; i++) {
      const currentRel = current[i];
      const updatedRel = updated[i];
      
      if (
        currentRel.anime?.anime_id !== updatedRel.anime?.anime_id ||
        currentRel.anime?.title !== updatedRel.anime?.title ||
        currentRel.anime?.poster !== updatedRel.anime?.poster ||
        currentRel.anime?.type !== updatedRel.anime?.type ||
        currentRel.anime?.duration !== updatedRel.anime?.duration ||
        currentRel.type !== updatedRel.type ||
        currentRel.type_formatted !== updatedRel.type_formatted
      ) {
        return false;
      }
    }
    
    return true;
  };

  if (!areRelatedAnimeEqual(normalizedCurrentRelated, newRelated)) {
    needsUpdate = true;
    updates.related_anime = newRelated;
  }
    
  // if (needsUpdate) {
  //   await collection.updateOne(
  //     { anime_id: parseInt(malData.id) },
  //     { $set: updates }
  //   );
  //   console.log(`Updated anime ${malData.id} with new data`);
  // }

  if ((existingAnime.status === 'currently_airing' && existingAnime.session) || 
      (existingAnime.session && (!existingAnime.episodes || existingAnime.episodes.length === 0))) {
    try {
      const latestEpisodesData = await getAllEpisodes(existingAnime.session, 1);
      const currentEpisodeCount = existingAnime.episodes?.length || 0;
      const newEpisodeCount = latestEpisodesData.pagination.total;

      if (newEpisodeCount !== currentEpisodeCount) {
        updates.current_episode_count = newEpisodeCount
        needsUpdate = true;
      }
        
      if (newEpisodeCount > currentEpisodeCount) {
        console.log(`New episodes found for ${malData.id}. Updating from ${currentEpisodeCount} to ${newEpisodeCount} episodes`);
          
        if (newEpisodeCount > 30) {
          updates.use_api = true;
        } else {
          let allEpisodes = [...latestEpisodesData.episodes];
          let currentPage = 1;
            
          while (currentPage < latestEpisodesData.pagination.last_page) {
            currentPage++;
            const nextPageData = await getAllEpisodes(existingAnime.session, currentPage);
            allEpisodes = [...allEpisodes, ...nextPageData.episodes];
          }

          const existingEpisodesMap = new Map();
          existingAnime.episodes?.forEach(ep => {
            existingEpisodesMap.set(ep.episode, ep);
          });

          const mergedEpisodes = allEpisodes.map(newEp => {
            const existingEp = existingEpisodesMap.get(newEp.episode);
            if (!existingEp) {
              return { ...newEp };
            }
              
            const hasEpisodeDataChanged = 
              existingEp.duration !== newEp.duration ||
              existingEp.session !== newEp.session ||
              existingEp.snapshot !== newEp.snapshot;
              
            if (hasEpisodeDataChanged) {
              const updatedLinks = {
                ...newEp.links,
                kwik: newEp.links.kwik.map(newKwikLink => {
                  const existingKwikLink = existingEp.links.kwik.find(
                    existingLink => existingLink.url === newKwikLink.url
                  );
                    
                  return {
                    ...newKwikLink,
                    direct_url: existingKwikLink?.direct_url || null
                  };
                })
              };
                
              return { 
                ...existingEp,
                duration: newEp.duration,
                snapshot: newEp.snapshot,
                session: newEp.session,
                links: updatedLinks
              };
            }
              
            return existingEp;
          });
            
          updates.episodes = mergedEpisodes;
          updates.current_episode_count = mergedEpisodes.length;
        }
        needsUpdate = true;
      }
    } catch (error) {
      console.error('Error updating episodes for currently airing anime:', error);
    }
  }
    
  if (needsUpdate) {
    await collection.updateOne(
      { anime_id: parseInt(malData.id) },
      { $set: updates }
    );
    existingAnime = { ...existingAnime, ...updates };
  }
  
  return existingAnime;
}

async function createNewAnime(malData: any, collection: any, db: Db) {
  const paheAnime = await findMatchingPaheAnime(malData.id.toString(), malData.title);
  let animeDoc = mapMALToDatabaseSchema(malData, paheAnime);
  animeDoc.current_episode_count = 0;

  if (animeDoc.related_anime && animeDoc.related_anime.length > 0) {
    animeDoc.related_anime = await Promise.all(animeDoc.related_anime.map(async (rel: any) => {
      try {
        const relatedDetails = await fetchMALAnimeInfo(
          rel.anime.anime_id.toString(),
          'media_type,average_episode_duration'
        );
        
        return {
          ...rel,
          anime: {
            ...rel.anime,
            type: relatedDetails.media_type?.toUpperCase() || '',
            duration: relatedDetails.average_episode_duration || 0
          }
        };
      } catch (error) {
        console.error(`Error fetching details for related anime ${rel.anime.anime_id}:`, error);
        return rel;
      }
    }));
  }
  
  if (paheAnime) {
    try {
      const episodesData = await getAllEpisodes(paheAnime.session, 1);
      const totalEpisodes = episodesData.pagination.total;
      animeDoc.current_episode_count = totalEpisodes;
      
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
        animeDoc.current_episode_count = allEpisodes.length;
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
