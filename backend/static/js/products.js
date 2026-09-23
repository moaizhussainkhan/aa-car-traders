(function () {
  const esc = AA.escapeHtml;
  const GROUPS = {
    modifications: { label: "Modifications", slugs: ["body-kits", "led-lights", "spoilers", "alloy-wheels"] },
    "interior-exterior": { label: "Interior & Exterior", slugs: ["interior", "exterior"] },
  };

  document.getElementById("filtersToggle").addEventListener("click", () => document.getElementById("filtersAside").classList.toggle("hidden"));

  function getParams() {
    const p = new URLSearchParams(location.search);
    return { q: p.get("q") || "", category: p.get("category") || "", group: p.get("group") || "", make: p.get("make") || "", model: p.get("model") || "" };
  }
  function updateParam(key, value) {
    const p = new URLSearchParams(location.search);
    if (value) p.set(key, value); else p.delete(key);
    if (key === "category") p.delete("group");
    if (key !== "q") p.delete("q");
    if (key === "make") p.delete("model");
    location.href = `/products${p.toString() ? "?" + p : ""}`;
  }

  let categories = [], makes = [], all = [];

  function linkList(el, items, active, key) {
    el.innerHTML = items.map((it) => `
      <button data-v="${esc(it.value)}" class="rounded-md px-2.5 py-1.5 text-left text-[13px] transition ${it.value === active ? "bg-crimson/15 font-semibold text-crimson-bright" : "text-silver-dim hover:bg-carbon-800 hover:text-silver"}">${esc(it.label)}</button>`).join("");
    el.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => updateParam(key, b.dataset.v === active ? "" : b.dataset.v)));
  }

  function renderChips(params) {
    const el = document.getElementById("activeFilters");
    const chips = [];
    if (params.category) { const c = categories.find((x) => x.slug === params.category); chips.push({ key: "category", label: c ? c.name : params.category }); }
    if (params.group && GROUPS[params.group]) chips.push({ key: "group", label: GROUPS[params.group].label });
    if (params.make) chips.push({ key: "make", label: params.make });
    if (params.model) chips.push({ key: "model", label: params.model });
    if (params.q) chips.push({ key: "q", label: `"${params.q}"` });
    el.classList.toggle("hidden", !chips.length);
    el.classList.toggle("flex", !!chips.length);
    el.innerHTML = chips.map((f) => `<button data-key="${f.key}" class="flex items-center gap-1.5 rounded-full border border-crimson/50 bg-crimson/10 px-3 py-1 text-xs font-medium text-crimson-bright">${esc(f.label)} ✕</button>`).join("");
    el.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => updateParam(b.dataset.key, "")));
  }

  function paint() {
    const sort = document.getElementById("sortSelect").value;
    let list = all.slice();
    if (sort === "low") list.sort((a, b) => a.retail_price - b.retail_price);
    else if (sort === "high") list.sort((a, b) => b.retail_price - a.retail_price);
    document.getElementById("resultCount").textContent = `${list.length} product${list.length === 1 ? "" : "s"}`;
    renderProductGrid(document.getElementById("productResults"), list, "sm:grid-cols-2 xl:grid-cols-3");
  }
  document.getElementById("sortSelect").addEventListener("change", paint);

  async function load() {
    const params = getParams();
    const group = GROUPS[params.group];
    document.getElementById("pageHeading").textContent = params.q ? `Results for “${params.q}”` : group ? group.label : "Catalog";

    await AA.ready;
    const [cats, mk] = await Promise.all([AA.Categories.list().catch(() => []), AA.Catalog.carModels().catch(() => ({ makes: [] }))]);
    categories = cats; makes = mk.makes;
    linkList(document.getElementById("categoryFilterList"), categories.map((c) => ({ value: c.slug, label: c.name })), params.category, "category");
    linkList(document.getElementById("makeFilterList"), makes.map((m) => ({ value: m.make, label: m.make })).concat([{ value: "Universal", label: "Universal" }]), params.make, "make");
    renderChips(params);

    try {
      let products = params.q
        ? await AA.Products.search(params.q)
        : await AA.Products.list({ category_slug: params.category || undefined, vehicle_make: params.make || undefined, vehicle_model: params.model || undefined, limit: 200 });
      if (group) products = products.filter((p) => p.category && group.slugs.includes(p.category.slug));
      all = products;
      paint();
    } catch {
      document.getElementById("productResults").innerHTML = `<p class="py-24 text-center text-silver-dim">Something went wrong loading products.</p>`;
    }
  }
  load();
})();
