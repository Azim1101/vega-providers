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

function qualityFrom(text: string): string {
  return text.match(/\b(2160p|1080p|720p|480p|360p)\b/i)?.[0] || "";
}

function cleanText(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/&#8211;/g, "–")
    .trim();
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
    const res = await getWithWAF(link, axios, openWebView, commonHeaders);
    const $ = cheerio.load(res.data);
    const pageHtml = $.html();

    const title =
      cleanText($("h1.entry-title").text() || $("h1").first().text()) ||
      cleanText($("title").text());

    let synopsis = "";
    $(".entry-content p, .post-content p, article .entry-content p").each(
      (_, el) => {
        if (synopsis) return;
        const t = cleanText($(el).text());
        if (t.length > 40 && !/download|telegram|how to|join/i.test(t)) {
          synopsis = t;
        }
      },
    );

    let image =
      $(".entry-content img, .post-thumb img, article img")
        .filter((_, el) => {
          const src = $(el).attr("src") || "";
          return !!src && !/logo|icon|svg|emoji|telegram/i.test(src);
        })
        .first()
        .attr("src") ||
      $("meta[property='og:image']").attr("content") ||
      "";

    const imdbId =
      $('a[href*="imdb.com/title/"]')
        .attr("href")
        ?.match(/tt\d+/)?.[0] || "";

    const type = /episode|season|drama|series/i.test(title + " " + synopsis)
      ? "series"
      : "movie";

    const links: Link[] = [];
    const seen = new Set<string>();

    // onclick buttons -> archive pages
    const onclickRe = /window\.location\.href\s*=\s*['"]([^'"]+)['"]/gi;
    let m: RegExpExecArray | null;
    while ((m = onclickRe.exec(pageHtml))) {
      const href = m[1];
      if (seen.has(href)) continue;
      if (!/archives\/\d+|kdramasmaza\.com\.pk/i.test(href)) continue;
      seen.add(href);
      const around = pageHtml.slice(Math.max(0, m.index - 160), m.index + 80);
      const btnText =
        around.match(/>([^<>]{2,80})<\/button>/i)?.[1]?.trim() ||
        (/zip/i.test(around)
          ? "Zip Download"
          : /episode/i.test(around)
            ? "All Episodes"
            : "Download");
      links.push({
        title: cleanText(btnText),
        quality: qualityFrom(btnText),
        episodesLink: href,
      });
    }

    // anchors only if archive/hoster and not random posts
    $("a[href]").each((_, el) => {
      const href = ($(el).attr("href") || "").trim();
      const text = cleanText($(el).text() || $(el).find("button").text());
      if (!href) return;
      const abs = href.startsWith("http")
        ? href
        : new URL(href, link).toString();
      if (seen.has(abs)) return;
      if (
        /how-to-download|telegram|t\.me|facebook|twitter|instagram|wordpress|\/category\/|\/tag\//i.test(
          abs,
        )
      ) {
        return;
      }
      // Ignore same-site drama post links that aren't archive download pages
      if (
        abs.includes("kdramasmaza.net") &&
        !/archives\//i.test(abs) &&
        abs.replace(/\/$/, "") !== link.replace(/\/$/, "")
      ) {
        return;
      }
      const isArchive = /archives\/\d+/i.test(abs) || /kdramasmaza\.com\.pk\/archives/i.test(abs);
      const isHoster =
        /(hubcloud|gdflix|send\.cm|drive\.google|pixeldrain|mediafire|mega\.nz)/i.test(
          abs,
        );
      if (!isArchive && !isHoster) return;
      seen.add(abs);
      if (isArchive) {
        links.push({
          title: text || "Download",
          quality: qualityFrom(text),
          episodesLink: abs,
        });
      } else {
        links.push({
          title: text || "Link",
          quality: qualityFrom(text),
          directLinks: [
            {
              title: text || "Link",
              link: abs,
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
    console.error("kdramasmaza getMeta error", err);
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
