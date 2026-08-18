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

function externalFallback(
  link: string,
  server: string,
): Stream[] {
  return [
    {
      server,
      link,
      type: "mp4",
      headers,
    },
  ];
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
      console.log(`KDramasMaza WAF detected (403) for ${url}, using solver...`);
      const wafResult = await openWebView(new URL(url).origin, {
        title: "Solve the captcha below and click done",
        description: "Required to bypass anti-bot protection on KDramasMaza.",
        headers,
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

/**
 * The archives pages on kdramasmaza.com.pk list the real hosts
 * (HubCloud / Dotflix / Sendcm ...). Pick the best one and resolve it.
 */
async function resolveArchivesPage(
  link: string,
  signal: AbortSignal,
  axios: ProviderContext["axios"],
  cheerio: ProviderContext["cheerio"],
  openWebView?: ProviderContext["openWebView"],
): Promise<Stream[]> {
  const res = await fetchWithWAF({ url: link, signal, axios, headers, openWebView });
  const $ = cheerio.load(res.data);

  const hubcloud = $('a[href*="hubcloud"], a[href*="hubdrive"]')
    .first()
    .attr("href");
  const dood = $('a[href*="dood."]').first().attr("href");
  const dtflix = $('a[href*="dtflix"], a[href*="dotflix"]')
    .first()
    .attr("href");
  const anyExternal =
    $('.episode-list a[href^="http"]').first().attr("href") ||
    $(".entry-content a[href^='http']").first().attr("href") ||
    $('a[href^="http"]').first().attr("href");

  const target = hubcloud || dood || dtflix || anyExternal || link;
  if (target === link || !target) return externalFallback(link, "KDramasMaza");

  const hostname = new URL(target).hostname.toLowerCase();
  if (/hubcloud|hubdrive|vcloud/i.test(hostname)) {
    return await hubcloudExtractor(target, signal, axios, cheerio, headers);
  }
  if (/dood\./i.test(hostname)) return resolveDood(target, signal, axios);
  if (/dtflix|dotflix/i.test(hostname)) return resolveDotflix(target, signal, axios);
  return externalFallback(target, hostname);
}

/**
 * Doodstream: the /e/<code> page embeds a pass_md5 token; calling
 * https://dood.li/<pass_md5> with a Referer returns the direct video URL.
 */
async function resolveDood(
  link: string,
  signal: AbortSignal,
  axios: ProviderContext["axios"],
): Promise<Stream[]> {
  const code = link.split("/").filter(Boolean).pop();
  if (code) {
    try {
      const embedUrl = `https://dood.li/e/${code}`;
      const embedRes = await axios.get(embedUrl, { headers, signal });
      const passMd5 = embedRes.data.match(
        /pass_md5\s*=\s*["']([^"']+)["']/i,
      )?.[1];
      if (passMd5) {
        const dlRes = await axios.get(`https://dood.li/${passMd5}`, {
          headers: { ...headers, Referer: embedUrl },
          signal,
        });
        const directUrl = dlRes.data?.url;
        if (directUrl) {
          return [
            {
              server: "Doodstream",
              link: directUrl,
              type: "mp4",
              headers: { ...headers, Referer: embedUrl },
            },
          ];
        }
      }
    } catch (error) {
      console.log("dood resolution failed", (error as any)?.message);
    }
  }
  return externalFallback(link, "Doodstream");
}

/**
 * DOTFLIX share pages load their download options with JavaScript, so a
 * direct link is usually not in the HTML. Try the common patterns anyway
 * (Google Drive / Pixeldrain / direct media files) and fall back to the
 * share page itself.
 */
async function resolveDotflix(
  link: string,
  signal: AbortSignal,
  axios: ProviderContext["axios"],
): Promise<Stream[]> {
  try {
    const res = await axios.get(link, { headers, signal });
    const html = res.data;

    const candidates = [
      html.match(/https:\/\/drive\.google\.com\/file\/d\/[^"'<>\s]+/)?.[0],
      html.match(/https:\/\/drive\.google\.com\/uc\?id=[^"'<>\s&]+/)?.[0],
      html.match(/https:\/\/pixeldrain\.com\/api\/file\/[^"'<>\s]+/)?.[0],
      html.match(/https?:\/\/[^"'\s<>]+\.(?:mp4|mkv|m3u8)(?:\?[^"'\s<>]*)?/i)?.[0],
    ].filter(Boolean) as string[];

    if (candidates.length) {
      return candidates.map((directUrl) => {
        const extension = directUrl.match(/\.(mp4|mkv|m3u8)(\?|$)/i)?.[1]?.toLowerCase() || "mp4";
        return {
          server: "Dotflix",
          link: directUrl,
          type: extension,
          headers,
        };
      });
    }
  } catch (error) {
    console.log("dotflix resolution failed", (error as any)?.message);
  }
  return externalFallback(link, "Dotflix");
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
    const hostname = new URL(link).hostname.toLowerCase();

    if (/hubcloud|hubdrive|vcloud/i.test(hostname)) {
      return await hubcloudExtractor(link, signal, axios, cheerio, headers);
    }
    if (/dood\./i.test(hostname)) return resolveDood(link, signal, axios);
    if (/dtflix|dotflix/i.test(hostname)) {
      return resolveDotflix(link, signal, axios);
    }
    if (/kdramasmaza/i.test(hostname)) {
      return resolveArchivesPage(link, signal, axios, cheerio, openWebView);
    }

    // send.cm, media.cm, multiup.io, mirrorace.org, filepress.store, ...
    return externalFallback(link, hostname);
  } catch (err) {
    throwProviderError("KDramasMaza", "stream", err);
  }
};
