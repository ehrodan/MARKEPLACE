import type { MetadataRoute } from "next";
import { crawlPolicy } from "@/lib/crawl-policy";

export default function sitemap(): MetadataRoute.Sitemap {
  const policy = crawlPolicy();
  if (!policy.indexable || !policy.siteUrl) return [];

  return [{
    url: policy.siteUrl.href,
    changeFrequency: "weekly",
    priority: 1,
  }];
}
