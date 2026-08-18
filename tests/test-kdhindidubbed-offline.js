/*
 * Offline fixture tests for the kdhindidubbed provider (no network needed).
 *
 * Fixtures are built from the real HTML structures captured from the live
 * site (kdhindidubbed.cfd posts + download pages + kddibba.blogspot.com),
 * so the parsing selectors can be regression-tested without depending on
 * the site.
 *
 * Run: npm run build && node tests/test-kdhindidubbed-offline.js
 */
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const cheerio = require(path.join(ROOT, "node_modules", "cheerio"));

// Shim global fetch so the bundled getBaseUrl resolves urls.json locally
// (raw.githubusercontent.com is blocked in this sandbox).
const localUrls = fs.readFileSync(path.join(ROOT, "urls.json"), "utf8");
globalThis.fetch = (url) => {
  if (String(url).includes("urls.json")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(JSON.parse(localUrls)),
    });
  }
  return Promise.reject(new Error(`fetch not mocked: ${url}`));
};

function loadModule(name) {
  return require(path.join(ROOT, "dist", "kdhindidubbed", `${name}.js`));
}

// ---------- Fixtures (real structures captured from the site) ----------

// Homepage: featured slider + main feed (reconstructed from live markdown)
const listPageHtml = `<!DOCTYPE html><html><head>
<title>KDHindiDubbed</title>
</head><body>
<header>
<nav>
<a href="https://kdhindidubbed.cfd/">HOME</a>
<a href="https://kdhindidubbed.cfd/upcoming-series-list/">Upcoming</a>
<a href="https://t.me/s/KDHindiDubbed1">TELEGRAM</a>
<a href="https://kdhindidubbed.cfd/dmca/">DMCA</a>
<a href="https://kdhindidubbed.cfd/about-us/">ABOUT US</a>
</nav>
</header>
<div class="main-content">
<article class="post">
<a href="https://kdhindidubbed.cfd/my-bias-my-boss-korean-drama-hindi-dubbed-episode/" title="My Bias, My Boss (Korean Drama) Hindi Dubbed [ Episode 5 ADD ]"><img src="https://i0.wp.com/blogger.googleusercontent.com/img/b/AAAA/w640-h360/IMGMBMBKD.webp?fit=640,360&ssl=1" /></a>
<h2 class="post-title"><a href="https://kdhindidubbed.cfd/my-bias-my-boss-korean-drama-hindi-dubbed-episode/">My Bias, My Boss (Korean Drama) Hindi Dubbed [ Episode 5 ADD ]</a></h2>
</article>
<article class="post">
<a href="https://kdhindidubbed.cfd/modern-farmer-korean-drama-hindi-dubbed-episodes/" title="Modern Farmer (Korean Drama) Hindi Dubbed Episodes"><img src="https://i3.wp.com/blogger.googleusercontent.com/img/b/BBBB/w640-h368/IMGMDKDHD.jpg?ssl=1" /></a>
<h2 class="post-title"><a href="https://kdhindidubbed.cfd/modern-farmer-korean-drama-hindi-dubbed-episodes/">Modern Farmer (Korean Drama) Hindi Dubbed Episodes</a></h2>
</article>
<article class="post">
<a href="https://kdhindidubbed.cfd/the-apartment-job-korean-drama-hindi-english-dubbed-episodes/"><img src="https://i0.wp.com/blogger.googleusercontent.com/img/b/CCCC/w640-h360/IMGTAJFDRR.webp?fit=640,360&ssl=1" /></a>
<a href="https://kdhindidubbed.cfd/the-apartment-job-korean-drama-hindi-english-dubbed-episodes/">The Apartment Job (Korean Drama) Hindi, English Dubbed Episodes</a>
</article>
</div>
</body></html>`;

