import { Info, Link, ProviderContext } from "../types";
import { getBaseUrl } from "../getBaseUrl";
import { throwProviderError } from "../providerErrors";

// The runtime getBaseUrl() reads urls.json from the upstream repo where the
// "kdhindidubbed" key does not exist yet, so we always fall back to the site.
const DEFAULT_BASE_URL = "https://kdhindidubbed.cfd";

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

function cleanTitle(title: string): string {
  return title
    .replace(/\s*[-–—|]\s*KDHindiDubbed\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse the "-: Information :-" block lines:
 * "Name: The Judge Returns", "Episodes: 14", "Genres: Action, Law, ..."
 */
function parseInfoBlock($: any): Record<string, string> {
  const info: Record<string, string> = {};
  const contentRoot = $(".entry-content").length ? $(".entry-content") : $("article");

  contentRoot.find("span, div, p").each((_: any, el: any) => {
    const text = $(el).text().trim();
    const match = text.match(
      /^(Name|Season|Episodes|Running time|Language|Subtitle|Genres|Release Date|Country of origin|Quality|Maximum File Size|Year|Duration|Status)\s*:\s*(.+)$/i,
    );
    if (match && !info[match[1].toLowerCase()]) {
      info[match[1].toLowerCase()] = match[2].trim();
    }
  });

  // Fallback: raw text scan of the content.
  if (!info.name) {
    const raw = contentRoot.text();
    const nameMatch = raw.match(/\bName\s*:\s*([^\n]+)/i);
    if (nameMatch) info.name = nameMatch[1].trim();
  }
  return info;
}

/** Find the download links ("DOWNLOAD LINKS") with their quality labels. */
function findDownloadLinks($: any, baseUrl: string): Array<{ title: string; url: string; quality: string }> {
  const found: Array<{ title: string; url: string; quality: string }> = [];
  const contentRoot = $(".entry-content").length ? $(".entry-content") : $("article");

  contentRoot.find('a[href]').each((_: any, el: any) => {
    const text = $(el).text().trim().toLowerCase();
    if (!text.includes("download links") && !text.includes("download")) return;
    const href = $(el).attr("href")?.trim();
    if (!href) return;

    // Quality from the nearest preceding heading-ish text (720p / 1080p ...).
    let quality = "";
    let node = $(el).parent();
    while (node.length && !node.is(".entry-content") && node[0] !== contentRoot[0]) {
      const ownQ = (node.text() || "").match(/(2160p|4k|1080p|720p|480p|360p)/i)?.[1];
      if (ownQ) {
        quality = ownQ.toLowerCase();
        break;
      }
      const prev = node.prevAll().first();
      if (prev.length) {
        const prevQ = (prev.text() || "").match(/(2160p|4k|1080p|720p|480p|360p)/i)?.[1];
        if (prevQ) {
          quality = prevQ.toLowerCase();
          break;
        }
      }
      node = node.parent();
    }
    if (!quality) {
      const prevText =
        $(el).closest("div").prevAll("div, p, h2, h3, b, i").first().text() || "";
      const q = prevText.match(/(2160p|4k|1080p|720p|480p|360p)/i)?.[1];
      if (q) quality = q.toLowerCase();
    }

    const title = $(el).text().trim() || "Download";
    if (!found.some((entry) => entry.url === href)) {
      found.push({ title, url: href, quality });
    }
  });

  return found.map((entry) => ({
    title: entry.quality ? `${entry.quality} - ${entry.title}` : entry.title,
    url: entry.url,
    quality: entry.quality,
  }));
}

function parseMeta($: any, url: string, baseUrl: string): Info {
  const contentRoot = $(".entry-content").length ? $(".entry-content") : $("article");

  const title =
    cleanTitle($(".entry-title").first().text()) ||
    cleanTitle($("h1").first().text()) ||
    cleanTitle($('meta[property="og:title"]').attr("content") || "") ||
    cleanTitle($("title").first().text());

  const image =
    contentRoot.find("img").first().attr("data-src") ||
    contentRoot.find("img").first().attr("src") ||
    $('meta[property="og:image"]').attr("content") ||
    "";

  const info = parseInfoBlock($);
  const name = info.name || title;

  const genresLine = info.genres || "";
  const tags = genresLine
    .split(",")
    .map((tag: string) => tag.trim())
    .filter(Boolean);

  // Series posts have "Episodes:" / "Season:" lines; movies do not.
  const type =
    info.episodes || info.season || /^\s*Episodes\s*:/im.test(contentRoot.text())
      ? "series"
      : "movie";

  // Storyline: text after a "Storyline" heading up to the comments section.
  let synopsis = "";
  const storylineHeading = contentRoot
    .find("b, strong, h2, h3, i, span")
    .filter((_: any, el: any) => /storyline/i.test($(el).text()))
    .first();
  if (storylineHeading.length) {
    let node = storylineHeading.parent();
    if (!node.length) node = storylineHeading;
    synopsis = node.text().replace(/storyline\s*:-?/i, "").replace(/\s+/g, " ").trim();
  }
  if (!synopsis) {
    synopsis = contentRoot.text().split(/screen-?shots/i)[1]?.split(/storyline/i)[1] || "";
    synopsis = synopsis.replace(/\s+/g, " ").trim();
  }
  if (!synopsis) {
    synopsis = contentRoot.text().replace(/\s+/g, " ").trim().slice(0, 500);
  }

  const downloadLinks = findDownloadLinks($, baseUrl);
  const linkList: Link[] = downloadLinks.map((entry) => ({
    title: entry.title,
    quality: entry.quality || undefined,
    ...(type === "movie"
      ? { directLinks: [{ link: entry.url, title: entry.title, type: "movie" as const }] }
      : { episodesLink: entry.url }),
  }));

  return {
    title: name || title,
    synopsis,
    image,
    imdbId: "",
    type,
    tags,
    linkList,
    webUrl: url,
  };
}

export const getMeta = async function ({
  link,
  providerContext,
}: {
  link: string;
  providerContext: ProviderContext;
}): Promise<Info> {
  try {
    const { axios, cheerio, openWebView } = providerContext;
    const baseUrl = (await getBaseUrl("kdhindidubbed")) || DEFAULT_BASE_URL;
    const url = new URL(link, `${baseUrl}/`).href;

    let res;
    try {
      res = await axios.get(url, { headers });
    } catch (error: any) {
      if (error?.response?.status === 403 && openWebView) {
        console.log(`KDHindiDubbed WAF detected (403) for ${url}, using solver...`);
        const wafResult = await openWebView(new URL(url).origin, {
          title: "Solve the captcha below and click done",
          description: "Required to bypass anti-bot protection on KDHindiDubbed.",
          headers,
          waitForCookie: "cf_clearance",
        });
        if (wafResult?.cookies) {
          res = await axios.get(url, {
            headers: { ...headers, Cookie: wafResult.cookies },
          });
        }
      }
      if (!res) throw error;
    }

    let $ = cheerio.load(res.data);
    let parsed = parseMeta($, url, baseUrl);

    // Cloudflare interstitial served with status 200 - solve and re-parse.
    const titleText = ($("title").first().text() || "").toLowerCase();
    if (
      parsed.title === "" &&
      openWebView &&
      (titleText.includes("just a moment") ||
        titleText.includes("attention required") ||
        ($("body").text() || "").toLowerCase().includes("challenge-platform"))
    ) {
      const wafResult = await openWebView(new URL(url).origin, {
        title: "Solve the captcha below and click done",
        description: "Required to bypass anti-bot protection on KDHindiDubbed.",
        headers,
        waitForCookie: "cf_clearance",
      });
      if (wafResult?.cookies) {
        const retry = await axios.get(url, {
          headers: { ...headers, Cookie: wafResult.cookies },
        });
        $ = cheerio.load(retry.data);
        parsed = parseMeta($, url, baseUrl);
      }
    }

    return parsed;
  } catch (err) {
    throwProviderError("KDHindiDubbed", "metadata", err);
  }
};
