import { EpisodeLink, ProviderContext } from "../types";
import { throwProviderError } from "../providerErrors";

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

/**
 * Order of preference for the per-episode hosts.
 * XCloud is a HubCloud-style host and can resolve to a direct file;
 * the rest are handed back as external links.
 */
const HOST_PRIORITY = [
  "xcloud",
  "hubcloud",
  "hubdrive",
  "gky",
  "fpgo",
  "filebee",
  "telegram",
  "streamlink1",
  "streamlink2",
  "stream",
];

function hostRank(anchorText: string, href: string): number {
  const text = anchorText.toLowerCase();
  const hostname = (() => {
    try {
      return new URL(href).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  for (let i = 0; i < HOST_PRIORITY.length; i++) {
    const key = HOST_PRIORITY[i];
    if (text.includes(key) || hostname.includes(key)) return i;
  }
  return HOST_PRIORITY.length;
}

/**
 * Parse a download page:
 *  - New on-site format: "Episode – 01" headings followed by host links
 *    (XCloud / GKYFILEHOST / Telegram / StreamLink1 / StreamLink2)
 *  - Blogger format: quality headings ("- 720p HD -") followed by host links
 */
function parseDownloadPage($: any): EpisodeLink[] {
  const episodeLinks: EpisodeLink[] = [];
  const contentRoot = $(".entry-content").length ? $(".entry-content") : $("article");

  // Group elements: each group starts when a heading-like node contains
  // "Episode <n>" (or a quality marker), then collect following anchors.
  let currentTitle = "";
  const groups: Array<{ title: string; links: Array<{ text: string; href: string }> }> = [];
  let group: { title: string; links: Array<{ text: string; href: string }> } | null = null;

  contentRoot.find("*").each((_: any, el: any) => {
    const tagName = el.tagName ? el.tagName.toLowerCase() : "";
    const text = $(el).text().trim();
    if (!text) return;

    const episodeMatch = text.match(/^Episode\s*[-–—:.]?\s*(\d+)/i);
    const qualityMatch = text.match(/^\s*[-–—]?\s*(2160p|4k|1080p|720p|480p)\s*[-–—]?/i);
    const isHeadingLike =
      ["h1", "h2", "h3", "h4", "strong", "b", "em", "i", "span"].includes(tagName) ||
      (el.children && el.children.length <= 1 && text.length < 60);

    if (isHeadingLike && (episodeMatch || qualityMatch) && text.length < 60) {
      const title = episodeMatch
        ? `Episode ${episodeMatch[1].padStart(2, "0")}`
        : qualityMatch![1].toUpperCase();
      group = { title, links: [] };
      groups.push(group);
      currentTitle = title;
      return;
    }

    if (tagName === "a") {
      const href = $(el).attr("href")?.trim();
      if (!href || !/^https?:/i.test(href)) return;
      if (!group) {
        group = { title: currentTitle || `Episode ${groups.length + 1}`, links: [] };
        groups.push(group);
      }
      const anchorText = $(el).text().trim();
      if (anchorText && /^(xcloud|hubcloud|gky|telegram|stream|hellabyte|terabox|filemoon|filepress|filebee|gd|mediafire|pixeldrain|mega|hubdrive)/i.test(anchorText)) {
        group.links.push({ text: anchorText, href });
      }
    }
  });

  for (const g of groups) {
    if (g.links.length === 0) continue;
    const sorted = [...g.links].sort(
      (a, b) => hostRank(a.text, a.href) - hostRank(b.text, b.href),
    );
    const best = sorted[0];
    episodeLinks.push({
      title: g.title,
      link: best.href,
      description: best.text,
    });
  }

  return episodeLinks;
}

/**
 * Fetch a page, and if the site answers with 403 (Cloudflare WAF), ask the
 * user to solve the challenge through the WebView dialog and retry with the
 * cookies obtained from it.
 */
async function fetchWithWAF({
  url,
  signal,
  axios,
  headers,
  openWebView,
}: {
  url: string;
  signal?: AbortSignal;
  axios: ProviderContext["axios"];
  headers: Record<string, string>;
  openWebView?: ProviderContext["openWebView"];
}) {
  try {
    return await axios.get(url, { headers, signal });
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
        return await axios.get(url, {
          headers: { ...headers, Cookie: wafResult.cookies },
          signal,
        });
      }
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
    const { axios, cheerio, openWebView } = providerContext;
    const res = await fetchWithWAF({ url, axios, headers, openWebView });
    const $ = cheerio.load(res.data);

    let episodeLinks = parseDownloadPage($);

    // Fallback: every external link inside the content, deduped.
    if (episodeLinks.length === 0) {
      const contentRoot = $(".entry-content").length ? $(".entry-content") : $("article");
      const seen = new Set<string>();
      contentRoot.find('a[href^="http"]').each((_: any, el: any) => {
        const href = $(el).attr("href")?.trim();
        if (!href || seen.has(href)) return;
        seen.add(href);
        const text = $(el).text().trim() || "Link";
        episodeLinks.push({ title: text, link: href });
      });
    }

    return episodeLinks;
  } catch (err) {
    throwProviderError("KDHindiDubbed", "episodes", err);
  }
};
