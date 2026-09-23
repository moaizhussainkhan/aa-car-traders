// Product card used on the home page, catalog and search results.
function renderProductCard(p) {
  ShopUI.register([p]);
  const esc = AA.escapeHtml;
  const outOfStock = p.stock_quantity <= 0;
  const hasWholesale = typeof p.wholesale_price === "number";
  const fits = p.vehicle_make && p.vehicle_make.toLowerCase() === "universal"
    ? "Universal fit"
    : `${esc(p.vehicle_make)} ${esc(p.vehicle_model)}${p.vehicle_year_from ? ` · ${p.vehicle_year_from}${p.vehicle_year_to ? "–" + p.vehicle_year_to : "+"}` : ""}`;

  return `
  <article class="group card flex flex-col overflow-hidden transition hover:border-crimson/70">
    <a href="/products/${esc(p.slug)}" class="relative block aspect-[4/3] overflow-hidden bg-carbon-800">
      ${AA.imgTag(p.thumbnail_url, p.title, "h-full w-full object-cover transition duration-500 group-hover:scale-105")}
      <span class="absolute left-2 top-2 rounded-md bg-crimson px-2 py-0.5 text-[10.5px] font-semibold tracking-wide text-white">${esc(p.category ? p.category.name : "")}</span>
      ${outOfStock ? `<span class="absolute inset-0 flex items-center justify-center bg-carbon-950/75 text-sm font-semibold text-silver">Out of stock</span>` : ""}
    </a>
    <div class="flex flex-1 flex-col gap-1.5 p-3.5">
      <p class="text-[10.5px] uppercase tracking-wider text-silver-dim">Fits: ${fits}</p>
      <a href="/products/${esc(p.slug)}"><h3 class="line-clamp-2 text-[13.5px] font-semibold leading-snug text-silver-bright transition group-hover:text-crimson-bright">${esc(p.title)}</h3></a>
      <div class="mb-1.5 flex items-baseline justify-between gap-2">
        <p class="text-base font-bold text-crimson-bright">${AA.fmtPKR(p.retail_price)}</p>
        ${hasWholesale ? `<p class="text-[11px] text-silver-dim">WS ${AA.fmtPKR(p.wholesale_price)}</p>` : ""}
      </div>

      <button type="button" data-action="visual-search" class="btn-ghost flex items-center justify-center gap-1.5 py-1.5 text-[12px]">
        <span aria-hidden="true">📷</span> Visual Search <span class="hidden font-normal text-silver-dim xl:inline">· upload picture to find</span>
      </button>
      <a href="${AA.buildWhatsAppLink(p)}" target="_blank" rel="noopener noreferrer" class="btn-green flex items-center justify-center gap-1.5 px-2 py-1.5 text-[12.5px]">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2Zm4.52 11.97c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.17.25-.64.8-.78.97-.14.17-.29.19-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.22-1.46-1.37-1.7-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.84-.86 2.05s.88 2.38 1 2.55c.13.17 1.73 2.65 4.2 3.71.59.25 1.05.4 1.41.52.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.68-1.19.2-.58.2-1.08.14-1.19-.06-.1-.23-.17-.48-.29Z"/></svg>
        Buy on WhatsApp
      </a>
      <button type="button" data-action="wholesale" data-id="${esc(p.id)}" class="btn-ghost px-2 py-1.5 text-left text-[12px] leading-tight">
        <span class="block text-center">Wholesale Details</span>
        <span class="block text-center text-[10px] font-normal text-silver-dim">Download Images &amp; Copy Info</span>
      </button>
      <button type="button" data-action="order" data-id="${esc(p.id)}" ${outOfStock ? "disabled" : ""} class="btn-crimson py-2 text-[12.5px]">${outOfStock ? "Out of stock" : "Place Order"}</button>
    </div>
  </article>`;
}

function renderProductGrid(container, products, cols = "sm:grid-cols-2 lg:grid-cols-4") {
  if (!products || products.length === 0) {
    container.innerHTML = `<p class="py-16 text-center text-silver-dim">No products found.</p>`;
    return;
  }
  container.innerHTML = `<div class="grid grid-cols-1 gap-4 ${cols}">${products.map(renderProductCard).join("")}</div>`;
}
