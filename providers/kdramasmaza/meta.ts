import { Info, Link, ProviderContext } from "../types";

const headers = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

export const getMeta = async function ({
  link,
  providerContext,
}: {
  link: string;
  providerContext: ProviderContext;
}): Promise<Info> {
  const { axios, cheerio } = providerContext;

  try {
    const res = await axios.get(link, {
      headers: { ...headers, Referer: link },
    });
    const $ = cheerio.load(res.data);

    const title =
      $("h1").first().text().trim() ||
      $(".entry-title").first().text().trim() ||
      "Unknown Title";

    const image =
      $("article img").first().attr("src") ||
      $("img").first().attr("src") ||
      "";

    const synopsis =
      $("article p")
        .map((_, el) => $(el).text().trim())
        .get()
        .find((text) => text.length > 80) ||
      $(".entry-content p").first().text().trim() ||
      "";

    const linkList: Link[] = [];
    const directLinks: Link["directLinks"] = [];

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      const text = $(el).text().trim();
      if (!href || !text) return;
      if (/episode|download|zip/i.test(text) || /episode|download|zip/i.test(href)) {
        if (/download|zip/i.test(text) || /download|zip/i.test(href)) {
          directLinks.push({ title: text || "Download", link: href });
        } else if (/episode/i.test(text) || /episode/i.test(href)) {
          linkList.push({
            title: text || "Episode",
            episodesLink: href,
          });
        }
      }
    });

    if (directLinks.length > 0) {
      linkList.push({
        title: "Downloads",
        directLinks,
      });
    }

    return {
      title,
      image,
      synopsis,
      imdbId: "",
      type: "series",
      linkList,
    };
  } catch (error) {
    console.error("kdramasmaza meta error:", error);
    return {
      title: "",
      image: "",
      synopsis: "",
      imdbId: "",
      type: "series",
      linkList: [],
    };
  }
};
