(function () {
  const esc = AA.escapeHtml;

  // ---------------------------------------------------------------- hero carousel
  const hero = document.getElementById("hero");
  const dotsEl = document.getElementById("heroDots");
  let slides = [], idx = 0, timer = null;

  function slideHtml(b, i) {
    const img = b.image_url
      ? `<img src="${esc(b.image_url)}" alt="" class="absolute inset-0 h-full w-full object-cover" ${i === 0 ? "" : 'loading="lazy"'} onerror="this.remove()" />` : "";
    return `
    <div class="hero-slide ${i === 0 ? "active" : ""}" data-i="${i}">
      ${img}
      <div class="absolute inset-0 bg-gradient-to-r from-carbon-950 via-carbon-950/75 to-carbon-950/10"></div>
      <div class="relative flex h-full max-w-xl flex-col justify-center gap-3 px-8 sm:px-14">
        <p class="text-[11px] font-semibold tracking-[0.3em] text-crimson-bright">TRUST · QUALITY · SATISFACTION</p>
        <h2 class="text-2xl font-extrabold leading-tight text-white sm:text-4xl">${esc(b.title)}</h2>
        ${b.subtitle ? `<p class="text-sm leading-relaxed text-silver sm:text-base">${esc(b.subtitle)}</p>` : ""}
        ${b.cta_text ? `<a href="${esc(b.cta_link || "/products")}" class="btn-crimson mt-1 w-max px-6 py-2.5 text-sm">${esc(b.cta_text)}</a>` : ""}
      </div>
    </div>`;
  }

  function show(n) {
    if (!slides.length) return;
    idx = (n + slides.length) % slides.length;
    hero.querySelectorAll(".hero-slide").forEach((s, i) => s.classList.toggle("active", i === idx));
    dotsEl.querySelectorAll("button").forEach((d, i) => { d.classList.toggle("bg-crimson", i === idx); d.classList.toggle("bg-white/40", i !== idx); });
  }
  function play() { clearInterval(timer); if (slides.length > 1) timer = setInterval(() => show(idx + 1), 6000); }

  AA.Banners.active().catch(() => []).then((list) => {
    slides = list && list.length ? list : [{
      title: "Modification parts, engineered for the road ahead",
      subtitle: "Body kits, LED lighting, spoilers and interior & exterior upgrades — matched to your car by our AI Adviser, delivered nationwide.",
      cta_text: "Browse Catalog", cta_link: "/products", image_url: null,
    }];
    hero.innerHTML = slides.map(slideHtml).join("");
    dotsEl.innerHTML = slides.map((_, i) => `<button aria-label="Slide ${i + 1}" class="h-2 w-2 rounded-full ${i === 0 ? "bg-crimson" : "bg-white/40"}"></button>`).join("");
    dotsEl.querySelectorAll("button").forEach((d, i) => d.addEventListener("click", () => { show(i); play(); }));
    const multi = slides.length > 1;
    ["heroPrev", "heroNext"].forEach((id) => document.getElementById(id).classList.toggle("hidden", !multi));
    dotsEl.classList.toggle("hidden", !multi);
    play();
  });
  document.getElementById("heroPrev").addEventListener("click", () => { show(idx - 1); play(); });
  document.getElementById("heroNext").addEventListener("click", () => { show(idx + 1); play(); });
  hero.parentElement.addEventListener("mouseenter", () => clearInterval(timer));
  hero.parentElement.addEventListener("mouseleave", play);

  // ---------------------------------------------------------------- categories
  const ICONS = { "body-kits": "🚘", "led-lights": "💡", spoilers: "🏁", interior: "🪑", exterior: "🔧", "alloy-wheels": "🛞", "audio-systems": "🔊" };
  AA.Categories.list().then((cats) => {
    document.getElementById("categoryGrid").innerHTML = cats.map((c) => `
      <a href="/products?category=${esc(c.slug)}" class="group card flex flex-col items-center gap-2 px-3 py-5 text-center transition hover:border-crimson hover:bg-carbon-800">
        <span class="text-2xl">${ICONS[c.slug] || "🔩"}</span>
        <span class="text-[13px] font-semibold text-silver group-hover:text-silver-bright">${esc(c.name)}</span>
      </a>`).join("");
  }).catch(() => {});

  // ---------------------------------------------------------------- latest products + shop-by-model chips
  AA.ready.then(() => AA.Products.list({ limit: 100 })).then((products) => {
    renderProductGrid(document.getElementById("featuredProducts"), products.slice(0, 9), "sm:grid-cols-2 xl:grid-cols-3");

    const seen = new Map();
    products.forEach((p) => {
      const key = `${p.vehicle_make}|${p.vehicle_model}`;
      if (!seen.has(key) && p.vehicle_make.toLowerCase() !== "universal") seen.set(key, { make: p.vehicle_make, model: p.vehicle_model });
    });
    const combos = Array.from(seen.values()).slice(0, 14);
    if (combos.length) {
      document.getElementById("shopByModelSection").classList.remove("hidden");
      document.getElementById("shopByModelGrid").innerHTML = combos.map((c) => `
        <a href="/products?make=${encodeURIComponent(c.make)}&model=${encodeURIComponent(c.model)}"
           class="flex items-center gap-2 rounded-lg border border-carbon-600 bg-carbon-950 px-4 py-2 text-sm font-medium text-silver transition hover:border-crimson hover:text-crimson-bright">
          🚗 ${esc(c.make)} ${esc(c.model)}</a>`).join("");
    }
  }).catch(() => {
    document.getElementById("featuredProducts").innerHTML =
      `<p class="py-16 text-center text-silver-dim">Products couldn't be loaded. Please refresh the page.</p>`;
  });
})();
