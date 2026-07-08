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
    const seenLinks = new Set<string>();

    // Strategy 1: Find post containers using common WordPress theme selectors
    const containerSelectors = [
      "article",
      ".post",
      ".post-item",
      ".item",
      ".post-box",
      ".blog-post",
      ".grid-item",
      ".post-card",
      ".entry",
      ".hentry",
      ".post-container",
      ".recent-posts > *",
      ".posts-wrapper > *",
      ".main-content > *",
      "#content > *",
      "main > *",
      ".post-listing > *",
      ".loop-item",
      ".post-holder",
    ];

    for (const selector of containerSelectors) {
      if (posts.length > 0) break;
      $(selector).each((_, el) => {
        const container = $(el);
        const link =
          container.find("a").first().attr("href") || "";
        if (!link || seenLinks.has(link)) return;

        let title =
          container.find("h2 a, h3 a, h4 a, .entry-title a, .post-title a, .post-title")
            .first().text().trim() ||
          container.find("a").first().attr("title") ||
          container.find("img").first().attr("alt") ||
          "";

        let image =
          container.find("img").first().attr("data-lazy-src") ||
          container.find("img").first().attr("data-src") ||
          container.find("img").first().attr("src") ||
          "";

        if (image.startsWith("//")) {
          image = "https:" + image;
        }

        if (title && link && image && !link.includes("#") && !link.includes("mailto:")) {
          seenLinks.add(link);
          posts.push({
            title: title.replace(/Download/gi, "").replace(/\s+/g, " ").trim(),
            link,
            image,
          });
        }
      });
    }

    // Strategy 2: Match image+text anchors by shared URL
    if (posts.length === 0) {
      const imageAnchors = new Map<string, string>();
      const textAnchors = new Map<string, string>();

      $("a[href]").each((_, el) => {
        const anchor = $(el);
        const href = anchor.attr("href") || "";
        if (!href || href.includes("#") || href.includes("mailto:")) return;
        if (!href.includes("kdramasmaza.net") && !href.startsWith("/")) return;

        const img = anchor.find("img").first();
        if (img.length) {
          const src = img.attr("data-lazy-src") || img.attr("data-src") || img.attr("src") || "";
          if (src) {
            const normalized = href.startsWith("http") ? href : new URL(href, url).href;
            if (!imageAnchors.has(normalized)) {
              imageAnchors.set(normalized, src.startsWith("//") ? "https:" + src : src);
            }
          }
        } else {
          const text = anchor.text().trim();
          if (text && text.length > 3) {
            const normalized = href.startsWith("http") ? href : new URL(href, url).href;
            if (!textAnchors.has(normalized)) {
              textAnchors.set(normalized, text);
            }
          }
        }
      });

      const allUrls = new Set([...imageAnchors.keys(), ...textAnchors.keys()]);
      for (const postUrl of allUrls) {
        if (seenLinks.has(postUrl)) continue;
        const imgSrc = imageAnchors.get(postUrl) || "";
        const title = textAnchors.get(postUrl) || "";
        if (title && postUrl && imgSrc) {
          seenLinks.add(postUrl);
          posts.push({
            title: title.replace(/Download/gi, "").replace(/\s+/g, " ").trim(),
            link: postUrl,
            image: imgSrc,
          });
        }
      }
    }

    return posts;
  } catch (error) {
    console.error("kdramasmaza posts error:", error);
    return [];
  }
          }
