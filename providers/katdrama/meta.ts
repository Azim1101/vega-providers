import { Info, Link, ProviderContext } from "../types";

const headers = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,application/signed-exchange;v=b3;q=0.7",
  "Cache-Control": "no-store",
  "Accept-Language": "en-US,en;q=0.9",
  DNT: "1",
  "Upgrade-Insecure-Requests": "1",
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
  const url = link;
  const baseUrl = url.split("/").slice(0, 3).join("/");

  const emptyResult: Info = {
    title: "",
    synopsis: "",
    image: "",
    imdbId: "",
    type: "series",
    linkList: [],
  };

  try {
    const response = await axios.get(url, {
      headers: { ...headers, Referer: baseUrl },
    });

    const $ = cheerio.load(response.data);
    const infoContainer = $(".post-content, .drama-info, .entry-content").first();

    const result: Info = {
      title: "",
      synopsis: "",
      image: "",
      imdbId: "",
      type: "series",
      linkList: [],
    };

    result.title =
      infoContainer.find("h1, .drama-title").first().text().trim() ||
      $("h1").first().text().trim() ||
      "Unknown Title";

    let image =
      infoContainer.find(".drama-poster img, .poster img").first().attr("src") ||
      infoContainer.find("img").first().attr("src") ||
      "";
    if (image.startsWith("//")) image = "https:" + image;
    result.image = image;

    result.synopsis =
      infoContainer
        .find(".synopsis, .description, .plot")
        .first()
        .text()
        .trim() || "";

    result.type = "series";

    const links: Link[] = [];

    const seasonBlocks = infoContainer.find(".season, .episodes-section, [data-season]");
    
    if (seasonBlocks.length > 0) {
      seasonBlocks.each((_, seasonEl) => {
        const season = $(seasonEl);
        const seasonTitle = season.find(".season-title, h3").text().trim() || "Season";

        season.find("a[href*='episode'], a[href*='ep'], .episode-link").each((_, epEl) => {
          const episodeLink = $(epEl);
          const title = episodeLink.text().trim();
          const href = episodeLink.attr("href") || "";

          if (title && href) {
            links.push({
              title: `${seasonTitle} - ${title}`,
              episodesLink: href,
            });
          }
        });
      });
    } else {
      infoContainer.find("a[href]").each((_, el) => {
        const linkEl = $(el);
        const text = linkEl.text().trim();
        const href = linkEl.attr("href") || "";

        if ((text.toLowerCase().includes("episode") || text.match(/ep\s*\d+/i)) && href) {
          links.push({
            title: text,
            episodesLink: href,
          });
        }
      });
    }

    result.linkList = links;
    return result;
  } catch (err) {
    console.log("KatDrama getMeta error:", err);
    return emptyResult;
  }
};