// Series post (The Judge Returns) - real wp-json rendered content structure
const seriesPostHtml = `<!DOCTYPE html><html><head>
<title>The Judge Returns (Korean Drama) Hindi Dubbed Episode - KDHindiDubbed</title>
<meta property="og:title" content="The Judge Returns (Korean Drama) Hindi Dubbed Episode - KDHindiDubbed" />
</head><body>
<article>
<h1 class="entry-title">The Judge Returns (Korean Drama) Hindi Dubbed Episode</h1>
<div class="entry-content">
<div class="separator" style="clear: both; text-align: center;"><a href="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgdlo/s3840/IMGTJRKDHD.webp"><img loading="lazy" decoding="async" title="The Judge Returns (Korean Drama) Hindi Dubbed Episode" src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgdlo/w640-h360/IMGTJRKDHD.webp" width="640" height="360" /></a></div>
<div class="separator" style="clear: both; text-align: center;">
<div class="separator" style="clear: both;"><span style="font-family: Changa;">-: Information :-</span></div>
<div class="separator" style="clear: both;"><span style="font-family: Changa;">Name: The Judge Returns</span></div>
<div class="separator" style="clear: both;"><span style="font-family: Changa;">Season: 1</span></div>
<div class="separator" style="clear: both;"><span style="font-family: Changa;">Episodes: 14</span></div>
<div class="separator" style="clear: both;"><span style="font-family: Changa;">Running time: 64min - 76min</span></div>
<div class="separator" style="clear: both;"><span style="font-family: Changa;">Language: Hindi - Korean</span></div>
<div class="separator" style="clear: both;"><span style="font-family: Changa;">Subtitle: English</span></div>
<div class="separator" style="clear: both;"><span style="font-family: Changa;">Genres: Action, Law, Drama, Fantasy, Mystery</span></div>
<div class="separator" style="clear: both;"><span style="font-family: Changa;">Release Date: 2 January 2026</span></div>
<div class="separator" style="clear: both;"><span style="font-family: Changa;">Country of origin: South Korea</span></div>
<div class="separator" style="clear: both;"><span style="font-family: Changa;">Quality: 720p / 1080p HD</span></div>
<div class="separator" style="clear: both;"><span style="font-family: Changa;">Maximum File Size: 560MB / 2.50GB</span></div>
<div class="separator" style="clear: both;"><hr /></div>
<div class="separator" style="clear: both;">
<div style="clear: both;"><i><span style="font-family: Changa; font-size: x-large;"><b>: SCREEN-SHOTS :</b></span></i></div>
<div class="separator" style="clear: both; text-align: center;"><a href="https://blogger.googleusercontent.com/img/b/scr1/s1280/IMGTJRKDHD%20(1).png"><img src="https://blogger.googleusercontent.com/img/b/scr1/w400-h225/IMGTJRKDHD%20(1).png" /></a></div>
</div>
<hr />
<div style="text-align: center;"><b style="font-family: Changa; font-size: xx-large;">-: 720p HD :-</b></div>
<p style="text-align: center;"><b><a href="https://kdhindidubbed.cfd/ryhutuhjryer4/">DOWNLOAD LINKS</a></b></p>
<hr />
<div style="text-align: center;"><b style="font-family: Changa; font-size: xx-large;">-: 1080p Full HD :-</b></div>
<p style="text-align: center;"><b><a href="https://kdhindidubbed.cfd/dtyiurstyhseryhsru/">DOWNLOAD LINKS</a></b></p>
<hr />
<div style="clear: both;"><b style="font-family: Changa; font-size: xx-large;"><i>Storyline</i><i> :-</i></b></div>
<div style="clear: both;"><span style="font-family: Changa;">Despite coming from a lower-income family and attending a non-prestigious university, Lee Han Yeong longed to rise in the judicial ranks. When he married the daughter of Haenal Law Firm's CEO, he also began a working relationship with her father, using his position as a judge for the firm's benefit. However, as the years went by, Han Yeong's guilty conscience grew stronger, and he eventually defied his orders, sentencing a corrupt chairman to 10 years in prison, only for Han Yeong himself to end up killed. Miraculously, he wakes up to find himself ten years in the past with all his memories intact, and realizes that he has been given a second chance to make things right. With the help of prosecutor Kim Jin A, Han Yeong strives to deliver justice, even in the toughest of times.</span></div>
</div>
</article>
</body></html>`;

