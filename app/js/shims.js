/**
 * Browser shims so CommonJS provider bundles (axios/cheerio based)
 * can run inside a static GitHub Pages frontend.
 */

/** Minimal axios-like client using fetch */
export function createAxios() {
  async function request(config = {}) {
    const method = (config.method || "get").toUpperCase();
    const url = config.url;
    const headers = { ...(config.headers || {}) };
    const init = {
      method,
      headers,
      signal: config.signal,
    };
    if (config.data != null && method !== "GET" && method !== "HEAD") {
      init.body =
        typeof config.data === "string"
          ? config.data
          : JSON.stringify(config.data);
      if (!headers["Content-Type"] && !headers["content-type"]) {
        headers["Content-Type"] = "application/json";
      }
    }

    let res;
    try {
      res = await fetch(url, init);
    } catch (err) {
      const error = new Error(err?.message || "Network error");
      error.config = config;
      error.isAxiosError = true;
      throw error;
    }

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
    };

    if (!res.ok) {
      const error = new Error(`Request failed with status code ${res.status}`);
      error.response = response;
      error.config = config;
      error.isAxiosError = true;
      throw error;
    }
    return response;
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
 * Tiny cheerio-compatible subset used by most providers:
 * load(html) -> $ ; $(sel).find/attr/text/html/each/map/children/first/eq/...
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
          if (el && el.querySelectorAll) {
            out.push(...el.querySelectorAll(sel));
          }
        }
        return wrap(out, doc);
      },

      children(sel) {
        const out = [];
        for (const el of list) {
          if (!el || !el.children) continue;
          for (const child of el.children) {
            if (!sel || (child.matches && child.matches(sel))) out.push(child);
          }
        }
        return wrap(out, doc);
      },

      parent() {
        return wrap(
          list.map((el) => el.parentElement).filter(Boolean),
          doc,
        );
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
        // cheerio map returns a collection-like with get()
        return {
          get: () => out,
          toArray: () => out,
        };
      },

      attr(name, value) {
        if (!list[0] || !list[0].getAttribute) return undefined;
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

      addClass(name) {
        for (const el of list) el.classList?.add(name);
        return api;
      },

      removeClass(name) {
        for (const el of list) el.classList?.remove(name);
        return api;
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
        return wrap(
          list.map((el) => el.closest?.(sel)).filter(Boolean),
          doc,
        );
      },

      filter(selOrFn) {
        if (typeof selOrFn === "function") {
          return wrap(
            list.filter((el, i) => selOrFn.call(el, i, el)),
            doc,
          );
        }
        return wrap(
          list.filter((el) => el.matches?.(selOrFn)),
          doc,
        );
      },

      not(sel) {
        return wrap(
          list.filter((el) => !el.matches?.(sel)),
          doc,
        );
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
        // cheerio often chains .children().remove().end().text()
        // We emulate remove by clearing children of each matched node when used that way.
        for (const el of list) {
          if (el.parentNode) el.parentNode.removeChild(el);
        }
        return api;
      },

      end() {
        // Not a full stack implementation; enough for common .children().remove().end().text()
        return api._root || api;
      },
    };

    // Make $(selector) style and support function form
    return api;
  }

  function load(html) {
    const doc = parseHTML(html);
    function $(selector, context) {
      if (!selector) return wrap([], doc);
      if (typeof selector === "function") {
        // $(function) not used
        return wrap([], doc);
      }
      if (selector === doc || selector?.nodeType) {
        return wrap([selector], doc);
      }
      if (selector?.documentElement) {
        return wrap([selector.documentElement], doc);
      }
      // cheerio supports pseudo like :contains via custom; approximate
      let sel = String(selector);
      const containsMatch = sel.match(/^(.*?):contains\((["'])(.*?)\2\)$/);
      if (containsMatch) {
        const base = containsMatch[1] || "*";
        const text = containsMatch[3];
        const nodes = Array.from(doc.querySelectorAll(base || "*")).filter(
          (el) => (el.textContent || "").includes(text),
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
    $.load = load;
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
  // Bundles are already self-contained CJS with exports.* assignments
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
