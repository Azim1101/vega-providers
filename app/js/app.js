import { createAxios, createCheerio, loadCommonJsModule } from "./shims.js";

const DEFAULTS = {
  owner: "Azim1101",
  repo: "vega-providers",
  branch: "main",
};

const state = {
  cfg: loadConfig(),
  providers: [],
  activeProvider: null,
  catalog: [],
  genres: [],
  activeFilter: "",
  activeFilterTitle: "Latest",
  posts: [],
  mode: "home", // home | search | detail
  searchQuery: "",
  moduleCache: new Map(),
};

const els = {
  repoLabel: document.getElementById("repoLabel"),
  providerList: document.getElementById("providerList"),
  providerCount: document.getElementById("providerCount"),
  providerFilter: document.getElementById("providerFilter"),
  catalogTabs: document.getElementById("catalogTabs"),
  grid: document.getElementById("grid"),
  emptyState: document.getElementById("emptyState"),
  loader: document.getElementById("loader"),
  statusBar: document.getElementById("statusBar"),
  searchInput: document.getElementById("searchInput"),
  searchBtn: document.getElementById("searchBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  settingsOverlay: document.getElementById("settingsOverlay"),
  closeSettings: document.getElementById("closeSettings"),
  saveCfg: document.getElementById("saveCfg"),
  resetCfg: document.getElementById("resetCfg"),
  cfgOwner: document.getElementById("cfgOwner"),
  cfgRepo: document.getElementById("cfgRepo"),
  cfgBranch: document.getElementById("cfgBranch"),
  detailOverlay: document.getElementById("detailOverlay"),
  detailBody: document.getElementById("detailBody"),
  closeDetail: document.getElementById("closeDetail"),
  goHome: document.getElementById("goHome"),
};

function loadConfig() {
  try {
    const raw = localStorage.getItem("vegaProvidersCfg");
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  // Auto-detect if hosted on github.io / raw pages path
  const host = location.hostname;
  if (host.endsWith("github.io")) {
    const owner = host.replace(".github.io", "");
    const parts = location.pathname.split("/").filter(Boolean);
    const repo = parts[0] || DEFAULTS.repo;
    return { owner, repo, branch: "main" };
  }
  return { ...DEFAULTS };
}

function saveConfig(cfg) {
  localStorage.setItem("vegaProvidersCfg", JSON.stringify(cfg));
}

function baseRawUrl() {
  const { owner, repo, branch } = state.cfg;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}`;
}

function jsDelivrUrl(path) {
  const { owner, repo, branch } = state.cfg;
  return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${path.replace(
    /^\//,
    "",
  )}`;
}

async function fetchText(path) {
  const urls = [
    `${baseRawUrl()}/${path.replace(/^\//, "")}`,
    jsDelivrUrl(path),
  ];
  let lastErr;
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error(`Failed to fetch ${path}`);
}

async function fetchJson(path) {
  const text = await fetchText(path);
  return JSON.parse(text);
}

function setStatus(msg, type = "") {
  els.statusBar.textContent = msg;
  els.statusBar.classList.remove("error", "ok");
  if (type) els.statusBar.classList.add(type);
}

function setLoading(on) {
  els.loader.classList.toggle("hidden", !on);
}

function updateRepoLabel() {
  const { owner, repo, branch } = state.cfg;
  els.repoLabel.textContent = `${owner}/${repo}@${branch}`;
}

function createProviderContext() {
  const axios = createAxios();
  const cheerio = createCheerio();
  const commonHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
  };

  // getBaseUrl from dist if available, else fallback map from modflix later
  let getBaseUrl = async () => "";
  return {
    axios,
    cheerio,
    commonHeaders,
    Aes: null,
    openWebView: async () => {
      throw new Error(
        "WAF/captcha solving (openWebView) is not available in the browser demo",
      );
    },
    // filled after modules load
    get getBaseUrl() {
      return getBaseUrl;
    },
    set getBaseUrl(fn) {
      getBaseUrl = fn;
    },
  };
}