// Movie post (Spy x Family Code: White) - external blogger download link
const moviePostHtml = `<!DOCTYPE html><html><head>
<title>White (Movie) Hindi-English-Japanese Dubbed - KDHindiDubbed</title>
</head><body>
<article>
<h1 class="entry-title">Spy x Family Code: White (Movie) Hindi-English-Japanese Dubbed</h1>
<div class="entry-content">
<div style="clear: both; text-align: center;"><a href="https://blogger.googleusercontent.com/img/b/movie/s1920/IMAGE847BUHY80.jpg"><img loading="lazy" decoding="async" alt="Spy x Family Code: White (Movie) Hindi-English-Japanese Dubbed" src="https://blogger.googleusercontent.com/img/b/movie/w640-h360/IMAGE847BUHY80.jpg" width="640" /></a></div>
<div style="clear: both; text-align: center;"><span style="font-family: Changa;">-: Information :-</span></div>
<div style="clear: both; text-align: center;">
<div style="clear: both;"><span style="font-family: Changa;">Name: Spy x Family Code: White</span></div>
<div style="clear: both;"><span style="font-family: Changa;">Running time: 1h:50m</span></div>
<div style="clear: both;"><span style="font-family: Changa;">Language: Hindi-English-Japanese Dubbed</span></div>
<div style="clear: both;"><span style="font-family: Changa;">Subtitle: English</span></div>
<div style="clear: both;"><span style="font-family: Changa;">Genres: Action, Comedy, Suspense, Thriller</span></div>
<div style="clear: both;"><span style="font-family: Changa;">Release Date: 22 December 2023</span></div>
<div style="clear: both;"><span style="font-family: Changa;">Country of origin: Japan</span></div>
<div style="clear: both;"><span style="font-family: Changa;">Quality: 720p HD</span></div>
<div style="clear: both;"><span style="font-family: Changa;">Maximum File Size: 1.10GB</span></div>
</div>
<div style="clear: both;"><i><span style="font-family: Changa; font-size: x-large;"><b>: SCREEN-SHOTS :</b></span></i></div>
<div style="clear: both; text-align: center;"><a href="https://blogger.googleusercontent.com/img/b/scr/s1280/Spy%20x%20Family%20Code%20-%20White%20KDHindiDubbed%20(1).png"><img src="https://blogger.googleusercontent.com/img/b/scr/w400-h225/Spy%20x%20Family%20Code%20-%20White%20KDHindiDubbed%20(1).png" /></a></div>
<div style="clear: both; text-align: center;"><a href="https://blogger.googleusercontent.com/img/b/scr/s1280/Spy%20x%20Family%20Code%20-%20White%20KDHindiDubbed%20(2).png"><img src="https://blogger.googleusercontent.com/img/b/scr/w400-h225/Spy%20x%20Family%20Code%20-%20White%20KDHindiDubbed%20(2).png" /></a></div>
<div style="clear: both; text-align: center;">
<div style="clear: both;"><b style="font-family: Changa; font-size: xx-large;"><a href="https://kddibba.blogspot.com/2024/12/m9yspyxm430ej.html">DOWNLOAD LINKS</a></b></div>
<div style="clear: both;"><b style="font-family: Changa; font-size: xx-large;"><i>Storyline</i><i> :-</i></b></div>
<div style="clear: both;"><span style="font-family: Changa;">Loid Forger, an elite spy, is warned by his handler that he may potentially be reassigned from his ongoing mission, Operation Strix. To maintain his position, he must make significant progress toward the operation's objectives, which involves having his adoptive daughter Anya earn sufficient Stella Stars to become an Imperial Scholar at Eden Academy.</span></div>
</div>
</div>
</article>
</body></html>`;

