/*
 * Offline fixture tests for the kdramasmaza provider (no network needed).
 *
 * Fixtures are built from the real HTML structures captured from the live
 * site (kdramasmaza.net posts + kdramasmaza.com.pk archives pages), so the
 * parsing selectors can be regression-tested without depending on the site.
 *
 * Run: npm run build && node tests/test-kdramasmaza-offline.js
 */
const path = require("path");

const ROOT = path.join(__dirname, "..");
const cheerio = require(path.join(ROOT, "node_modules", "cheerio"));

// Shim global fetch so the bundled getBaseUrl resolves urls.json locally
// (raw.githubusercontent.com is blocked in this sandbox).
const fs = require("fs");
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
  return require(path.join(ROOT, "dist", "kdramasmaza", `${name}.js`));
}

// ---------- Fixtures (real structures captured from the site) ----------

// Detail page: new format series (The Judge Returns) - real content HTML
const detailSeriesHtml = `<!DOCTYPE html><html><head>
<title>The Judge Returns [Korean Drama] in Urdu Hindi Dubbed - Complete All Episodes - KDramas Maza</title>
<meta property="og:title" content="The Judge Returns [Korean Drama] in Urdu Hindi Dubbed - Complete All Episodes - KDramas Maza" />
<meta property="og:image" content="https://i0.wp.com/kdramasmaza.net/wp-content/uploads/2026/08/The-Judge-Returns.png?fit=1672%2C941&ssl=1" />
</head><body>
<article>
<h1 class="entry-title">The Judge Returns [Korean Drama] in Urdu Hindi Dubbed - Complete All Episodes - KDramas Maza</h1>
<div class="entry-content">
<p>The return of corrupt judge Lee Han-young, who was a slave to a large law firm, to the past 10 years ago. He makes new choices to punish evil and implement justice.<br />
Title: The Judge Returns<br />
Type: Drama<br />
Format: Standard Series<br />
Country: South Korea<br />
Episodes: 14<br />
Aired: Jan 2, 2026 &ndash; Feb 14, 2026<br />
Duration: 1 hr. 10 min.<br />
Content Rating: 15+ &ndash; Teens 15 or older<br />
Native Title: 판사 이한영<br />
Also Known As: Judge Lee Han Yeong , Pansa Lee Han Yeong<br />
Director: Lee Jae Jin<br />
Genres: Action, Law, Drama, Fantasy</p>
<h2>Download The Judge Returns [Korean Drama] in Urdu Hindi Dubbed &ndash; Complete All Episodes</h2>
<p style="text-align: center;"><button onclick="window.location.href='https://kdramasmaza.com.pk/archives/4985'" class="button-78">Zip Download!</button></p>
<p style="text-align: center;"><button onclick="window.location.href='https://kdramasmaza.com.pk/archives/4983'" class="button-45">All Episodes Wise</button></p>
<div class="download-buttons">
<div class="button-container">
<a href="/how-to-download-from-kdramas-maza/" target="_blank" rel="noopener"><button class="button-001">How To Download</button></a><br />
<a href="https://t.me/kdramashindipro" target="_blank" rel="noopener nofollow"><button class="button-002">Join Telegram</button></a>
</div>
</div>
</div>
</article>
</body></html>`;

