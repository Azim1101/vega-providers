import { getBaseUrl } from "../getBaseUrl";
import { ProviderContext, Stream, TextTracks } from "../types";
import { generateKisskhKey, getKisskhConfig } from "./keyGenerator";

const DEFAULT_BASE_URL = "https://kisskh.is";

function normalizeBaseUrl(value: string): string {
  return (value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function extractEpisodeId(value: string): string {
  const input = value.trim();
  if (/^\d+$/.test(input)) return input;

  try {
    const parsed = new URL(input);
    for (const key of ["ep", "episode", "episodeId"]) {
      const episodeId = parsed.searchParams.get(key);
      if (episodeId && /^\d+$/.test(episodeId)) return episodeId;
    }
  } catch {
    // The provider normally passes a numeric ID, so a non-URL value is valid.
  }

  const pathMatch = input.match(/\/Episode\/(\d+)/i);
  if (pathMatch) return pathMatch[1];

  return input;
}

function getQuality(value: string | undefined): Stream["quality"] {
  if (!value) return undefined;
  const match = value.match(/\b(360|480|720|1080|2160)\b/);
  return match ? (match[1] as Stream["quality"]) : undefined;
}

function resolveVideoUrl(value: unknown, baseUrl: string): string {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    return new URL(value, `${baseUrl}/`).href;
  } catch {
    return value.trim();
  }
}

function getSubtitleItems(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.subtitles)) return data.subtitles;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

async function getSubtitles(
  episodeId: string,
  subKey: string,
  baseUrl: string,
  headers: Record<string, string>,
  signal: AbortSignal | undefined,
  providerContext: ProviderContext,
): Promise<TextTracks> {
  try {
    const response = await providerContext.axios.get(
      `${baseUrl}/api/Sub/${encodeURIComponent(episodeId)}?kkey=${encodeURIComponent(subKey)}`,
      { headers, signal, timeout: 8000 },
    );
    const subtitles: TextTracks = [];
    for (const subtitle of getSubtitleItems(response.data)) {
      const uri = resolveVideoUrl(subtitle?.src, baseUrl);
      if (!uri) continue;
      subtitles.push({
        title: subtitle.label || "Subtitle",
        language: subtitle.land || subtitle.label || "en",
        type: uri.includes(".vtt") ? "text/vtt" : "application/x-subrip",
        uri,
      });
    }
    return subtitles;
  } catch {
    // A missing subtitle endpoint must not prevent the video from loading.
    return [];
  }
}

async function getPlaylistVariants(
  videoUrl: string,
  baseUrl: string,
  headers: Record<string, string>,
  signal: AbortSignal | undefined,
  providerContext: ProviderContext,
  subtitles: TextTracks,
): Promise<Stream[]> {
  try {
    const response = await providerContext.axios.get(videoUrl, {
      headers,
      signal,
      timeout: 5000,
    });
    const playlist = typeof response.data === "string" ? response.data : "";
    if (!playlist.includes("#EXT-X-STREAM-INF:")) return [];

    const streams: Stream[] = [];
    const lines = playlist.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const info = lines[index];
      if (!info.startsWith("#EXT-X-STREAM-INF:")) continue;

      const variantUrl = lines[index + 1]?.trim();
      if (!variantUrl || variantUrl.startsWith("#")) continue;
      const link = resolveVideoUrl(variantUrl, videoUrl);
      const quality = getQuality(info);
      streams.push({
        server: `KissKH${quality ? ` (${quality}p)` : ""}`,
        link,
        type: "m3u8",
        ...(quality ? { quality } : {}),
        subtitles,
        headers,
      });
    }
    return streams;
  } catch {
    return [];
  }
}

export const getStream = async function ({
  link,
  signal,
  providerContext,
  isDownload,
}: {
  link: string;
  type?: string;
  signal?: AbortSignal;
  providerContext: ProviderContext;
  isDownload?: boolean;
}): Promise<Stream[]> {
  try {
    const { axios, commonHeaders } = providerContext;
    let baseUrl = DEFAULT_BASE_URL;
    try {
      baseUrl = normalizeBaseUrl(await getBaseUrl("kissKh"));
    } catch {
      // Keep the known current domain when the remote URL configuration is unavailable.
    }

    const episodeId = extractEpisodeId(link);
    const config = await getKisskhConfig(axios, baseUrl);
    const streamKey = generateKisskhKey(
      episodeId,
      config.viGuid,
      config.appVer,
      config.platformVer,
      config.appName,
    );
    const subtitleKey = generateKisskhKey(
      episodeId,
      config.subGuid,
      config.appVer,
      config.platformVer,
      config.appName,
    );

    const headers: Record<string, string> = {
      ...(commonHeaders || {}),
      Accept: "application/json, text/plain, */*",
      Referer: `${baseUrl}/`,
      Origin: baseUrl,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };
    const subtitles = await getSubtitles(
      episodeId,
      subtitleKey,
      baseUrl,
      headers,
      signal,
      providerContext,
    );
    const response = await axios.get(
      `${baseUrl}/api/DramaList/Episode/${encodeURIComponent(episodeId)}.png?err=false&ts=null&time=null&kkey=${encodeURIComponent(streamKey)}`,
      {
        headers,
        responseType: "json",
        signal,
        timeout: 10000,
      },
    );

    let data: any = response.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        data = {};
      }
    }
    const source = data?.source || data;
    const streams: Stream[] = [];
    const primaryUrl = resolveVideoUrl(source?.Video, baseUrl);

    if (primaryUrl) {
      const isM3u8 = primaryUrl.toLowerCase().includes(".m3u8") || source?.Type === 1;
      if (isM3u8) {
        streams.push(
          ...(await getPlaylistVariants(
            primaryUrl,
            baseUrl,
            headers,
            signal,
            providerContext,
            subtitles,
          )),
        );
      }
      if (!streams.length) {
        const quality = getQuality(primaryUrl) || (primaryUrl.includes(".mp4") ? "1080" : undefined);
        streams.push({
          server: "KissKH",
          link: primaryUrl,
          type: isM3u8 ? "m3u8" : "mp4",
          ...(quality ? { quality } : {}),
          subtitles,
          headers,
        });
      }
    }

    const backupUrl = resolveVideoUrl(source?.Video_tmp, baseUrl);
    if (backupUrl) {
      streams.push({
        server: "KissKH (Backup)",
        link: backupUrl,
        type: backupUrl.toLowerCase().includes(".m3u8") ? "m3u8" : "mp4",
        subtitles,
        headers,
      });
    }

    if (isDownload) {
      streams.sort((first, second) => {
        if (first.type === "mp4" && second.type !== "mp4") return -1;
        if (first.type !== "mp4" && second.type === "mp4") return 1;
        return 0;
      });
    }
    return streams;
  } catch (error) {
    console.error("KissKh stream request failed", error);
    return [];
  }
};
