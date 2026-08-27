import "server-only";

import { createHmac, randomUUID } from "node:crypto";

import type { ImageKitUploadSigner, UploadAuthorization } from "../application/ports";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MIME_CHECK = "'file.mime' IN ['image/jpeg', 'image/png', 'image/webp']";

export class ImageKitV2UploadSigner implements ImageKitUploadSigner {
  private readonly endpoint: URL;

  constructor(
    private readonly config: { publicKey: string; privateKey: string; urlEndpoint: string; environment: string },
  ) {
    this.endpoint = new URL(config.urlEndpoint);
  }

  authorize(input: { vendorId: string; propertyId: string; fileName: string; now: Date }): UploadAuthorization {
    const issuedAt = Math.floor(input.now.getTime() / 1000);
    const expiresAt = issuedAt + 10 * 60;
    const folder = this.folder(input.vendorId, input.propertyId);
    const payload = {
      fileName: input.fileName,
      folder,
      useUniqueFileName: true as const,
      checks: `'request.folder' = '${folder}' AND 'file.size' <= ${MAX_IMAGE_BYTES} AND ${MIME_CHECK}`,
      tags: ["book-my-room", `vendor-${input.vendorId}`, `property-${input.propertyId}`],
    };
    const token = signJwt(
      { ...payload, iat: issuedAt, exp: expiresAt, jti: randomUUID() },
      { alg: "HS256", typ: "JWT", kid: this.config.publicKey },
      this.config.privateKey,
    );
    return {
      uploadUrl: "https://upload.imagekit.io/api/v2/files/upload",
      token,
      publicKey: this.config.publicKey,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
      payload,
    };
  }

  validateRegisteredAsset(input: { vendorId: string; propertyId: string; filePath: string; url: string }): boolean {
    const folder = this.folder(input.vendorId, input.propertyId);
    if (!input.filePath.startsWith(`${folder}/`)) return false;
    const assetUrl = new URL(input.url);
    if (assetUrl.protocol !== "https:" || assetUrl.origin !== this.endpoint.origin) return false;
    const endpointPath = this.endpoint.pathname.replace(/\/$/, "");
    return assetUrl.pathname.startsWith(`${endpointPath}${input.filePath}`);
  }

  private folder(vendorId: string, propertyId: string) {
    const environment = this.config.environment.replace(/[^a-zA-Z0-9_-]/g, "-");
    return `/book-my-room/${environment}/vendors/${vendorId}/properties/${propertyId}`;
  }
}

function signJwt(payload: Record<string, unknown>, header: Record<string, string>, secret: string): string {
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const content = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret).update(content).digest("base64url");
  return `${content}.${signature}`;
}
