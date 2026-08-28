import { describe, expect, it } from "vitest";

import {
  parseImageKitDeliveryEnv,
  parseMongoEnv,
  parseServerEnv,
  serverEnvSchema,
} from "../../src/platform/config/env-schema";

const validEnv = {
  NODE_ENV: "test",
  APP_ORIGIN: "http://localhost:3000",
  MONGODB_URI: "mongodb://localhost:27017/?replicaSet=rs0",
  MONGODB_DB_NAME: "book_my_room_test",
  IDENTITY_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
  IMAGEKIT_PUBLIC_KEY: "public_test_key",
  IMAGEKIT_PRIVATE_KEY: "private_test_key",
  IMAGEKIT_URL_ENDPOINT: "https://ik.imagekit.io/book-my-room-test",
} satisfies NodeJS.ProcessEnv;

describe("server environment contract", () => {
  it("supports dependency-scoped public catalog configuration", () => {
    expect(parseMongoEnv(validEnv)).toEqual({
      MONGODB_URI: validEnv.MONGODB_URI,
      MONGODB_DB_NAME: validEnv.MONGODB_DB_NAME,
    });
    expect(parseImageKitDeliveryEnv(validEnv)).toEqual({
      IMAGEKIT_URL_ENDPOINT: validEnv.IMAGEKIT_URL_ENDPOINT,
    });
  });
  it("accepts an isolated local/test configuration", () => {
    expect(parseServerEnv(validEnv)).toMatchObject({
      NODE_ENV: "test",
      MONGODB_DB_NAME: "book_my_room_test",
    });
  });

  it("rejects missing secrets without exposing their values", () => {
    const result = serverEnvSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(() => parseServerEnv({})).toThrow();
  });

  it("requires an HTTPS ImageKit delivery endpoint", () => {
    expect(() => parseServerEnv({
      ...validEnv,
      IMAGEKIT_URL_ENDPOINT: "http://ik.imagekit.io/book-my-room-test",
    })).toThrow("ImageKit URL endpoint must use HTTPS");
  });
});
