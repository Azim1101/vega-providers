import { Post, ProviderContext } from "../types";

const BASE_API = "https://api.mxplayer.in/v1/web/search/result";
const IMAGE_BASE = "https://qqcdnpictest.mxplay.com/";

function buildImageUrl(imageInfo: any[] | null, id: string): string {
  if (!imageInfo || imageInfo.length === 0) {
    // fallback to pic endpoint
    return `https://qqcdnpictest.mxplay.com/pic/${id}/en/16x9/640x360/test_pic.jpg`;
  }
  // prefer bigpic or landscape
  const preferred =
    imageInfo.find((i: any) => i.type === "bigpic") ||
    imageInfo.find((i: any) => i.type === "landscape") ||
    imageInfo[0];
  if (preferred?.url) {
    return `${IMAGE_BASE}${preferred.url}`.replace("http://", "https://");
  }
  return "";
}

function mapItemToPost(item: any): Post {
  const id = item.id;
  const type = item.type; // tvshow, movie, episode
  const title = item.title || "Untitled";
  const image = buildImageUrl(item.imageInfo, id);
  // link format: type:id for easier parsing in meta
  // For tvshow/movie we store id, for episode we store id as well
  // We'll use format `${type}:${id}` to keep type info
  return {
    title,
    link: `${type}:${id}`,
    image,
  };
}

async function fetchSearch(query: string, providerContext: ProviderContext): Promise<Post[]> {
  try {
    const url = `${BASE_API}?query=${encodeURIComponent(
      query
    )}&platform=com.mxplay.desktop&content-languages=en,hi&device-density=3&userid=test`;
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const data = await response.json();
    const sections = data?.sections || [];
    const posts: Post[] = [];
    for (const section of sections) {
      const items = section.items || [];
      for (const item of items) {
        // only tvshow and movie for posts, skip episode if appears
        if (item.type === "tvshow" || item.type === "movie") {
          posts.push(mapItemToPost(item));
        }
      }
    }
    return posts;
  } catch (e) {
    console.error("mxplayer posts error", e);
    return [];
  }
}

export const getPosts = async function ({
  filter,
  providerContext,
}: {
  filter: string;
  page: number;
  providerValue: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Post[]> {
  const query = filter && filter !== "trending" ? filter : "aashram";
  // For trending we use a popular query
  const q = filter === "trending" ? "bhaukaal" : query;
  return await fetchSearch(q, providerContext);
};

export const getSearchPosts = async function ({
  searchQuery,
  providerContext,
}: {
  searchQuery: string;
  page: number;
  providerValue: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Post[]> {
  if (!searchQuery) return [];
  return await fetchSearch(searchQuery, providerContext);
};
