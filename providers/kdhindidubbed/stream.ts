import { ProviderContext, Stream } from "../types";
import { hubcloudExtractor } from "../extractors/hubcloud";
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

function externalFallback(link: string, server: string): Stream[] {
  return [
    {
      server,
      link,
      type: "mp4",
      headers,
    },
  ];
}

/** Pick the best host link from a download page (on-site or Blogger). */
function pickBestHostLink($: any, cheerio: ProviderContext["cheerio"]): string {
  const contentRoot = $(".entry-content").length ? $(".entry-content") : $("article");
  const links: Array<{ text: string; href: string }> = [];

  contentRoot.find('a[href^="http"]').each((_: any, el: any) => {
    const href = $(el).attr("href")?.trim();
    if (!href) return;
    const text = $(el).text().trim();
    links.push({ text, href });
  });

  const rank = (text: string, href: string): number => {
    const t = text.toLowerCase();
    const h = (() => {
      try {
        return new URL(href).hostname.toLowerCase();
      } catch {
        return "";
      }
    })();
    if (t.includes("xcloud") || h.includes("xcloud")) return 0;
    if (t.includes("hubcloud") || h.includes("hubcloud")) return 1;
    if (t.includes("hubdrive") || h.includes("hubdrive")) return 2;
    if (t.includes("gky") || h.includes("gkycdn")) return 3;
    if (t.includes("telegram") || h.includes("fpgo") || h.includes("filebee")) return 4;
    if (t.includes("filemoon") || h.includes("filemoon")) return 5;
    if (t.includes("stream") || h.includes("strp2p") || h.includes("rpmvid")) return 6;
    return 7;
  };

  links.sort((a, b) => rank(a.text, a.href) - rank(b.text, b.href));
  return links[0]?.href || "";
}

/** Doodstream-style host (dood.li, filemoon.in, ...) pass_md5 resolution. */
async function resolveDoodStyle(
  link: string,
  signal: AbortSignal,
  axios: ProviderContext["axios"],
): Promise<Stream[]> {
  const parsed = new URL(link);
  const domain = parsed.hostname;
  const pathParts = parsed.pathname.split("/").filter(Boolean);
  const code = pathParts[pathParts.length - 1];
  if (!code) return externalFallback(link, domain);

  try {
    const embedUrl = `https://${domain}/e/${code}`;
    const embedRes = await axios.get(embedUrl, { headers, signal });
    const passMd5 = embedRes.data.match(
      /pass_md5\s*=\s*["']([^"']+)["']/i,
    )?.[1];
    if (passMd5) {
      const dlRes = await axios.get(`https://${domain}/${passMd5}`, {
        headers: { ...headers, Referer: embedUrl },
        signal,
      });
      const directUrl = dlRes.data?.url;
      if (directUrl) {
        return [
          {
            server: domain,
            link: directUrl,
            type: "mp4",
            headers: { ...headers, Referer: embedUrl },
          },
        ];
      }
    }
  } catch (error) {
    console.log(`dood-style resolution failed for ${domain}`, (error as any)?.message);
  }
  return externalFallback(link, domain);
}

