import type { MetadataRoute } from "next";
import { absoluteUrl } from "../lib/site.mjs";

// sitemap.xml。canonical と同じ absoluteUrl を通すことで、
// サブパス配信のときに実在しない URL を申告してしまうのを防ぐ。

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: absoluteUrl("/"),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
