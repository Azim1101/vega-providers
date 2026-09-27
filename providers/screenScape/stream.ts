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

    console.log("ScreenScape stream payload:", {
      tmdbId,
      imdbId,
      season,
      episode,
      effectiveType,
    });

    const isTV =
      effectiveType === "series" || effectiveType === "tv";

    // Try TMDB-based embed first
    if (tmdbId && tmdbId !== "undefined" && tmdbId !== "") {
      let embedUrl: string;
      if (isTV) {
        if (!season || !episode) {
          console.warn("ScreenScape: missing season or episode for TV series");
          return streams;
        }
        embedUrl = `${SCREENSCAPE_EMBED_BASE}?tmdb=${tmdbId}&type=tv&s=${season}&e=${episode}`;
      } else {
        embedUrl = `${SCREENSCAPE_EMBED_BASE}?tmdb=${tmdbId}&type=movie`;
      }
      console.log("ScreenScape TMDB embed URL:", embedUrl);
      streams.push({
        server: "ScreenScape",
        link: embedUrl,
        type: "embed",
      });
    }

    // Fallback: IMDB-based embed
    if (imdbId && imdbId !== "undefined" && imdbId !== "") {
      let embedUrl: string;
      if (isTV) {
        if (!season || !episode) return streams;
        embedUrl = `${SCREENSCAPE_EMBED_BASE}?imdb=${imdbId}&type=tv&s=${season}&e=${episode}`;
      } else {
        embedUrl = `${SCREENSCAPE_EMBED_BASE}?imdb=${imdbId}&type=movie`;
      }
      console.log("ScreenScape IMDB embed URL:", embedUrl);
      streams.push({
        server: "ScreenScape (IMDB)",
        link: embedUrl,
        type: "embed",
      });
    }

    if (streams.length === 0) {
      console.warn("ScreenScape: no valid tmdbId or imdbId in link payload");
    }

    return streams;
  } catch (err) {
    console.error("ScreenScape getStream error:", err);
    return [];
  }
};