// Detail page: old format movie (Art of Fighting) - real content HTML
const detailMovieHtml = `<!DOCTYPE html><html><head>
<title>Art of Fighting 2019 Korean Movie in Hindi Dubbed - 480p [550MB] 720p [950MB] 1080p [1.9GB] - KDramas Maza</title>
<meta property="og:image" content="https://i0.wp.com/kdramasmaza.net/wp-content/uploads/2023/12/Art-of-fighting.jpg?fit=1280%2C720&ssl=1" />
</head><body>
<article>
<h1 class="entry-title">Art of Fighting 2019 Korean Movie in Hindi Dubbed &ndash; 480p [550MB] 720p [950MB] 1080p [1.9GB] &ndash; KDramas Maza</h1>
<div class="entry-content">
<p>Art of Fighting 2019 Korean Movie in Hindi Dubbed. Art of Fighting is a Korean Action Drama Sci-fi Movie which is now dubbed by Amazon. Art of Fighting in Hindi Dubbed is now available on Amazon. You can Watch and Download the drama in Hindi Dubbed. I highly recommend you to watch this movie.</p>
<h2>DETAILS:</h2>
<p><strong>Drama</strong>: South Korean<br />
<strong>Duration</strong>: 1 hr. 12 min.<br />
<strong>Content Rating</strong>: 18+ Restricted (violence &amp; profanity)<br />
<strong>Aired</strong>: Dec 19, 2019<br />
<strong>Also Known as</strong>: ssaumeui gisul , Ssaumui Gisul, The Techniques of Fighting<br />
<strong>Genres</strong>: Action, Youth, Martial Arts</p>
<h2>Storyline:</h2>
<p>In a small corner of Deoksang High, Geon Woo enters the scene like a whirlwind.</p>
<h2>Download Art of Fighting 2019 Korean Movie in Hindi Dubbed</h2>
<p style="text-align: center;"><button onclick="window.location.href='https://kdramasmaza.com.pk/archives/1169'" class="button-78">Download Links</button></p>
<div style="font-size: medium; text-align: center;"><b>How to Download:</b><br />
Visit <a href="/how-to-download-from-kdramas-maza/" target="_blank" rel="noopener">HERE</a> to watch Video Tutorial</div>
</div>
</article>
</body></html>`;

// Archives page: new format (episode list) - real content HTML (post 4983)
const archivesSeriesHtml = `<!DOCTYPE html><html><head><title>KDramas Maza</title></head><body>
<article><div class="entry-content">
<div class="episode-list">
<div class="episode-row"><span class="ep-no">Episode 01</span><a href="https://dtflix.ink/share/1AA3F304" target="_blank" rel="noopener"><button class="button-123">Dotflix</button></a><a href="https://hubcloud.cx/drive/s74hslromcmfmab" target="_blank" rel="noopener"><button class="button-123">HubCloud</button></a><a href="https://send.cm/367n4pnp55cl" target="_blank" rel="noopener"><button class="button-123">Sendcm</button></a></div>
<div class="episode-row"><span class="ep-no">Episode 02</span><a href="https://dtflix.ink/share/3A9476AB" target="_blank" rel="noopener"><button class="button-123">Dotflix</button></a><a href="https://hubcloud.cx/drive/njn96mz1mmxmvks" target="_blank" rel="noopener"><button class="button-123">HubCloud</button></a><a href="https://send.cm/jg2nhsd153rh" target="_blank" rel="noopener"><button class="button-123">Sendcm</button></a></div>
<div class="episode-row"><span class="ep-no">Episode 03</span><a href="https://dtflix.ink/share/D2502934" target="_blank" rel="noopener"><button class="button-123">Dotflix</button></a><a href="https://hubcloud.cx/drive/qlsofslizixs6ij" target="_blank" rel="noopener"><button class="button-123">HubCloud</button></a><a href="https://send.cm/i6wb9l32p22t" target="_blank" rel="noopener"><button class="button-123">Sendcm</button></a></div>
</div>
</div></article>
</body></html>`;

// Archives page: old format (quality sections) - real content HTML (post 1169)
const archivesMovieHtml = `<!DOCTYPE html><html><head><title>KDramas Maza</title></head><body>
<article><div class="entry-content">
<div style="text-align: center;">
<h2>480p Links [MB]</h2>
<p><b><span style="font-size: medium; font-size: 18px;"><br />
  <a href="https://send.cm/d/oaiA" target="_blank" rel="noopener">Sendcm</a><br />
  <a href="https://dood.li/d/50864fsu83vq" target="_blank" rel="noopener">Doodstm</a><br />
  <a href="https://uploadever.in/d/3vMz" target="_blank" rel="noopener">UploadE</a><br />
  <a href="https://media.cm/u/4SN5" target="_blank" rel="noopener">Stream</a></span></b>
  </div>
<div style="text-align: center;">
<h2>720p x264 Links [MB]</h2>
<p><b><span style="font-size: medium; font-size: 18px;"><br />
  <a href="https://send.cm/d/oaiE" target="_blank" rel="noopener">Sendcm</a><br />
  <a href="https://dood.li/d/yozrk4qrw0dc" target="_blank" rel="noopener">Doodstm</a><br />
  <a href="https://media.cm/u/4SN7" target="_blank" rel="noopener">Stream</a></span></b>
  </div>
</div></article>
</body></html>`;

