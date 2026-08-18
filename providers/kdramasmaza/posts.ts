import { Post, ProviderContext } from "../types";
import { getBaseUrl } from "../getBaseUrl";
import { throwProviderError } from "../providerErrors";

// The runtime getBaseUrl() reads urls.json from the upstream repo where the
// "kdramasmaza" key does not exist yet, so we always fall back to the site.
const DEFAULT_BASE_URL = "https://kdramasmaza.net";

const headers = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-store",
  DNT: "1",
  "sec-ch-ua":
    '"Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
};

/**
 * Fetch a page, and if the site answers with 403 (Cloudflare WAF), ask the
 * user to solve the challenge through the WebView dialog and retry with the
 * cookies obtained from it.
 */
async function fetchWithWAF({
  url,
  signal,
  axios,
  headers,
  openWebView,
}: {
  url: string;
  signal: AbortSignal;
  axios: ProviderContext["axios"];
  headers: Record<string, string>;
  openWebView?: ProviderContext["openWebView"];
}) {
  try {
    return await axios.get(url, { headers, signal });
  } catch (error: any) {
    if (error?.response?.status === 403 && openWebView) {
      console.log(`KDramasMaza WAF detected (403) for ${url}, using solver...`);
      const wafResult = await openWebView(new URL(url).origin, {
        title: "Solve the captcha below and click done",
        description: "Required to bypass anti-bot protection on KDramasMaza.",
        headers,
      });
      if (wafResult?.cookies) {
        return await axios.get(url, {
          headers: { ...headers, Cookie: wafResult.cookies },
          signal,
        });
      }
    }
    throw error;
  }
}

// WordPress pages that live alongside posts and must be excluded.
const blockedSlugs = new Set([
  "how-to-download-from-kdramas-maza",
  "category",
  "tag",
  "author",
  "page",
  "feed",
  "wp-content",
  "wp-json",
  "xmlrpc",
  "sitemap",
]);

function cleanTitle(title: string): string {
  return title
    .replace(/\s*[-–—|]\s*KDramas\s*Maza\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function scrapePosts({
  baseUrl,
  url,
  signal,
  axios,
  cheerio,
  openWebView,
  operation,
}: {
  baseUrl: string;
  url: string;
  signal: AbortSignal;
  axios: ProviderContext["axios"];
  cheerio: ProviderContext["cheerio"];
  openWebView?: ProviderContext["openWebView"];
  operation: string;
}): Promise<Post[]> {
  try {
    const res = await fetchWithWAF({
      url,
      signal,
      axios,
      headers,
      openWebView,
    });
    const $ = cheerio.load(res.data);
    const baseHost = new URL(baseUrl).hostname
      .replace(/^www\./, "")
      .toLowerCase();

    // Each post permalink is <site>/<slug>/ ; collect every anchor that
    // points to one, then merge title/image info across duplicate anchors.
    const posts = new Map<
      string,
      { link: string; title: string; image: string }
    >();

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href")?.trim();
      if (!href) return;

      let parsed: URL;
      try {
        parsed = new URL(href, baseUrl);
      } catch {
        return;
      }
      if (parsed.search || parsed.hash) return;
      if (parsed.hostname.replace(/^www\./, "").toLowerCase() !== baseHost)
        return;

      const segments = parsed.pathname.split("/").filter(Boolean);
      if (segments.length !== 1) return;

      const slug = segments[0].toLowerCase();
      if (blockedSlugs.has(slug)) return;
      if (!/^[a-z0-9-]+$/i.test(slug)) return;

      const existing = posts.get(href) || { link: href, title: "", image: "" };
      const anchorText = $(el).text().trim();
      const title =
        $(el).attr("title")?.trim() ||
        (anchorText.length > existing.title.length ? anchorText : "");
      if (title) existing.title = title;
      const img =
        $(el).find("img").first().attr("data-src") ||
        $(el).find("img").first().attr("src") ||
        "";
      if (img) existing.image = img;
      posts.set(href, existing);
    });

    const catalog: Post[] = [];
    posts.forEach((post) => {
      const title = cleanTitle(post.title);
      if (!title && !post.image) return;
      catalog.push({
        title: title || "Untitled",
        link: post.link,
        image: post.image,
      });
    });
    return catalog;
  } catch (err) {
    throwProviderError("KDramasMaza", operation, err);
  }
}

export const getPosts = async function ({
  filter,
  page,
  providerValue,
  signal,
  providerContext,
}: {
  filter: string;
  page: number;
  providerValue: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Post[]> {
  const { axios, cheerio, openWebView } = providerContext;
  const baseUrl = (await getBaseUrl("kdramasmaza")) || DEFAULT_BASE_URL;

  const url = filter
    ? `${baseUrl}${filter}/page/${page}/`
    : page > 1
      ? `${baseUrl}/page/${page}/`
      : baseUrl;

  return scrapePosts({
    baseUrl,
    url,
    signal,
    axios,
    cheerio,
    openWebView,
    operation: "posts",
  });
};

export const getSearchPosts = async function ({
  searchQuery,
  page,
  providerValue,
  signal,
  providerContext,
}: {
  searchQuery: string;
  page: number;
  providerValue: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Post[]> {
  const { axios, cheerio, openWebView } = providerContext;
  const baseUrl = (await getBaseUrl("kdramasmaza")) || DEFAULT_BASE_URL;

  const url =
    page > 1
      ? `${baseUrl}/page/${page}/?s=${encodeURIComponent(searchQuery)}`
      : `${baseUrl}/?s=${encodeURIComponent(searchQuery)}`;

  return scrapePosts({
    baseUrl,
    url,
    signal,
    axios,
    cheerio,
    openWebView,
    operation: "search posts",
  });
};
