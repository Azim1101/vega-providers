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
  const baseUrl = await getBaseUrl("katdrama");
  const url = new URL(filter || "/", baseUrl);
  if (page > 1) {
    url.searchParams.set("page", page.toString());
  }

  return fetchPosts({
    url: url.toString(),
    baseUrl,
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
  const baseUrl = await getBaseUrl("katdrama");
  const url = new URL("/", baseUrl);
  url.searchParams.set("search", searchQuery);
  if (page > 1) {
    url.searchParams.set("page", page.toString());
  }

  return fetchPosts({
    url: url.toString(),
    baseUrl,
    signal,
    axios,
    cheerio,
  });
};

async function fetchPosts({
  url,
  baseUrl,
  signal,
  axios,
  cheerio,
}: {
  url: string;
  baseUrl: string;
  signal: AbortSignal;
  axios: ProviderContext["axios"];
  cheerio: ProviderContext["cheerio"];
}): Promise<Post[]> {
  try {
    const response = await axios.get(url, {
      headers: defaultHeaders,
      signal,
    });
    const html = response.data;
    const $ = cheerio.load(html);

    const scriptText = $('script')
      .map((_, el) => $(el).html() || "")
      .get()
      .join("\n");

    let items: any[] = [];

    const payloadMatch = scriptText.match(
      /__sveltekit_[^=]+\.resolve\((\{[\s\S]*?\})\)/
    );

    if (payloadMatch) {
      try {
        const payload = new Function(`return (${payloadMatch[1]});`)();
        items =
          payload?.data?.data?.data?.items ||
          payload?.data?.data?.items ||
          payload?.data?.items ||
          [];
      } catch (error) {
        console.warn("katdrama payload parse failed", error);
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      const fallbackItems = $('a[href]')
        .map((_, el) => {
          const anchor = $(el);
          const href = anchor.attr("href") || "";
          const title = anchor.text().trim();
          const image = anchor.find("img").first().attr("src") || "";
          return href && title && image
            ? { slug: href, post_title: title, thumbnail_image: image }
            : null;
        })
        .get()
        .filter(Boolean);

      items = fallbackItems;
    }

    const posts = items
      .map((item) => {
        const title = item.post_title || item.title || item.name || "";
        const slug = item.slug || item.link || item.url || "";
        const image =
          item.thumbnail_image ||
          item.image ||
          item.poster ||
          item.thumbnail ||
          "";
        if (!title || !slug) return null;

        const normalizedLink = /^https?:\/\//i.test(slug)
          ? slug
          : new URL(slug.replace(/^\//, ""), baseUrl).href;

        const normalizedImage = /^https?:\/\//i.test(image)
          ? image
          : image
            ? new URL(image.replace(/^\//, ""), baseUrl).href
            : "";

        return {
          title: title.replace(/\s+/g, " ").trim(),
          link: normalizedLink,
          image: normalizedImage,
        };
      })
      .filter(Boolean) as Post[];

    return posts;
  } catch (error) {
    console.error("katdrama posts error:", error);
    return [];
  }
}