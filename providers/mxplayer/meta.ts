import { Info, Link, ProviderContext } from "../types";

const API_BASE = "https://api.mxplayer.in/v1/web/detail/video";
const SEO_BASE = "https://seo.mxplay.com/v1/api/seo/get-url-details";
const IMAGE_BASE = "https://qqcdnpictest.mxplay.com/";

function buildImage(imageInfo: any[] | null, id: string): string {
  if (!imageInfo || imageInfo.length === 0) return "";
  const pref =
    imageInfo.find((i: any) => i.type === "bigpic") ||
    imageInfo.find((i: any) => i.type === "landscape") ||
    imageInfo[0];
  if (pref?.url) {
    return `${IMAGE_BASE}${pref.url}`.replace("http://", "https://");
  }
  return "";
}

async function getFirstEpisodeIdForTvShow(
  tvshowId: string,
  providerContext: ProviderContext
): Promise<string | null> {
  try {
    const url = `${API_BASE}?type=tvshow&id=${tvshowId}&platform=com.mxplay.desktop`;
    const res = await fetch(url);
    const data = await res.json();
    if (data?.firstVideo?.id) return data.firstVideo.id;
    return null;
  } catch {
    return null;
  }
}

async function getSeasonsFromEpisode(
  episodeId: string,
  providerContext: ProviderContext
): Promise<{ id: string; title: string; sequence: number; filterId: string; episodesCount: number }[]> {
  try {
    const url = `${API_BASE}?type=episode&id=${episodeId}&platform=com.mxplay.desktop`;
    const res = await fetch(url);
    const data = await res.json();
    const tabs = data?.tabs || [];
    const epTab = tabs.find((t: any) => t.type === "tvshowepisodes");
    if (!epTab?.containers) return [];
    const containers = epTab.containers;
    return containers.map((c: any) => {
      const aroundApi: string = c.aroundApi || "";
      const m = aroundApi.match(/filterId=([^&]+)/);
      const filterId = m ? m[1] : episodeId;
      return {
        id: c.id,
        title: c.title || `Season ${c.sequence}`,
        sequence: c.sequence || 0,
        filterId,
        episodesCount: c.episodesCount || 0,
      };
    });
  } catch (e) {
    console.error("getSeasonsFromEpisode error", e);
    return [];
  }
}

async function getTvShowDetails(
  tvshowId: string,
  providerContext: ProviderContext
): Promise<any> {
  try {
    const url = `${API_BASE}?type=tvshow&id=${tvshowId}&platform=com.mxplay.desktop`;
    const res = await fetch(url);
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}

async function getMovieDetails(
  movieId: string,
  providerContext: ProviderContext
): Promise<any> {
  try {
    const url = `${API_BASE}?type=movie&id=${movieId}&platform=com.mxplay.desktop`;
    const res = await fetch(url);
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}

export const getMeta = async function ({
  link,
  providerContext,
}: {
  link: string;
  provider: any;
  providerContext: ProviderContext;
}): Promise<Info> {
  try {
    // link format is type:id
    const [type, id] = link.split(":");
    if (!type || !id) {
      return {
        title: "",
        synopsis: "",
        image: "",
        imdbId: "",
        type: "movie",
        linkList: [],
      };
    }

    if (type === "movie") {
      const data = await getMovieDetails(id, providerContext);
      if (!data) throw new Error("No movie data");
      const title = data.title || "";
      const synopsis = data.description || "";
      const image = buildImage(data.imageInfo, id);
      const tags = (data.genres || []).map((g: string) => g) || [];
      const linkList: Link[] = [
        {
          title: title || "Movie",
          directLinks: [
            {
              title: title,
              link: `movie:${id}`,
              type: "movie",
            },
          ],
        },
      ];
      return {
        title,
        synopsis,
        image,
        imdbId: "",
        type: "movie",
        tags,
        linkList,
      };
    } else if (type === "tvshow") {
      const tvData = await getTvShowDetails(id, providerContext);
      if (!tvData) throw new Error("No tvshow data");
      const title = tvData.title || "";
      const synopsis = tvData.description || "";
      const image = buildImage(tvData.imageInfo, id);
      const tags = (tvData.genres || []) as string[];

      let firstEpisodeId: string | null = null;
      try {
        const searchUrl = `https://api.mxplayer.in/v1/web/search/result?query=${encodeURIComponent(
          title
        )}&platform=com.mxplay.desktop&content-languages=en,hi&device-density=3&userid=test`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();
        const sections = searchData?.sections || [];
        for (const sec of sections) {
          for (const item of sec.items || []) {
            if (item.id === id && item.firstVideo?.id) {
              firstEpisodeId = item.firstVideo.id;
              break;
            }
          }
        }
      } catch {}

      if (!firstEpisodeId && tvData.firstVideo?.id) {
        firstEpisodeId = tvData.firstVideo.id;
      }

      // Fallback: try to get first episode id from activate page
      if (!firstEpisodeId) {
        try {
          const activateUrl = `https://activate.mxplayer.in/show/watch-ek-badnaam-aashram-series-online-${id}`;
          // We don't know slug, try generic detail page via tvshow id
          const altUrl = `https://activate.mxplayer.in/detail/tvshow/${id}`;
          let html = "";
          try {
            const r = await fetch(altUrl);
            html = await r.text();
          } catch {}
          if (!html) {
            try {
              const r2 = await fetch(`https://activate.mxplayer.in/show/watch-aashram-series-online-${id}`);
              html = await r2.text();
            } catch {}
          }
          // Parse first episode id from html
          const match = html.match(/-([a-f0-9]{32})(?:\?|$)/);
          if (match) firstEpisodeId = match[1];
        } catch {}
      }

      // If still null, we can't get seasons, return with single link that will try to get episodes via fallback
      let seasons: { id: string; title: string; sequence: number; filterId: string; episodesCount: number }[] = [];
      if (firstEpisodeId) {
        seasons = await getSeasonsFromEpisode(firstEpisodeId, providerContext);
      }

      // Sort seasons by sequence
      seasons.sort((a, b) => a.sequence - b.sequence);

      const linkList: Link[] = seasons.map((s) => ({
        title: s.title,
        episodesLink: `season:${s.id}:${s.filterId}`,
      }));

      // Fallback if no seasons found, create one link using tvshow id
      if (linkList.length === 0) {
        linkList.push({
          title: "Season 1",
          episodesLink: `tvshow:${id}`,
        });
      }

      return {
        title,
        synopsis,
        image,
        imdbId: "",
        type: "series",
        tags,
        linkList,
      };
    } else if (type === "episode") {
      const url = `${API_BASE}?type=episode&id=${id}&platform=com.mxplay.desktop`;
      const res = await fetch(url);
      const data = await res.json();
      const title = data.title || "";
      const synopsis = data.description || "";
      const image = buildImage(data.imageInfo, id);
      return {
        title,
        synopsis,
        image,
        imdbId: "",
        type: "movie",
        linkList: [
          {
            title,
            directLinks: [
              {
                title,
                link: `episode:${id}`,
                type: "movie",
              },
            ],
          },
        ],
      };
    }

    return {
      title: "",
      synopsis: "",
      image: "",
      imdbId: "",
      type: "movie",
      linkList: [],
    };
  } catch (err) {
    console.error("mxplayer meta error", err);
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
