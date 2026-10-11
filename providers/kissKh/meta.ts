import { Info, Link, ProviderContext } from "../types";

function asTag(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const tag = value.trim();
  return tag || undefined;
}

export const getMeta = async function ({
  link,
  providerContext,
}: {
  link: string;
  providerContext: ProviderContext;
}): Promise<Info> {
  try {
    const response = await providerContext.axios.get(link);
    const data = response.data || {};
    const episodes = Array.isArray(data.episodes) ? data.episodes.slice().reverse() : [];
    const episodeCount = Number(data.episodesCount);
    const isMovie = Number.isFinite(episodeCount)
      ? episodeCount <= 1
      : episodes.length <= 1;
    const type = isMovie ? "movie" : "series";
    const title = typeof data.title === "string" ? data.title : "";
    const tags = [
      asTag(typeof data.releaseDate === "string" ? data.releaseDate.split("-")[0] : undefined),
      asTag(data.status),
      asTag(data.type),
    ].filter((tag): tag is string => Boolean(tag));

    const directLinks: Link["directLinks"] = [];
    for (const episode of episodes) {
      if (episode?.id === undefined || episode?.id === null) continue;
      directLinks.push({
        title: isMovie ? "Full Movie" : `Episode ${episode.number ?? ""}`.trim(),
        link: String(episode.id),
        type,
      });
    }

    return {
      title,
      synopsis: typeof data.description === "string" ? data.description : "",
      image: data.thumbnail || data.image || "",
      tags,
      imdbId: "",
      type,
      linkList: [
        {
          title: isMovie ? "Movie" : title,
          directLinks,
        },
      ],
    };
  } catch (error) {
    console.error("KissKh metadata request failed", error);
    return {
      title: "",
      synopsis: "",
      image: "",
      imdbId: "",
      type: "movie",
      linkList: [],
    };
  }
};
