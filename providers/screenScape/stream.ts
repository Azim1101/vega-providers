import { Stream, ProviderContext } from "../types";

const SCREENSCAPE_EMBED_BASE = "https://nxsha.screenscape.me/embed";

export const getStream = async ({
  link: id,
  type,
  providerContext,
}: {
  link: string;
  type: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Stream[]> => {
  try {
    const streams: Stream[] = [];
    
    // Parse the link payload (JSON or plain tmdbId)
    const payload = (() => {
      try {
        return JSON.parse(id);
      } catch {
        return { tmdbId: id };
      }
    })();

    const tmdbId: string | number =
      payload.tmdbId ?? payload.id ?? payload.tmdId ?? "";
    const imdbId: string = payload.imdbId ?? "";
    const season: string = payload.season ?? "";
    const episode: string = payload.episode ?? "";
    const effectiveType: string = payload.type ?? type ?? "movie";

    console.log("ScreenScape stream payload:", { tmdbId, imdbId, season, episode, effectiveType });

    // ScreenScape requires TMDB ID for embeds
    if (!tmdbId || tmdbId === "undefined" || tmdbId === "") {
      console.warn("ScreenScape: missing tmdbId in link payload");
      return streams;
    }

    // Build the embed URL based on content type
    let embedUrl: string;
    
    if (effectiveType === "series" || effectiveType === "tv") {
      // TV Series embed
      if (!season || !episode) {
        console.warn("ScreenScape: missing season or episode for TV series");
        return streams;
      }
      embedUrl = `${SCREENSCAPE_EMBED_BASE}?tmdb=${tmdbId}&type=tv&s=${season}&e=${episode}`;
    } else {
      // Movie embed
      embedUrl = `${SCREENSCAPE_EMBED_BASE}?tmdb=${tmdbId}&type=movie`;
    }

    console.log("ScreenScape embed URL:", embedUrl);

    streams.push({
      server: "ScreenScape",
      link: embedUrl,
      type: "embed",
    });

    return streams;
  } catch (err) {
    console.error("ScreenScape getStream error:", err);
    return [];
  }
};
