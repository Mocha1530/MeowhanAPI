export const PAHE_HEADERS = {
  "Accept": "application/json, text/javascript, */*; q=0.0",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0",
  "Cookie": process.env.PAHE_COOKIE || ""
};

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://meowani.vercel.app',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const EXTERNAL_APIS = {
  PAHE: {
    BASE: 'https://animepahe.si',
    API: 'https://animepahe.si/api',
    PLAY: (animeSession: string, episodeSession: string) => 
      `https://animepahe.si/play/${animeSession}/${episodeSession}`
  },
  MAL: {
    BASE: 'https://api.myanimelist.net/v2/anime',
    FIELDS: {
      BASIC: "id,title,main_picture,alternative_titles,media_type,rating,average_episode_duration,status,num_episodes",
      FULL: "id,title,main_picture,alternative_titles,start_date,end_date,synopsis,mean,created_at,updated_at,media_type,status,genres,my_list_status,num_episodes,start_season,broadcast,average_episode_duration,rating,related_anime,recommendations,studios"
    }
  },
  WORKERS: {
    EPISODE: (session: string, ep: string) => 
      `https://anime.apex-cloud.workers.dev/?method=episode&session=${session}&ep=${ep}`,
    ACCESS_KWIK: 'https://access-kwik.apex-cloud.workers.dev'
  }
};

export const DATABASE_CONFIG = {
  URI: process.env.MEOW_MONGODB_URI!,
  DB_NAME: process.env.MEOW_ANI_MONGODB_DB,
  COLLECTION_NAME: 'allani'
} as const;
