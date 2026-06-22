import { Post, ProviderContext } from "../types";

const defaultHeaders = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

export const getPosts = async function ({
  filter,
  page,
  signal,
  providerContext,
}: {
  filter: string;
  page: number;
  providerValue: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Post[]> {
  const { getBaseUrl, axios, cheerio } = providerContext;
  const baseUrl = await getBaseUrl("kdhindidubbed");
  const url = new URL(filter || "/", baseUrl);
  if (page > 1) {
    url.searchParams.set("page", page.toString());
  }

  return fetchPosts({
    url: url.toString(),
    signal,
    axios,
    cheerio,
  });
};

export const getSearchPosts = async function ({
  searchQuery,
  page,
  signal,
  providerContext,
}: {
  searchQuery: string;
  page: number;
  providerValue: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Post[]> {
  const { getBaseUrl, axios, cheerio } = providerContext;
  const baseUrl = await getBaseUrl("kdhindidubbed");
  const url = new URL("/", baseUrl);
  url.searchParams.set("s", searchQuery);
  if (page > 1) {
    url.searchParams.set("page", page.toString());
  }

  return fetchPosts({
    url: url.toString(),
    signal,
    axios,
    cheerio,
  });
};

async function fetchPosts({
  url,
  signal,
  axios,
  cheerio,
}: {
  url: string;
  signal: AbortSignal;
  axios: ProviderContext["axios"];
  cheerio: ProviderContext["cheerio"];
}): Promise<Post[]> {
  try {
    const response = await axios.get(url, {
      headers: defaultHeaders,
      signal,
    });
    const $ = cheerio.load(response.data || "");
    const posts: Post[] = [];
    const seen = new Set<string>();

    $("article").each((_, el) => {
      const card = $(el);
      const titleLink = card
        .find("a[rel='bookmark'], .entry-title a, h2 a, h3 a")
        .first();
      const title = titleLink.text().trim();
      const link = titleLink.attr("href");
      const image =
        card.find("img").first().attr("src") ||
        card.find("img").first().attr("data-src") ||
        "";

      if (title && link && !seen.has(link)) {
        seen.add(link);
        posts.push({
          title: title.replace(/\s+/g, " ").trim(),
          link,
          image,
        });
      }
    });

    if (posts.length === 0) {
      const rootUrl = new URL("/", new URL(url).origin).toString();
      if (url !== rootUrl) {
        return fetchPosts({
          url: rootUrl,
          signal,
          axios,
          cheerio,
        });
      }
    }

    return posts;
  } catch (error) {
    console.error("kdhindidubbed posts error:", error);
    return [];
  }
}
