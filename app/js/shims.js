/**
 * Browser shims so CommonJS provider bundles (axios/cheerio based)
 * can run inside a static GitHub Pages frontend.
 */

function shouldProxy(url, proxyBase) {
  if (!proxyBase) return false;
  try {
    const u = new URL(url, location.href);
    // never proxy same-origin or known CDN/github raw hosts used for code loading
    const host = u.hostname;
    if (
      host === location.hostname ||
      host === "raw.githubusercontent.com" ||
      host === "cdn.jsdelivr.net" ||
      host.endsWith("github.io")
    ) {
      return false;
    }
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function withProxy(url, proxyBase) {
  if (!proxyBase) return url;
  const base = proxyBase.endsWith("/") ? proxyBase : proxyBase + "/";
  // allorigins style: https://api.allorigins.win/raw?url=
  if (base.includes("allorigins.win")) {
    return `${base.replace(/\/$/, "")}?url=${encodeURIComponent(url)}`;
  }
  // corsproxy.io style: https://corsproxy.io/?url=
  if (base.includes("corsproxy.io")) {
    return `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
  }
  // generic prefix proxy
  return base + encodeURIComponent(url);
}

/** Minimal axios-like client using fetch (+ optional CORS proxy) */
export function createAxios(getProxyBase = () => "") {
  async function request(config = {}) {
    const method = (config.method || "get").toUpperCase();
    let url = config.url;
    const headers = { ...(config.headers || {}) };
    const proxyBase = typeof getProxyBase === "function" ? getProxyBase() : getProxyBase;

    // Prefer direct first, then proxy fallback on network/CORS failure for GET
    const tryUrls = [url];
    if (proxyBase && shouldProxy(url, proxyBase)) {
      tryUrls.push(withProxy(url, proxyBase));
    }

    let lastError;
    for (let i = 0; i < tryUrls.length; i++) {
      const finalUrl = tryUrls[i];
      const init = {
        method,
        // Custom headers on cross-origin often trigger preflight and get blocked.
        // Only send headers on same-origin / proxy second attempt carefully.
        headers: i === 0 ? {} : headers,
        signal: config.signal,
      };
      if (config.data != null && method !== "GET" && method !== "HEAD") {
        init.body =
          typeof config.data === "string"
            ? config.data
            : JSON.stringify(config.data);
        if (!init.headers["Content-Type"] && !init.headers["content-type"]) {
          init.headers["Content-Type"] = "application/json";
        }
      }

      try {
        const res = await fetch(finalUrl, init);
        const contentType = res.headers.get("content-type") || "";
        let data;
        if (contentType.includes("application/json")) {
          data = await res.json();
        } else {
          data = await res.text();
        }
        const response = {
          data,
          status: res.status,
          statusText: res.statusText,
          headers: Object.fromEntries(res.headers.entries()),
          config,
          request: null,
          requestUrl: finalUrl,
        };
        if (!res.ok) {
          const error = new Error(`Request failed with status code ${res.status}`);
          error.response = response;
          error.config = config;
          error.isAxiosError = true;
          // retry via proxy if possible
          lastError = error;
          continue;
        }
        return response;
      } catch (err) {
        lastError = err;
        // try next url (proxy)
      }
    }

    const error = new Error(
      lastError?.message ||
        "Network/CORS error. Enable CORS proxy in Settings and retry.",
    );
    error.config = config;
    error.isAxiosError = true;
    error.cause = lastError;
    throw error;
  }

  const axios = {
    request,
    get: (url, config = {}) => request({ ...config, method: "get", url }),
    post: (url, data, config = {}) =>
      request({ ...config, method: "post", url, data }),
    defaults: { headers: { common: {} } },
  };
  return axios;
}

/**
 * Tiny cheerio-compatible subset used by most providers.
 */
export function createCheerio() {
  function parseHTML(html) {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    return doc;
  }

  function wrap(nodes, doc) {
    const list = Array.from(nodes || []);
    const api = {
      length: list.length,
      [Symbol.iterator]: () => list[Symbol.iterator](),
      get: (i) => (i == null ? list.slice() : list[i]),
      toArray: () => list.slice(),
      find(sel) {
        const out = [];
        for (const el of list) {
          if (el?.querySelectorAll) out.push(...el.querySelectorAll(sel));
        }
        return wrap(out, doc);
      },
      children(sel) {
        const out = [];
        for (const el of list) {
          if (!el?.children) continue;
          for (const child of el.children) {
            if (!sel || child.matches?.(sel)) out.push(child);
          }
        }
        return wrap(out, doc);
      },
      parent() {
        return wrap(list.map((el) => el.parentElement).filter(Boolean), doc);
      },
      first() {
        return wrap(list.slice(0, 1), doc);
      },
      last() {
        return wrap(list.slice(-1), doc);
      },
      eq(i) {
        return wrap(list.slice(i, i + 1), doc);
      },
      each(fn) {
        list.forEach((el, i) => fn.call(el, i, el));
        return api;
      },
      map(fn) {
        const out = [];
        list.forEach((el, i) => {
          const v = fn.call(el, i, el);
          if (v != null) out.push(v);
        });
        return { get: () => out, toArray: () => out };
      },
      attr(name, value) {
        if (!list[0]?.getAttribute) return undefined;
        if (value === undefined) return list[0].getAttribute(name) || undefined;
        for (const el of list) el.setAttribute?.(name, value);
        return api;
      },
      prop(name) {
        return list[0] ? list[0][name] : undefined;
      },
      text(value) {
        if (value !== undefined) {
          for (const el of list) el.textContent = value;
          return api;
        }
        return list.map((el) => el.textContent || "").join("").trim();
      },
      html(value) {
        if (value !== undefined) {
          for (const el of list) el.innerHTML = value;
          return api;
        }
        return list[0] ? list[0].innerHTML : null;
      },
      val() {
        const el = list[0];
        return el ? el.value ?? el.getAttribute?.("value") ?? "" : undefined;
      },
      hasClass(name) {
        return list.some((el) => el.classList?.contains(name));
      },
      next(sel) {
        const out = [];
        for (const el of list) {
          let n = el.nextElementSibling;
          while (n) {
            if (!sel || n.matches(sel)) {
              out.push(n);
              break;
            }
            n = n.nextElementSibling;
          }
        }
        return wrap(out, doc);
      },
      prev(sel) {
        const out = [];
        for (const el of list) {
          let n = el.previousElementSibling;
          while (n) {
            if (!sel || n.matches(sel)) {
              out.push(n);
              break;
            }
            n = n.previousElementSibling;
          }
        }
        return wrap(out, doc);
      },
      closest(sel) {
        return wrap(list.map((el) => el.closest?.(sel)).filter(Boolean), doc);
      },
      filter(selOrFn) {
        if (typeof selOrFn === "function") {
          return wrap(list.filter((el, i) => selOrFn.call(el, i, el)), doc);
        }
        return wrap(list.filter((el) => el.matches?.(selOrFn)), doc);
      },
      not(sel) {
        return wrap(list.filter((el) => !el.matches?.(sel)), doc);
      },
      is(sel) {
        return list.some((el) => el.matches?.(sel));
      },
      contents() {
        const out = [];
        for (const el of list) out.push(...(el.childNodes || []));
        return wrap(out, doc);
      },
      remove() {
        for (const el of list) el.parentNode?.removeChild(el);
        return api;
      },
      end() {
        return api._root || api;
      },
    };
    return api;
  }

  function load(html) {
    const doc = parseHTML(html);
    function $(selector, context) {
      if (!selector) return wrap([], doc);
      if (typeof selector === "function") return wrap([], doc);
      if (selector === doc || selector?.nodeType) return wrap([selector], doc);
      let sel = String(selector);
      const containsMatch = sel.match(/^(.*?):contains\((["'])(.*?)\2\)$/);
      if (containsMatch) {
        const base = containsMatch[1] || "*";
        const text = containsMatch[3];
        const nodes = Array.from(doc.querySelectorAll(base || "*")).filter((el) =>
          (el.textContent || "").includes(text),
        );
        const api = wrap(nodes, doc);
        api._root = api;
        return api;
      }
      try {
        const root = context?.querySelectorAll
          ? context
          : context?.get?.(0) || doc;
        const nodes = root.querySelectorAll
          ? root.querySelectorAll(sel)
          : doc.querySelectorAll(sel);
        const api = wrap(nodes, doc);
        api._root = api;
        return api;
      } catch {
        return wrap([], doc);
      }
    }
    $.html = () => doc.documentElement?.outerHTML || "";
    $.root = () => wrap([doc.documentElement], doc);
    $.text = () => doc.body?.textContent || "";
    return $;
  }

  return { load };
}

/** Evaluate CommonJS provider bundle source in browser */
export function loadCommonJsModule(source, filename = "module.js") {
  const module = { exports: {} };
  const exports = module.exports;
  const requireFn = (name) => {
    throw new Error(
      `require('${name}') is not available in browser for ${filename}`,
    );
  };
  const fn = new Function(
    "require",
    "module",
    "exports",
    "console",
    `${source}\n//# sourceURL=${filename}`,
  );
  fn(requireFn, module, exports, console);
  return module.exports;
}
