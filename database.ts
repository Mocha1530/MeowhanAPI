import { MongoClient } from 'mongodb';
import { DATABASE_CONFIG } from '@/lib/constants';

export async function connectToDatabase() {
  const client = new MongoClient(DATABASE_CONFIG.URI);
  await client.connect();
  return client.db(DATABASE_CONFIG.DB_NAME);
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
