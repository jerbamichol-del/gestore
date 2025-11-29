import { openDB, IDBPDatabase } from 'idb';

export interface OfflineImage {
  id: string;
  base64Image: string;
  mimeType: string;
  timestamp?: number;
}

const DB_NAME = 'expense-manager-db';
const STORE_NAME = 'offline-images';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<unknown>> | null = null;

const getDb = (): Promise<IDBPDatabase<unknown>> => {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            },
            blocked() {
                console.warn('Database blocked');
            },
            blocking() {
                if (dbPromise) {
                    dbPromise.then((db) => db.close());
                    dbPromise = null;
                }
            },
            terminated() {
                dbPromise = null;
            },
        });
    }
    return dbPromise;
};

// Helper to retry once on "closing" error
async function withRetry<T>(operation: (db: IDBPDatabase<unknown>) => Promise<T>): Promise<T> {
    try {
        const db = await getDb();
        return await operation(db);
    } catch (error: any) {
        // Retry if the database connection is closing or closed
        if (error && (
            (error.message && (error.message.includes('closing') || error.message.includes('closed'))) || 
            error.name === 'InvalidStateError'
        )) {
            console.warn('Database connection issue, retrying...', error);
            dbPromise = null; // Force new connection
            const db = await getDb();
            return await operation(db);
        }
        throw error;
    }
}

export const addImageToQueue = async (image: OfflineImage): Promise<void> => {
  await withRetry(async (db) => {
      // Use put instead of add to upsert and prevent "Key already exists" errors
      await db.put(STORE_NAME, image);
  });
};

export const getQueuedImages = async (): Promise<OfflineImage[]> => {
  return await withRetry(async (db) => {
      return await db.getAll(STORE_NAME);
  }) as OfflineImage[];
};

export const deleteImageFromQueue = async (id: string): Promise<void> => {
  await withRetry(async (db) => {
      await db.delete(STORE_NAME, id);
  });
};
