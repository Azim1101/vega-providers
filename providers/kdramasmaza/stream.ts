import { ProviderContext, Stream } from "../types";

const headers = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

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
  const { axios, cheerio } = providerContext;

  try {
    const res = await axios.get(link, {
      headers: { ...headers, Referer: link },
      signal,
    });
    const $ = cheerio.load(res.data);
    const streams: Stream[] = [];

    $("iframe[src], iframe[data-src], source[src], a[href]").each((_, el) => {
      const iframe = $(el);
      const href = iframe.attr("src") || iframe.attr("data-src") || iframe.attr("href") || "";
      if (!href) return;
      const isVideo = /\.m3u8|\.mp4|\.mp3|video/i.test(href) || iframe[0].name === "source";
      if (isVideo || /iframe|player|embed/i.test(href)) {
        streams.push({
          server: iframe.attr("title") || iframe.attr("data-server") || "Stream",
          link: href,
          type: href.includes(".m3u8") ? "hls" : href.includes(".mp4") ? "mp4" : "iframe",
          quality: "720",
        });
      }
    });

    return streams;
  } catch (error) {
    console.error("kdramasmaza stream error:", error);
    return [];
  }
};
