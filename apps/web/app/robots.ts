import type { MetadataRoute } from "next";
import { crawlPolicy } from "@/lib/crawl-policy";

export default function robots(): MetadataRoute.Robots {
  const policy = crawlPolicy();
  if (!policy.indexable || !policy.siteUrl) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      disallow: [...policy.privateRoutePrefixes, "/*?*"],
    }],
    sitemap: new URL("/sitemap.xml", policy.siteUrl).href,
    host: policy.siteUrl.href,
  };
}
