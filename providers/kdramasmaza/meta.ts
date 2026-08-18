import { Info, Link, ProviderContext } from "../types";
import { getBaseUrl } from "../getBaseUrl";
import { throwProviderError } from "../providerErrors";

// The runtime getBaseUrl() reads urls.json from the upstream repo where the
// "kdramasmaza" key does not exist yet, so we always fall back to the site.
const DEFAULT_BASE_URL = "https://kdramasmaza.net";

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

function cleanTitle(title: string): string {
  return title
    .replace(/\s*[-–—|]\s*KDramas\s*Maza\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractArchivesUrl(onclick: string): string {
  const match = onclick.match(/https?:\/\/[^'"\s]*(?:\/archives\/\d+)/i);
  return match?.[0] || "";
}

export const getMeta = async function ({
  link,
  providerContext,
}: {
  link: string;
  providerContext: ProviderContext;
}): Promise<Info> {
  try {
    const { axios, cheerio, openWebView } = providerContext;
    const baseUrl = (await getBaseUrl("kdramasmaza")) || DEFAULT_BASE_URL;
    const url = new URL(link, `${baseUrl}/`).href;

    let res;
    try {
      res = await axios.get(url, { headers });
    } catch (error: any) {
      if (error?.response?.status === 403 && openWebView) {
        console.log(`KDramasMaza WAF detected (403) for ${url}, using solver...`);
        const wafResult = await openWebView(new URL(url).origin, {
          title: "Solve the captcha below and click done",
          description: "Required to bypass anti-bot protection on KDramasMaza.",
          headers,
          waitForCookie: "cf_clearance",
        });
        if (wafResult?.cookies) {
          res = await axios.get(url, {
            headers: { ...headers, Cookie: wafResult.cookies },
          });
        }
      }
      if (!res) throw error;
    }

    let $ = cheerio.load(res.data);
    let parsed = parseMeta($, url);

    // Cloudflare interstitial served with status 200 - solve and re-parse.
    const titleText = ($("title").first().text() || "").toLowerCase();
    if (
      parsed.title === "" &&
      openWebView &&
      (titleText.includes("just a moment") ||
        titleText.includes("attention required") ||
        ($("body").text() || "").toLowerCase().includes("challenge-platform"))
    ) {
      const wafResult = await openWebView(new URL(url).origin, {
        title: "Solve the captcha below and click done",
        description: "Required to bypass anti-bot protection on KDramasMaza.",
        headers,
        waitForCookie: "cf_clearance",
      });
      if (wafResult?.cookies) {
        const retry = await axios.get(url, {
          headers: { ...headers, Cookie: wafResult.cookies },
        });
        $ = cheerio.load(retry.data);
        parsed = parseMeta($, url);
      }
    }

    return parsed;
  } catch (err) {
    throwProviderError("KDramasMaza", "metadata", err);
  }
};

function parseMeta(
  $: any,
  url: string,
): Info {
  const entryText = $(".entry-content").text() || $("article").text() || "";

  const title =
    cleanTitle($(".entry-title").first().text()) ||
    cleanTitle($("h1").first().text()) ||
    cleanTitle($('meta[property="og:title"]').attr("content") || "") ||
    cleanTitle($("title").first().text());

  // First paragraph holds the synopsis; on newer posts the meta info
  // block ("Title: ... Type: ...") follows inside the same paragraph.
  const firstParagraph = $(".entry-content p").first().text();
  let synopsis = (firstParagraph || entryText).split(/\n?\s*Title:/i)[0];
  synopsis = synopsis
    .split(/Read More/i)[0]
    .replace(/\s+/g, " ")
    .trim();

  const image =
    $('meta[property="og:image"]').attr("content") ||
    $('link[rel="image_src"]').attr("href") ||
    $(".entry-content img").first().attr("data-src") ||
    $(".entry-content img").first().attr("src") ||
    $(".post-thumbnail img, .wp-post-image").first().attr("src") ||
    "";

  const lowerText = entryText.toLowerCase();
  const isMovie =
    /\bmovie\b/i.test(entryText) &&
    !/format:\s*standard\s*series/i.test(entryText);
  const type = isMovie ? "movie" : "series";

  // Genres line: "Genres: Action, Law, Drama, Fantasy"
  const genresLine = entryText.match(/Genres?:\s*([^\n]+)/i)?.[1] || "";
  const tags = genresLine
    .split(",")
    .map((tag: string) => tag.trim())
    .filter(Boolean);

  // The download buttons navigate to kdramasmaza.com.pk/archives/<id>.
  const linkList: Link[] = [];
  const found: Array<{ title: string; url: string }> = [];

  $("button[onclick]").each((_: any, el: any) => {
    const onclick = $(el).attr("onclick") || "";
    const archivesUrl = extractArchivesUrl(onclick);
    if (!archivesUrl) return;
    const buttonText = $(el).text().trim() || "Download";
    if (!found.some((entry) => entry.url === archivesUrl)) {
      found.push({ title: buttonText, url: archivesUrl });
    }
  });

  // Fallback: plain anchors pointing at an archives page.
  if (found.length === 0) {
    $('a[href*="/archives/"]').each((_: any, el: any) => {
      const href = $(el).attr("href")?.trim();
      if (!href) return;
      if (!found.some((entry) => entry.url === href)) {
        found.push({
          title: $(el).text().trim() || "Download",
          url: href,
        });
      }
    });
  }

  for (const entry of found) {
    if (type === "movie") {
      linkList.push({
        title: entry.title,
        directLinks: [{ link: entry.url, title: entry.title, type: "movie" }],
      });
    } else {
      linkList.push({ title: entry.title, episodesLink: entry.url });
    }
  }

  return {
    title,
    synopsis,
    image,
    imdbId: "",
    type,
    tags,
    linkList,
    webUrl: url,
  };
}
