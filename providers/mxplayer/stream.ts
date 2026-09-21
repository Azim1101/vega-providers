import { Stream, ProviderContext } from "../types";

const API_BASE = "https://api.mxplayer.in/v1/web/detail/video";
const API_ALT = "https://api.mxplay.com/v1/web/detail/video";
const IMAGE_BASE = "https://qqcdnpictest.mxplay.com/";

// Helper to try to get HLS from MX Player API with India-like headers
async function tryGetStreamData(
  id: string,
  type: string,
  providerContext: ProviderContext
): Promise<any> {
  const endpoints = [
    `${API_ALT}?type=${type}&id=${id}&platform=com.mxplay.desktop&device-density=3&userid=30bb09af-733a-413b-b8b7-b10348ec2b3d&content-languages=en,hi`,
    `${API_ALT}?type=${type}&id=${id}&platform=com.mxplay.desktop`,
    `${API_BASE}?type=${type}&id=${id}&platform=com.mxplay.desktop&device-density=3&userid=30bb09af-733a-413b-b8b7-b10348ec2b3d&content-languages=en,hi`,
    `${API_BASE}?type=${type}&id=${id}&platform=com.mxplay.desktop&device-density=2&userid=30bb09af-733a-413b-b8b7-b10348ec2b3d&content-languages=hi,mr,pa,bn,en,ml,kn,gu,te,ta`,
    `${API_BASE}?type=${type}&id=${id}&platform=com.mxplay.desktop`,
    `${API_BASE}?type=${type}&id=${id}&platform=com.mxplay.android`,
    `${API_BASE}?type=${type}&id=${id}&platform=com.mxplay.ios`,
  ];

  const headersList = [
    {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "X-Forwarded-For": "103.8.126.1",
      "X-Real-IP": "103.8.126.1",
    },
    {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      "X-Forwarded-For": "103.8.126.1",
    },
    {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
  ];

  for (const endpoint of endpoints) {
    for (const headers of headersList) {
      try {
        const res = await fetch(endpoint, {
          headers,
        });
        if (!res.ok) continue;
        const data = await res.json();
        if (data?.stream) {
          return data;
        }
        // Return data even if stream null, so we can try to extract from other fields
        if (data?.id) {
          // Keep the data for fallback extraction (gifVideoUrl etc)
          // Only return if it has some useful fields
          if (data.gifVideoUrl || data.seekThumbnail) {
            return data;
          }
          continue;
        }
      } catch {
        continue;
      }
    }
  }
  // Last attempt: try without headers, just fetch mxplayer.in
  try {
    const url = `${API_BASE}?type=${type}&id=${id}&platform=com.mxplay.desktop`;
    const res = await fetch(url);
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}

function extractHlsFromStream(stream: any): { hls: string[]; dash: string[]; videoHash?: string } {
  const hlsLinks: string[] = [];
  const dashLinks: string[] = [];

  if (!stream) return { hls: [], dash: [] };

  // Direct HLS fields as per GitHub examples
  const hls = stream.hls || {};
  const dash = stream.dash || {};
  const thirdParty = stream.thirdParty || {};
  const altBalaji = stream.altBalaji || {};

  // Check various possible HLS URL fields
  const candidates = [
    hls.high,
    hls.base,
    hls.main,
    hls.min,
    hls.low,
    thirdParty.hlsUrl,
    altBalaji.hlsUrl,
    stream.hlsUrl,
    stream.videoHash ? `https://llvod.mxplay.com/video/${stream.videoHash}/hls/h264_high.m3u8` : null,
  ];

  for (const c of candidates) {
    if (c && typeof c === "string") {
      let url = c;
      if (!url.startsWith("http")) {
        // If it's a relative path like video/xxx/hls/...
        if (url.startsWith("video/") || url.startsWith("/video/")) {
          url = `https://llvod.mxplay.com/${url.replace(/^\//, "")}`;
        } else {
          url = `https://llvod.mxplay.com/${url}`;
        }
      }
      if (url.includes(".m3u8") && !hlsLinks.includes(url)) {
        hlsLinks.push(url);
      }
    }
  }

  const dashCandidates = [
    dash.high,
    dash.base,
    dash.main,
    thirdParty.dashUrl,
    altBalaji.dashUrl,
  ];

  for (const c of dashCandidates) {
    if (c && typeof c === "string") {
      let url = c;
      if (!url.startsWith("http")) {
        url = `https://llvod.mxplay.com/${url.replace(/^\//, "")}`;
      }
      if (!dashLinks.includes(url)) dashLinks.push(url);
    }
  }

  return { hls: hlsLinks, dash: dashLinks, videoHash: stream.videoHash };
}

export const getStream = async function ({
  link,
  type,
  providerContext,
}: {
  link: string;
  type: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Stream[]> {
  try {
    // link format: movie:{id} or episode:{id} or tvshow:{id}
    const [linkType, id] = link.split(":");
    if (!id) return [];

    const videoType = linkType === "movie" ? "movie" : "episode";

    // Try to get stream data from API
    const streamData = await tryGetStreamData(id, videoType, providerContext);

    if (!streamData) {
      // Fallback: try to construct HLS from known patterns using activate page?
      // For now return empty, but log
      console.log(`mxplayer: no stream data for ${link}`);
      return [];
    }

    const stream = streamData.stream;
    if (!stream) {
      console.log(`mxplayer: stream null for ${link}, trying to use videoHash from seekThumbnail`);
      // Try to get videoHash from seekThumbnail or gifVideoUrl
      // For Bhaukaal, seekThumbnail has video hash like 39a11245c702b4e2eb2cc99e92bf06a077ac71612a176fc3478c6feb9dda9213
      // That hash might be usable to construct HLS URL with token? Let's try to extract from gifVideoUrl
      const gifUrl = streamData.gifVideoUrl?.["16x9"] || "";
      const match = gifUrl.match(/video\/([a-f0-9]{32,})/);
      if (match) {
        const hash = match[1];
        // Try common HLS patterns
        const patterns = [
          `https://llvod.mxplay.com/video/${hash}/hls/h264_high.m3u8`,
          `https://llvod.mxplay.com/video/${hash}/1/hls/h264_high.m3u8`,
          `https://llvod.mxplay.com/video/${hash}/3/hls/h264_1080_baseline_5800k.m3u8`,
        ];
        const streams: Stream[] = patterns.map((url, idx) => ({
          server: `MXPlayer HLS ${idx + 1}`,
          link: url,
          type: "hls",
        }));
        return streams;
      }
      return [];
    }

    const { hls, dash } = extractHlsFromStream(stream);

    const result: Stream[] = [];

    // Add HLS streams
    hls.forEach((url, idx) => {
      // Try to determine quality from url
      let quality: "360" | "480" | "720" | "1080" | undefined;
      if (url.includes("1080")) quality = "1080";
      else if (url.includes("720")) quality = "720";
      else if (url.includes("480")) quality = "480";
      else if (url.includes("360")) quality = "360";
      else if (idx === 0) quality = "720";

      result.push({
        server: `MXPlayer HLS ${quality || idx + 1}`,
        link: url,
        type: "hls",
        quality,
      });
    });

    // Add DASH streams
    dash.forEach((url, idx) => {
      result.push({
        server: `MXPlayer DASH ${idx + 1}`,
        link: url,
        type: "dash",
      });
    });

    // If we have at least one, return
    if (result.length > 0) return result;

    // Last resort: try videoHash
    if (stream.videoHash) {
      const hash = stream.videoHash;
      const url = `https://llvod.mxplay.com/video/${hash}/hls/h264_high.m3u8`;
      return [
        {
          server: "MXPlayer HLS",
          link: url,
          type: "hls",
          quality: "720",
        },
      ];
    }

    return [];
  } catch (err) {
    console.error("mxplayer stream error", err);
    return [];
  }
};
