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
  const { getBaseUrl, cheerio } = providerContext;
  const baseUrl = await getBaseUrl("kdramasmaza");
  const url = new URL(filter || "/", baseUrl);
  if (page > 1) {
    url.searchParams.set("page", page.toString());
  }
  return fetchPosts({ url: url.toString(), signal, cheerio });
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
  const { getBaseUrl, cheerio } = providerContext;
  const baseUrl = await getBaseUrl("kdramasmaza");
  const url = new URL("/", baseUrl);
  url.searchParams.set("s", searchQuery);
  if (page > 1) {
    url.searchParams.set("page", page.toString());
  }
  return fetchPosts({ url: url.toString(), signal, cheerio });
};

async function fetchPosts({
  url,
  signal,
  cheerio,
}: {
  url: string;
  signal: AbortSignal;
  cheerio: ProviderContext["cheerio"];
}): Promise<Post[]> {
  try {
    const response = await fetch(url, {
      headers: defaultHeaders,
      signal,
    });
    const html = await response.text();
    const $ = cheerio.load(html);
    const posts: Post[] = [];

    $("article, .post-item, .item").each((_, el) => {
      const article = $(el);
      const title = article.find("h2 a, h3 a, .entry-title a").first().text().trim();
      const link = article.find("h2 a, h3 a, .entry-title a").first().attr("href");
      const image =
        article.find("img").first().attr("src") ||
        article.find("img").first().attr("data-src") ||
        "";

      if (title && link && image) {
        posts.push({
          title: title.replace(/\s+/g, " ").trim(),
          link,
          image,
        });
      }
    });

    if (posts.length === 0) {
      $("a[href*='https://kdramasmaza.net/']").each((_, el) => {
        const anchor = $(el);
        const href = anchor.attr("href");
        const title = anchor.text().trim();
        const image = anchor.find("img").first().attr("src") || "";
        if (href && title && image && !href.includes("#") && !href.includes("mailto:")) {
          posts.push({ title, link: href, image });
        }
      });
    }

    if (posts.length === 0) {
      const rootUrl = new URL("/", new URL(url).origin).toString();
      if (url !== rootUrl) {
        return fetchPosts({
          url: rootUrl,
          signal,
          cheerio,
        });
      }
    }

    return posts;
  } catch (error) {
    console.error("kdramasmaza posts error:", error);
    return [];
  }
}
