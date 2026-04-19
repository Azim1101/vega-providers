import { ProviderContext, Stream } from "../types";

const headers = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Cache-Control": "no-store",
  "Accept-Language": "en-US,en;q=0.9",
  DNT: "1",
  "Upgrade-Insecure-Requests": "1",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

export async function getStream({
  link,
  type,
  signal,
  providerContext,
}: {
  link: string;
  type: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Stream[]> {
  const { axios, cheerio } = providerContext;
  
  try {
    const response = await axios.get(link, {
      headers: { ...headers, Referer: link },
      signal,
    });

    const $ = cheerio.load(response.data);
    const streams: Stream[] = [];

    // Look for iframes (common streaming method)
    $("iframe[src], iframe[data-src]").each((_, el) => {
      const iframe = $(el);
      const iframeUrl = iframe.attr("src") || iframe.attr("data-src") || "";
      
      if (iframeUrl) {
        const serverName = iframe.attr("title") || iframe.attr("data-server") || "Iframe";
        streams.push({
          server: serverName,
          link: iframeUrl,
          type: "iframe",
          quality: "720",
        });
      }
    });

    // Look for direct video links (m3u8, mp4, etc.)
    $("source[src], a[href*='.m3u8'], a[href*='.mp4']").each((_, el) => {
      const source = $(el);
      const videoUrl = source.attr("src") || source.attr("href") || "";
      
      if (videoUrl && videoUrl.length > 0) {
        const type = videoUrl.includes(".m3u8") ? "hls" : "mp4";
        streams.push({
          server: "Direct Stream",
          link: videoUrl,
          type,
          quality: "720",
        });
      }
    });

    // Look for embedded players with data attributes
    $(["data-video], [data-link]").each((_, el) => {
      const player = $(el);
      const videoUrl = player.attr("data-video") || player.attr("data-link") || "";
      
      if (videoUrl) {
        streams.push({
          server: player.attr("data-server") || "Player",
          link: videoUrl,
          type: "iframe",
          quality: "720",
        });
      }
    });

    return streams.length > 0 ? streams : [];
  } catch (error: any) {
    console.log("KatDrama getStream error: ", error);
    return [];
  }
}