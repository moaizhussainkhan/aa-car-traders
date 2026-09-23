(function () {
  const root = document.getElementById("productDetailRoot");
  const slug = root.dataset.slug;
  const esc = AA.escapeHtml;

  function marginCalcHtml(p) {
    return `
    <div class="card card-red p-5">
      <div class="mb-3 flex items-center gap-2"><span>🧮</span><h3 class="text-sm font-bold text-silver-bright">Reseller Profit Margin Calculator</h3></div>
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div><p class="text-silver-dim">Wholesale price</p><p class="text-lg font-bold text-silver-bright">${AA.fmtPKR(p.wholesale_price)}</p></div>
        <div><p class="text-silver-dim">Suggested retail</p><p class="text-lg font-bold text-silver-bright">${AA.fmtPKR(p.retail_price)}</p></div>
      </div>
      <label class="mt-4 block text-xs text-silver-dim">Your margin: <span id="marginPercentLabel" class="font-semibold text-crimson-bright">20%</span></label>
      <input id="marginSlider" type="range" min="0" max="100" value="20" class="mt-2 w-full accent-[#E50914]" />
      <div class="mt-4 flex items-center justify-between border-t border-carbon-700 pt-4">
        <div><p class="text-xs text-silver-dim">Your selling price</p><p id="sellingPrice" class="text-xl font-bold text-crimson-bright"></p></div>
        <div class="text-right"><p class="text-xs text-silver-dim">Your profit / unit</p><p id="profitAmount" class="text-xl font-bold text-green-400"></p></div>
      </div>
    </div>`;
  }

  function bindMarginCalc(p) {
    const slider = document.getElementById("marginSlider");
    if (!slider) return;
    const update = () => {
      const pct = Number(slider.value);
      document.getElementById("marginPercentLabel").textContent = `${pct}%`;
      const selling = Math.round(p.wholesale_price * (1 + pct / 100));
      document.getElementById("sellingPrice").textContent = AA.fmtPKR(selling);
      document.getElementById("profitAmount").textContent = AA.fmtPKR(selling - p.wholesale_price);
    };
    slider.addEventListener("input", update);
    update();
  }

  async function render() {
    await AA.ready;
    let p;
    try { p = await AA.Products.get(slug); }
    catch {
      root.innerHTML = `<div class="mx-auto max-w-3xl py-24 text-center"><h1 class="text-2xl font-bold text-silver-bright">Product not found</h1>
        <p class="mt-3 text-silver-dim">It may have been removed or the link is incorrect.</p><a href="/products" class="btn-crimson mt-6 inline-block px-6 py-2.5 text-sm">Browse products</a></div>`;
      return;
    }
    ShopUI.register([p]);
    document.title = `${p.title} — AA Car Traders`;

    // gallery = images first, then videos (uploaded file or external link)
    const images = [...(p.thumbnail_url ? [p.thumbnail_url] : []), ...p.media.filter((m) => m.media_type === "image").map((m) => m.url)];
    const videos = [...(p.video_url ? [p.video_url] : []), ...p.media.filter((m) => m.media_type === "video").map((m) => m.url)];
    const gallery = [...new Set(images)].map((u) => ({ type: "image", url: u })).concat([...new Set(videos)].map((u) => ({ type: "video", url: u })));
    const inStock = p.stock_quantity > 0;
    const privileged = typeof p.wholesale_price === "number";
    const fits = p.vehicle_make.toLowerCase() === "universal" ? "Universal — fits all cars"
      : `${esc(p.vehicle_make)} ${esc(p.vehicle_model)}${p.vehicle_year_from ? ` (${p.vehicle_year_from}–${p.vehicle_year_to || "present"})` : ""}`;

    root.innerHTML = `
    <nav class="mb-4 text-xs text-silver-dim"><a href="/" class="hover:text-crimson-bright">Home</a> / <a href="/products?category=${esc(p.category.slug)}" class="hover:text-crimson-bright">${esc(p.category.name)}</a></nav>
    <div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <div>
        <div id="stage" class="relative aspect-[4/3] overflow-hidden rounded-xl border border-carbon-600 bg-carbon-900"></div>
        ${gallery.length > 1 ? `<div id="thumbRow" class="mt-3 flex gap-2 overflow-x-auto pb-1">
          ${gallery.map((g, i) => `<button data-i="${i}" class="thumb-btn relative h-16 w-20 shrink-0 overflow-hidden rounded-md border ${i === 0 ? "border-crimson" : "border-carbon-600"}">
            ${g.type === "image" ? AA.imgTag(g.url, "", "h-full w-full object-cover") : `<span class="flex h-full w-full items-center justify-center bg-carbon-800 text-xl text-crimson-bright">▶</span>`}</button>`).join("")}
        </div>` : ""}
      </div>

      <div>
        <span class="inline-block rounded-md bg-crimson px-2.5 py-1 text-xs font-semibold text-white">${esc(p.category.name)}</span>
        <h1 class="mt-3 text-xl font-bold leading-snug text-silver-bright sm:text-2xl">${esc(p.title)}</h1>
        <p class="mt-2 text-sm text-silver-dim">Fits: ${fits}</p>
        <p class="mt-4 text-2xl font-bold text-crimson-bright sm:text-3xl">${AA.fmtPKR(p.retail_price)}</p>
        <p class="mt-2 text-sm ${inStock ? "text-green-400" : "text-crimson-bright"}">${inStock ? `✔ In stock (${p.stock_quantity} available)` : "✕ Out of stock"}</p>

        <div class="mt-5 grid gap-2.5 sm:grid-cols-2">
          <button data-action="order" data-id="${esc(p.id)}" ${inStock ? "" : "disabled"} class="btn-crimson py-3 text-sm">🛒 Place Order (Cash on Delivery)</button>
          <a href="${AA.buildWhatsAppLink(p)}" target="_blank" rel="noopener noreferrer" class="btn-green flex items-center justify-center gap-2 py-3 text-sm">💬 Buy on WhatsApp</a>
        </div>
        <button data-action="wholesale" data-id="${esc(p.id)}" class="btn-ghost mt-2.5 w-full py-2.5 text-sm">Wholesale Details <span class="font-normal text-silver-dim">· download images &amp; copy info</span></button>

        <div class="mt-7 border-t border-carbon-700 pt-5">
          <h2 class="mb-2 text-sm font-bold text-silver-bright">Description</h2>
          <p class="whitespace-pre-line text-sm leading-relaxed text-silver-dim">${esc(p.description)}</p>
        </div>

        ${privileged ? `<div class="mt-7 space-y-4">${marginCalcHtml(p)}
          <button id="zipBtn" class="btn-ghost w-full py-2.5 text-sm">⬇ Download HD media kit (ZIP: images + details)</button></div>` : ""}
      </div>
    </div>`;

    // main stage
    const stage = document.getElementById("stage");
    function showItem(i) {
      const g = gallery[i];
      if (!g) { stage.innerHTML = AA.imgTag(null, p.title, "h-full w-full object-cover"); return; }
      if (g.type === "image") stage.innerHTML = AA.imgTag(g.url, p.title, "h-full w-full object-cover");
      else if (AA.isVideoUrl(g.url)) stage.innerHTML = `<video src="${esc(g.url)}" controls playsinline class="h-full w-full bg-black object-contain"></video>`;
      else stage.innerHTML = `<a href="${esc(g.url)}" target="_blank" rel="noopener noreferrer" class="flex h-full items-center justify-center text-sm font-semibold text-crimson-bright">▶ Watch video</a>`;
    }
    showItem(0);
    const row = document.getElementById("thumbRow");
    if (row) row.querySelectorAll(".thumb-btn").forEach((btn) => btn.addEventListener("click", () => {
      showItem(Number(btn.dataset.i));
      row.querySelectorAll(".thumb-btn").forEach((b) => { b.classList.remove("border-crimson"); b.classList.add("border-carbon-600"); });
      btn.classList.add("border-crimson"); btn.classList.remove("border-carbon-600");
    }));

    bindMarginCalc(p);
    const zip = document.getElementById("zipBtn");
    if (zip) zip.addEventListener("click", async () => {
      zip.disabled = true; const old = zip.textContent; zip.textContent = "Preparing ZIP…";
      try { await AA.Products.mediaZip(p.id); } catch (e) { AA.toast(e.message, "err"); }
      zip.disabled = false; zip.textContent = old;
    });
  }
  render();
})();
