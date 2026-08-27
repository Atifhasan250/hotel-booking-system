import "server-only";

import { IdentityService } from "../application/identity-service";
import { ActorResolver } from "../application/actor-resolver";
import { getServerEnv } from "../../../platform/config/server-env";
import { Argon2idPasswordHasher, CryptographicTokenFactory, RandomUuidFactory } from "../../../platform/crypto/secrets";
import { getMongoClient, getMongoDatabase } from "../../../platform/db/mongo-client";
import { assertMongoTransactionSupport, MongoTransactionRunner } from "../../../platform/db/mongo-transaction";
import { MongoIdentityMessageOutbox } from "./mongo-identity-messages";
import {
  ensureIdentityIndexes,
  MongoActorGrantRepository,
  MongoAuditEventWriter,
  MongoIdentityTokenRepository,
  MongoRateLimiter,
  MongoSessionRepository,
  MongoUserRepository,
} from "./mongo-identity-repositories";

let servicePromise: Promise<IdentityService> | undefined;
let actorResolverPromise: Promise<ActorResolver> | undefined;
let transactionsPromise: Promise<MongoTransactionRunner> | undefined;

export function getIdentityService(): Promise<IdentityService> {
  servicePromise ??= createIdentityService().catch((error) => {
    servicePromise = undefined;
    throw error;
  });
  return servicePromise;
}

export function getActorResolver(): Promise<ActorResolver> {
  actorResolverPromise ??= createActorResolver().catch((error) => {
    actorResolverPromise = undefined;
    throw error;
  });
  return actorResolverPromise;
}

async function createIdentityService(): Promise<IdentityService> {
  const [db, transactions] = await Promise.all([getMongoDatabase(), getTransactions()]);
  await ensureIdentityIndexes(db);
  await assertMongoTransactionSupport(transactions, db);
  const env = getServerEnv();
  return new IdentityService({
    users: new MongoUserRepository(db, transactions),
    sessions: new MongoSessionRepository(db, transactions),
    tokens: new MongoIdentityTokenRepository(db, transactions),
    passwordHasher: new Argon2idPasswordHasher(),
    tokenFactory: new CryptographicTokenFactory(),
    ids: new RandomUuidFactory(),
    clock: { now: () => new Date() },
    messages: new MongoIdentityMessageOutbox(db, env.IDENTITY_TOKEN_ENCRYPTION_KEY, transactions),
    rateLimiter: new MongoRateLimiter(db, transactions),
    audit: new MongoAuditEventWriter(db, transactions),
    transactions,
  });
}

async function createActorResolver(): Promise<ActorResolver> {
  const [db, transactions] = await Promise.all([getMongoDatabase(), getTransactions()]);
  await ensureIdentityIndexes(db);
  await assertMongoTransactionSupport(transactions, db);
  return new ActorResolver(
    new MongoSessionRepository(db, transactions),
    new MongoUserRepository(db, transactions),
    new MongoActorGrantRepository(db),
  );
}

function getTransactions(): Promise<MongoTransactionRunner> {
  transactionsPromise ??= getMongoClient().then((client) => new MongoTransactionRunner(client));
  return transactionsPromise;
}
