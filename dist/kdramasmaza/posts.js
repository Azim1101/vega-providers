"use strict";

const defaultHeaders = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

exports.getPosts = async function ({
  filter,
  page,
  signal,
  providerContext,
}) {
  const { getBaseUrl, axios, cheerio } = providerContext;
  const baseUrl = await getBaseUrl("kdramasmaza");
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

exports.getSearchPosts = async function ({
  searchQuery,
  page,
  signal,
  providerContext,
}) {
  const { getBaseUrl, axios, cheerio } = providerContext;
  const baseUrl = await getBaseUrl("kdramasmaza");
  const url = new URL("/", baseUrl);

  url.searchParams.set("s", searchQuery);
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

async function fetchPosts({ url, baseUrl, signal, axios, cheerio }) {
  try {
    const response = await axios.get(url, {
      headers: defaultHeaders,
      signal,
    });
    const $ = cheerio.load(response.data || "");
    const posts = [];
    const seen = new Set();

    const pushPost = ({ title, link, image }) => {
      if (!title || !link || seen.has(link)) {
        return;
      }

      seen.add(link);
      posts.push({
        title: title.replace(/\s+/g, " ").trim(),
        link: /^https?:\/\//i.test(link) ? link : new URL(link, baseUrl).href,
        image: image
          ? /^https?:\/\//i.test(image)
            ? image
            : new URL(image, baseUrl).href
          : "",
      });
    };

    $("article, .post, .post-item, .item").each((_, el) => {
      const article = $(el);
      const titleLink = article
        .find("a[rel='bookmark'], .entry-title a, h1 a, h2 a, h3 a, h4 a")
        .first();
      const fallbackLink = article.find("a[href]").first();
      const imageEl = article
        .find("img[src], img[data-src], img[data-lazy-src]")
        .first();

      const title =
        titleLink.text().trim() ||
        titleLink.attr("title") ||
        fallbackLink.attr("title") ||
        imageEl.attr("alt") ||
        "";
      const link = titleLink.attr("href") || fallbackLink.attr("href");
      const image =
        imageEl.attr("src") ||
        imageEl.attr("data-src") ||
        imageEl.attr("data-lazy-src") ||
        "";

      pushPost({ title, link, image });
    });

    if (posts.length === 0) {
      $("a[href]").each((_, el) => {
        const anchor = $(el);
        const href = anchor.attr("href") || "";
        const imageEl = anchor.find("img").first();
        const title =
          anchor.text().trim() ||
          anchor.attr("title") ||
          imageEl.attr("alt") ||
          "";
        const image =
          imageEl.attr("src") ||
          imageEl.attr("data-src") ||
          imageEl.attr("data-lazy-src") ||
          "";

        if (
          href &&
          /^https?:\/\/kdramasmaza\.net\//i.test(href) &&
          !href.includes("#") &&
          !href.includes("/category/") &&
          !href.includes("/author/")
        ) {
          pushPost({ title, link: href, image });
        }
      });
    }

    if (posts.length === 0) {
      const rootUrl = new URL("/", new URL(url).origin).toString();
      if (url !== rootUrl) {
        return fetchPosts({
          url: rootUrl,
          baseUrl,
          signal,
          axios,
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