// Homepage / category / search list pages (structure reconstructed from
// the rendered markdown of the live homepage, page 2 and search results)
const listPageHtml = `<!DOCTYPE html><html><head><title>KDramas Maza</title></head><body>
<header>
<nav>
<a href="https://kdramasmaza.net/">Home</a>
<a href="https://kdramasmaza.net/category/korean-dramas-in-urdu-hindi-dubbed/">Korean Dramas</a>
<a href="https://kdramasmaza.net/category/chinese-dramas-in-urdu-hindi-dubbed/">Chinese Dramas</a>
<a href="https://kdramasmaza.net/how-to-download-from-kdramas-maza/">How to Download</a>
<a href="https://t.me/kdramashindipro">Telegram</a>
</nav>
</header>
<div id="home-content">
<ul class="posts-grid">
<li>
<a href="https://kdramasmaza.net/my-bias-my-boss-korean-drama-in-hindi/" title="My Bias, My Boss [Korean Drama] in Urdu Hindi Dubbed &ndash; Episode 03-04 Added &ndash; KDramas Maza"><img src="https://i0.wp.com/kdramasmaza.net/wp-content/uploads/2026/08/My-Bias-My-Boss.png?resize=240%2C172&ssl=1" alt="My Bias, My Boss" /></a>
<h3 class="post-title"><a href="https://kdramasmaza.net/my-bias-my-boss-korean-drama-in-hindi/">My Bias, My Boss...</a></h3>
<span class="date">August 13, 2026</span> <span class="comments"><a href="https://kdramasmaza.net/my-bias-my-boss-korean-drama-in-hindi/#respond">0</a></span>
</li>
<li>
<a href="https://kdramasmaza.net/the-judge-returns-korean-drama-in-hindi/" title="The Judge Returns [Korean Drama] in Urdu Hindi Dubbed &ndash; Complete All Episodes &ndash; KDramas Maza"><img src="https://i0.wp.com/kdramasmaza.net/wp-content/uploads/2026/08/The-Judge-Returns.png?fit=660%2C365&ssl=1" alt="The Judge Returns" /></a>
<h3 class="post-title"><a href="https://kdramasmaza.net/the-judge-returns-korean-drama-in-hindi/">The Judge Returns [Korean Drama] in Urdu Hindi Dubbed &ndash; Complete All Episodes &ndash; KDramas Maza</a></h3>
</li>
<li>
<a href="https://kdramasmaza.net/your-house-helper-korean-drama-in-hindi/"><img src="https://i0.wp.com/kdramasmaza.net/wp-content/uploads/2026/08/Your-House-Helper.png?fit=660%2C365&ssl=1" /></a>
<a href="https://kdramasmaza.net/your-house-helper-korean-drama-in-hindi/">Your House Helper [Korean Drama] in Urdu Hindi Dubbed &ndash; Complete All Episodes &ndash; KDramas Maza</a>
<a href="https://kdramasmaza.net/category/korean-dramas/">Korean Dramas</a>
</li>
<li>
<a href="https://kdramasmaza.net/2026/08/10/"><img src="https://i0.wp.com/kdramasmaza.net/wp-content/uploads/2026/08/Filter.png" /></a>
<a href="https://kdramasmaza.net/filter-chinese-drama-in-hindi/"><img src="https://i0.wp.com/kdramasmaza.net/wp-content/uploads/2026/08/Filter.png?fit=660%2C365&ssl=1" /></a>
<h3 class="post-title"><a href="https://kdramasmaza.net/filter-chinese-drama-in-hindi/">Filter [Chinese Drama] in Urdu Hindi Dubbed &ndash; Complete All Episodes &ndash; KDramas Maza</a></h3>
</li>
</ul>
</div>
</body></html>`;

// vcloud page returned after the drive page JS-decodes its direct link
const hubcloudDrivePage = `<html><body>
<script>var url = atob(atob('${Buffer.from(Buffer.from("https://vcloud.test/dl").toString("base64")).toString("base64")}'))</script>
</body></html>`;

const vcloudPage = `<html><body>
<a class="btn-success btn-lg h6" href="https://example.com/video.mkv">Download</a>
</body></html>`;

// Doodstream embed page with pass_md5 token
const doodEmbedPage = `<html><body><script>
var pass_md5 = "abcdef1234567890";
</script></body></html>`;

