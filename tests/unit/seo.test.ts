import { afterEach, describe, expect, it } from "vitest";

import { metadata } from "../../app/layout";
import robots from "../../app/robots";

const previousNodeEnv = process.env.NODE_ENV;
const previousOrigin = process.env.APP_ORIGIN;

afterEach(() => {
  Object.assign(process.env, { NODE_ENV: previousNodeEnv, APP_ORIGIN: previousOrigin });
});

describe("technical SEO policy", () => {
  it("uses the locked canonical production origin", () => {
    expect(new URL(metadata.metadataBase!.toString()).origin).toBe("https://bookmyroom.site");
    expect(metadata.alternates).toEqual({ canonical: "/" });
  });

  it("makes every non-production environment noindex", () => {
    Object.assign(process.env, { NODE_ENV: "development", APP_ORIGIN: "http://localhost:3000" });
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("keeps private and internal-search routes out of production crawl rules", () => {
    Object.assign(process.env, { NODE_ENV: "production", APP_ORIGIN: "https://bookmyroom.site" });
    const policy = robots();
    expect(policy.sitemap).toBe("https://bookmyroom.site/sitemap.xml");
    expect(policy.rules).toMatchObject({ disallow: ["/api/", "/auth", "/admin/", "/vendor/", "/search"] });
  });
});
