// AA Car Traders — shared API client, session, cart storage and helpers (window.AA).
// Same-origin app (Python serves both the API and the HTML), so relative "/api/..." paths.
window.AA = (function () {
  const TOKEN_KEY = "aact_token";
  const USER_KEY = "aact_user";
  const CART_KEY = "aact_cart";

  // ---------------- session ----------------
  const getToken = () => localStorage.getItem(TOKEN_KEY);
  function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; }
  }
  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
  const isAdmin = (u) => !!u && u.is_admin && u.role === "admin";
  const isReseller = (u) => !!u && (isAdmin(u) || (u.role === "reseller" && u.is_approved));
  const isPendingReseller = (u) => !!u && u.role === "reseller" && !u.is_approved;

  // ---------------- http ----------------
  async function request(path, options = {}) {
    const token = getToken();
    const headers = Object.assign(
      {},
      options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {},
      token ? { Authorization: `Bearer ${token}` } : {},
      options.headers || {}
    );
    let res;
    try {
      res = await fetch(`/api${path}`, { ...options, headers });
    } catch {
      throw new Error("Can't reach the server. Check your internet connection.");
    }
    if (res.status === 204) return undefined;
    const isJson = (res.headers.get("content-type") || "").includes("application/json");
    const data = isJson ? await res.json() : await res.text();
    if (!res.ok) {
      let message = (isJson && (data?.detail || data?.message)) || "Something went wrong";
      if (Array.isArray(message)) message = message.map((m) => (m.msg || "").replace(/^Value error, /, "")).join(" · ");
      const err = new Error(typeof message === "string" ? message : JSON.stringify(message));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // Authenticated file download (ZIP / PDF) — triggers the browser "save as".
  async function download(path, fallbackName) {
    const token = getToken();
    const res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) {
      let msg = "Download failed";
      try { msg = (await res.json()).detail || msg; } catch {}
      throw new Error(msg);
    }
    const cd = res.headers.get("content-disposition") || "";
    const m = cd.match(/filename="?([^";]+)"?/);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = m ? m[1] : fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  // Upload with progress (fetch can't report upload progress, XHR can).
  function upload(file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/media/upload");
      const token = getToken();
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
      xhr.onerror = () => reject(new Error("Upload failed — connection problem."));
      xhr.onload = () => {
        let body = {};
        try { body = JSON.parse(xhr.responseText); } catch {}
        if (xhr.status >= 200 && xhr.status < 300) resolve(body);
        else reject(new Error(typeof body.detail === "string" ? body.detail : "Upload failed."));
      };
      const form = new FormData();
      form.append("file", file);
      xhr.send(form);
    });
  }

  function qs(params) {
    const usp = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") usp.set(k, v);
    });
    const s = usp.toString();
    return s ? `?${s}` : "";
  }
  const json = (method, body) => ({ method, body: JSON.stringify(body) });

  // ---------------- endpoints ----------------
  const Auth = {
    login: (email, password) => request("/auth/login", json("POST", { email, password })),
    adminLogin: (email, password) => request("/auth/admin-login", json("POST", { email, password })),
    register: (payload) => request("/auth/register", json("POST", payload)),
    me: () => request("/auth/me"),
    changePassword: (current_password, new_password) => request("/auth/change-password", json("POST", { current_password, new_password })),
  };
  const Categories = { list: () => request("/categories") };
  const Catalog = { carModels: () => request("/catalog/car-models") };
  const Products = {
    list: (params) => request(`/products${qs(params)}`),
    get: (idOrSlug) => request(`/products/${idOrSlug}`),
    create: (payload) => request("/products", json("POST", payload)),
    update: (id, payload) => request(`/products/${id}`, json("PUT", payload)),
    updateStock: (id, quantity) => request(`/products/${id}/stock?quantity=${quantity}`, { method: "PATCH" }),
    remove: (id) => request(`/products/${id}`, { method: "DELETE" }),
    search: (q) => request(`/search?q=${encodeURIComponent(q)}`),
    mediaZip: (id) => download(`/products/${id}/media.zip`, "product-media.zip"),
    bulkZip: (categorySlug) => download(`/products/bulk/media.zip${qs({ category_slug: categorySlug })}`, "aa-car-traders-media.zip"),
  };
  const WhatsApp = {
    getConfig: () => request("/whatsapp/config"),
    updateConfig: (payload) => request("/whatsapp/config", json("PUT", payload)),
  };
  const Orders = {
    list: () => request("/orders"),
    create: (payload) => request("/orders", json("POST", payload)),
    setStatus: (id, status) => request(`/orders/${id}/status`, json("PATCH", { status })),
    invoiceUrl: (id) => `/api/orders/${id}/invoice.pdf`,
    bookCourier: (id) => request(`/orders/${id}/book-courier`, json("POST", {})),
    track: (id) => request(`/orders/${id}/track`),
  };
  const Banners = {
    active: () => request("/banners"),
    all: () => request("/banners/all"),
    create: (p) => request("/banners", json("POST", p)),
    update: (id, p) => request(`/banners/${id}`, json("PUT", p)),
    remove: (id) => request(`/banners/${id}`, { method: "DELETE" }),
  };
  const Admin = {
    stats: () => request("/admin/stats"),
    activity: (limit = 30) => request(`/admin/activity?limit=${limit}`),
    users: () => request("/admin/users"),
    patchUser: (id, p) => request(`/admin/users/${id}`, json("PATCH", p)),
  };
  const Ai = {
    chat: (payload) => request("/ai/chat", json("POST", payload)),
    visualSearch: (file, make, model) => {
      const form = new FormData();
      form.append("image", file);
      if (make) form.append("vehicle_make", make);
      if (model) form.append("vehicle_model", model);
      return request("/ai/visual-search", { method: "POST", body: form });
    },
  };

  // ---------------- site config (WhatsApp number etc.) ----------------
  const DEFAULT_CFG = {
    whatsapp_number: "923154448835",
    whatsapp_default_message: "Hi AA Car Traders, I'm interested in this product:",
    contact_phone: "03154448835",
    contact_email: "aacartrad3rs@gmail.com",
    site_announcement: null,
  };
  let cfg = { ...DEFAULT_CFG };
  const ready = WhatsApp.getConfig().then((c) => { cfg = { ...DEFAULT_CFG, ...c }; return cfg; }).catch(() => cfg);
  const config = () => cfg;

  const digits = (s) => String(s || "").replace(/\D/g, "");
  // Pakistani numbers: 0315… -> 92315…
  function waNumber(raw) {
    let d = digits(raw);
    if (d.startsWith("00")) d = d.slice(2);
    if (d.startsWith("0")) d = "92" + d.slice(1);
    return d;
  }

  function buildWhatsAppLink(product, pageUrl) {
    const number = waNumber((product && product.whatsapp_number) || cfg.whatsapp_number);
    const intro = (product && product.whatsapp_message) || cfg.whatsapp_default_message;
    const url = pageUrl || `${window.location.origin}/products/${product.slug}`;
    const lines = [
      intro, "",
      `*${product.title}*`,
      `Price: PKR ${Number(product.retail_price).toLocaleString()}`,
      `Category: ${product.category ? product.category.name : ""}`,
      `Fits: ${product.vehicle_make} ${product.vehicle_model}`,
      `Link: ${url}`,
    ];
    return `https://wa.me/${number}?text=${encodeURIComponent(lines.join("\n"))}`;
  }
  const buildGeneralWhatsAppLink = (msg) =>
    `https://wa.me/${waNumber(cfg.whatsapp_number)}?text=${encodeURIComponent(msg || "Hi AA Car Traders, I'd like some help finding a part.")}`;

  // ---------------- cart (localStorage) ----------------
  const Cart = (function () {
    const listeners = [];
    const read = () => { try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); } catch { return []; } };
    const write = (items) => { localStorage.setItem(CART_KEY, JSON.stringify(items)); listeners.forEach((fn) => fn(items)); };
    return {
      items: read,
      count: () => read().reduce((n, i) => n + i.qty, 0),
      add(p, qty = 1) {
        const items = read();
        const max = Math.max(0, p.stock_quantity ?? 999);
        const line = items.find((i) => i.id === p.id);
        if (line) line.qty = Math.min(max || 999, line.qty + qty);
        else items.push({
          id: p.id, slug: p.slug, title: p.title, price: p.retail_price,
          wholesale: typeof p.wholesale_price === "number" ? p.wholesale_price : null,
          thumb: p.thumbnail_url || null, qty: Math.min(max || 999, qty), max,
        });
        write(items);
      },
      setQty(id, qty) {
        write(read().map((i) => (i.id === id ? { ...i, qty: Math.max(1, Math.min(i.max || 999, qty)) } : i)));
      },
      remove: (id) => write(read().filter((i) => i.id !== id)),
      clear: () => write([]),
      onChange: (fn) => listeners.push(fn),
    };
  })();

  // ---------------- helpers ----------------
  const fmtPKR = (n) => `PKR ${Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  // API timestamps are UTC without a "Z" suffix
  const parseUTC = (s) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + "Z");
  function timeAgo(s) {
    const sec = Math.max(0, (Date.now() - parseUTC(s).getTime()) / 1000);
    if (sec < 60) return "just now";
    const m = Math.floor(sec / 60); if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
    const d = Math.floor(h / 24); if (d < 30) return `${d} day${d > 1 ? "s" : ""} ago`;
    return parseUTC(s).toLocaleDateString();
  }
  const PLACEHOLDER = "/static/images/placeholder.svg";
  // <img> with graceful fallback when a photo URL is broken / blocked
  const imgTag = (src, alt, cls = "") =>
    `<img src="${escapeHtml(src || PLACEHOLDER)}" alt="${escapeHtml(alt || "")}" loading="lazy" class="${cls}" onerror="this.onerror=null;this.src='${PLACEHOLDER}'" />`;
  const isVideoUrl = (u) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u || "");
  const toast = (msg, kind = "ok") => {
    const root = document.getElementById("toastRoot");
    if (!root) return;
    const el = document.createElement("div");
    el.className = `toast pointer-events-auto max-w-sm rounded-lg border px-4 py-2.5 text-sm font-medium shadow-xl ${
      kind === "err" ? "border-crimson/60 bg-carbon-900 text-crimson-bright" : "border-green-600/50 bg-carbon-900 text-green-400"}`;
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  };

  return {
    getToken, setSession, getUser, clearSession, isAdmin, isReseller, isPendingReseller,
    request, download, upload,
    Auth, Categories, Catalog, Products, WhatsApp, Orders, Banners, Admin, Ai, Cart,
    ready, config, waNumber, buildWhatsAppLink, buildGeneralWhatsAppLink,
    fmtPKR, escapeHtml, parseUTC, timeAgo, imgTag, isVideoUrl, toast, qs, PLACEHOLDER,
  };
})();
