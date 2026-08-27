import "server-only";

import { parseServerEnv, type ServerEnv } from "./env-schema";

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cachedEnv ??= parseServerEnv(process.env);
  return cachedEnv;
}
