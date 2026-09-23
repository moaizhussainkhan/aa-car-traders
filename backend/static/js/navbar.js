// Header / footer behaviour shared by every public page.
(function () {
  const esc = AA.escapeHtml;

  // ---- mobile menu + search
  const menuBtn = document.getElementById("mobileMenuBtn");
  const mobileMenu = document.getElementById("mobileMenu");
  if (menuBtn && mobileMenu) menuBtn.addEventListener("click", () => mobileMenu.classList.toggle("hidden"));

  function goSearch(value) {
    const q = (value || "").trim();
    if (q) window.location.href = `/products?q=${encodeURIComponent(q)}`;
  }
  [["navSearchForm", "navSearchInput"], ["navSearchFormMobile", "navSearchInputMobile"]].forEach(([f, i]) => {
    const form = document.getElementById(f), input = document.getElementById(i);
    if (form) form.addEventListener("submit", (e) => { e.preventDefault(); goSearch(input.value); });
  });
  const urlQ = new URLSearchParams(location.search).get("q");
  const si = document.getElementById("navSearchInput");
  if (si && urlQ) si.value = urlQ;

  // ---- cart badge + button
  const cartBtn = document.getElementById("cartBtn");
  if (cartBtn) cartBtn.addEventListener("click", () => ShopUI.openCart());
  (function initBadge() {
    const n = AA.Cart.count();
    const badge = document.getElementById("cartBadge");
    if (badge && n > 0) { badge.textContent = n; badge.classList.remove("hidden"); badge.classList.add("flex"); }
  })();

  // ---- auth area (customer / reseller — the admin link is never shown to the public)
  function renderAuthArea() {
    const user = AA.getUser();
    const desktop = document.getElementById("navAuthArea");
    const mobile = document.getElementById("navAuthAreaMobile");
    let d = "", m = "";
    if (user) {
      const first = esc((user.name || "").split(" ")[0] || "Account");
      const extra = AA.isAdmin(user)
        ? `<a href="/admin" class="text-sm font-semibold text-crimson-bright hover:underline">Admin panel</a>`
        : user.role === "reseller"
          ? `<a href="/reseller" class="text-sm font-semibold text-crimson-bright hover:underline">${user.is_approved ? "Reseller portal" : "Reseller (pending)"}</a>` : "";
      d = `${extra}<span class="hidden text-sm text-silver-dim xl:inline">Hi, ${first}</span>
           <button data-logout class="rounded-lg border border-carbon-600 px-3 py-1.5 text-sm text-silver hover:border-crimson hover:text-white">Logout</button>`;
      m = `${extra}<button data-logout class="text-left text-sm text-silver-dim">Logout (${first})</button>`;
    } else {
      d = `<a href="/login" class="text-sm font-semibold text-silver hover:text-white">Login</a>
           <a href="/register" class="btn-crimson px-4 py-2 text-sm">Sign up</a>`;
      m = `<a href="/login" class="text-sm font-semibold text-silver">Login</a>
           <a href="/register" class="text-sm font-semibold text-crimson-bright">Sign up</a>`;
    }
    if (desktop) { desktop.innerHTML = d; desktop.classList.remove("hidden"); desktop.classList.add("flex"); }
    if (mobile) mobile.innerHTML = m;
    document.querySelectorAll("[data-logout]").forEach((b) =>
      b.addEventListener("click", () => { AA.clearSession(); window.location.href = "/"; }));
  }
  renderAuthArea();

  // Refresh the cached user (e.g. reseller just got approved) without blocking the page
  if (AA.getToken()) {
    AA.Auth.me().then((fresh) => {
      const before = JSON.stringify(AA.getUser());
      AA.setSession(AA.getToken(), fresh);
      if (JSON.stringify(fresh) !== before) renderAuthArea();
    }).catch((e) => { if (e.status === 401) { AA.clearSession(); renderAuthArea(); } });
  }

  // ---- shop-by-model dropdown
  const modelBtn = document.getElementById("modelMenuBtn");
  const modelMenu = document.getElementById("modelMenu");
  if (modelBtn && modelMenu) {
    let loaded = false;
    const toggle = async (force) => {
      const open = force !== undefined ? force : modelMenu.classList.contains("hidden");
      modelMenu.classList.toggle("hidden", !open);
      modelBtn.classList.toggle("open", open);
      if (open && !loaded) {
        loaded = true;
        try {
          const data = await AA.Catalog.carModels();
          document.getElementById("modelMenuGrid").innerHTML = data.makes.map((mk) => `
            <div>
              <a href="/products?make=${encodeURIComponent(mk.make)}" class="text-sm font-bold text-silver-bright hover:text-crimson-bright">${esc(mk.make)}</a>
              <ul class="mt-1.5 space-y-1">
                ${mk.models.slice(0, 6).map((md) => `<li><a class="text-xs text-silver-dim hover:text-crimson-bright" href="/products?make=${encodeURIComponent(mk.make)}&model=${encodeURIComponent(md)}">${esc(md)}</a></li>`).join("")}
              </ul>
            </div>`).join("") + `
            <div><a href="/products?make=Universal" class="text-sm font-bold text-silver-bright hover:text-crimson-bright">Universal</a>
              <p class="mt-1.5 text-xs text-silver-dim">Fits all cars</p></div>`;
        } catch { document.getElementById("modelMenuGrid").innerHTML = `<p class="text-sm text-silver-dim">Couldn't load car list.</p>`; }
      }
    };
    modelBtn.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });
    document.addEventListener("click", (e) => { if (!modelMenu.contains(e.target) && !modelBtn.contains(e.target)) toggle(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") toggle(false); });
  }

  // ---- config-driven bits (WhatsApp number, footer contact, announcement)
  AA.ready.then((cfg) => {
    const fw = document.getElementById("floatingWhatsApp");
    if (fw) fw.href = AA.buildGeneralWhatsAppLink();
    const hw = document.getElementById("heroWhatsapp");
    if (hw) hw.href = AA.buildGeneralWhatsAppLink();
    const ph = document.getElementById("footPhone");
    if (ph) { ph.textContent = cfg.contact_phone; ph.href = `tel:${cfg.contact_phone.replace(/\s+/g, "")}`; }
    const em = document.getElementById("footEmail");
    if (em) { em.textContent = cfg.contact_email; em.href = `mailto:${cfg.contact_email}`; }
    const bar = document.getElementById("announceBar");
    if (bar && cfg.site_announcement) { bar.textContent = cfg.site_announcement; bar.classList.remove("hidden"); }
  });
})();
