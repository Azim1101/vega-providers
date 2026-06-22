import { Info, ProviderContext } from "../types";

export const getMeta = async function ({
  link,
  providerContext,
}: {
  link: string;
  providerContext: ProviderContext;
}): Promise<Info> {
  const { axios, cheerio } = providerContext;

  try {
    const response = await axios.get(link, {
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    });

    const $ = cheerio.load(response.data || "");
    const title =
      $('h1.entry-title, h1.post-title, h1').first().text().trim() ||
      $('meta[property="og:title"]').attr("content") ||
      "";
    const image =
      $('meta[property="og:image"]').attr("content") ||
      $('img').first().attr("src") ||
      "";
    const synopsis =
      $('meta[name="description"]').attr("content") ||
      $('p').first().text().trim() ||
      "";
    const tags = $('a[rel="tag"]').map((_, el) => $(el).text().trim()).get();

    return {
      title,
      image,
      synopsis,
      imdbId: "",
      type: "series",
      tags,
      linkList: [],
    };
  } catch (error) {
    console.error("kdhindidubbed meta error:", error);
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
