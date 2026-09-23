(async function () {
  const esc = AA.escapeHtml;
  // Re-check the account with the server first — the admin may have approved it since the last login.
  if (AA.getToken()) {
    try { AA.setSession(AA.getToken(), await AA.Auth.me()); }
    catch (e) { if (e.status === 401) AA.clearSession(); }
  }
  const user = AA.getUser();
  const statusBox = document.getElementById("statusBox");
  let approved = AA.isReseller(user);

  function paintStatus() {
    if (approved) {
      statusBox.innerHTML = `<div class="rounded-xl border border-green-600/40 bg-green-600/10 px-4 py-3 text-sm text-green-300">✔ Approved reseller account${user && user.business_name ? ` — ${esc(user.business_name)}` : ""}. Wholesale prices are visible below.</div>`;
    } else if (AA.isPendingReseller(user)) {
      statusBox.innerHTML = `<div class="rounded-xl border border-crimson/40 bg-crimson/10 px-4 py-3 text-sm text-silver">⏳ Your reseller account is <b>waiting for approval</b>. <a id="waApprove" href="#" target="_blank" class="font-semibold text-green-400 underline">Message us on WhatsApp</a> to get approved faster.</div>`;
      AA.ready.then(() => { document.getElementById("waApprove").href = AA.buildGeneralWhatsAppLink("Hi AA Car Traders, please approve my reseller account: " + user.email); });
    } else {
      statusBox.innerHTML = `<div class="card flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-silver-dim">
        <span>${user ? "You're signed in as a customer." : "Wholesale tools need a reseller account."} Approved resellers see wholesale prices and can download ZIP media.</span>
        <span class="flex gap-2">${user ? "" : `<a href="/login?next=/reseller" class="btn-ghost px-4 py-2 text-sm">Login</a>`}<a href="/register?type=reseller" class="btn-crimson px-4 py-2 text-sm">Become a reseller</a></span></div>`;
    }
  }
  paintStatus();

  AA.Categories.list().then((cats) => {
    const sel = document.getElementById("bulkCategory");
    sel.innerHTML += cats.map((c) => `<option value="${esc(c.slug)}">${esc(c.name)}</option>`).join("");
    sel.addEventListener("change", () => { document.getElementById("bulkBtn").dataset.category = sel.value; });
  }).catch(() => {});

  async function init() {
    await AA.ready;
    let products = [];
    if (approved) {
      try {
        products = await AA.Products.list({ limit: 200 });
        if (!products.length || typeof products[0].wholesale_price !== "number") {
          if (products.length) { approved = false; paintStatus(); products = []; }   // token no longer privileged
        }
      } catch { products = []; }
    }
    window.initProfitCalculator(document.getElementById("calculator"), products);
    if (!approved || !products.length) return;

    ShopUI.register(products);
    const section = document.getElementById("catalogSection");
    section.classList.remove("hidden");
    const tbody = document.getElementById("catalogRows");
    function paint(filter = "") {
      const f = filter.toLowerCase();
      const list = products.filter((p) => !f || `${p.title} ${p.vehicle_make} ${p.vehicle_model} ${p.category.name}`.toLowerCase().includes(f));
      tbody.innerHTML = list.map((p) => `
        <tr class="text-silver">
          <td class="px-4 py-2.5"><div class="flex items-center gap-3"><span class="h-11 w-14 shrink-0 overflow-hidden rounded-md bg-carbon-800">${AA.imgTag(p.thumbnail_url, p.title, "h-full w-full object-cover")}</span>
            <div class="min-w-0"><a href="/products/${esc(p.slug)}" class="line-clamp-1 font-semibold text-silver-bright hover:text-crimson-bright">${esc(p.title)}</a><p class="text-[11px] text-silver-dim">${esc(p.vehicle_make)} ${esc(p.vehicle_model)} · stock ${p.stock_quantity}</p></div></div></td>
          <td class="px-3 py-2.5 text-silver-dim">${esc(p.category.name)}</td>
          <td class="px-3 py-2.5 font-semibold">${AA.fmtPKR(p.wholesale_price)}</td>
          <td class="px-3 py-2.5">${AA.fmtPKR(p.retail_price)}</td>
          <td class="px-3 py-2.5 font-semibold text-green-400">${AA.fmtPKR(p.margin)}</td>
          <td class="px-3 py-2.5"><div class="flex justify-end gap-1.5">
            <button data-action="wholesale" data-id="${esc(p.id)}" class="btn-ghost px-2.5 py-1.5 text-xs">Details</button>
            <button data-action="order" data-id="${esc(p.id)}" ${p.stock_quantity <= 0 ? "disabled" : ""} class="btn-crimson px-2.5 py-1.5 text-xs">Order</button></div></td>
        </tr>`).join("") || `<tr><td colspan="6" class="px-4 py-8 text-center text-silver-dim">No matching products.</td></tr>`;
    }
    paint();
    document.getElementById("catalogSearch").addEventListener("input", (e) => paint(e.target.value));
  }
  init();
})();