// DOTFLIX share page with an embedded Google Drive file
const dtflixDrivePage = `<html><body>
<h1>The.Judge.Returns.S01E01.Episode.1.720p.AMZN.WEB-DL.Multi.Audio.DDP.2.0.H265-Shubham.mkv</h1>
<div id="app" data-file="1AA3F304"><script>
window.__FILE__ = "1AA3F304";
</script></div>
</body></html>`;

// DOTFLIX share page without any direct link (JS-only download options)
const dtflixJsPage = `<html><body>
<h1>Some.Episode.mkv</h1>
<p>Preparing download options&hellip;</p>
</body></html>`;

// ---------- Fake axios serving the fixtures ----------
const routes = {
  "https://kdramasmaza.net/": listPageHtml,
  "https://kdramasmaza.net/page/2/": listPageHtml,
  "https://kdramasmaza.net/category/korean-dramas-in-urdu-hindi-dubbed/page/1/": listPageHtml,
  "https://kdramasmaza.net/?s=judge": listPageHtml,
  "https://kdramasmaza.net/the-judge-returns-korean-drama-in-hindi/": detailSeriesHtml,
  "https://kdramasmaza.net/art-of-fighting-2019-korean-movie-in-hindi-dubbed/": detailMovieHtml,
  "https://kdramasmaza.com.pk/archives/4983": archivesSeriesHtml,
  "https://kdramasmaza.com.pk/archives/4985": archivesSeriesHtml,
  "https://kdramasmaza.com.pk/archives/1169": archivesMovieHtml,
  "https://hubcloud.cx/drive/s74hslromcmfmab": hubcloudDrivePage,
  "https://dood.li/e/50864fsu83vq": doodEmbedPage,
  "https://dtflix.ink/share/DRIVE123": dtflixDrivePage,
  "https://dtflix.ink/share/JS456789": dtflixJsPage,
  "https://dood.li/abcdef1234567890": { url: "https://doodstream.example/direct/video.mp4" },
};





const fakeFetch = (url, opts) => {
  const u = String(url);
  if (u.includes("urls.json")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(JSON.parse(localUrls)),
    });
  }
  if (u === "https://dood.li/abcdef1234567890") {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ url: "https://doodstream.example/direct/video.mp4" }),
      text: async () => "",
      headers: { get: () => null },
      url: u,
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