/** Best-effort direct-link extraction from file host pages. */
async function resolveFileHost(
  link: string,
  signal: AbortSignal,
  axios: ProviderContext["axios"],
): Promise<Stream[]> {
  try {
    const res = await axios.get(link, { headers, signal });
    const html = res.data;
    const hostname = new URL(link).hostname.toLowerCase();

    const candidates = [
      html.match(/https:\/\/drive\.google\.com\/file\/d\/[^"'<>\s]+/)?.[0],
      html.match(/https:\/\/drive\.google\.com\/uc\?id=[^"'<>\s&]+/)?.[0],
      html.match(/https:\/\/pixeldrain\.com\/api\/file\/[^"'<>\s]+/)?.[0],
      html.match(/https?:\/\/[^"'\s<>]+\.(?:mp4|mkv|m3u8|webm)(?:\?[^"'\s<>]*)?/i)?.[0],
    ].filter(Boolean) as string[];

    if (candidates.length) {
      return candidates.map((directUrl) => {
        const extension =
          directUrl.match(/\.(mp4|mkv|m3u8|webm)(\?|$)/i)?.[1]?.toLowerCase() || "mp4";
        return {
          server: hostname,
          link: directUrl,
          type: extension,
          headers,
        };
      });
    }
  } catch (error) {
    console.log(`file host resolution failed`, (error as any)?.message);
  }
  return externalFallback(link, new URL(link).hostname);
}

/** XCloud / HubCloud style hosts. XCloud sits behind Cloudflare so try the
 *  WAF solver and retry with the obtained cookies when it is blocked. */
async function resolveHubCloud(
  link: string,
  signal: AbortSignal,
  axios: ProviderContext["axios"],
  cheerio: ProviderContext["cheerio"],
  openWebView?: ProviderContext["openWebView"],
): Promise<Stream[]> {
  try {
    return await hubcloudExtractor(link, signal, axios, cheerio, headers);
  } catch (error: any) {
    const status = error?.response?.status || error?.cause?.status;
    if ((status === 403 || error?.message?.includes("403")) && openWebView) {
      console.log(`KDHindiDubbed WAF on host ${link}, using solver...`);
      try {
        const wafResult = await openWebView(new URL(link).origin, {
          title: "Solve the captcha below and click done",
          description: "Required to bypass anti-bot protection on the file host.",
          headers,
          waitForCookie: "cf_clearance",
        });
        if (wafResult?.cookies) {
          const cookieHeaders = { ...headers, Cookie: wafResult.cookies };
          return await hubcloudExtractor(
            link,
            signal,
            axios,
            cheerio,
            cookieHeaders,
          );
        }
      } catch (wafError) {
        console.log(`WAF solve failed`, (wafError as any)?.message);
      }
    }
    return externalFallback(link, new URL(link).hostname);
  }
}

/**
 * Resolve a single host link to playable streams. Also handles "download
 * page" URLs (on-site /ryhutuhjryer4/ or Blogger kddibba.blogspot.com):
 * those pages list host links, so we pick the best one and resolve it.
 */
async function resolveLink(
  link: string,
  signal: AbortSignal,
  axios: ProviderContext["axios"],
  cheerio: ProviderContext["cheerio"],
  openWebView?: ProviderContext["openWebView"],
  depth = 0,
): Promise<Stream[]> {
  const hostname = new URL(link).hostname.toLowerCase();

  // Download pages that just list host links.
  const isDownloadPage =
    hostname.includes("kdhindidubbed") ||
    hostname.includes("blogspot");
  if (isDownloadPage) {
    if (depth > 1) return externalFallback(link, hostname);
    try {
      const res = await axios.get(link, { headers, signal });
      const $ = cheerio.load(res.data);
      const best = pickBestHostLink($, cheerio);
      if (best && best !== link) {
        return resolveLink(best, signal, axios, cheerio, openWebView, depth + 1);
      }
    } catch (error) {
      console.log(`download page resolution failed`, (error as any)?.message);
    }
    return externalFallback(link, hostname);
  }

  if (/xcloud|hubcloud|hubdrive|vcloud/i.test(hostname)) {
    return resolveHubCloud(link, signal, axios, cheerio, openWebView);
  }
  if (/dood\.|filemoon/i.test(hostname)) {
    return resolveDoodStyle(link, signal, axios);
  }
  if (/pixeldrain/.test(hostname)) {
    const parts = new URL(link).pathname.split("/").filter(Boolean);
    const id = parts[parts.length - 1];
    if (id) {
      return [
        {
          server: "PixelDrain",
          link: `https://pixeldrain.com/api/file/${id}`,
          type: "mp4",
        },
      ];
    }
  }
  if (/gkycdn|fpgo|filebee|hellabyte|gdmirrorbot|terabox|send\.cm|mediafire/i.test(hostname)) {
    return resolveFileHost(link, signal, axios);
  }

  return externalFallback(link, hostname);
}

export const getStream = async function ({
  link,
  signal,
  providerContext,
}: {
  link: string;
  type: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Stream[]> {
  try {
    const { axios, cheerio, openWebView } = providerContext;
    return await resolveLink(link, signal, axios, cheerio, openWebView, 0);
  } catch (err) {
    throwProviderError("KDHindiDubbed", "stream", err);
  }
};
