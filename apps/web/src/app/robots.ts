import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/preview/", "/admin/"],
      },
    ],
    sitemap: "https://anycol.aurict.com/sitemap.xml",
    host: "https://anycol.aurict.com",
  };
}
