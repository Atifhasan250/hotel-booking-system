import "server-only";

import { MongoClient, type Db } from "mongodb";

import { getMongoEnv } from "../config/server-env";

let clientPromise: Promise<MongoClient> | undefined;

export function getMongoClient(): Promise<MongoClient> {
  if (!clientPromise) {
    const { MONGODB_URI } = getMongoEnv();
    const client = new MongoClient(MONGODB_URI, { appName: "book-my-room" });
    clientPromise = client.connect().catch((error) => {
      clientPromise = undefined;
      throw error;
    });
  }
  return clientPromise;
}

export async function getMongoDatabase(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(getMongoEnv().MONGODB_DB_NAME);
}
