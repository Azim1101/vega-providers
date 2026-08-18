import { EpisodeLink, ProviderContext } from "../types";
import { throwProviderError } from "../providerErrors";

const headers = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-store",
  DNT: "1",
  "sec-ch-ua":
    '"Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
};

function hostLabel(href: string, anchorText: string): string {
  const text = anchorText.trim();
  if (text) return text;
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "Link";
  }
}

export const getEpisodes = async function ({
  url,
  providerContext,
}: {
  url: string;
  providerContext: ProviderContext;
}): Promise<EpisodeLink[]> {
  try {
    const { axios, cheerio } = providerContext;
    const res = await axios.get(url, { headers });
    const $ = cheerio.load(res.data);

    const episodeLinks: EpisodeLink[] = [];
    const seen = new Set<string>();

    const push = (title: string, link: string) => {
      if (!link || seen.has(link)) return;
      seen.add(link);
      episodeLinks.push({ title, link });
    };

    // New format (series):
    // <div class="episode-list">
    //   <div class="episode-row">
    //     <span class="ep-no">Episode 01</span>
    //     <a href="https://dtflix.ink/share/...">Dotflix</a>
    //     <a href="https://hubcloud.cx/drive/...">HubCloud</a>
    //     <a href="https://send.cm/...">Sendcm</a>
    //   </div>
    // ...
    $(".episode-list .episode-row").each((_, row) => {
      const $row = $(row);
      const epTitle =
        $row.find(".ep-no").first().text().trim() ||
        `Episode ${episodeLinks.length + 1}`;

      const hubcloud = $row
        .find('a[href*="hubcloud"], a[href*="hubdrive"]')
        .first()
        .attr("href");
      const dtflix = $row
        .find('a[href*="dtflix"], a[href*="dotflix"]')
        .first()
        .attr("href");
      const anyExternal = $row.find('a[href^="http"]').first().attr("href");

      // HubCloud resolves to a playable direct link, prefer it.
      push(epTitle, hubcloud || dtflix || anyExternal || "");
    });

    // Old format (movies/older series): quality sections like
    // <h2>480p Links [MB]</h2><p><a ...>Sendcm</a><a ...>Doodstm</a>...</p>
    if (episodeLinks.length === 0) {
      const contentRoot = $(".entry-content").length
        ? $(".entry-content")
        : $("article");
      contentRoot.find("h2, h3").each((_, el) => {
        const heading = $(el).text().trim();
        const qualityMatch = heading.match(
          /(2160p|1080p|720p|480p|360p|4k)/i,
        );
        const quality = qualityMatch?.[1] || heading;

        let node = $(el).next();
        while (node.length && !node.is("h2, h3")) {
          node.find('a[href^="http"]').each((_, anchor) => {
            const href = $(anchor).attr("href")?.trim();
            if (!href) return;
            const label = hostLabel(href, $(anchor).text());
            push(`${quality} - ${label}`, href);
          });
          node = node.next();
        }
      });
    }

    // Fallback: any external link inside the post content.
    if (episodeLinks.length === 0) {
      const contentRoot = $(".entry-content").length
        ? $(".entry-content")
        : $("article");
      contentRoot.find('a[href^="http"]').each((_, anchor) => {
        const href = $(anchor).attr("href")?.trim();
        if (!href) return;
        const label = hostLabel(href, $(anchor).text());
        push(label, href);
      });
    }

    return episodeLinks;
  } catch (err) {
    throwProviderError("KDramasMaza", "episodes", err);
  }
};
