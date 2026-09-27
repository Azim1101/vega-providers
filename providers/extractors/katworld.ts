import { Info, Link, Post, ProviderContext, Stream } from "../types";
import { getBaseUrl } from "../getBaseUrl";
import { throwProviderError } from "../providerErrors";
import {
  addCinemetaContext,
  applyCinemetaMeta,
  enrichCinemetaEpisodes,
  getCinemetaMeta,
  getCinemetaSeason,
} from "../getCinemetaMeta";
import { hubcloudExtractor } from "./hubcloud";
import { gdflixExtractor } from "./gdflix";

async function getWithWAF(
  url: string,
  axios: any,
  openWebView: any,
  headers: any,
  customHeaders?: any,
): Promise<any> {
  const baseUrl = url.split("/").slice(0, 3).join("/");
  const mergedHeaders = { ...headers, ...customHeaders, Referer: baseUrl };
  try {
    return await axios.get(url, { headers: mergedHeaders });
  } catch (error: any) {
    if (error.response?.status === 403 && openWebView) {
      console.log(`WAF detected (403) for ${url}, using solver...`);
      const wafResult = await openWebView(baseUrl, {
        title: "Solve the captcha below and click done",
        description: "Required to bypass anti-bot protection.",
        headers: mergedHeaders,
        force: true,
        waitForCookie: "cf_clearance",
      });
      return await axios.get(url, {
        headers: {
          ...mergedHeaders,
          Cookie:
            (mergedHeaders.Cookie ? mergedHeaders.Cookie + "; " : "") +
            wafResult.cookies,
        },
      });
    }
    throw error;
  }
}

