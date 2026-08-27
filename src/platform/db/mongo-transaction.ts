import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import type { ClientSession, Db, MongoClient } from "mongodb";

import type { TransactionRunner } from "../../modules/identity/application/ports";

export class MongoTransactionRunner implements TransactionRunner {
  private readonly storage = new AsyncLocalStorage<ClientSession>();

  constructor(private readonly client: MongoClient) {}

  current(): ClientSession | undefined {
    return this.storage.getStore();
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.current()) return work();
    const session = this.client.startSession();
    let result: T | undefined;
    let completed = false;
    try {
      await session.withTransaction(async () => {
        result = await this.storage.run(session, work);
        completed = true;
      }, {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      });
      if (!completed) throw new Error("Identity transaction completed without a result");
      return result as T;
    } finally {
      await session.endSession();
    }
  }
}

const capabilityPromises = new WeakMap<MongoTransactionRunner, Promise<void>>();

export function assertMongoTransactionSupport(
  transactions: MongoTransactionRunner,
  db: Db,
): Promise<void> {
  const existing = capabilityPromises.get(transactions);
  if (existing) return existing;
  const capabilityPromise = transactions.run(async () => {
    await db.collection<{ _id: string }>("users").findOne(
      { _id: "__book_my_room_transaction_probe__" },
      { projection: { _id: 1 }, session: transactions.current() },
    );
  }).catch((error) => {
    capabilityPromises.delete(transactions);
    throw new Error("MongoDB transaction support is required for identity mutations", { cause: error });
  });
  capabilityPromises.set(transactions, capabilityPromise);
  return capabilityPromise;
}
