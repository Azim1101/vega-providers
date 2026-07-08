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
    const html = response.data || "";
    const $ = cheerio.load(html);
    const seen = new Set<string>();
    const posts: Post[] = [];

    const cleanText = (value?: string) =>
      (value || "")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#039;|&apos;/g, "'")
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const normalizeUrl = (value?: string) => {
      const raw = (value || "").trim();
      if (!raw || raw.startsWith("#") || raw.toLowerCase().startsWith("javascript:")) {
        return "";
      }
      if (raw.startsWith("//")) return `https:${raw}`;
      return /^https?:\/\//i.test(raw) ? raw : new URL(raw, baseUrl).href;
    };

    const isContentLink = (link: string) => {
      try {
        const parsed = new URL(link);
        const base = new URL(baseUrl);
        if (parsed.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) {
          return false;
        }

        const path = parsed.pathname.replace(/\/$/, "");
        if (!path || path === "/") return false;
        return !/\/(category|tag|author|search|page|wp-admin|wp-content|wp-json)(\/|$)/i.test(path);
      } catch {
        return false;
      }
    };

    const pushPost = ({
      title,
      link,
      image,
    }: {
      title?: string;
      link?: string;
      image?: string;
    }) => {
      const normalizedLink = normalizeUrl(link);
      if (!normalizedLink || !isContentLink(normalizedLink) || seen.has(normalizedLink)) {
        return;
      }

      const normalizedTitle = cleanText(title);
      if (!normalizedTitle) {
        return;
      }

      seen.add(normalizedLink);
      posts.push({
        title: normalizedTitle,
        link: normalizedLink,
        image: normalizeUrl(image),
      });
    };

    const scriptText = $("script")
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

    if (Array.isArray(items) && items.length > 0) {
      items.forEach((item) => {
        pushPost({
          title: item.post_title || item.title || item.name,
          link: item.slug || item.link || item.url,
          image: item.thumbnail_image || item.image || item.poster || item.thumbnail,
        });
      });
    }

    // KatDrama changed its home/category pages to static card markup. In that
    // markup, the image anchor contains the poster/alt text and the title is in
    // a nearby h3 link, so the old single-anchor fallback returned zero posts.
    if (posts.length === 0) {
      $("article, .post, .post-item, .movie, .movie-item, .grid-item, .card, .item, li").each(
        (_, el) => {
          const card = $(el);
          const imageEl = card.find("img[src], img[data-src], img[data-lazy-src]").first();
          const imageAnchor = imageEl.closest("a[href]");
          const titleLink = card
            .find("h1 a[href], h2 a[href], h3 a[href], h4 a[href], .title a[href], .entry-title a[href], a[title][href]")
            .filter((_, linkEl) => isContentLink(normalizeUrl($(linkEl).attr("href"))))
            .first();
          const fallbackLink = card
            .find("a[href]")
            .filter((_, linkEl) => isContentLink(normalizeUrl($(linkEl).attr("href"))))
            .first();

          pushPost({
            title:
              titleLink.text() ||
              titleLink.attr("title") ||
              imageEl.attr("alt") ||
              imageEl.attr("title") ||
              imageAnchor.attr("title") ||
              fallbackLink.text() ||
              fallbackLink.attr("title"),
            link: titleLink.attr("href") || imageAnchor.attr("href") || fallbackLink.attr("href"),
            image:
              imageEl.attr("src") ||
              imageEl.attr("data-src") ||
              imageEl.attr("data-lazy-src") ||
              "",
          });
        }
      );
    }

    if (posts.length === 0) {
      $("a[href]").each((_, el) => {
        const anchor = $(el);
        const imageEl = anchor.find("img[src], img[data-src], img[data-lazy-src]").first();
        pushPost({
          title:
            imageEl.attr("alt") ||
            imageEl.attr("title") ||
            anchor.attr("title") ||
            anchor.text(),
          link: anchor.attr("href"),
          image:
            imageEl.attr("src") ||
            imageEl.attr("data-src") ||
            imageEl.attr("data-lazy-src") ||
            "",
        });
      });
    }

    return posts;
  } catch (error) {
    console.error("katdrama posts error:", error);
    return [];
  }
}