export async function katworldGetPosts({
  urlKey,
  providerName,
  filter,
  page,
  signal,
  providerContext,
}: {
  urlKey: string;
  providerName: string;
  filter: string;
  page: number;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Post[]> {
  const { cheerio, axios, openWebView, commonHeaders } = providerContext;
  const baseUrl = await getBaseUrl(urlKey);
  const url = `${baseUrl + filter}/page/${page}/`;
  try {
    const res = await getWithWAF(url, axios, openWebView, commonHeaders);
    const $ = cheerio.load(res.data);
    const catalog: Post[] = [];
    $(".recent-posts")
      .children()
      .map((i, element) => {
        const title = $(element).find("img").attr("alt");
        const link = $(element).find("a").attr("href");
        const image = $(element).find("img").attr("src");
        if (title && link && image) {
          const postUrl = new URL(link, `${baseUrl}/`);
          catalog.push({
            title: title.replace("Download", "").trim(),
            link: `${postUrl.pathname}${postUrl.search}${postUrl.hash}`,
            image: image,
          });
        }
      });
    return catalog;
  } catch (err) {
    throwProviderError(providerName, "posts", err);
  }
}

export async function katworldSearchPosts({
  urlKey,
  providerName,
  searchQuery,
  page,
  signal,
  providerContext,
}: {
  urlKey: string;
  providerName: string;
  searchQuery: string;
  page: number;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Post[]> {
  const { cheerio, axios, openWebView, commonHeaders } = providerContext;
  const baseUrl = await getBaseUrl(urlKey);
  const url = `${baseUrl}/page/${page}/?s=${searchQuery}`;
  try {
    const res = await getWithWAF(url, axios, openWebView, commonHeaders);
    const $ = cheerio.load(res.data);
    const catalog: Post[] = [];
    $(".recent-posts")
      .children()
      .map((i, element) => {
        const title = $(element).find("img").attr("alt");
        const link = $(element).find("a").attr("href");
        const image = $(element).find("img").attr("src");
        if (title && link && image) {
          const postUrl = new URL(link, `${baseUrl}/`);
          catalog.push({
            title: title.replace("Download", "").trim(),
            link: `${postUrl.pathname}${postUrl.search}${postUrl.hash}`,
            image: image,
          });
        }
      });
    return catalog;
  } catch (err) {
    throwProviderError(providerName, "search", err);
  }
}

export async function katworldGetMeta({
  urlKey,
  providerName,
  link,
  providerContext,
}: {
  urlKey: string;
  providerName: string;
  link: string;
  providerContext: ProviderContext;
}): Promise<Info> {
  try {
    const { axios, cheerio, openWebView, commonHeaders } = providerContext;
    const baseUrl = await getBaseUrl(urlKey);
    const url = new URL(link, `${baseUrl}/`).href;
    const res = await getWithWAF(url, axios, openWebView, commonHeaders);
    const $ = cheerio.load(res.data);
    const container = $(".yQ8hqd.ksSzJd.LoQAYe").html()
      ? $(".yQ8hqd.ksSzJd.LoQAYe")
      : $(".FxvUNb");
    const imdbId =
      container
        .find('a[href*="imdb.com/title/tt"]:not([href*="imdb.com/title/tt/"])')
        .attr("href")
        ?.split("/")[4] || "";
    const title = container
      .find('li:contains("Name")')
      .children()
      .remove()
      .end()
      .text();
    const type = $(".yQ8hqd.ksSzJd.LoQAYe").html() ? "series" : "movie";
    const synopsis = container.find('li:contains("Stars")').text();
    const image =
      $('h4:contains("SCREENSHOTS")').next().find("img").attr("src") || "";

    const links: Link[] = [];
    const directLink: Link["directLinks"] = [];

    $(".entry-content")
      .find('p:contains("Episode")')
      .each((i, element) => {
        const dlLink =
          $(element)
            .nextAll("h3,h2")
            .first()
            .find('a:contains("1080"),a:contains("720"),a:contains("480")')
            .attr("href") || "";
        const dlTitle = $(element).find("span").text();
        if (dlLink.trim().length > 0 && dlTitle.includes("Episode ")) {
          directLink.push({ title: dlTitle, link: dlLink });
        }
      });

    if (directLink.length > 0) {
      links.push({ quality: "", title, directLinks: directLink });
    }

    $(".entry-content")
      .find("pre")
      .nextUntil("div")
      .filter("h2")
      .each((i, element) => {
        const link = $(element).find("a").attr("href");
        const quality =
          $(element).text().match(/\b(480p|720p|1080p|2160p)\b/i)?.[0] || "";
        const title = $(element).text();
        if (link && title.includes("")) {
          links.push({ quality, title, episodesLink: link });
        }
      });

    if (links.length === 0 && type === "movie") {
      $(".entry-content")
        .find('h2:contains("DOWNLOAD"),h3:contains("DOWNLOAD")')
        .nextUntil("pre,div")
        .filter("h2")
        .each((i, element) => {
          const link = $(element).find("a").attr("href");
          const quality =
            $(element).text().match(/\b(480p|720p|1080p|2160p)\b/i)?.[0] || "";
          const title = $(element).text();
          if (link && !title.includes("Online")) {
            links.push({
              quality,
              title,
              directLinks: [{ link, title, type: "movie" }],
            });
          }
        });
    }

    const websiteInfo: Info = {
      title,
      synopsis,
      image,
      imdbId: "",
      type,
      linkList: links,
      webUrl: url,
    };
    if (!imdbId) return websiteInfo;

    const cinemeta = await getCinemetaMeta(imdbId, type, providerContext);
    if (type === "series" && cinemeta.type === "series") {
      websiteInfo.linkList = websiteInfo.linkList.map((item) => {
        const season = getCinemetaSeason(item.title) || getCinemetaSeason(title);
        if (!season) return item;
        if (item.directLinks) {
          return {
            ...item,
            directLinks: enrichCinemetaEpisodes(
              item.directLinks,
              cinemeta.videos || [],
              season,
            ),
          };
        }
        if (item.episodesLink) {
          return {
            ...item,
            episodesLink: addCinemetaContext(
              new URL(item.episodesLink, url).href,
              imdbId,
              season,
            ),
          };
        }
        return item;
      });
    }
    return applyCinemetaMeta(websiteInfo, cinemeta);
  } catch (err) {
    throwProviderError(providerName, "metadata", err);
  }
}

async function extractKmhdLink(
  katlink: string,
  providerContext: ProviderContext,
) {
  const { axios, openWebView, commonHeaders } = providerContext;
  const res = await getWithWAF(katlink, axios, openWebView, commonHeaders, {
    Cookie: "unlocked=true",
  });
  const data = res.data;
  const hubDriveRes = data.match(/hubdrive_res:\s*"([^"]+)"/)?.[1] || "";
  const hubDriveLink = data.match(
    /hubdrive_res\s*:\s*\{[^}]*?link\s*:\s*"([^"]+)"/,
  )?.[1] || "";
  return hubDriveLink + hubDriveRes;
}

export async function katworldGetStream({
  providerName,
  link,
  signal,
  providerContext,
}: {
  providerName: string;
  link: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Stream[]> {
  const { axios, cheerio, commonHeaders, openWebView } = providerContext;
  const streamLinks: Stream[] = [];
  console.log(`${providerName} getStream`, link);
  try {
    if (link.includes("gdflix")) {
      return await gdflixExtractor(
        link,
        signal,
        axios,
        cheerio,
        commonHeaders,
        providerContext,
      );
    }
    if (link.includes("kmhd")) {
      const hubcloudLink = await extractKmhdLink(link, providerContext);
      return await hubcloudExtractor(
        hubcloudLink,
        signal,
        axios,
        cheerio,
        commonHeaders,
      );
    }
    const res = await getWithWAF(link, axios, openWebView, commonHeaders, {
      Cookie: "unlocked=true",
    });
    const $ = cheerio.load(res.data);
    const container = $(".yQ8hqd.ksSzJd.LoQAYe").html()
      ? $(".yQ8hqd.ksSzJd.LoQAYe")
      : $(".FxvUNb");

    const downloadLinks: { title: string; link: string }[] = [];
    container.find('a[href*="hubcloud"],a[href*="gdflix"],a[href*="kmhd"]').each((_, el) => {
      const href = $(el).attr("href") || "";
      const title = $(el).text().trim() || "Download";
      if (href) downloadLinks.push({ title, link: href });
    });

    if (downloadLinks.length === 0) {
      container.find("a").each((_, el) => {
        const href = $(el).attr("href") || "";
        if (href.includes("hubcloud") || href.includes("gdflix") || href.includes("kmhd") || href.includes("drive")) {
          downloadLinks.push({ title: $(el).text().trim(), link: href });
        }
      });
    }

    for (const dl of downloadLinks) {
      try {
        if (dl.link.includes("gdflix")) {
          const streams = await gdflixExtractor(
            dl.link,
            signal,
            axios,
            cheerio,
            commonHeaders,
            providerContext,
          );
          streamLinks.push(...streams);
        } else if (dl.link.includes("kmhd")) {
          const hubcloudLink = await extractKmhdLink(dl.link, providerContext);
          const streams = await hubcloudExtractor(
            hubcloudLink,
            signal,
            axios,
            cheerio,
            commonHeaders,
          );
          streamLinks.push(...streams);
        } else if (dl.link.includes("hubcloud")) {
          const streams = await hubcloudExtractor(
            dl.link,
            signal,
            axios,
            cheerio,
            commonHeaders,
          );
          streamLinks.push(...streams);
        }
      } catch (e) {
        console.error(`${providerName} stream extraction error:`, e);
      }
    }

    return streamLinks;
  } catch (err) {
    throwProviderError(providerName, "stream", err);
  }
}