// On-site series download page (The Judge Returns 720p) - real structure
const downloadPageHtml = `<!DOCTYPE html><html><head><title>The Judge Returns - KDHindiDubbed</title></head><body>
<article><div class="entry-content">
<h1 class="entry-title">The Judge Returns</h1>
<p><em>Episode - 01</em></p>
<p><a href="https://new9.xcloud.asia/535020fc7a2c445">XCloud</a>&nbsp;<a href="https://gkycdn.site/file/198563789">GKYFILEHOST</a>&nbsp;<a href="https://fpgo.xyz/file/6a774884ecbe9f1114d77437">Telegram</a>&nbsp;<a href="https://kdhindifree.strp2p.live/#yjmgrf">StreamLink1</a>&nbsp;<a href="https://kdpikapika.rpmvid.site/#oezyy5">StreamLink2</a></p>
<hr />
<p><em>Episode - 02</em></p>
<p><a href="https://new9.xcloud.asia/345b7dab4f6dcf7">XCloud</a>&nbsp;<a href="https://gkycdn.site/file/305819827">GKYFILEHOST</a>&nbsp;<a href="https://fpgo.xyz/file/6a774885ecbe9f1114d77491">Telegram</a>&nbsp;<a href="https://kdhindifree.strp2p.live/#1lr5f6">StreamLink1</a>&nbsp;<a href="https://kdpikapika.rpmvid.site/#ai1ps5">StreamLink2</a></p>
<hr />
<p><em>Episode - 03</em></p>
<p><a href="https://new9.xcloud.asia/f0f47d4d354698f">XCloud</a>&nbsp;<a href="https://gkycdn.site/file/731227507">GKYFILEHOST</a>&nbsp;<a href="https://fpgo.xyz/file/6a774886ecbe9f1114d774d4">Telegram</a>&nbsp;<a href="https://kdhindifree.strp2p.live/#3pl6gf">StreamLink1</a>&nbsp;<a href="https://kdpikapika.rpmvid.site/#oezyxv">StreamLink2</a></p>
</div></article>
</body></html>`;

// Blogger movie download page (Spy x Family) - real structure
const bloggerPageHtml = `<!DOCTYPE html><html><head><title>Spy x Family Code: White</title></head><body>
<div class="post-body entry-content">
<div class="separator" style="clear: both; text-align: center;"><b><i>- 720p HD -</i></b></div>
<p><a href="https://hubcloud.art/video/zuhrxcr688i1v1r">HubCloud</a><br />
<a href="https://hellabyte.one/drive/s/6764f483a3fb848ac13bbc92">HellaByte</a><br />
<a href="https://1024terabox.com/sharing/embed?surl=mWlbg9hzl9mtxBxU-GyLfg&resolution=720&autoplay=true&mute=false&uk=4401682733034&fid=769556366552662">TeraBox</a><br />
<a href="https://filemoon.in/e/ecmpdtej0y1u">FileMoon</a><br />
<a href="https://filebee.xyz/file/6764f45c6c8ffe681c8cd196">FilePress</a><br />
<a href="https://gdmirrorbot.nl/embed/vjr5uq9">GDMirrorBot</a></p>
</div>
</body></html>`;

// vcloud page for hubcloud extractor chain
const hubcloudDrivePage = `<html><body>
<script>var url = atob(atob('${Buffer.from(Buffer.from("https://vcloud.test/dl").toString("base64")).toString("base64")}'))</script>
</body></html>`;
const vcloudPage = `<html><body>
<a class="btn-success btn-lg h6" href="https://example.com/video.mkv">Download</a>
</body></html>`;

// ---------- Fake axios / fetch serving the fixtures ----------
const routes = {
  "https://kdhindidubbed.cfd/": listPageHtml,
  "https://kdhindidubbed.cfd/page/2/": listPageHtml,
  "https://kdhindidubbed.cfd/category/korean-drama/page/1/": listPageHtml,
  "https://kdhindidubbed.cfd/?s=judge": listPageHtml,
  "https://kdhindidubbed.cfd/the-judge-returns-korean-drama-hindi-dubbed-episode/": seriesPostHtml,
  "https://kdhindidubbed.cfd/spy-x-family-code-white-movie-hindi-english-japanese-dubbed/": moviePostHtml,
  "https://kdhindidubbed.cfd/ryhutuhjryer4/": downloadPageHtml,
  "https://kdhindidubbed.cfd/dtyiurstyhseryhsru/": downloadPageHtml,
  "https://kddibba.blogspot.com/2024/12/m9yspyxm430ej.html": bloggerPageHtml,
  "https://hubcloud.art/video/zuhrxcr688i1v1r": hubcloudDrivePage,
  "https://new9.xcloud.asia/535020fc7a2c445": hubcloudDrivePage,
  "https://gkycdn.site/file/198563789": `<html><body><h1>The Judge Returns-S1.E01-Hin.Kor.DUB.ESUB-720p-KDHindiDubbed.mkv</h1><p>File Size 521.61 MB</p></body></html>`,
  "https://fpgo.xyz/file/6a774884ecbe9f1114d77437": `<html><body><p>Loading...</p><a href="https://cdn.fpgo.example/direct/telegram.mp4">Direct</a></body></html>`,
};

