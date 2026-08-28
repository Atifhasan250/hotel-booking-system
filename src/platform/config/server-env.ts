import "server-only";

import {
  parseImageKitDeliveryEnv,
  parseMongoEnv,
  parseServerEnv,
  type ImageKitDeliveryEnv,
  type MongoEnv,
  type ServerEnv,
} from "./env-schema";

let cachedEnv: ServerEnv | undefined;
let cachedMongoEnv: MongoEnv | undefined;
let cachedImageKitDeliveryEnv: ImageKitDeliveryEnv | undefined;

export function getServerEnv(): ServerEnv {
  cachedEnv ??= parseServerEnv(process.env);
  return cachedEnv;
}

export function getMongoEnv(): MongoEnv {
  cachedMongoEnv ??= parseMongoEnv(process.env);
  return cachedMongoEnv;
}

export function getImageKitDeliveryEnv(): ImageKitDeliveryEnv {
  cachedImageKitDeliveryEnv ??= parseImageKitDeliveryEnv(process.env);
  return cachedImageKitDeliveryEnv;
}
