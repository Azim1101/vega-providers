import { EpisodeLink, ProviderContext } from "../types";

async function getWithWAF(
  url: string,
  axios: any,
  openWebView: any,
  headers: any,
  customHeaders?: any,
): Promise<any> {
  const baseUrl = url.split("/").slice(0, 3).join("/");
  const mergedHeaders = { ...headers, ...customHeaders, Referer: baseUrl };
  try {
    return await axios.get(url, { headers: mergedHeaders });
  } catch (error: any) {
    if (error.response?.status === 403 && openWebView) {
      const wafResult = await openWebView(baseUrl, {
        title: "Solve the captcha below and click done",
        description: "Required to bypass anti-bot protection.",
        headers: mergedHeaders,
        force: true,
        waitForCookie: "cf_clearance",
      });
      const cookie = wafResult?.cookies || wafResult?.cookie || "";
      return await axios.get(url, {
        headers: {
          ...mergedHeaders,
          Cookie: (mergedHeaders.Cookie ? mergedHeaders.Cookie + "; " : "") + cookie,
        },
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
    // kmhd pack pages are SPA; try __data.json first
    const candidates = [
      url.replace(/\/$/, "") + "/__data.json",
      url,
    ];
    let html = "";
    for (const u of candidates) {
      try {
        const res = await getWithWAF(u, axios, openWebView, commonHeaders, {
          Cookie: "unlocked=true",
        });
        html = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
        if (html && html.length > 50) break;
      } catch {
        // try next
      }
    }

    const $ = cheerio.load(html);
    const episodes: EpisodeLink[] = [];
    const seen = new Set<string>();

    // From anchors
    $("a[href]").each((_, el) => {
      const href = ($(el).attr("href") || "").trim();
      const title = $(el).text().replace(/\s+/g, " ").trim() || "Episode";
      if (!href) return;
      const abs = href.startsWith("http") ? href : "";
      if (!abs) return;
      if (
        !/(kmhd|hubcloud|gdflix|drive\.google|pixeldrain|filepress|gofile|mediafire|mega\.nz)/i.test(
          abs,
        )
      ) {
        return;
      }
      if (seen.has(abs)) return;
      seen.add(abs);
      episodes.push({ title, link: abs });
    });

    // Regex fallback for hubdrive/hubcloud style payloads
    const hubMatches = html.matchAll(
      /https?:\/\/[^\s"'\\]+(?:hubcloud|hubdrive|gdflix|pixeldrain|filepress)[^\s"'\\]*/gi,
    );
    for (const m of hubMatches) {
      const href = m[0].replace(/\\+$/, "");
      if (seen.has(href)) continue;
      seen.add(href);
      episodes.push({ title: "Link", link: href });
    }

    return episodes;
  } catch (err) {
    console.error("katdrama getEpisodes error", err);
    return [];
  }
};
