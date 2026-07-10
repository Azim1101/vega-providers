import { EpisodeLink, ProviderContext } from "../types";

async function getWithWAF(
  url: string,
  axios: any,
  openWebView: any,
  headers: any,
): Promise<any> {
  const baseUrl = url.split("/").slice(0, 3).join("/");
  try {
    return await axios.get(url, {
      headers: { ...headers, Referer: baseUrl },
    });
  } catch (error: any) {
    if (error.response?.status === 403 && openWebView) {
      const wafResult = await openWebView(baseUrl, {
        title: "Solve the captcha below and click done",
        description: "Required to bypass anti-bot protection.",
        headers: { ...headers, Referer: baseUrl },
        force: true,
        waitForCookie: "cf_clearance",
      });
      const cookie = wafResult?.cookies || wafResult?.cookie || "";
      return await axios.get(url, {
        headers: { ...headers, Referer: baseUrl, Cookie: cookie },
      });
    }
    throw error;
  }
}

export const getEpisodes = async function ({
  url,
  providerContext,
}: {
  url: string;
  providerContext: ProviderContext;
}): Promise<EpisodeLink[]> {
  try {
    const { axios, cheerio, openWebView, commonHeaders } = providerContext;
    const res = await getWithWAF(url, axios, openWebView, commonHeaders);
    const $ = cheerio.load(res.data);
    const episodes: EpisodeLink[] = [];
    const seen = new Set<string>();

    $("a[href]").each((_, el) => {
      const href = ($(el).attr("href") || "").trim();
      const title = $(el).text().replace(/\s+/g, " ").trim() || "Link";
      if (!href || !href.startsWith("http")) return;
      if (
        /facebook|twitter|instagram|telegram|t\.me|whatsapp|kdhindidubbed\.cfd\/($|category|about|dmca|how-to)/i.test(
          href,
        )
      ) {
        return;
      }
      if (
        !/(xcloud|krakenfiles|filebee|gkycdn|hubcloud|gdflix|drive\.google|pixeldrain|mediafire|mega\.nz|send\.cm|rpmvid)/i.test(
          href,
        )
      ) {
        return;
      }
      if (seen.has(href)) return;
      seen.add(href);
      episodes.push({ title, link: href });
    });

    return episodes;
  } catch (err) {
    console.error("kdhindidubbed getEpisodes error", err);
    return [];
  }
};
