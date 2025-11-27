import { MongoClient, Db } from 'mongodb';
import { DATABASE_CONFIG } from '@/lib/constants';

let cachedDb: Db = null;

export async function connectToDatabase(): Promise<Db> {
  if (cachedDb) {
    return cachedDb;
  }

  const client = new MongoClient(DATABASE_CONFIG.URI);
  await client.connect();
  cachedDb = client.db(DATABASE_CONFIG.DB_NAME);
  
  return cachedDb;
}

export function convertDecimalFields(obj: any): any {
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
