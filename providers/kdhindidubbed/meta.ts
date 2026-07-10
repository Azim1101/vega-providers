import { Info, Link, ProviderContext } from "../types";

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

function qualityFrom(text: string): string {
  return text.match(/\b(2160p|1080p|720p|480p|360p)\b/i)?.[0] || "";
}

function cleanText(s: string): string {
  return s.replace(/\s+/g, " ").replace(/&#8211;/g, "–").trim();
}

export const getMeta = async function ({
  link,
  providerContext,
}: {
  link: string;
  providerContext: ProviderContext;
}): Promise<Info> {
  try {
    const { axios, cheerio, openWebView, commonHeaders } = providerContext;
    const res = await getWithWAF(link, axios, openWebView, commonHeaders);
    const $ = cheerio.load(res.data);

    const title =
      cleanText($("h1.entry-title").text() || $("h1").first().text()) ||
      cleanText(($("title").text() || "").split("–")[0] || "");

    const infoBits: string[] = [];
    const seenInfo = new Set<string>();
    $(".entry-content, .herald-entry-content, article")
      .find("div, p, span, li")
      .each((_, el) => {
        const t = cleanText($(el).text());
        if (
          /^(Name|Season|Episodes|Language|Genres|Quality|Release Date|Subtitle|Country)\s*:/i.test(
            t,
          ) &&
          !seenInfo.has(t)
        ) {
          seenInfo.add(t);
          infoBits.push(t);
        }
      });
    const synopsis = infoBits.slice(0, 8).join(" · ");

    let image =
      $("article img.wp-post-image, .herald-post-thumbnail img, .entry-content img")
        .filter((_, el) => {
          const src = $(el).attr("src") || "";
          return !!src && !/logo|icon|svg|emoji|avatar/i.test(src);
        })
        .first()
        .attr("src") ||
      $("meta[property='og:image']").attr("content") ||
      "";

    const imdbId =
      $('a[href*="imdb.com/title/"]')
        .attr("href")
        ?.match(/tt\d+/)?.[0] || "";

    const type = /episode|season|drama|series/i.test(title) ? "series" : "movie";

    const links: Link[] = [];
    const seen = new Set<string>();

    // Prefer explicit DOWNLOAD LINKS anchors
    $("a[href]").each((_, el) => {
      const href = ($(el).attr("href") || "").trim();
      const text = cleanText($(el).text());
      if (!href || !href.startsWith("http")) return;
      if (!/download/i.test(text) && !/download/i.test(href)) return;
      if (
        /facebook|twitter|instagram|telegram|t\.me|whatsapp|wp-json|xmlrpc|feed|how-to|dmca|about|blogger\.googleusercontent|wp-content\/uploads/i.test(
          href,
        )
      ) {
        return;
      }
      // Same-site intermediate pages only
      if (!href.includes("kdhindidubbed")) return;
      if (href.replace(/\/$/, "") === link.replace(/\/$/, "")) return;
      if (seen.has(href)) return;
      seen.add(href);
      links.push({
        title: text || "Download Links",
        quality: qualityFrom(text) || qualityFrom(href) || qualityFrom(title),
        episodesLink: href,
      });
    });

    // If no download pages found, collect direct hosters on the page
    if (!links.length) {
      $("a[href]").each((_, el) => {
        const href = ($(el).attr("href") || "").trim();
        const text = cleanText($(el).text()) || "Link";
        if (
          !/(xcloud|krakenfiles|filebee|gkycdn|hubcloud|gdflix|rpmvid)/i.test(
            href,
          )
        ) {
          return;
        }
        if (seen.has(href)) return;
        seen.add(href);
        links.push({
          title: text,
          quality: qualityFrom(text),
          directLinks: [
            {
              title: text,
              link: href,
              type: type === "series" ? "series" : "movie",
            },
          ],
        });
      });
    }

    return {
      title: title || "Untitled",
      synopsis,
      image,
      imdbId,
      type,
      linkList: links,
    };
  } catch (err) {
    console.error("kdhindidubbed getMeta error", err);
    return {
      title: "",
      synopsis: "",
      image: "",
      imdbId: "",
      type: "movie",
      linkList: [],
    };
  }
};