const providerContext = createProviderContext();

async function ensureGetBaseUrl() {
  if (providerContext._ready) return;
  try {
    const src = await fetchText("dist/getBaseUrl.js");
    const mod = loadCommonJsModule(src, "getBaseUrl.js");
    if (typeof mod.getBaseUrl === "function") {
      providerContext.getBaseUrl = mod.getBaseUrl.bind(mod);
    } else if (typeof mod === "function") {
      providerContext.getBaseUrl = mod;
    } else {
      // try reading BASE_URLS from source via Function after export patch
      const m2 = loadCommonJsModule(
        src.replace(
          /module\.exports\s*=\s*__toCommonJS\([^)]+\);?/,
          "module.exports = { getBaseUrl };",
        ),
        "getBaseUrl-fallback.js",
      );
      if (m2.getBaseUrl) providerContext.getBaseUrl = m2.getBaseUrl;
    }
  } catch (err) {
    console.warn("getBaseUrl load failed, using empty fallback", err);
    providerContext.getBaseUrl = async () => "";
  }
  providerContext._ready = true;
}

async function loadProviderModule(providerValue, file) {
  const key = `${providerValue}/${file}`;
  if (state.moduleCache.has(key)) return state.moduleCache.get(key);
  const src = await fetchText(`dist/${providerValue}/${file}.js`);
  const mod = loadCommonJsModule(src, `${providerValue}/${file}.js`);
  state.moduleCache.set(key, mod);
  return mod;
}

function renderProviders(filter = "") {
  const q = filter.trim().toLowerCase();
  const list = state.providers.filter((p) => {
    if (!q) return true;
    return (
      p.display_name?.toLowerCase().includes(q) ||
      p.value?.toLowerCase().includes(q)
    );
  });

  els.providerList.innerHTML = list
    .map((p) => {
      const active = state.activeProvider?.value === p.value ? "active" : "";
      const disabled = p.disabled ? "disabled" : "";
      return `<button class="provider-item ${active} ${disabled}" data-value="${escapeHtml(
        p.value,
      )}">
        <span class="name">${escapeHtml(p.display_name || p.value)}</span>
        <span class="meta">${escapeHtml(p.value)} · v${escapeHtml(
          String(p.version || "?"),
        )}${p.disabled ? " · disabled" : ""}</span>
      </button>`;
    })
    .join("");

  els.providerCount.textContent = String(state.providers.length);
}

function renderTabs() {
  const items = [
    ...state.catalog.map((c) => ({ ...c, kind: "catalog" })),
    ...state.genres.map((g) => ({ ...g, kind: "genre" })),
  ];
  if (!items.length) {
    els.catalogTabs.classList.add("hidden");
    els.catalogTabs.innerHTML = "";
    return;
  }
  els.catalogTabs.classList.remove("hidden");
  els.catalogTabs.innerHTML = items
    .map((item) => {
      const active =
        state.mode !== "search" && state.activeFilter === item.filter
          ? "active"
          : "";
      return `<button class="tab ${active}" data-filter="${escapeAttr(
        item.filter,
      )}" data-title="${escapeAttr(item.title)}">${escapeHtml(
        item.title,
      )}</button>`;
    })
    .join("");
}

