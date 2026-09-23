// AA Car Traders — Admin panel (single page, hash-routed tabs).
(function () {
  const esc = AA.escapeHtml;
  const root = document.getElementById("adminRoot");
  const TABS = [
    ["dashboard", "Dashboard", '<path d="M3 13a9 9 0 1 1 18 0"/><path d="m12 13 4-4"/><circle cx="12" cy="13" r="1.2"/>'],
    ["products", "Products", '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'],
    ["orders", "Orders", '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>'],
    ["customers", "Customers", '<circle cx="9" cy="8" r="3.5"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.5A7 7 0 0 1 22 21"/>'],
    ["analytics", "Analytics", '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'],
  ];
  const icon = (paths, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

  let user = null, cfg = AA.config();
  let tab = "products";
  const S = { categories: [], models: null, products: [], activity: [], sort: "date", filter: "", collapsed: new Set(), pf: null, media: [] };

  // ================================================================ boot / guard
  function toLogin() { AA.clearSession(); location.replace("/admin/login"); }
  if (!AA.getToken()) toLogin();
  else AA.Auth.me().then(async (fresh) => {
    if (!AA.isAdmin(fresh)) return toLogin();
    AA.setSession(AA.getToken(), fresh);
    user = fresh;
    cfg = await AA.ready;
    shell();
  }).catch(toLogin);

  // ================================================================ shell
  function shell() {
    root.innerHTML = `
    <header class="sticky top-0 z-40 border-b border-carbon-600/70 bg-carbon-950/95 backdrop-blur">
      <div class="mx-auto flex h-[68px] max-w-[1500px] items-center gap-3 px-3 sm:px-5">
        <nav id="adminTabs" class="order-2 hidden min-w-0 flex-1 items-center gap-1 lg:order-1 lg:flex"></nav>
        <a href="/admin#products" class="order-1 flex shrink-0 justify-center lg:order-2 lg:flex-none" aria-label="Dashboard"><img src="/static/images/logo.png" alt="AA Car Traders" class="h-[54px] w-auto" /></a>
        <div class="order-3 ml-auto flex flex-1 items-center justify-end gap-1.5 sm:gap-2">
          <div class="mr-1 hidden items-center gap-2 rounded-lg border border-crimson/60 px-2.5 py-1 md:flex">
            <span class="flex h-7 w-7 items-center justify-center rounded-full border border-crimson/70 text-crimson-bright">${icon('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', 16)}</span>
            <span class="leading-tight"><span class="block text-[12px] font-semibold text-silver-bright">Admin</span><span class="block text-[10px] text-silver-dim">Admin Profile</span></span>
          </div>
          <a href="#settings" data-tab-link="settings" class="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-silver-dim hover:bg-carbon-800 hover:text-white">${icon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>')}<span class="hidden sm:inline">Settings</span></a>
          <button id="logoutBtn" class="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-silver-dim hover:bg-carbon-800 hover:text-white">${icon('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>')}<span class="hidden sm:inline">Logout</span></button>
        </div>
      </div>
      <nav id="adminTabsMobile" class="flex gap-1 overflow-x-auto border-t border-carbon-700 px-2 py-1.5 lg:hidden"></nav>
    </header>
    <main id="tabContent" class="mx-auto max-w-[1500px] px-3 py-5 sm:px-5"></main>`;

    const tabsHtml = (mobile) => TABS.map(([id, label, paths]) =>
      `<a href="#${id}" data-tab-link="${id}" class="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${mobile ? "" : "lg:px-3.5"}">${icon(paths)}<span>${label}</span></a>`).join("");
    document.getElementById("adminTabs").innerHTML = tabsHtml(false);
    document.getElementById("adminTabsMobile").innerHTML = tabsHtml(true);
    document.getElementById("logoutBtn").addEventListener("click", toLogin);
    window.addEventListener("hashchange", route);
    route();
  }

  function route() {
    const h = (location.hash || "#products").slice(1);
    tab = [...TABS.map((t) => t[0]), "settings"].includes(h) ? h : "products";
    document.querySelectorAll("[data-tab-link]").forEach((a) => {
      const on = a.dataset.tabLink === tab;
      a.classList.toggle("bg-crimson/15", on); a.classList.toggle("text-crimson-bright", on);
      a.classList.toggle("text-silver-dim", !on && a.dataset.tabLink !== "settings");
      a.classList.toggle("hover:text-white", !on);
    });
    ({ dashboard: renderDashboard, products: renderProducts, orders: renderOrders, customers: renderCustomers, analytics: renderAnalytics, settings: renderSettings })[tab]();
    window.scrollTo(0, 0);
  }
  const content = () => document.getElementById("tabContent");
  const loading = (t = "Loading…") => `<div class="flex items-center justify-center gap-2 py-24 text-silver-dim"><span class="spinner"></span> ${t}</div>`;
  const cardHead = (title, right = "") => `<div class="mb-3 flex items-center justify-between gap-2"><h2 class="text-[15px] font-bold text-silver-bright">${title}</h2>${right}</div>`;
  const errBox = (e) => `<p class="py-16 text-center text-sm text-crimson-bright">${esc(e.message || e)}</p>`;

  // ================================================================ PRODUCTS TAB (matches the posting mock-up)
  const DEFAULT_MSG_PH = "e.g. “Interested in this body kit, details please.”";

  function blankForm() {
    return { id: null, title: "", categoryId: "", carKey: "", make: "", model: "", yearFrom: "", yearTo: "", wholesale: "", retail: "",
      stock: 1, sku: "", description: "", waNumber: "", waMessage: "" };
  }
  function formFromProduct(p) {
    const known = S.models && S.models.makes.some((m) => m.make === p.vehicle_make && m.models.includes(p.vehicle_model));
    const universal = p.vehicle_make.toLowerCase() === "universal";
    return { id: p.id, title: p.title, categoryId: p.category.id, carKey: universal ? "universal" : known ? `${p.vehicle_make}|${p.vehicle_model}` : "other",
      make: p.vehicle_make, model: p.vehicle_model, yearFrom: p.vehicle_year_from ?? "", yearTo: p.vehicle_year_to ?? "",
      wholesale: p.wholesale_price, retail: p.retail_price, stock: p.stock_quantity, sku: p.sku || "", description: p.description,
      waNumber: p.whatsapp_number || "", waMessage: p.whatsapp_message || "" };
  }
  function mediaFromProduct(p) {
    const list = [];
    const seen = new Set();
    const push = (url, type, cover) => { if (!url || seen.has(url)) return; seen.add(url); list.push({ key: url, url, type, name: url.split("/").pop().split("?")[0], progress: 1, status: "done", cover: !!cover }); };
    push(p.thumbnail_url, "image", true);
    p.media.filter((m) => m.media_type === "image").forEach((m) => push(m.url, "image"));
    push(p.video_url, "video");
    p.media.filter((m) => m.media_type === "video").forEach((m) => push(m.url, "video"));
    return list;
  }

  async function renderProducts() {
    content().innerHTML = loading("Loading products…");
    try {
      const [cats, models, products, activity] = await Promise.all([
        AA.Categories.list(), S.models ? Promise.resolve(S.models) : AA.Catalog.carModels(),
        AA.Products.list({ limit: 200, include_inactive: true }), AA.Admin.activity(30),
      ]);
      S.categories = cats; S.models = models; S.products = products; S.activity = activity;
    } catch (e) { content().innerHTML = errBox(e); return; }
    if (!S.pf) { S.pf = blankForm(); S.media = []; }

    content().innerHTML = `
    <div class="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_270px] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section id="formCard" class="card card-red p-4 sm:p-5"></section>
      <section id="postedCard" class="card p-4 sm:p-5"></section>
      <section id="feedCard" class="card p-4 sm:p-5 lg:col-span-2 xl:col-span-1"></section>
    </div>`;
    renderForm(); renderPosted(); renderFeed();
  }

  // ---------- left: the form ----------
  function renderForm() {
    const f = S.pf, editing = !!f.id;
    const catOptions = S.categories.map((c) => `<option value="${esc(c.id)}" ${c.id === f.categoryId ? "selected" : ""}>${esc(c.name)}</option>`).join("");
    const modelOptions = `<option value="">Select car model…</option>
      <option value="universal" ${f.carKey === "universal" ? "selected" : ""}>Universal — fits all cars</option>
      ${S.models.makes.map((mk) => `<optgroup label="${esc(mk.make)}">${mk.models.map((md) => `<option value="${esc(mk.make)}|${esc(md)}" ${f.carKey === `${mk.make}|${md}` ? "selected" : ""}>${esc(mk.make)} ${esc(md)}</option>`).join("")}</optgroup>`).join("")}
      <option value="other" ${f.carKey === "other" ? "selected" : ""}>Other car (type it in)…</option>`;

    document.getElementById("formCard").innerHTML = `
    <div class="mb-3 flex items-center justify-between gap-2">
      <h2 class="text-[15px] font-bold text-silver-bright">${editing ? "Edit product" : "Post a new product"}</h2>
      ${editing ? `<button id="cancelEdit" type="button" class="text-xs font-semibold text-crimson-bright hover:underline">✕ Cancel editing</button>` : ""}
    </div>
    <form id="productForm" class="space-y-3.5" novalidate>
      <div><label class="lbl" for="f_title">Product Title</label>
        <input id="f_title" class="field field-red" maxlength="200" placeholder="Product Title" value="${esc(f.title)}" /></div>

      <div><label class="lbl">Select Category &amp; Car Model</label>
        <div class="grid gap-2 sm:grid-cols-2">
          <select id="f_category" class="field field-red"><option value="">Select category…</option>${catOptions}</select>
          <select id="f_car" class="field field-red">${modelOptions}</select>
        </div>
        <div id="otherCar" class="${f.carKey === "other" ? "" : "hidden"} mt-2 grid gap-2 sm:grid-cols-2">
          <input id="f_make" class="field" placeholder="Make (e.g. Lexus)" value="${esc(f.carKey === "other" ? f.make : "")}" />
          <input id="f_model" class="field" placeholder="Model (e.g. RX 350)" value="${esc(f.carKey === "other" ? f.model : "")}" />
        </div>
        <div class="mt-2 grid grid-cols-2 gap-2">
          <input id="f_yfrom" type="number" class="field" placeholder="Year from (optional)" value="${esc(f.yearFrom)}" />
          <input id="f_yto" type="number" class="field" placeholder="Year to (optional)" value="${esc(f.yearTo)}" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div><label class="lbl" for="f_wholesale">Wholesale Price (PKR)</label><input id="f_wholesale" type="number" min="0" class="field field-red" placeholder="PKR" value="${esc(f.wholesale)}" /></div>
        <div><label class="lbl" for="f_retail">Retail Price (PKR)</label><input id="f_retail" type="number" min="0" class="field field-red" placeholder="PKR" value="${esc(f.retail)}" /></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="lbl" for="f_stock">Stock quantity</label><input id="f_stock" type="number" min="0" class="field" value="${esc(f.stock)}" /></div>
        <div><label class="lbl" for="f_sku">SKU (optional)</label><input id="f_sku" class="field" value="${esc(f.sku)}" /></div>
      </div>

      <div><label class="lbl" for="f_desc">Description</label>
        <textarea id="f_desc" rows="3" class="field field-red" placeholder="Description">${esc(f.description)}</textarea></div>

      <div>
        <label class="lbl">HD Images &amp; Video Upload</label>
        <div id="dropzone" class="dropzone cursor-pointer p-4 text-center" tabindex="0" role="button" aria-label="Upload images and videos">
          <input id="fileInput" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" class="hidden" />
          <div class="flex items-center justify-center gap-3 text-silver-dim">
            <span class="text-2xl text-crimson-bright">⬆</span>
            <span class="text-left text-xs leading-snug"><b class="text-silver-bright">Drag &amp; drop</b> photos / video here<br/>or click to browse · JPG, PNG, WEBP, MP4 (video up to ${"120"} MB)</span>
          </div>
          <div class="mt-3 text-left"><div class="mb-1 flex justify-between text-[11px] text-silver-dim"><span id="overallLabel">No files yet</span><span id="overallPct"></span></div>
            <div class="progress"><span id="overallBar" style="width:0%"></span></div></div>
        </div>
        <div id="mediaList" class="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3"></div>
        <p class="mt-1.5 text-[11px] text-silver-dim">The ★ image is the cover photo shown on the store. Add several angles for a better listing.</p>
      </div>

      <div class="grid gap-3 sm:grid-cols-[1fr_1fr]">
        <div class="rounded-xl border border-carbon-600 bg-carbon-950/60 p-3">
          <p class="mb-2 text-[13px] font-bold text-silver-bright">WhatsApp Settings</p>
          <label class="lbl" for="f_wa">Seller Number</label>
          <input id="f_wa" type="tel" class="field field-red" placeholder="03xx xxxxxxx" value="${esc(f.waNumber || cfg.whatsapp_number)}" />
          <label class="lbl mt-2" for="f_wamsg">Pre-filled WhatsApp Message</label>
          <input id="f_wamsg" maxlength="255" class="field field-red" placeholder="${esc(DEFAULT_MSG_PH)}" value="${esc(f.waMessage)}" />
        </div>
        <div class="rounded-xl border border-carbon-600 bg-carbon-950/60 p-3">
          <p class="mb-2 text-[13px] font-bold text-silver-bright">Contact info</p>
          <p class="flex items-center gap-2 text-sm text-silver"><span class="text-crimson-bright">📞</span> ${esc(cfg.contact_phone)}</p>
          <p class="mt-1.5 flex items-center gap-2 break-all text-sm text-silver"><span class="text-crimson-bright">✉</span> ${esc(cfg.contact_email)}</p>
          <p class="mt-2 text-[11px] leading-snug text-silver-dim">Shown to customers. Change it in Settings.</p>
        </div>
      </div>

      <p id="formMsg" class="hidden text-sm"></p>
      <button id="postBtn" type="submit" class="btn-crimson w-full py-3 text-[15px]">${editing ? "Save Changes" : "Post Product"}</button>
    </form>`;

    bindForm();
    renderMediaList();
  }

  function bindForm() {
    const $ = (id) => document.getElementById(id);
    const cancel = $("cancelEdit");
    if (cancel) cancel.addEventListener("click", () => { S.pf = blankForm(); S.media = []; renderForm(); renderPosted(); });
    $("f_car").addEventListener("change", (e) => $("otherCar").classList.toggle("hidden", e.target.value !== "other"));

    // drag & drop + click to browse
    const dz = $("dropzone"), fi = $("fileInput");
    dz.addEventListener("click", (e) => { if (!e.target.closest("button")) fi.click(); });
    dz.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fi.click(); } });
    ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("drag"); }));
    dz.addEventListener("drop", (e) => handleFiles(e.dataTransfer.files));
    fi.addEventListener("change", () => { handleFiles(fi.files); fi.value = ""; });

    $("productForm").addEventListener("submit", submitProduct);
  }

  // ---------- uploads ----------
  const IMG_MAX = 12 * 1024 * 1024, VID_MAX = 120 * 1024 * 1024;
  function handleFiles(files) {
    Array.from(files).forEach((file) => {
      const isImg = /^image\/(jpeg|png|webp|gif)$/.test(file.type), isVid = /^video\/(mp4|webm|quicktime)$/.test(file.type);
      if (!isImg && !isVid) return AA.toast(`“${file.name}” isn't a supported photo/video`, "err");
      if (file.size > (isImg ? IMG_MAX : VID_MAX)) return AA.toast(`“${file.name}” is too large (max ${isImg ? "12" : "120"} MB)`, "err");
      const item = { key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, url: null, type: isImg ? "image" : "video", name: file.name, progress: 0, status: "uploading", cover: false, preview: isImg ? URL.createObjectURL(file) : null };
      if (isImg && !S.media.some((m) => m.type === "image")) item.cover = true;
      S.media.push(item);
      AA.upload(file, (p) => { item.progress = p; updateOverall(); paintItem(item); })
        .then((res) => { item.url = res.url; item.status = "done"; item.progress = 1; })
        .catch((err) => { item.status = "error"; item.error = err.message; })
        .finally(() => { renderMediaList(); });
    });
    renderMediaList();
  }

  function updateOverall() {
    const bar = document.getElementById("overallBar"); if (!bar) return;
    const total = S.media.length, done = S.media.filter((m) => m.status === "done").length;
    const up = S.media.filter((m) => m.status === "uploading");
    const pct = total ? Math.round((S.media.reduce((s, m) => s + (m.status === "error" ? 0 : m.progress), 0) / total) * 100) : 0;
    bar.style.width = `${pct}%`;
    document.getElementById("overallPct").textContent = total ? `${pct}%` : "";
    document.getElementById("overallLabel").textContent = !total ? "No files yet" : up.length ? `Uploading ${up.length} file${up.length > 1 ? "s" : ""}…` : `${done} file${done === 1 ? "" : "s"} ready`;
  }
  function paintItem(item) {
    const el = document.querySelector(`[data-mkey="${item.key}"] .progress > span`);
    if (el) el.style.width = `${Math.round(item.progress * 100)}%`;
  }
  function renderMediaList() {
    const list = document.getElementById("mediaList"); if (!list) return;
    list.innerHTML = S.media.map((m) => {
      const src = m.preview || (m.type === "image" ? m.url : null);
      return `
      <div data-mkey="${m.key}" class="group relative overflow-hidden rounded-lg border ${m.status === "error" ? "border-crimson" : "border-carbon-600"} bg-carbon-950">
        <div class="aspect-[4/3] bg-carbon-800">${m.type === "image" ? AA.imgTag(src, m.name, "h-full w-full object-cover")
          : `<div class="flex h-full flex-col items-center justify-center gap-1 text-crimson-bright"><span class="text-2xl">▶</span><span class="px-2 text-center text-[10px] text-silver-dim">${esc(m.name)}</span></div>`}</div>
        ${m.status === "uploading" ? `<div class="absolute inset-x-0 bottom-0 bg-carbon-950/85 p-1.5"><div class="progress"><span style="width:${Math.round(m.progress * 100)}%"></span></div></div>` : ""}
        ${m.status === "error" ? `<div class="absolute inset-x-0 bottom-0 bg-carbon-950/90 p-1.5 text-[10px] leading-tight text-crimson-bright">${esc(m.error || "Failed")}</div>` : ""}
        <button type="button" data-rm="${m.key}" aria-label="Remove" class="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-carbon-950/85 text-xs text-white hover:bg-crimson">✕</button>
        ${m.type === "image" && m.status === "done" ? `<button type="button" data-cover="${m.key}" title="Set as cover" class="absolute left-1 top-1 flex h-6 items-center rounded-full px-2 text-[11px] font-semibold ${m.cover ? "bg-crimson text-white" : "bg-carbon-950/85 text-silver hover:bg-carbon-700"}">★ ${m.cover ? "Cover" : ""}</button>` : ""}
      </div>`;
    }).join("");
    list.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => {
      const i = S.media.findIndex((m) => m.key === b.dataset.rm);
      const wasCover = S.media[i] && S.media[i].cover;
      S.media.splice(i, 1);
      if (wasCover) { const nx = S.media.find((m) => m.type === "image"); if (nx) nx.cover = true; }
      renderMediaList();
    }));
    list.querySelectorAll("[data-cover]").forEach((b) => b.addEventListener("click", () => {
      S.media.forEach((m) => (m.cover = m.key === b.dataset.cover)); renderMediaList();
    }));
    updateOverall();
  }

  // ---------- submit ----------
  function msg(text, kind) {
    const el = document.getElementById("formMsg"); if (!el) return;
    el.textContent = text; el.className = `text-sm ${kind === "ok" ? "text-green-400" : "text-crimson-bright"}`;
  }
  async function submitProduct(e) {
    e.preventDefault();
    const $ = (id) => document.getElementById(id);
    const title = $("f_title").value.trim(), categoryId = $("f_category").value, car = $("f_car").value;
    const wholesale = $("f_wholesale").value, retail = $("f_retail").value, description = $("f_desc").value.trim();
    let make, model;
    if (car === "universal") { make = "Universal"; model = "Universal"; }
    else if (car === "other") { make = $("f_make").value.trim(); model = $("f_model").value.trim(); }
    else if (car) [make, model] = car.split("|");

    if (title.length < 2) return msg("Please enter a product title.");
    if (!categoryId) return msg("Please choose a category.");
    if (!make || !model) return msg("Please choose the car model (or “Universal”).");
    if (wholesale === "" || retail === "") return msg("Please enter both wholesale and retail prices.");
    if (!description) return msg("Please add a description.");
    if (S.media.some((m) => m.status === "uploading")) return msg("Please wait — files are still uploading.");
    if (Number(retail) < Number(wholesale) && !confirm("Retail price is LOWER than wholesale price. Post anyway?")) return;

    const done = S.media.filter((m) => m.status === "done");
    const imgs = done.filter((m) => m.type === "image"), vids = done.filter((m) => m.type === "video");
    const cover = imgs.find((m) => m.cover) || imgs[0];
    const waRaw = $("f_wa").value.trim();
    const waDefault = AA.waNumber(cfg.whatsapp_number);
    const payload = {
      title, description, category_id: categoryId, vehicle_make: make, vehicle_model: model,
      vehicle_year_from: $("f_yfrom").value ? Number($("f_yfrom").value) : null,
      vehicle_year_to: $("f_yto").value ? Number($("f_yto").value) : null,
      wholesale_price: Number(wholesale), retail_price: Number(retail), stock_quantity: Number($("f_stock").value || 0),
      sku: $("f_sku").value.trim() || null,
      thumbnail_url: cover ? cover.url : null,
      extra_media_urls: imgs.filter((m) => m !== cover).map((m) => m.url),
      video_url: vids[0] ? vids[0].url : null,
      extra_video_urls: vids.slice(1).map((m) => m.url),
      whatsapp_number: waRaw && AA.waNumber(waRaw) !== waDefault ? waRaw : null,
      whatsapp_message: $("f_wamsg").value.trim() || null,
    };
    const btn = $("postBtn"), editing = !!S.pf.id;
    btn.disabled = true; btn.textContent = editing ? "Saving…" : "Posting…";
    try {
      editing ? await AA.Products.update(S.pf.id, payload) : await AA.Products.create(payload);
      AA.toast(editing ? "Product updated" : "Product posted — it's live on the store!");
      S.pf = blankForm(); S.media = [];
      const [products, activity] = await Promise.all([AA.Products.list({ limit: 200, include_inactive: true }), AA.Admin.activity(30)]);
      S.products = products; S.activity = activity;
      renderForm(); renderPosted(); renderFeed();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (ex) { msg(ex.message); btn.disabled = false; btn.textContent = editing ? "Save Changes" : "Post Product"; }
  }

  // ---------- middle: posted products ----------
  function renderPosted() {
    const card = document.getElementById("postedCard"); if (!card) return;
    const f = S.filter.toLowerCase();
    let list = S.products.filter((p) => !f || `${p.title} ${p.vehicle_make} ${p.vehicle_model} ${p.category.name}`.toLowerCase().includes(f));
    const cmp = { date: (a, b) => new Date(b.created_at) - new Date(a.created_at), low: (a, b) => a.retail_price - b.retail_price, high: (a, b) => b.retail_price - a.retail_price }[S.sort];
    list.sort(cmp);
    const groups = new Map();
    list.forEach((p) => { const k = p.category.name; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); });

    card.innerHTML = `
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-[15px] font-bold text-silver-bright">Posted Products <span class="text-xs font-normal text-silver-dim">(${S.products.length})</span></h2>
        <select id="sortSel" class="field w-auto py-1.5 text-xs"><option value="date" ${S.sort === "date" ? "selected" : ""}>Sort by Date</option><option value="low" ${S.sort === "low" ? "selected" : ""}>Price: low → high</option><option value="high" ${S.sort === "high" ? "selected" : ""}>Price: high → low</option></select>
      </div>
      <input id="postedFilter" class="field mb-3 py-2 text-sm" placeholder="Search posted products…" value="${esc(S.filter)}" />
      <div id="postedList" class="max-h-[none] space-y-1 lg:max-h-[1180px] lg:overflow-y-auto lg:pr-1">
        ${groups.size ? [...groups].map(([cat, items]) => `
          <div class="rounded-xl border border-carbon-700/80">
            <button type="button" data-grp="${esc(cat)}" class="flex w-full items-center justify-between px-3 py-2.5 text-left">
              <span class="text-[12px] font-bold uppercase tracking-wider text-silver-bright">${esc(cat)} <span class="font-normal text-silver-dim">(${items.length})</span></span>
              <span class="text-silver-dim transition ${S.collapsed.has(cat) ? "" : "rotate-180"}">⌃</span>
            </button>
            <div class="${S.collapsed.has(cat) ? "hidden" : ""} space-y-1.5 px-2 pb-2">
              ${items.map(rowHtml).join("")}
            </div>
          </div>`).join("") : `<p class="py-12 text-center text-sm text-silver-dim">${S.products.length ? "No products match your search." : "Nothing posted yet — use the form to add your first product."}</p>`}
      </div>`;

    card.querySelector("#sortSel").addEventListener("change", (e) => { S.sort = e.target.value; renderPosted(); });
    const pf = card.querySelector("#postedFilter");
    pf.addEventListener("input", (e) => { S.filter = e.target.value; const pos = e.target.selectionStart; renderPosted(); const n = document.getElementById("postedFilter"); n.focus(); n.setSelectionRange(pos, pos); });
    card.querySelectorAll("[data-grp]").forEach((b) => b.addEventListener("click", () => { const k = b.dataset.grp; S.collapsed.has(k) ? S.collapsed.delete(k) : S.collapsed.add(k); renderPosted(); }));
    card.querySelectorAll("[data-menu]").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      const m = card.querySelector(`[data-menu-for="${b.dataset.menu}"]`);
      card.querySelectorAll("[data-menu-for]").forEach((x) => x !== m && x.classList.add("hidden"));
      m.classList.toggle("hidden");
    }));
    card.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => editProduct(b.dataset.edit)));
    card.querySelectorAll("[data-toggle]").forEach((b) => b.addEventListener("click", () => toggleProduct(b.dataset.toggle)));
    card.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => deleteProduct(b.dataset.del)));
  }
  document.addEventListener("click", () => document.querySelectorAll("[data-menu-for]").forEach((x) => x.classList.add("hidden")));

  function rowHtml(p) {
    const low = p.stock_quantity <= 3;
    return `
    <div class="relative flex items-center gap-2.5 rounded-lg border border-carbon-700 bg-carbon-900/70 p-2 ${p.is_active ? "" : "opacity-60"}">
      <a href="/products/${esc(p.slug)}" target="_blank" class="h-12 w-14 shrink-0 overflow-hidden rounded-md bg-carbon-800">${AA.imgTag(p.thumbnail_url, p.title, "h-full w-full object-cover")}</a>
      <div class="min-w-0 flex-1">
        <p class="line-clamp-2 text-[12.5px] font-semibold leading-tight text-silver-bright">${esc(p.title)}</p>
        <p class="mt-0.5 text-xs font-bold text-silver">${AA.fmtPKR(p.retail_price)} <span class="font-normal ${low ? "text-crimson-bright" : "text-silver-dim"}">· stock ${p.stock_quantity}</span></p>
      </div>
      <div class="flex shrink-0 flex-col items-end gap-1">
        <button type="button" data-menu="${esc(p.id)}" aria-label="Actions" class="rounded px-1.5 text-lg leading-none text-silver-dim hover:bg-carbon-700 hover:text-white">⋯</button>
        <span class="rounded-md px-2 py-0.5 text-[10.5px] font-semibold ${p.is_active ? "border border-green-600/40 bg-green-600/15 text-green-400" : "border border-carbon-600 bg-carbon-800 text-silver-dim"}">${p.is_active ? "Active" : "Hidden"}</span>
      </div>
      <div data-menu-for="${esc(p.id)}" class="absolute right-2 top-9 z-20 hidden w-36 overflow-hidden rounded-lg border border-carbon-600 bg-carbon-950 text-sm shadow-2xl">
        <button data-edit="${esc(p.id)}" class="block w-full px-3 py-2 text-left text-silver hover:bg-carbon-800">✏️ Edit</button>
        <button data-toggle="${esc(p.id)}" class="block w-full px-3 py-2 text-left text-silver hover:bg-carbon-800">${p.is_active ? "🙈 Hide from store" : "👁 Show on store"}</button>
        <button data-del="${esc(p.id)}" class="block w-full px-3 py-2 text-left text-crimson-bright hover:bg-carbon-800">🗑 Delete</button>
      </div>
    </div>`;
  }

  function editProduct(id) {
    const p = S.products.find((x) => x.id === id); if (!p) return;
    S.pf = formFromProduct(p); S.media = mediaFromProduct(p);
    renderForm();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function toggleProduct(id) {
    const p = S.products.find((x) => x.id === id);
    try {
      await AA.Products.update(id, { is_active: !p.is_active });
      AA.toast(p.is_active ? "Hidden from the store" : "Now visible on the store");
      await refreshProductsAndFeed();
    } catch (e) { AA.toast(e.message, "err"); }
  }
  async function deleteProduct(id) {
    const p = S.products.find((x) => x.id === id);
    if (!confirm(`Delete “${p.title}”? This can't be undone.`)) return;
    try {
      const r = await AA.Products.remove(id);
      AA.toast(r && r.archived ? "Product has past orders, so it was hidden instead of deleted" : "Product deleted");
      if (S.pf && S.pf.id === id) { S.pf = blankForm(); S.media = []; renderForm(); }
      await refreshProductsAndFeed();
    } catch (e) { AA.toast(e.message, "err"); }
  }
  async function refreshProductsAndFeed() {
    const [products, activity] = await Promise.all([AA.Products.list({ limit: 200, include_inactive: true }), AA.Admin.activity(30)]);
    S.products = products; S.activity = activity; renderPosted(); renderFeed();
  }

  // ---------- right: activity feed ----------
  const ACT_ICON = { product_posted: "🆕", product_updated: "✏️", product_deleted: "🗑", product_archived: "📦", product_visibility: "👁", stock_updated: "📊", order_placed: "🛒", order_status: "🚚", user_registered: "👤", user_status: "👤", user_approval: "✅", settings_updated: "⚙️", banner_added: "🖼", banner_removed: "🖼" };
  function feedHtml(list) {
    return list.length ? list.map((a) => `
      <li class="flex gap-2.5 py-2.5">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-crimson/50 bg-crimson/10 text-sm">${ACT_ICON[a.action] || "•"}</span>
        <div class="min-w-0"><p class="text-[12.5px] leading-snug text-silver">${esc(a.detail)}</p>
          <p class="mt-0.5 text-[11px] text-silver-dim">${a.actor ? esc(a.actor) + " · " : ""}${AA.timeAgo(a.created_at)}</p></div>
      </li>`).join("") : `<li class="py-8 text-center text-sm text-silver-dim">No activity yet.</li>`;
  }
  function renderFeed() {
    const c = document.getElementById("feedCard"); if (!c) return;
    c.innerHTML = `${cardHead("Activity Feed")}<ul class="divide-y divide-carbon-700 lg:max-h-[1180px] lg:overflow-y-auto">${feedHtml(S.activity)}</ul>`;
  }

  // ================================================================ DASHBOARD
  async function renderDashboard() {
    content().innerHTML = loading("Loading dashboard…");
    try {
      const [st, orders, activity] = await Promise.all([AA.Admin.stats(), AA.Orders.list(), AA.Admin.activity(8)]);
      const stat = (label, value, sub, tone = "") => `<div class="card p-4"><p class="text-xs text-silver-dim">${label}</p><p class="mt-1 text-2xl font-bold ${tone || "text-silver-bright"}">${value}</p><p class="mt-0.5 text-[11px] text-silver-dim">${sub}</p></div>`;
      content().innerHTML = `
      <h1 class="mb-4 text-lg font-bold text-silver-bright">Dashboard</h1>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        ${stat("Revenue (excl. cancelled)", AA.fmtPKR(st.revenue), `${st.orders_total} orders in total`, "text-green-400")}
        ${stat("Pending orders", st.orders_pending, st.orders_pending ? "Need your attention" : "All caught up", st.orders_pending ? "text-crimson-bright" : "")}
        ${stat("Products", st.products_active, `${st.products_total - st.products_active} hidden · ${st.products_total} total`)}
        ${stat("Customers / Resellers", `${st.customers} / ${st.resellers}`, st.pending_resellers ? `${st.pending_resellers} reseller(s) awaiting approval` : "No pending approvals", st.pending_resellers ? "" : "")}
      </div>
      <div class="mt-4 grid gap-4 lg:grid-cols-3">
        <section class="card p-4 lg:col-span-2">${cardHead("Recent orders", `<a href="#orders" class="text-xs font-semibold text-crimson-bright hover:underline">View all →</a>`)}
          ${orders.length ? `<div class="overflow-x-auto"><table class="w-full min-w-[520px] text-left text-sm"><tbody class="divide-y divide-carbon-700">
            ${orders.slice(0, 6).map((o) => `<tr><td class="py-2.5 pr-3 font-semibold text-silver-bright">${esc(o.order_number)}</td><td class="pr-3 text-silver-dim">${esc(o.customer_name)}</td><td class="pr-3">${statusPill(o.status)}</td><td class="pr-3 font-semibold">${AA.fmtPKR(o.total_amount)}</td><td class="text-right text-xs text-silver-dim">${AA.timeAgo(o.created_at)}</td></tr>`).join("")}
          </tbody></table></div>` : `<p class="py-8 text-center text-sm text-silver-dim">No orders yet.</p>`}
        </section>
        <section class="card p-4">${cardHead("Low stock", `<span class="text-[11px] text-silver-dim">≤ 3 left</span>`)}
          ${st.low_stock.length ? `<ul class="divide-y divide-carbon-700">${st.low_stock.map((p) => `<li class="flex items-center justify-between gap-2 py-2 text-sm"><span class="line-clamp-1 text-silver">${esc(p.title)}</span><span class="shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${p.stock === 0 ? "bg-crimson/20 text-crimson-bright" : "bg-yellow-500/15 text-yellow-400"}">${p.stock === 0 ? "Out" : p.stock + " left"}</span></li>`).join("")}</ul>` : `<p class="py-8 text-center text-sm text-silver-dim">Stock levels look healthy ✔</p>`}
        </section>
        <section class="card p-4 lg:col-span-3">${cardHead("Latest activity")}<ul class="grid divide-y divide-carbon-700 md:grid-cols-2 md:gap-x-8 md:divide-y-0">${feedHtml(activity)}</ul></section>
      </div>`;
    } catch (e) { content().innerHTML = errBox(e); }
  }

  const STATUS_STYLE = { pending: "border-yellow-500/40 bg-yellow-500/10 text-yellow-400", confirmed: "border-sky-500/40 bg-sky-500/10 text-sky-400", shipped: "border-violet-500/40 bg-violet-500/10 text-violet-400", delivered: "border-green-600/40 bg-green-600/10 text-green-400", cancelled: "border-carbon-600 bg-carbon-800 text-silver-dim" };
  const statusPill = (s) => `<span class="rounded-md border px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLE[s] || ""}">${esc(s)}</span>`;

  // ================================================================ ORDERS
  async function renderOrders() {
    content().innerHTML = loading("Loading orders…");
    let orders;
    try { orders = await AA.Orders.list(); } catch (e) { content().innerHTML = errBox(e); return; }
    content().innerHTML = `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2"><h1 class="text-lg font-bold text-silver-bright">Orders <span class="text-sm font-normal text-silver-dim">(${orders.length})</span></h1>
      <select id="orderFilter" class="field w-auto py-2 text-sm"><option value="">All statuses</option>${["pending", "confirmed", "shipped", "delivered", "cancelled"].map((s) => `<option value="${s}" class="capitalize">${s}</option>`).join("")}</select></div>
    <div id="orderList" class="space-y-3"></div>`;
    const paint = (filter) => {
      const list = orders.filter((o) => !filter || o.status === filter);
      document.getElementById("orderList").innerHTML = list.length ? list.map((o) => `
      <div class="card p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div><p class="text-sm font-bold text-silver-bright">${esc(o.order_number)} ${o.is_reseller_order ? '<span class="ml-1 rounded bg-crimson/20 px-1.5 py-0.5 text-[10px] text-crimson-bright">RESELLER</span>' : ""}</p>
            <p class="mt-0.5 text-xs text-silver-dim">${AA.parseUTC(o.created_at).toLocaleString()}</p></div>
          <div class="flex items-center gap-2">
            <select data-status="${esc(o.id)}" class="field w-auto py-1.5 text-xs capitalize">${["pending", "confirmed", "shipped", "delivered", "cancelled"].map((s) => `<option value="${s}" ${o.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
            <a href="${AA.Orders.invoiceUrl(o.id)}" target="_blank" class="btn-ghost px-3 py-1.5 text-xs">Invoice PDF</a>
          </div>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          ${o.courier_tracking_number
            ? `<span class="rounded-md border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-[11px] font-semibold text-violet-300">🚚 Leopards: ${esc(o.courier_tracking_number)}${o.courier_status ? ` — ${esc(o.courier_status)}` : ""}</span>
               <button data-track="${esc(o.id)}" class="btn-ghost px-2.5 py-1 text-[11px]">Check status</button>`
            : o.status === "cancelled"
              ? ""
              : `<button data-book-courier="${esc(o.id)}" class="btn-ghost px-2.5 py-1 text-[11px]">📦 Book with Leopards Courier</button>`}
        </div>
        <div class="mt-3 grid gap-3 md:grid-cols-[1.2fr_1fr]">
          <ul class="space-y-1 text-sm text-silver">${o.items.map((i) => `<li class="flex justify-between gap-3"><span>${i.quantity} × ${esc(i.product_title || "Item")}</span><span class="text-silver-dim">${AA.fmtPKR(i.unit_price * i.quantity)}</span></li>`).join("")}
            <li class="flex justify-between border-t border-carbon-700 pt-1.5 font-bold text-silver-bright"><span>Total (COD)</span><span>${AA.fmtPKR(o.total_amount)}</span></li></ul>
          <div class="text-sm text-silver-dim"><p class="font-semibold text-silver-bright">${esc(o.customer_name)}</p><p>📞 ${esc(o.customer_phone)}</p><p class="mt-0.5 text-xs">${esc(o.customer_address || "—")}</p>
            <a href="https://wa.me/${AA.waNumber(o.customer_phone)}?text=${encodeURIComponent(`Assalam o Alaikum ${o.customer_name}, this is AA Car Traders regarding your order ${o.order_number}.`)}" target="_blank" class="btn-green mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs">💬 WhatsApp customer</a></div>
        </div>
      </div>`).join("") : `<p class="card py-16 text-center text-sm text-silver-dim">No orders${filter ? " with this status" : " yet"}.</p>`;
      document.querySelectorAll("[data-status]").forEach((sel) => sel.addEventListener("change", async () => {
        try { await AA.Orders.setStatus(sel.dataset.status, sel.value); AA.toast("Order status updated"); const o = orders.find((x) => x.id === sel.dataset.status); o.status = sel.value; }
        catch (e) { AA.toast(e.message, "err"); }
      }));
      document.querySelectorAll("[data-book-courier]").forEach((btn) => btn.addEventListener("click", async () => {
        btn.disabled = true; btn.textContent = "Booking…";
        try {
          const updated = await AA.Orders.bookCourier(btn.dataset.bookCourier);
          const o = orders.find((x) => x.id === updated.id);
          Object.assign(o, updated);
          AA.toast(updated.courier_tracking_number.startsWith("MOCK-")
            ? "Booked (mock — add real Leopards API keys in .env for live bookings)" : "Booked with Leopards Courier");
          paint(document.getElementById("orderFilter").value);
        } catch (e) { AA.toast(e.message, "err"); btn.disabled = false; btn.textContent = "📦 Book with Leopards Courier"; }
      }));
      document.querySelectorAll("[data-track]").forEach((btn) => btn.addEventListener("click", async () => {
        btn.disabled = true; btn.textContent = "Checking…";
        try {
          const r = await AA.Orders.track(btn.dataset.track);
          const o = orders.find((x) => x.id === btn.dataset.track);
          if (o) o.courier_status = r.status;
          AA.toast(`Status: ${r.status}`);
          paint(document.getElementById("orderFilter").value);
        } catch (e) { AA.toast(e.message, "err"); btn.disabled = false; btn.textContent = "Check status"; }
      }));
    };
    paint("");
    document.getElementById("orderFilter").addEventListener("change", (e) => paint(e.target.value));
  }

  // ================================================================ CUSTOMERS
  async function renderCustomers() {
    content().innerHTML = loading("Loading customers…");
    let users;
    try { users = await AA.Admin.users(); } catch (e) { content().innerHTML = errBox(e); return; }
    content().innerHTML = `
    <h1 class="mb-4 text-lg font-bold text-silver-bright">Customers &amp; Resellers <span class="text-sm font-normal text-silver-dim">(${users.length})</span></h1>
    <div class="card overflow-x-auto"><table class="w-full min-w-[820px] text-left text-sm">
      <thead class="text-[11px] uppercase tracking-wide text-silver-dim"><tr class="border-b border-carbon-600"><th class="px-4 py-3">Name</th><th class="px-3 py-3">Contact</th><th class="px-3 py-3">Type</th><th class="px-3 py-3">Orders</th><th class="px-3 py-3">Joined</th><th class="px-3 py-3 text-right">Actions</th></tr></thead>
      <tbody class="divide-y divide-carbon-700">${users.length ? users.map((u) => `
        <tr class="${u.is_active ? "" : "opacity-50"}">
          <td class="px-4 py-3"><p class="font-semibold text-silver-bright">${esc(u.name)}</p>${u.business_name ? `<p class="text-xs text-silver-dim">${esc(u.business_name)}</p>` : ""}</td>
          <td class="px-3 py-3 text-xs text-silver-dim">${esc(u.email)}<br/>${esc(u.phone || "—")}</td>
          <td class="px-3 py-3">${u.role === "reseller" ? (u.is_approved ? '<span class="rounded-md border border-green-600/40 bg-green-600/10 px-2 py-0.5 text-[11px] font-semibold text-green-400">Reseller ✔</span>' : '<span class="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 text-[11px] font-semibold text-yellow-400">Reseller · pending</span>') : '<span class="text-xs text-silver-dim">Customer</span>'}</td>
          <td class="px-3 py-3">${u.orders}</td>
          <td class="px-3 py-3 text-xs text-silver-dim">${AA.parseUTC(u.created_at).toLocaleDateString()}</td>
          <td class="px-3 py-3"><div class="flex justify-end gap-1.5">
            ${u.role === "reseller" ? `<button data-approve="${esc(u.id)}" data-val="${u.is_approved ? 0 : 1}" class="${u.is_approved ? "btn-ghost" : "btn-crimson"} px-3 py-1.5 text-xs">${u.is_approved ? "Revoke" : "Approve"}</button>` : ""}
            <button data-active="${esc(u.id)}" data-val="${u.is_active ? 0 : 1}" class="btn-ghost px-3 py-1.5 text-xs">${u.is_active ? "Disable" : "Enable"}</button></div></td>
        </tr>`).join("") : `<tr><td colspan="6" class="px-4 py-16 text-center text-silver-dim">No customers yet.</td></tr>`}</tbody></table></div>`;
    const act = async (id, patch) => { try { await AA.Admin.patchUser(id, patch); AA.toast("Saved"); renderCustomers(); } catch (e) { AA.toast(e.message, "err"); } };
    document.querySelectorAll("[data-approve]").forEach((b) => b.addEventListener("click", () => act(b.dataset.approve, { is_approved: b.dataset.val === "1" })));
    document.querySelectorAll("[data-active]").forEach((b) => b.addEventListener("click", () => act(b.dataset.active, { is_active: b.dataset.val === "1" })));
  }

  // ================================================================ ANALYTICS
  async function renderAnalytics() {
    content().innerHTML = loading("Crunching numbers…");
    let st;
    try { st = await AA.Admin.stats(); } catch (e) { content().innerHTML = errBox(e); return; }
    const days = st.revenue_by_day, max = Math.max(1, ...days.map((d) => d.revenue));
    const W = 640, H = 200, bw = W / days.length;
    const bars = days.map((d, i) => {
      const h = Math.round((d.revenue / max) * (H - 30));
      const label = new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });
      return `<g><rect x="${i * bw + 5}" y="${H - 20 - h}" width="${bw - 10}" height="${h}" rx="3" fill="${d.revenue ? "#E50914" : "#2E2E32"}"><title>${label}: ${AA.fmtPKR(d.revenue)} (${d.orders} orders)</title></rect>
        ${i % 2 === 0 ? `<text x="${i * bw + bw / 2}" y="${H - 5}" text-anchor="middle" font-size="9" fill="#9CA3AF">${label}</text>` : ""}</g>`;
    }).join("");
    const total14 = days.reduce((s, d) => s + d.revenue, 0), orders14 = days.reduce((s, d) => s + d.orders, 0);
    const maxCat = Math.max(1, ...st.products_by_category.map((c) => c.count)), maxTop = Math.max(1, ...st.top_products.map((c) => c.units));
    const hbar = (label, val, max, color = "#E50914") => `<div class="mb-2.5"><div class="mb-1 flex justify-between text-xs"><span class="line-clamp-1 text-silver">${esc(label)}</span><span class="text-silver-dim">${val}</span></div><div class="progress"><span style="width:${Math.round((val / max) * 100)}%;background:${color}"></span></div></div>`;
    content().innerHTML = `
    <h1 class="mb-4 text-lg font-bold text-silver-bright">Analytics</h1>
    <div class="grid gap-4 lg:grid-cols-3">
      <section class="card p-4 lg:col-span-2">${cardHead("Revenue — last 14 days", `<span class="text-xs text-silver-dim">${AA.fmtPKR(total14)} · ${orders14} orders</span>`)}
        <div class="overflow-x-auto"><svg viewBox="0 0 ${W} ${H}" class="min-w-[560px] w-full" role="img" aria-label="Revenue per day">${bars}</svg></div></section>
      <section class="card p-4">${cardHead("Orders by status")}
        ${Object.keys(st.orders_by_status).length ? Object.entries(st.orders_by_status).map(([k, v]) => `<div class="mb-2 flex items-center justify-between">${statusPill(k)}<span class="text-sm font-bold text-silver-bright">${v}</span></div>`).join("") : '<p class="py-6 text-center text-sm text-silver-dim">No orders yet.</p>'}</section>
      <section class="card p-4 lg:col-span-2">${cardHead("Best sellers (units)")}${st.top_products.length ? st.top_products.map((p) => hbar(p.title, p.units, maxTop, "#22c55e")).join("") : '<p class="py-6 text-center text-sm text-silver-dim">Sales will appear here after your first orders.</p>'}</section>
      <section class="card p-4">${cardHead("Products per category")}${st.products_by_category.map((c) => hbar(c.name, c.count, maxCat)).join("")}</section>
    </div>`;
  }

  // ================================================================ SETTINGS
  async function renderSettings() {
    content().innerHTML = loading("Loading settings…");
    let settings, banners;
    try { [settings, banners] = await Promise.all([AA.WhatsApp.getConfig(), AA.Banners.all()]); } catch (e) { content().innerHTML = errBox(e); return; }
    content().innerHTML = `
    <h1 class="mb-4 text-lg font-bold text-silver-bright">Settings</h1>
    <div class="grid gap-4 lg:grid-cols-2">
      <form id="settingsForm" class="card space-y-3 p-5">${cardHead("WhatsApp &amp; contact")}
        <div><label class="lbl">WhatsApp business number (with country code)</label><input id="s_number" class="field" value="${esc(settings.whatsapp_number)}" placeholder="923154448835" /></div>
        <div><label class="lbl">Default WhatsApp message</label><textarea id="s_message" rows="2" class="field">${esc(settings.whatsapp_default_message)}</textarea></div>
        <div class="grid grid-cols-2 gap-3"><div><label class="lbl">Contact phone</label><input id="s_phone" class="field" value="${esc(settings.contact_phone)}" /></div>
          <div><label class="lbl">Contact email</label><input id="s_email" class="field" value="${esc(settings.contact_email)}" /></div></div>
        <div><label class="lbl">Announcement bar (optional — shown at the top of every page)</label><input id="s_announce" class="field" maxlength="255" value="${esc(settings.site_announcement || "")}" placeholder="e.g. Free delivery on orders above PKR 20,000" /></div>
        <button class="btn-crimson px-5 py-2.5 text-sm">Save settings</button>
      </form>

      <form id="pwForm" class="card space-y-3 p-5 self-start">${cardHead("Change admin password")}
        <div><label class="lbl">Current password</label><input id="pw_cur" type="password" class="field" autocomplete="current-password" /></div>
        <div><label class="lbl">New password (min 8 characters — any length is fine)</label><input id="pw_new" type="password" minlength="8" class="field" autocomplete="new-password" /></div>
        <p id="pwMsg" class="hidden text-sm"></p>
        <button class="btn-crimson px-5 py-2.5 text-sm">Update password</button>
      </form>

      <section class="card p-5 lg:col-span-2">${cardHead("Homepage banners (hero slider)")}
        <div id="bannerList" class="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"></div>
        <form id="bannerForm" class="rounded-xl border border-carbon-600 bg-carbon-950/60 p-4">
          <p class="mb-3 text-sm font-bold text-silver-bright">Add a banner</p>
          <div class="grid gap-3 md:grid-cols-2">
            <input id="b_title" class="field" placeholder="Headline (e.g. Latest Uplift Kits)" required maxlength="120" />
            <input id="b_sub" class="field" placeholder="Sub-heading (optional)" maxlength="200" />
            <input id="b_cta" class="field" placeholder="Button text (e.g. Shop Now)" maxlength="40" />
            <input id="b_link" class="field" placeholder="Button link (e.g. /products?category=body-kits)" maxlength="200" />
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-3">
            <label class="btn-ghost cursor-pointer px-4 py-2 text-sm">⬆ Upload banner photo<input id="b_file" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" /></label>
            <span id="b_state" class="text-xs text-silver-dim">Wide photos work best (about 1600×600).</span>
            <button class="btn-crimson ml-auto px-5 py-2 text-sm">Add banner</button>
          </div>
        </form>
      </section>
    </div>`;

    const $ = (id) => document.getElementById(id);
    $("settingsForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        cfg = await AA.WhatsApp.updateConfig({ whatsapp_number: $("s_number").value.trim(), whatsapp_default_message: $("s_message").value.trim(),
          contact_phone: $("s_phone").value.trim(), contact_email: $("s_email").value.trim(), site_announcement: $("s_announce").value.trim() });
        AA.toast("Settings saved");
      } catch (ex) { AA.toast(ex.message, "err"); }
    });
    $("pwForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const m = $("pwMsg"); m.classList.remove("hidden");
      try { await AA.Auth.changePassword($("pw_cur").value, $("pw_new").value); m.className = "text-sm text-green-400"; m.textContent = "Password updated."; $("pw_cur").value = $("pw_new").value = ""; }
      catch (ex) { m.className = "text-sm text-crimson-bright"; m.textContent = ex.message; }
    });

    function paintBanners() {
      $("bannerList").innerHTML = banners.length ? banners.map((b) => `
        <div class="overflow-hidden rounded-xl border border-carbon-600 bg-carbon-900 ${b.is_active ? "" : "opacity-60"}">
          <div class="aspect-[16/6] bg-carbon-800">${AA.imgTag(b.image_url, b.title, "h-full w-full object-cover")}</div>
          <div class="p-3"><p class="line-clamp-1 text-sm font-bold text-silver-bright">${esc(b.title)}</p><p class="line-clamp-1 text-xs text-silver-dim">${esc(b.subtitle || "")}</p>
            <div class="mt-2 flex gap-2"><button data-bt="${esc(b.id)}" class="btn-ghost px-3 py-1 text-xs">${b.is_active ? "Hide" : "Show"}</button><button data-bd="${esc(b.id)}" class="btn-ghost px-3 py-1 text-xs !text-crimson-bright">Delete</button></div></div>
        </div>`).join("") : `<p class="text-sm text-silver-dim sm:col-span-2 xl:col-span-3">No banners — the homepage shows a default headline.</p>`;
      $("bannerList").querySelectorAll("[data-bt]").forEach((b) => b.addEventListener("click", async () => {
        const bn = banners.find((x) => x.id === b.dataset.bt);
        try { const upd = await AA.Banners.update(bn.id, { ...bn, is_active: !bn.is_active }); Object.assign(bn, upd); paintBanners(); } catch (ex) { AA.toast(ex.message, "err"); }
      }));
      $("bannerList").querySelectorAll("[data-bd]").forEach((b) => b.addEventListener("click", async () => {
        if (!confirm("Delete this banner?")) return;
        try { await AA.Banners.remove(b.dataset.bd); banners = banners.filter((x) => x.id !== b.dataset.bd); paintBanners(); } catch (ex) { AA.toast(ex.message, "err"); }
      }));
    }
    paintBanners();

    let bannerUrl = null;
    $("b_file").addEventListener("change", async (e) => {
      const file = e.target.files[0]; if (!file) return;
      $("b_state").textContent = "Uploading…";
      try { const r = await AA.upload(file, (p) => ($("b_state").textContent = `Uploading… ${Math.round(p * 100)}%`)); bannerUrl = r.url; $("b_state").textContent = `✔ ${file.name} uploaded`; }
      catch (ex) { bannerUrl = null; $("b_state").textContent = ex.message; }
    });
    $("bannerForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const nb = await AA.Banners.create({ title: $("b_title").value.trim(), subtitle: $("b_sub").value.trim() || null, cta_text: $("b_cta").value.trim() || null,
          cta_link: $("b_link").value.trim() || null, image_url: bannerUrl, sort_order: banners.length + 1, is_active: true });
        banners.push(nb); paintBanners(); e.target.reset(); bannerUrl = null; $("b_state").textContent = "Banner added ✔";
      } catch (ex) { AA.toast(ex.message, "err"); }
    });
  }
})();
