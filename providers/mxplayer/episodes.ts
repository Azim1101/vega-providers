import { EpisodeLink, ProviderContext } from "../types";

const API_BASE = "https://api.mxplayer.in/v1/web/detail";
const ACTIVATE_BASE = "https://activate.mxplayer.in";
const IMAGE_BASE = "https://qqcdnpictest.mxplay.com/";

function buildImage(imageInfo: any[] | null): string {
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

async function getEpisodesViaActivate(
  seasonId: string,
  providerContext: ProviderContext
): Promise<EpisodeLink[]> {
  const { cheerio } = providerContext;
  try {
    let html = "";
    try {
      const url = `${ACTIVATE_BASE}/detail/season/${seasonId}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      html = await res.text();
    } catch {}

    if (html) {
      const $ = cheerio.load(html);
      const episodes: EpisodeLink[] = [];
      // The activate page has links like /show/watch-.../season-.../episode-...-online-{id}
      // We can parse all anchor tags with href containing /episode- and extract id
      $("a[href*='/episode-']").each((_, el) => {
        const href = $(el).attr("href") || "";
        const match = href.match(/-([a-f0-9]{32})(?:\?|$)/);
        if (match) {
          const epId = match[1];
          // Try to get title from nearby text or img alt
          const title =
            $(el).find("img").attr("alt") ||
            $(el).text().trim() ||
            `Episode ${episodes.length + 1}`;
          // Avoid duplicates
          if (!episodes.find((e) => e.link.includes(epId))) {
            episodes.push({
              title: title.substring(0, 100) || `Episode ${episodes.length + 1}`,
              link: `episode:${epId}`,
              image: $(el).find("img").attr("src") || "",
            });
          }
        }
      });
      // Also check for S1 E1 pattern
      if (episodes.length > 0) return episodes;
    }

    return [];
  } catch (e) {
    console.error("activate episodes error", e);
    return [];
  }
}

async function getEpisodesViaApi(
  seasonId: string,
  filterId: string,
  providerContext: ProviderContext
): Promise<EpisodeLink[]> {
  const episodes: EpisodeLink[] = [];
  const seen = new Set<string>();

  try {
    const initialUrl = `${API_BASE}/tab/aroundcurrentepisodes?type=season&id=${seasonId}&filterId=${filterId}&platform=com.mxplay.desktop&content-languages=en,hi&device-density=3&userid=test`;
    const res = await fetch(initialUrl);
    const data = await res.json();
    const items = data.items || [];
    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        episodes.push({
          title: item.title || `Episode ${item.sequence || episodes.length + 1}`,
          link: `episode:${item.id}`,
          description: item.description || "",
          image: buildImage(item.imageInfo),
        });
      }
    }
    // Check pagination tokens if available in raw response? The api returns next/previous as strings like "finalId=...&pageDirection=1"
    // We need to parse from the initial response's next/previous fields if present, but our earlier fetch_page showed they are in top level
    // The axios response should have next and previous
    let nextToken = data.next || null;
    let prevToken = data.previous || null;

    // The initial call for season 1 with ep9 returned only ep9, but previous pagination returned 8 episodes
    // So we need to try both directions
    // Try previous direction from filterId
    if (prevToken === null && items.length === 1) {
      const prevUrl = `${API_BASE}/tab/aroundcurrentepisodes?type=season&id=${seasonId}&filterId=${filterId}&platform=com.mxplay.desktop&content-languages=en,hi&device-density=3&userid=test&finalId=${filterId}&pageDirection=2`;
      try {
        const prevRes = await fetch(prevUrl);
        const prevData = await prevRes.json();
        const prevItems = prevData.items || [];
        for (const item of prevItems) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            episodes.push({
              title: item.title || `Episode ${item.sequence || episodes.length + 1}`,
              link: `episode:${item.id}`,
              description: item.description || "",
              image: buildImage(item.imageInfo),
            });
          }
        }
        nextToken = prevData.next || nextToken;
        prevToken = prevData.previous || prevToken;

        // If prevData has next token, we might need to fetch next as well to get remaining
        // For Aashram S1, prev call returned 8 episodes and next token pointed to ep8, which when fetched with pageDirection=1 returned ep9 again
        // So we have all now

        // Try to paginate further previous if prevToken exists and we haven't got all
        let currentPrev = prevToken;
        let attempts = 0;
        while (currentPrev && attempts < 5) {
          const m = currentPrev.match(/finalId=([^&]+).*pageDirection=(\d)/);
          if (!m) break;
          const fid = m[1];
          const dir = m[2];
          const url = `${API_BASE}/tab/aroundcurrentepisodes?type=season&id=${seasonId}&filterId=${filterId}&platform=com.mxplay.desktop&content-languages=en,hi&device-density=3&userid=test&finalId=${fid}&pageDirection=${dir}`;
          try {
            const r = await fetch(url);
            const d = await r.json();
            const its = d.items || [];
            let added = 0;
            for (const it of its) {
              if (!seen.has(it.id)) {
                seen.add(it.id);
                episodes.push({
                  title: it.title || `Episode ${it.sequence || episodes.length + 1}`,
                  link: `episode:${it.id}`,
                  description: it.description || "",
                  image: buildImage(it.imageInfo),
                });
                added++;
              }
            }
            if (added === 0) break;
            currentPrev = d.previous;
          } catch {
            break;
          }
          attempts++;
        }
      } catch (e) {
        console.error("prev pagination error", e);
      }
    }

    // Try next direction from filterId (for season 2 starting from ep1)
    if (episodes.length <= 1) {
      const nextUrl = `${API_BASE}/tab/aroundcurrentepisodes?type=season&id=${seasonId}&filterId=${filterId}&platform=com.mxplay.desktop&content-languages=en,hi&device-density=3&userid=test&finalId=${filterId}&pageDirection=1`;
      try {
        const nextRes = await fetch(nextUrl);
        const nextData = await nextRes.json();
        const nextItems = nextData.items || [];
        for (const item of nextItems) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            episodes.push({
              title: item.title || `Episode ${item.sequence || episodes.length + 1}`,
              link: `episode:${item.id}`,
              description: item.description || "",
              image: buildImage(item.imageInfo),
            });
          }
        }
        let currentNext = nextData.next;
        let attempts = 0;
        while (currentNext && attempts < 10) {
          const m = currentNext.match(/finalId=([^&]+).*pageDirection=(\d)/);
          if (!m) break;
          const fid = m[1];
          const dir = m[2];
          const url = `${API_BASE}/tab/aroundcurrentepisodes?type=season&id=${seasonId}&filterId=${filterId}&platform=com.mxplay.desktop&content-languages=en,hi&device-density=3&userid=test&finalId=${fid}&pageDirection=${dir}`;
          try {
            const r = await fetch(url);
            const d = await r.json();
            const its = d.items || [];
            let added = 0;
            for (const it of its) {
              if (!seen.has(it.id)) {
                seen.add(it.id);
                episodes.push({
                  title: it.title || `Episode ${it.sequence || episodes.length + 1}`,
                  link: `episode:${it.id}`,
                  description: it.description || "",
                  image: buildImage(it.imageInfo),
                });
                added++;
              }
            }
            if (added === 0) break;
            currentNext = d.next;
          } catch {
            break;
          }
          attempts++;
        }
      } catch {}
    }

    // Sort by sequence if available, otherwise by title
    episodes.sort((a, b) => {
      const seqA = parseInt(a.title.match(/Episode\s*(\d+)/i)?.[1] || "0");
      const seqB = parseInt(b.title.match(/Episode\s*(\d+)/i)?.[1] || "0");
      if (seqA && seqB) return seqA - seqB;
      return a.title.localeCompare(b.title);
    });

    return episodes;
  } catch (e) {
    console.error("getEpisodesViaApi error", e);
    return episodes;
  }
}

export const getEpisodes = async function ({
  url,
  providerContext,
}: {
  url: string;
  providerContext: ProviderContext;
}): Promise<EpisodeLink[]> {
  // url format: season:{seasonId}:{filterId} or tvshow:{tvshowId}
  const parts = url.split(":");
  if (parts[0] === "season" && parts[1] && parts[2]) {
    const seasonId = parts[1];
    const filterId = parts[2];

    // Try activate first (not geo-blocked)
    let eps = await getEpisodesViaActivate(seasonId, providerContext);
    if (eps.length > 0) return eps;

    // Fallback to API
    eps = await getEpisodesViaApi(seasonId, filterId, providerContext);
    return eps;
  } else if (parts[0] === "tvshow" && parts[1]) {
    // For tvshow without season info, try to get first episode and then seasons
    const tvshowId = parts[1];
    // This case shouldn't happen often, return empty
    return [];
  }
  return [];
};
