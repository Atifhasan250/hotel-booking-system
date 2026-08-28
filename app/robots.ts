import type { MetadataRoute } from "next";

const canonicalOrigin = "https://bookmyroom.site";

export default function robots(): MetadataRoute.Robots {
  const production = process.env.NODE_ENV === "production" && process.env.APP_ORIGIN === canonicalOrigin;
  if (!production) return { rules: { userAgent: "*", disallow: "/" } };

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/properties/", "/destinations/"],
      disallow: ["/api/", "/auth", "/admin/", "/vendor/", "/search"],
    },
    sitemap: `${canonicalOrigin}/sitemap.xml`,
    host: canonicalOrigin,
  };
}

