import { ProviderContext, Stream } from "../types";

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
    const response = await axios.get(link, {
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      signal,
    });

    const $ = cheerio.load(response.data || "");
    const streams: Stream[] = [];

    $("iframe[src], iframe[data-src], source[src], a[href*='.m3u8']").each(
      (_, el) => {
        const href = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("href") || "";
        if (!href) return;

        const type = href.includes(".m3u8") ? "hls" : "iframe";
        streams.push({
          server: $(el).attr("title") || $(el).attr("data-server") || "Stream",
          link: href,
          type,
          quality: "720",
        });
      },
    );

    return streams;
  } catch (error) {
    console.error("kdhindidubbed stream error:", error);
    return [];
  }
};