const fakeAxios = Object.assign(
  (url) => fakeAxios.get(url),
  {
    get: (url) => {
      let clean = url.split("#")[0];
      if (routes[clean]) return Promise.resolve({ data: routes[clean] });
      if (!clean.endsWith("/")) {
        const withSlash = clean + "/";
        if (routes[withSlash]) return Promise.resolve({ data: routes[withSlash] });
      }
      return Promise.reject(new Error(`No fixture for ${clean}`));
    },
  },
);

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
    providerValue: "kdramasmaza",
    signal: new AbortController().signal,
    providerContext,
  });
  console.log("  posts:", posts.map((p) => `${p.title} | ${p.link} | ${p.image}`).join("\n         "));
  check("returns 4 unique posts", posts.length === 4, posts.length);
  check(
    "has my-bias-my-boss with image",
    posts.some((p) => p.link.includes("my-bias-my-boss") && p.image.includes("My-Bias-My-Boss.png")),
  );
  check(
    "title suffix cleaned",
    posts.some((p) => p.title.includes("My Bias, My Boss") && !p.title.includes("KDramas Maza")),
    posts.map((p) => p.title),
  );
  check(
    "page/2 style (img anchor + text anchor merged)",
    posts.some((p) => p.link.includes("your-house-helper") && p.image && p.title.includes("Your House Helper")),
  );
  check(
    "date archive link filtered (2026/08/10)",
    !posts.some((p) => p.link.includes("/2026/")),
  );
  check(
    "how-to-download page filtered",
    !posts.some((p) => p.link.includes("how-to-download")),
  );
  check(
    "telegram link filtered",
    !posts.some((p) => p.link.includes("t.me")),
  );

  console.log("\n--- getPosts (category page 1) ---");
  const catPosts = await getPosts({
    filter: "/category/korean-dramas-in-urdu-hindi-dubbed",
    page: 1,
    providerValue: "kdramasmaza",
    signal: new AbortController().signal,
    providerContext,
  });
  check("category posts parsed", catPosts.length === 4, catPosts.length);

  console.log("\n--- getSearchPosts ---");
  const { getSearchPosts } = loadModule("posts");
  const searchPosts = await getSearchPosts({
    searchQuery: "judge",
    page: 1,
    providerValue: "kdramasmaza",
    signal: new AbortController().signal,
    providerContext,
  });
  check("search posts parsed", searchPosts.length === 4, searchPosts.length);

  console.log("\n--- getMeta (series, new format) ---");
  const { getMeta } = loadModule("meta");
  const meta = await getMeta({
    link: "https://kdramasmaza.net/the-judge-returns-korean-drama-in-hindi/",
    providerContext,
  });
  console.log("  meta:", JSON.stringify(meta, null, 1).slice(0, 900));
  check("title", meta.title.includes("The Judge Returns") && !meta.title.includes("KDramas Maza"), meta.title);
  check("synopsis clean", meta.synopsis.startsWith("The return of corrupt judge") && !meta.synopsis.includes("Title:"), meta.synopsis);
  check("image", meta.image.includes("The-Judge-Returns.png"), meta.image);
  check("type series", meta.type === "series", meta.type);
  check("tags", Array.isArray(meta.tags) && meta.tags.includes("Action"), meta.tags);
  check("linkList has 2 entries", meta.linkList.length === 2, meta.linkList);
  check(
    "episodesLink points to archives 4983",
    meta.linkList.some((l) => l.episodesLink === "https://kdramasmaza.com.pk/archives/4983"),
    meta.linkList,
  );
  check(
    "zip link entry present",
    meta.linkList.some((l) => l.episodesLink === "https://kdramasmaza.com.pk/archives/4985"),
  );

  console.log("\n--- getMeta (movie, old format) ---");
  const metaMovie = await getMeta({
    link: "https://kdramasmaza.net/art-of-fighting-2019-korean-movie-in-hindi-dubbed/",
    providerContext,
  });
  console.log("  meta:", JSON.stringify(metaMovie, null, 1).slice(0, 600));
  check("type movie", metaMovie.type === "movie", metaMovie.type);
  check(
    "directLinks used for movie",
    metaMovie.linkList[0]?.directLinks?.[0]?.link === "https://kdramasmaza.com.pk/archives/1169",
    metaMovie.linkList,
  );
  check("synopsis from first paragraph", metaMovie.synopsis.startsWith("Art of Fighting 2019 Korean Movie"), metaMovie.synopsis);

  console.log("\n--- getEpisodes (series archives, new format) ---");
  const { getEpisodes } = loadModule("episodes");
  const episodes = await getEpisodes({
    url: "https://kdramasmaza.com.pk/archives/4983",
    providerContext,
  });
  console.log("  episodes:", episodes.map((e) => `${e.title} -> ${e.link}`).join("\n            "));
  check("3 episodes found", episodes.length === 3, episodes.length);
  check(
    "hubcloud preferred as episode link",
    episodes[0].title === "Episode 01" && episodes[0].link.includes("hubcloud.cx/drive/s74hslromcmfmab"),
    episodes[0],
  );

  console.log("\n--- getEpisodes (movie archives, old format) ---");
  const movieEpisodes = await getEpisodes({
    url: "https://kdramasmaza.com.pk/archives/1169",
    providerContext,
  });
  console.log("  movie episodes:", movieEpisodes.map((e) => `${e.title} -> ${e.link}`).join("\n            "));
  check("7 entries for movie archives", movieEpisodes.length === 7, movieEpisodes.length);
  check(
    "quality in title",
    movieEpisodes.some((e) => e.title === "480p - Sendcm" || e.title === "480P - Sendcm"),
    movieEpisodes.map((e) => e.title),
  );
  check(
    "dood link captured",
    movieEpisodes.some((e) => e.link.includes("dood.li")),
  );

  console.log("\n--- getStream (hubcloud) ---");
  const { getStream } = loadModule("stream");
  const hubStreams = await getStream({
    link: "https://hubcloud.cx/drive/s74hslromcmfmab",
    type: "series",
    signal: new AbortController().signal,
    providerContext,
  });
  console.log("  hubcloud streams:", JSON.stringify(hubStreams).slice(0, 300));

  console.log("\n--- getStream (dood) ---");
  const doodStreams = await getStream({
    link: "https://dood.li/d/50864fsu83vq",
    type: "movie",
    signal: new AbortController().signal,
    providerContext,
  });
  console.log("  dood streams:", JSON.stringify(doodStreams).slice(0, 300));
  check("dood fallback stream", doodStreams.length > 0 && doodStreams[0].server === "Doodstream");

  console.log("\n--- getStream (archives page) ---");
  const archStreams = await getStream({
    link: "https://kdramasmaza.com.pk/archives/1169",
    type: "movie",
    signal: new AbortController().signal,
    providerContext,
  });
  console.log("  archives streams:", JSON.stringify(archStreams).slice(0, 300));

  console.log("\n--- getStream (send.cm external) ---");
  const sendStreams = await getStream({
    link: "https://send.cm/367n4pnp55cl",
    type: "series",
    signal: new AbortController().signal,
    providerContext,
  });
  check("send.cm external fallback", sendStreams.length === 1 && sendStreams[0].link.includes("send.cm"));

  console.log("\n--- getStream (dood success path) ---");
  const doodOk = await getStream({
    link: "https://dood.li/d/50864fsu83vq",
    type: "movie",
    signal: new AbortController().signal,
    providerContext,
  });
  console.log("  dood direct:", JSON.stringify(doodOk));
  check(
    "dood resolves to direct mp4",
    doodOk.length === 1 && doodOk[0].link.includes("doodstream.example") && doodOk[0].server === "Doodstream",
    doodOk,
  );

  console.log("\n--- getStream (dtflix with drive link) ---");
  const dtflixDrive = await getStream({
    link: "https://dtflix.ink/share/DRIVE123",
    type: "series",
    signal: new AbortController().signal,
    providerContext,
  });
  console.log("  dtflix:", JSON.stringify(dtflixDrive));
  check(
    "dtflix page without drive link -> fallback",
    dtflixDrive.length === 1 && dtflixDrive[0].server === "Dotflix" && dtflixDrive[0].link.includes("dtflix.ink"),
    dtflixDrive,
  );

  console.log("\n--- getStream (dtflix JS-only page) ---");
  const dtflixJs = await getStream({
    link: "https://dtflix.ink/share/JS456789",
    type: "series",
    signal: new AbortController().signal,
    providerContext,
  });
  check(
    "dtflix JS-only page -> share page fallback",
    dtflixJs.length === 1 && dtflixJs[0].server === "Dotflix" && dtflixJs[0].link === "https://dtflix.ink/share/JS456789",
    dtflixJs,
  );


  console.log("\n--- challenge page handling ---");
  const cfChallengePage = `<html><head><title>Just a moment...</title></head><body>
  <div class="cf-browser-verification"><div class="cf-chl">Checking your browser before accessing kdramasmaza.net.</div></div>
  </body></html>`;
  const { getPosts: getPosts2 } = loadModule("posts");
  const cfAxios = {
    get: (url, config) => {
      const cookie = config?.headers?.Cookie || "";
      if (cookie.includes("cf_clearance=solved")) {
        return Promise.resolve({ data: listPageHtml });
      }
      return Promise.resolve({ data: cfChallengePage });
    },
  };
  const cfContext = { ...providerContext, axios: cfAxios };
  let wafOpened = 0;
  const withWaf = {
    ...providerContext,
    axios: cfAxios,
    openWebView: async (origin, opts) => {
      wafOpened++;
      return { cookies: "cf_clearance=solved", data: "", url: origin, userAgent: "test", cookieMap: {} };
    },
  };
  const challengePosts = await getPosts2({
    filter: "",
    page: 1,
    providerValue: "kdramasmaza",
    signal: new AbortController().signal,
    providerContext: withWaf,
  });
  console.log("  challenge posts after solve:", challengePosts.length);
  check("challenge page triggers WAF solver once", wafOpened === 1, wafOpened);
  check("posts parsed after WAF solve", challengePosts.length === 4, challengePosts.length);
  const noWafPosts = await getPosts2({
    filter: "",
    page: 1,
    providerValue: "kdramasmaza",
    signal: new AbortController().signal,
    providerContext: cfContext,
  });
  check("without WAF returns empty instead of crashing", Array.isArray(noWafPosts) && noWafPosts.length === 0, noWafPosts);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("TEST CRASH:", e);
  process.exit(1);
});