const fakeAxios = Object.assign(
  (url) => fakeAxios.get(url),
  {
    get: (url) => {
      let clean = String(url).split("#")[0];
      if (routes[clean]) return Promise.resolve({ data: routes[clean] });
      if (!clean.endsWith("/")) {
        const withSlash = clean + "/";
        if (routes[withSlash]) return Promise.resolve({ data: routes[withSlash] });
      }
      return Promise.reject(new Error(`No fixture for ${clean}`));
    },
  },
);

const fakeFetch = (url, opts) => {
  const u = String(url);
  if (u.includes("urls.json")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(JSON.parse(localUrls)),
    });
  }
  if (u.includes("vcloud.test")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      text: async () => vcloudPage,
      headers: { get: () => null },
      url: u,
    });
  }
  return Promise.reject(new Error(`fetch not mocked: ${u}`));
};
globalThis.fetch = fakeFetch;

const providerContext = {
  axios: fakeAxios,
  cheerio,
  commonHeaders: { "User-Agent": "test" },
};

// ---------- Tests ----------
let passed = 0;
let failed = 0;
function check(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}`, extra !== undefined ? JSON.stringify(extra) : "");
  }
}

(async () => {
  console.log("\n--- getPosts (homepage) ---");
  const { getPosts } = loadModule("posts");
  const posts = await getPosts({
    filter: "",
    page: 1,
    providerValue: "kdhindidubbed",
    signal: new AbortController().signal,
    providerContext,
  });
  console.log("  posts:", posts.map((p) => `${p.title} | ${p.link}`).join("\n         "));
  check("returns 3 unique posts", posts.length === 3, posts.length);
  check(
    "my-bias-my-boss with image",
    posts.some((p) => p.link.includes("my-bias-my-boss") && p.image.includes("IMGMBMBKD.webp")),
  );
  check(
    "title present on all posts",
    posts.every((p) => p.title.length > 0),
    posts.map((p) => p.title),
  );
  check(
    "nav pages filtered (upcoming/dmca/about)",
    !posts.some((p) => /upcoming-series|dmca|about-us/.test(p.link)),
  );
  check(
    "telegram filtered",
    !posts.some((p) => p.link.includes("t.me")),
  );

  console.log("\n--- getSearchPosts ---");
  const { getSearchPosts } = loadModule("posts");
  const searchPosts = await getSearchPosts({
    searchQuery: "judge",
    page: 1,
    providerValue: "kdhindidubbed",
    signal: new AbortController().signal,
    providerContext,
  });
  check("search posts parsed", searchPosts.length === 3, searchPosts.length);

  console.log("\n--- getMeta (series) ---");
  const { getMeta } = loadModule("meta");
  const meta = await getMeta({
    link: "https://kdhindidubbed.cfd/the-judge-returns-korean-drama-hindi-dubbed-episode/",
    providerContext,
  });
  console.log("  meta:", JSON.stringify(meta, null, 1).slice(0, 700));
  check("title = The Judge Returns", meta.title === "The Judge Returns", meta.title);
  check("type series", meta.type === "series", meta.type);
  check("tags from Genres line", meta.tags.includes("Action") && meta.tags.includes("Mystery"), meta.tags);
  check("image", meta.image.includes("IMGTJRKDHD.webp"), meta.image);
  check(
    "synopsis from storyline",
    meta.synopsis.includes("Lee Han Yeong longed to rise"),
    meta.synopsis.slice(0, 80),
  );
  check("2 download links", meta.linkList.length === 2, meta.linkList);
  check(
    "720p entry points to ryhutuhjryer4",
    meta.linkList.some((l) => l.title.includes("720p") && l.episodesLink === "https://kdhindidubbed.cfd/ryhutuhjryer4/"),
    meta.linkList,
  );
  check(
    "1080p entry points to dtyiurstyhseryhsru",
    meta.linkList.some((l) => l.title.includes("1080p") && l.episodesLink === "https://kdhindidubbed.cfd/dtyiurstyhseryhsru/"),
  );

  console.log("\n--- getMeta (movie) ---");
  const metaMovie = await getMeta({
    link: "https://kdhindidubbed.cfd/spy-x-family-code-white-movie-hindi-english-japanese-dubbed/",
    providerContext,
  });
  console.log("  movie meta:", JSON.stringify({ title: metaMovie.title, type: metaMovie.type, tags: metaMovie.tags, links: metaMovie.linkList }, null, 1));
  check("movie title", metaMovie.title.includes("Spy x Family Code: White"), metaMovie.title);
  check("type movie", metaMovie.type === "movie", metaMovie.type);
  check(
    "movie download -> blogger directLinks",
    metaMovie.linkList.length === 1 &&
      metaMovie.linkList[0].directLinks?.[0]?.link === "https://kddibba.blogspot.com/2024/12/m9yspyxm430ej.html",
    metaMovie.linkList,
  );

  console.log("\n--- getEpisodes (on-site download page) ---");
  const { getEpisodes } = loadModule("episodes");
  const episodes = await getEpisodes({
    url: "https://kdhindidubbed.cfd/ryhutuhjryer4/",
    providerContext,
  });
  console.log("  episodes:", episodes.map((e) => `${e.title} -> ${e.link}`).join("\n            "));
  check("3 episodes found", episodes.length === 3, episodes.length);
  check(
    "episode 01 links to xcloud",
    episodes[0].title === "Episode 01" && episodes[0].link.includes("xcloud.asia/535020fc7a2c445"),
    episodes[0],
  );

  console.log("\n--- getStream (xcloud) ---");
  const { getStream } = loadModule("stream");
  const xcloudStreams = await getStream({
    link: "https://new9.xcloud.asia/535020fc7a2c445",
    type: "series",
    signal: new AbortController().signal,
    providerContext,
  });
  console.log("  xcloud:", JSON.stringify(xcloudStreams).slice(0, 200));
  check(
    "xcloud resolves to direct mkv",
    xcloudStreams.length === 1 && xcloudStreams[0].link.includes("example.com/video.mkv"),
    xcloudStreams,
  );

  console.log("\n--- getStream (blogger page) ---");
  const bloggerStreams = await getStream({
    link: "https://kddibba.blogspot.com/2024/12/m9yspyxm430ej.html",
    type: "movie",
    signal: new AbortController().signal,
    providerContext,
  });
  console.log("  blogger ->", JSON.stringify(bloggerStreams).slice(0, 200));
  check(
    "blogger page resolves best host (hubcloud)",
    bloggerStreams.length === 1 && bloggerStreams[0].link.includes("example.com/video.mkv"),
    bloggerStreams,
  );

  console.log("\n--- getStream (file host fallback) ---");
  const gkyStreams = await getStream({
    link: "https://gkycdn.site/file/198563789",
    type: "series",
    signal: new AbortController().signal,
    providerContext,
  });
  check(
    "gkycdn falls back to external",
    gkyStreams.length === 1 && gkyStreams[0].server.includes("gkycdn"),
    gkyStreams,
  );

  console.log("\n--- getStream (dood-style filemoon) ---");
  const filemoonRes = await getStream({
    link: "https://filemoon.in/e/ecmpdtej0y1u",
    type: "movie",
    signal: new AbortController().signal,
    providerContext,
  });
  check(
    "filemoon falls back to external",
    filemoonRes.length === 1 && filemoonRes[0].server.includes("filemoon"),
    filemoonRes,
  );

  console.log("\n--- getStream (streamlink JS player) ---");
  const streamLinkRes = await getStream({
    link: "https://kdhindifree.strp2p.live/#yjmgrf",
    type: "series",
    signal: new AbortController().signal,
    providerContext,
  });
  check(
    "strp2p falls back to external",
    streamLinkRes.length === 1 && streamLinkRes[0].link.includes("strp2p.live"),
    streamLinkRes,
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("TEST CRASH:", e);
  process.exit(1);
});
