import { Info, Link, ProviderContext } from "../types";

async function getWithWAF(
  url: string,
  axios: any,
  openWebView: any,
  headers: any,
): Promise<any> {
  const baseUrl = url.split("/").slice(0, 3).join("/");
  try {
    return await axios.get(url, {
      headers: { ...headers, Referer: baseUrl },
    });
  } catch (error: any) {
    if (error.response?.status === 403 && openWebView) {
      const wafResult = await openWebView(baseUrl, {
        title: "Solve the captcha below and click done",
        description: "Required to bypass anti-bot protection.",
        headers: { ...headers, Referer: baseUrl },
        force: true,
        waitForCookie: "cf_clearance",
      });
      const cookie = wafResult?.cookies || wafResult?.cookie || "";
      return await axios.get(url, {
        headers: { ...headers, Referer: baseUrl, Cookie: cookie },
      });
    }
    throw error;
  }
}

function decodeMaybe(raw: string): string {
  // Handles both already-decoded HTML and JSON-escaped HTML
  let s = raw;
  try {
    // If it still has \u003C style escapes
    if (s.includes("\\u003C") || s.includes("\\u003c") || s.includes('\\"')) {
      s = JSON.parse(`"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r")}"`);
    }
  } catch {
    s = raw
      .replace(/\\u003C/gi, "<")
      .replace(/\\u003E/gi, ">")
      .replace(/\\u0026/gi, "&")
      .replace(/\\u0027/gi, "'")
      .replace(/\\u0022/gi, '"')
      .replace(/\\\//g, "/")
      .replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"');
  }
  return s
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8211;/g, "–")
    .replace(/Â/g, "");
}

function extractPostContent(payload: string): {
  html: string;
  title: string;
  image: string;
} {
  let html = "";
  let title = "";
  let image = "";

  // 1) __data.json devalue chunk: longest string containing "Download"
  for (const line of payload.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      const data = obj?.data;
      if (!Array.isArray(data)) continue;
      for (const v of data) {
        if (typeof v === "string" && v.includes("Download") && v.length > html.length) {
          html = v;
        }
        if (typeof v === "string" && /S\d+|Season|Drama|Episode/i.test(v) && v.length < 300 && !title) {
          // maybe title-ish; keep later from HTML
        }
      }
    } catch {
      // ignore
    }
  }

  // 2) HTML page inline: post_content:"...."
  if (!html) {
    const m = payload.match(/post_content:"((?:\\.|[^"\\])*)"/);
    if (m?.[1]) html = m[1];
  }

  // 3) title/image from payload strings
  const titleMatch =
    payload.match(/post_title":"((?:\\.|[^"\\])*)"/) ||
    payload.match(/"post_title":"((?:\\.|[^"\\])*)"/);
  if (titleMatch?.[1]) {
    try {
      title = JSON.parse(`"${titleMatch[1]}"`);
    } catch {
      title = titleMatch[1];
    }
  }
  const imgMatch = payload.match(/thumbnail_image":"(https?:[^"]+)"/);
  if (imgMatch?.[1]) image = imgMatch[1];

  if (html) html = decodeMaybe(html);
  return { html, title: title || "", image: image || "" };
}

function qualityFrom(text: string): string {
  return text.match(/\b(2160p|1080p|720p|480p|360p)\b/i)?.[0] || "";
}

export const getMeta = async function ({
  link,
  providerContext,
}: {
  link: string;
  providerContext: ProviderContext;
}): Promise<Info> {
  try {
    const { axios, cheerio, openWebView, commonHeaders } = providerContext;
    const cleanLink = link.replace(/\/$/, "");

    let payload = "";
    try {
      const res = await getWithWAF(
        `${cleanLink}/__data.json`,
        axios,
        openWebView,
        commonHeaders,
      );
      payload = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    } catch {
      const res = await getWithWAF(cleanLink, axios, openWebView, commonHeaders);
      payload = typeof res.data === "string" ? res.data : String(res.data);
    }

    const extracted = extractPostContent(payload);
    let html = extracted.html;
    if (!html) {
      // last resort: whole page
      html = payload;
    }

    const $ = cheerio.load(html);

    let title =
      extracted.title ||
      $(".FxvUNb").first().text().trim() ||
      $('li:contains("Series Name")')
        .text()
        .replace(/.*Series Name:\s*/i, "")
        .trim() ||
      $("h2").first().text().trim() ||
      $("h3").first().text().trim() ||
      "";
    title = title.replace(/\s+/g, " ").replace(/&amp;/g, "&").trim();

    const imdbId =
      $('a[href*="imdb.com/title/"]')
        .attr("href")
        ?.match(/tt\d+/)?.[0] ||
      payload.match(/imdb\.com\/title\/(tt\d+)/)?.[1] ||
      "";

    const synopsis =
      $('li:contains("Stars")')
        .text()
        .replace(/.*Stars:\s*/i, "")
        .trim() ||
      $("p")
        .filter((_, el) => $(el).text().trim().length > 40)
        .first()
        .text()
        .trim() ||
      "";

    let image =
      extracted.image ||
      $('img[src*="tmdb"], img[src*="media-amazon"], img[src*="image.tmdb"]')
        .first()
        .attr("src") ||
      $("img").first().attr("src") ||
      "";

    const type = /season|episode|series|drama|s\d+/i.test(title + " " + html.slice(0, 400))
      ? "series"
      : "movie";

    const links: Link[] = [];
    const seen = new Set<string>();

    $("a[href]").each((_, el) => {
      const href = ($(el).attr("href") || "").trim();
      const text = $(el).text().replace(/\s+/g, " ").trim() || "Link";
      if (!href || !/^https?:\/\//i.test(href)) return;
      if (
        /imdb\.com|t\.me|telegram|instagram|facebook|twitter|catimages\.org|katdrama\.my\/category|katmoviehd|googletagmanager|ignatiapaler/i.test(
          href,
        )
      ) {
        return;
      }
      const useful =
        /(links\.kmhd|kmhd\.|hubcloud|gdflix|drive\.google|pixeldrain|filepress|gofile|mediafire|mega\.nz|send\.cm|xcloud|krakenfiles|filebee|gkycdn)/i.test(
          href,
        ) || /download|pack|file|play|480|720|1080|2160/i.test(text);
      if (!useful) return;
      if (seen.has(href)) return;
      seen.add(href);

      const quality = qualityFrom(text) || qualityFrom(href);
      if (/\/pack\//i.test(href) || /links$/i.test(text)) {
        links.push({ title: text, quality, episodesLink: href });
      } else {
        links.push({
          title: text,
          quality,
          directLinks: [
            {
              title: text,
              link: href,
              type: type === "series" ? "series" : "movie",
            },
          ],
        });
      }
    });

    return {
      title: title || "Untitled",
      synopsis,
      image,
      imdbId,
      type,
      linkList: links,
    };
  } catch (err) {
    console.error("katdrama getMeta error", err);
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