function renderPosts() {
  els.emptyState.classList.add("hidden");
  if (!state.posts.length) {
    els.grid.innerHTML = "";
    if (!state.activeProvider) {
      els.emptyState.classList.remove("hidden");
    } else {
      els.grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><h3>No posts</h3><p>This provider returned an empty list. CORS or site protection may be blocking browser requests.</p></div>`;
    }
    return;
  }
  els.grid.innerHTML = state.posts
    .map((post, idx) => {
      const img = post.image || "";
      const title = post.title || "Untitled";
      return `<article class="card" data-idx="${idx}">
        <img class="card-img" src="${escapeAttr(
          img,
        )}" alt="" loading="lazy" onerror="this.style.opacity=.15" />
        <div class="card-body"><div class="card-title">${escapeHtml(
          title,
        )}</div></div>
      </article>`;
    })
    .join("");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

async function init() {
  updateRepoLabel();
  setLoading(true);
  setStatus("Loading manifest from GitHub…");
  try {
    await ensureGetBaseUrl();
    const manifest = await fetchJson("manifest.json");
    state.providers = (Array.isArray(manifest) ? manifest : [])
      .slice()
      .sort((a, b) =>
        String(a.display_name || a.value).localeCompare(
          String(b.display_name || b.value),
        ),
      );
    renderProviders();
    setStatus(
      `Loaded ${state.providers.length} providers from ${state.cfg.owner}/${state.cfg.repo}`,
      "ok",
    );
    // auto-select first enabled provider
    const first = state.providers.find((p) => !p.disabled);
    if (first) await selectProvider(first.value);
  } catch (err) {
    console.error(err);
    setStatus(`Failed to load manifest: ${err.message}`, "error");
    els.emptyState.classList.remove("hidden");
  } finally {
    setLoading(false);
  }
}

async function selectProvider(value) {
  const provider = state.providers.find((p) => p.value === value);
  if (!provider) return;
  state.activeProvider = provider;
  state.mode = "home";
  state.searchQuery = "";
  els.searchInput.value = "";
  renderProviders(els.providerFilter.value);
  setLoading(true);
  setStatus(`Loading catalog for ${provider.display_name}…`);
  try {
    const catalogMod = await loadProviderModule(provider.value, "catalog");
    state.catalog = catalogMod.catalog || [];
    state.genres = catalogMod.genres || [];
    if (!state.catalog.length) {
      throw new Error("Catalog is empty / failed to export catalog");
    }
    state.activeFilter = state.catalog[0].filter ?? "";
    state.activeFilterTitle = state.catalog[0].title || "Latest";
    renderTabs();
    await loadPosts();
  } catch (err) {
    console.error(err);
    state.catalog = [];
    state.genres = [];
    state.posts = [];
    renderTabs();
    renderPosts();
    setStatus(
      `Failed to load categories for ${provider.display_name}: ${err.message}`,
      "error",
    );
  } finally {
    setLoading(false);
  }
}

async function loadPosts() {
  const provider = state.activeProvider;
  if (!provider) return;
  setLoading(true);
  try {
    const postsMod = await loadProviderModule(provider.value, "posts");
    const signal = AbortSignal.timeout
      ? AbortSignal.timeout(45000)
      : undefined;
    let posts = [];
    if (state.mode === "search") {
      if (typeof postsMod.getSearchPosts !== "function") {
        throw new Error("Provider has no getSearchPosts()");
      }
      posts = await postsMod.getSearchPosts({
        searchQuery: state.searchQuery,
        page: 1,
        providerValue: provider.value,
        signal,
        providerContext,
      });
      setStatus(
        `Search “${state.searchQuery}” on ${provider.display_name}: ${
          posts?.length || 0
        } results`,
        posts?.length ? "ok" : "error",
      );
    } else {
      if (typeof postsMod.getPosts !== "function") {
        throw new Error("Provider has no getPosts()");
      }
      posts = await postsMod.getPosts({
        filter: state.activeFilter || "",
        page: 1,
        providerValue: provider.value,
        signal,
        providerContext,
      });
      setStatus(
        `${provider.display_name} · ${state.activeFilterTitle}: ${
          posts?.length || 0
        } posts`,
        posts?.length ? "ok" : "error",
      );
    }
    state.posts = Array.isArray(posts) ? posts : [];
    renderPosts();
  } catch (err) {
    console.error(err);
    state.posts = [];
    renderPosts();
    setStatus(`Posts failed: ${err.message}`, "error");
  } finally {
    setLoading(false);
  }
}

async function openDetail(post) {
  els.detailOverlay.classList.remove("hidden");
  els.detailBody.innerHTML = `<div class="loader inline"><div class="spinner"></div><span>Loading details…</span></div>`;
  const provider = state.activeProvider;
  try {
    const metaMod = await loadProviderModule(provider.value, "meta");
    const info = await metaMod.getMeta({
      link: post.link,
      providerContext,
    });
    const image = info.image || post.image || "";
    const title = info.title || post.title || "Untitled";
    const synopsis = info.synopsis || "No synopsis.";
    const type = info.type || "";
    const imdb = info.imdbId || "";
    const links = Array.isArray(info.linkList) ? info.linkList : [];

    els.detailBody.innerHTML = `
      <div class="detail-hero">
        <img src="${escapeAttr(image)}" alt="" onerror="this.style.opacity=.2" />
        <div>
          <h2>${escapeHtml(title)}</h2>
          <div class="chip-row">
            ${type ? `<span class="chip">${escapeHtml(type)}</span>` : ""}
            ${imdb ? `<span class="chip">${escapeHtml(imdb)}</span>` : ""}
            <span class="chip">${escapeHtml(provider.display_name)}</span>
          </div>
          <p>${escapeHtml(synopsis)}</p>
          <div class="link-list" id="linkList"></div>
        </div>
      </div>
    `;

    const linkListEl = els.detailBody.querySelector("#linkList");
    if (!links.length) {
      linkListEl.innerHTML = `<div class="hint">No linkList returned by provider meta.</div>`;
      return;
    }

    for (const group of links) {
      const box = document.createElement("div");
      box.className = "link-group";
      box.innerHTML = `<h4>${escapeHtml(group.title || "Links")}${
        group.quality ? ` · ${escapeHtml(group.quality)}` : ""
      }</h4>`;

      if (Array.isArray(group.directLinks) && group.directLinks.length) {
        const list = document.createElement("div");
        list.className = "stream-list";
        for (const item of group.directLinks) {
          const btn = document.createElement("button");
          btn.className = "stream-item";
          btn.type = "button";
          btn.innerHTML = `<span>${escapeHtml(
            item.title || "Play",
          )}</span><span class="chip">${escapeHtml(
            item.type || "stream",
          )}</span>`;
          btn.addEventListener("click", () =>
            loadStreams(item.link, item.type || type || "movie", box),
          );
          list.appendChild(btn);
        }
        box.appendChild(list);
      } else if (group.episodesLink) {
        const btn = document.createElement("button");
        btn.className = "episode-item";
        btn.type = "button";
        btn.textContent = "Load episodes";
        btn.addEventListener("click", () =>
          loadEpisodes(group.episodesLink, box),
        );
        box.appendChild(btn);
      } else {
        box.innerHTML += `<div class="hint">No direct links / episodesLink</div>`;
      }
      linkListEl.appendChild(box);
    }
  } catch (err) {
    console.error(err);
    els.detailBody.innerHTML = `<div class="empty"><h3>Failed to load details</h3><p>${escapeHtml(
      err.message,
    )}</p><p class="hint warn">Browser CORS or WAF may block meta requests.</p></div>`;
  }
}

async function loadEpisodes(url, container) {
  try {
    const mod = await loadProviderModule(state.activeProvider.value, "episodes");
    if (typeof mod.getEpisodes !== "function") {
      throw new Error("No getEpisodes export");
    }
    const episodes = await mod.getEpisodes({ url, providerContext });
    const list = document.createElement("div");
    list.className = "episode-list";
    for (const ep of episodes || []) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "episode-item";
      btn.innerHTML = `<span>${escapeHtml(ep.title || "Episode")}</span><span>▶</span>`;
      btn.addEventListener("click", () =>
        loadStreams(ep.link, "series", container),
      );
      list.appendChild(btn);
    }
    container.appendChild(list);
  } catch (err) {
    container.insertAdjacentHTML(
      "beforeend",
      `<div class="hint warn">Episodes failed: ${escapeHtml(err.message)}</div>`,
    );
  }
}

async function loadStreams(link, type, container) {
  try {
    const mod = await loadProviderModule(state.activeProvider.value, "stream");
    if (typeof mod.getStream !== "function") throw new Error("No getStream");
    const streams = await mod.getStream({
      link,
      type,
      signal: AbortSignal.timeout ? AbortSignal.timeout(45000) : undefined,
      providerContext,
    });
    const list = document.createElement("div");
    list.className = "stream-list";
    list.style.marginTop = "8px";
    if (!streams?.length) {
      list.innerHTML = `<div class="hint">No streams returned.</div>`;
    } else {
      for (const s of streams) {
        const a = document.createElement("a");
        a.className = "stream-item";
        a.href = s.link;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.innerHTML = `<span>${escapeHtml(s.server || "Server")}${
          s.quality ? " · " + escapeHtml(s.quality) : ""
        }</span><span class="chip">${escapeHtml(s.type || "link")}</span>`;
        list.appendChild(a);
      }
    }
    container.appendChild(list);
  } catch (err) {
    container.insertAdjacentHTML(
      "beforeend",
      `<div class="hint warn">Stream failed: ${escapeHtml(err.message)}</div>`,
    );
  }
}

// Events
els.providerList.addEventListener("click", (e) => {
  const btn = e.target.closest(".provider-item");
  if (!btn || btn.classList.contains("disabled")) return;
  selectProvider(btn.dataset.value);
});

els.providerFilter.addEventListener("input", () => {
  renderProviders(els.providerFilter.value);
});

els.catalogTabs.addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  state.mode = "home";
  state.activeFilter = tab.dataset.filter || "";
  state.activeFilterTitle = tab.dataset.title || "Latest";
  renderTabs();
  loadPosts();
});

els.grid.addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  const post = state.posts[Number(card.dataset.idx)];
  if (post) openDetail(post);
});

els.searchBtn.addEventListener("click", () => {
  const q = els.searchInput.value.trim();
  if (!q || !state.activeProvider) return;
  state.mode = "search";
  state.searchQuery = q;
  renderTabs();
  loadPosts();
});

els.searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") els.searchBtn.click();
});

els.settingsBtn.addEventListener("click", () => {
  els.cfgOwner.value = state.cfg.owner;
  els.cfgRepo.value = state.cfg.repo;
  els.cfgBranch.value = state.cfg.branch;
  els.settingsOverlay.classList.remove("hidden");
});
els.closeSettings.addEventListener("click", () =>
  els.settingsOverlay.classList.add("hidden"),
);
els.settingsOverlay.addEventListener("click", (e) => {
  if (e.target === els.settingsOverlay) els.settingsOverlay.classList.add("hidden");
});
els.resetCfg.addEventListener("click", () => {
  els.cfgOwner.value = DEFAULTS.owner;
  els.cfgRepo.value = DEFAULTS.repo;
  els.cfgBranch.value = DEFAULTS.branch;
});
els.saveCfg.addEventListener("click", () => {
  state.cfg = {
    owner: els.cfgOwner.value.trim() || DEFAULTS.owner,
    repo: els.cfgRepo.value.trim() || DEFAULTS.repo,
    branch: els.cfgBranch.value.trim() || DEFAULTS.branch,
  };
  saveConfig(state.cfg);
  location.reload();
});

els.closeDetail.addEventListener("click", () =>
  els.detailOverlay.classList.add("hidden"),
);
els.detailOverlay.addEventListener("click", (e) => {
  if (e.target === els.detailOverlay) els.detailOverlay.classList.add("hidden");
});

els.goHome.addEventListener("click", () => {
  if (state.activeProvider) {
    state.mode = "home";
    els.searchInput.value = "";
    loadPosts();
  }
});

init();
