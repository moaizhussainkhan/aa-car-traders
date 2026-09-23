// Shared storefront UI: modals, cart drawer + checkout, wholesale details, product action buttons.
window.ShopUI = (function () {
  const esc = AA.escapeHtml;
  const registry = new Map(); // product id -> product (filled by renderProductCard)

  const register = (products) => (products || []).forEach((p) => registry.set(p.id, p));

  // ---------------------------------------------------------------- modal
  function modal(html, opts = {}) {
    const root = document.getElementById("modalRoot");
    const wrap = document.createElement("div");
    wrap.className = "fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4";
    wrap.innerHTML = `
      <div class="card card-red relative max-h-[92vh] w-full ${opts.wide ? "sm:max-w-2xl" : "sm:max-w-md"} overflow-y-auto rounded-b-none p-5 shadow-2xl sm:rounded-b-[0.9rem] sm:p-6" role="dialog" aria-modal="true">
        <button data-close aria-label="Close" class="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-silver-dim hover:bg-carbon-700 hover:text-white">✕</button>
        ${html}
      </div>`;
    root.appendChild(wrap);
    const close = () => { wrap.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    wrap.addEventListener("click", (e) => { if (e.target === wrap || e.target.closest("[data-close]")) close(); });
    return { el: wrap, close };
  }

  // ---------------------------------------------------------------- cart drawer
  let drawer = null; // { el, close }
  let orderResult = null;

  function subtotal(items, reseller, margin) {
    return items.reduce((sum, i) => {
      const unit = reseller && i.wholesale != null ? Math.round(i.wholesale * (1 + margin / 100)) : i.price;
      return sum + unit * i.qty;
    }, 0);
  }

  function drawerShell() {
    const root = document.getElementById("modalRoot");
    const wrap = document.createElement("div");
    wrap.className = "fixed inset-0 z-[80] flex justify-end bg-black/70 backdrop-blur-sm";
    wrap.innerHTML = `<aside class="flex h-full w-full max-w-md flex-col border-l border-carbon-600 bg-carbon-950 shadow-2xl" role="dialog" aria-label="Cart"><div data-body class="flex min-h-0 flex-1 flex-col"></div></aside>`;
    root.appendChild(wrap);
    const close = () => { wrap.remove(); drawer = null; orderResult = null; document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    wrap.addEventListener("click", (e) => { if (e.target === wrap || e.target.closest("[data-close]")) close(); });
    return { el: wrap, body: wrap.querySelector("[data-body]"), close };
  }

  function renderCart() {
    if (!drawer) return;
    if (orderResult) return renderSuccess();
    const items = AA.Cart.items();
    const user = AA.getUser();
    const canReseller = AA.isReseller(user) && items.some((i) => i.wholesale != null);
    const b = drawer.body;

    const header = `
      <div class="flex items-center justify-between border-b border-carbon-600 px-5 py-4">
        <h2 class="text-base font-bold text-silver-bright">Your cart <span class="text-sm font-normal text-silver-dim">(${AA.Cart.count()})</span></h2>
        <button data-close aria-label="Close cart" class="flex h-8 w-8 items-center justify-center rounded-md text-silver-dim hover:bg-carbon-700 hover:text-white">✕</button>
      </div>`;

    if (!items.length) {
      b.innerHTML = header + `
        <div class="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-silver-dim">
          <div class="text-4xl">🛒</div><p class="text-sm">Your cart is empty.</p>
          <a href="/products" class="btn-crimson px-5 py-2 text-sm">Browse products</a>
        </div>`;
      return;
    }

    const state = drawer.state || (drawer.state = { reseller: false, margin: 20 });
    if (!canReseller) state.reseller = false;

    b.innerHTML = header + `
      <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <ul class="divide-y divide-carbon-700">
          ${items.map((i) => {
            const unit = state.reseller && i.wholesale != null ? Math.round(i.wholesale * (1 + state.margin / 100)) : i.price;
            return `
            <li class="flex gap-3 py-3">
              <a href="/products/${esc(i.slug)}" class="h-16 w-20 shrink-0 overflow-hidden rounded-md bg-carbon-800">${AA.imgTag(i.thumb, i.title, "h-full w-full object-cover")}</a>
              <div class="min-w-0 flex-1">
                <a href="/products/${esc(i.slug)}" class="line-clamp-2 text-sm font-semibold text-silver-bright hover:text-crimson-bright">${esc(i.title)}</a>
                <p class="mt-0.5 text-sm font-bold text-crimson-bright">${AA.fmtPKR(unit)}</p>
                <div class="mt-1.5 flex items-center gap-2">
                  <button data-dec="${esc(i.id)}" class="h-7 w-7 rounded-md border border-carbon-600 text-silver hover:border-crimson" aria-label="Decrease">−</button>
                  <span class="w-6 text-center text-sm">${i.qty}</span>
                  <button data-inc="${esc(i.id)}" class="h-7 w-7 rounded-md border border-carbon-600 text-silver hover:border-crimson" aria-label="Increase">+</button>
                  <button data-del="${esc(i.id)}" class="ml-auto text-xs text-silver-dim hover:text-crimson-bright">Remove</button>
                </div>
              </div>
            </li>`;
          }).join("")}
        </ul>

        ${canReseller ? `
        <div class="mt-3 rounded-lg border border-crimson/40 bg-crimson/5 p-3 text-sm">
          <label class="flex items-center gap-2 font-semibold text-silver-bright">
            <input type="checkbox" id="ckReseller" ${state.reseller ? "checked" : ""} class="accent-crimson" /> Reseller order (wholesale + my margin)
          </label>
          <div id="ckMarginRow" class="${state.reseller ? "" : "hidden"} mt-2 flex items-center gap-2 text-xs text-silver-dim">
            My margin <input id="ckMargin" type="number" min="0" max="500" value="${state.margin}" class="field w-20 py-1 text-sm" /> %
            <span>— the invoice shows only the final price.</span>
          </div>
        </div>` : ""}

        <form id="ckForm" class="mt-4 space-y-3">
          <p class="text-xs font-semibold uppercase tracking-wider text-silver-dim">${state.reseller ? "Your customer's details" : "Delivery details"}</p>
          <input id="ckName" required minlength="2" placeholder="Full name" class="field" value="${esc(!state.reseller && user ? user.name : "")}" />
          <input id="ckPhone" required minlength="7" type="tel" inputmode="tel" placeholder="Mobile / WhatsApp number (03xx xxxxxxx)" class="field" value="${esc(!state.reseller && user && user.phone ? user.phone : "")}" />
          <textarea id="ckAddress" required rows="2" placeholder="Full delivery address (house, street, city)" class="field"></textarea>
          <p class="text-xs text-silver-dim">💵 Payment: Cash on Delivery. We'll confirm your order on WhatsApp.</p>
          <p id="ckError" class="hidden text-sm text-crimson-bright"></p>
        </form>
      </div>

      <div class="border-t border-carbon-600 bg-carbon-900 px-5 py-4">
        <div class="mb-3 flex items-center justify-between text-sm"><span class="text-silver-dim">Total</span>
          <span class="text-lg font-bold text-silver-bright">${AA.fmtPKR(subtotal(items, state.reseller, state.margin))}</span></div>
        <button id="ckSubmit" form="ckForm" type="submit" class="btn-crimson w-full py-3 text-sm">Place Order</button>
      </div>`;

    b.querySelectorAll("[data-inc]").forEach((el) => el.addEventListener("click", () => { const i = items.find((x) => x.id === el.dataset.inc); AA.Cart.setQty(i.id, i.qty + 1); }));
    b.querySelectorAll("[data-dec]").forEach((el) => el.addEventListener("click", () => { const i = items.find((x) => x.id === el.dataset.dec); if (i.qty > 1) AA.Cart.setQty(i.id, i.qty - 1); }));
    b.querySelectorAll("[data-del]").forEach((el) => el.addEventListener("click", () => AA.Cart.remove(el.dataset.del)));

    const ck = b.querySelector("#ckReseller");
    if (ck) {
      ck.addEventListener("change", () => { keepForm(); state.reseller = ck.checked; renderCart(); });
      b.querySelector("#ckMargin").addEventListener("change", (e) => { keepForm(); state.margin = Math.max(0, Math.min(500, Number(e.target.value) || 0)); renderCart(); });
    }
    restoreForm();
    b.querySelector("#ckForm").addEventListener("submit", submitOrder);
  }

  // keep typed customer details while the drawer re-renders (qty change etc.)
  const formMemo = { name: "", phone: "", address: "" };
  function keepForm() {
    const n = document.getElementById("ckName");
    if (!n) return;
    formMemo.name = n.value; formMemo.phone = document.getElementById("ckPhone").value; formMemo.address = document.getElementById("ckAddress").value;
  }
  function restoreForm() {
    if (formMemo.name) document.getElementById("ckName").value = formMemo.name;
    if (formMemo.phone) document.getElementById("ckPhone").value = formMemo.phone;
    if (formMemo.address) document.getElementById("ckAddress").value = formMemo.address;
    ["ckName", "ckPhone", "ckAddress"].forEach((id) => document.getElementById(id).addEventListener("input", keepForm));
  }

  async function submitOrder(e) {
    e.preventDefault();
    const btn = document.getElementById("ckSubmit");
    const err = document.getElementById("ckError");
    err.classList.add("hidden");
    const items = AA.Cart.items();
    const state = drawer.state;
    btn.disabled = true; btn.textContent = "Placing order…";
    try {
      const order = await AA.Orders.create({
        customer_name: document.getElementById("ckName").value,
        customer_phone: document.getElementById("ckPhone").value,
        customer_address: document.getElementById("ckAddress").value,
        is_reseller_order: !!state.reseller,
        reseller_margin_percent: state.reseller ? state.margin : 0,
        items: items.map((i) => ({ product_id: i.id, quantity: i.qty })),
      });
      orderResult = { order, items };
      AA.Cart.clear();
      formMemo.name = formMemo.phone = formMemo.address = "";
      renderSuccess();
    } catch (ex) {
      err.textContent = ex.message;
      err.classList.remove("hidden");
      btn.disabled = false; btn.textContent = "Place Order";
    }
  }

  function renderSuccess() {
    const { order, items } = orderResult;
    const lines = [
      "Assalam o Alaikum AA Car Traders,",
      `I just placed order *${order.order_number}*.`, "",
      `Name: ${order.customer_name}`, `Phone: ${order.customer_phone}`, `Address: ${order.customer_address || "-"}`, "",
      "Items:",
      ...order.items.map((it) => `- ${it.quantity} x ${it.product_title || (items.find((i) => i.id === it.product_id) || {}).title || "Item"} — ${AA.fmtPKR(it.unit_price)}`),
      "", `Total: ${AA.fmtPKR(order.total_amount)} (Cash on Delivery)`, "Please confirm my order. Thank you!",
    ];
    drawer.body.innerHTML = `
      <div class="flex items-center justify-end border-b border-carbon-600 px-5 py-4">
        <button data-close aria-label="Close" class="flex h-8 w-8 items-center justify-center rounded-md text-silver-dim hover:bg-carbon-700 hover:text-white">✕</button>
      </div>
      <div class="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <div class="flex h-16 w-16 items-center justify-center rounded-full bg-green-600/15 text-3xl text-green-400">✔</div>
        <h2 class="text-lg font-bold text-silver-bright">Order placed!</h2>
        <p class="text-sm text-silver-dim">Your order number is <span class="font-bold text-silver-bright">${esc(order.order_number)}</span><br/>Total ${AA.fmtPKR(order.total_amount)} · Cash on Delivery</p>
        <a href="${AA.buildGeneralWhatsAppLink(lines.join("\n"))}" target="_blank" rel="noopener noreferrer" class="btn-green mt-2 w-full py-3 text-sm">💬 Confirm on WhatsApp</a>
        <a href="${AA.Orders.invoiceUrl(order.id)}" target="_blank" rel="noopener noreferrer" class="btn-ghost w-full py-2.5 text-sm">⬇ Download invoice (PDF)</a>
        <button data-close class="mt-1 text-sm text-silver-dim hover:text-white">Continue shopping</button>
      </div>`;
  }

  function openCart() {
    if (drawer) return renderCart();
    drawer = { ...drawerShell(), state: null };
    renderCart();
  }

  // ---------------------------------------------------------------- wholesale details
  function openWholesale(product) {
    const user = AA.getUser();
    if (!AA.isReseller(user)) {
      const pending = AA.isPendingReseller(user);
      const m = modal(`
        <div class="text-center">
          <div class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-crimson/15 text-2xl">🔒</div>
          <h3 class="text-base font-bold text-silver-bright">Wholesale details are for resellers</h3>
          <p class="mt-2 text-sm text-silver-dim">${pending
            ? "Your reseller account is waiting for approval. Message us on WhatsApp and we'll approve it quickly."
            : "Sign in with an approved reseller account to see wholesale prices, copy product info and download HD images."}</p>
          <div class="mt-5 flex flex-col gap-2">
            ${pending
              ? `<a href="${AA.buildGeneralWhatsAppLink("Hi AA Car Traders, please approve my reseller account: " + (user.email || ""))}" target="_blank" class="btn-green py-2.5 text-sm">💬 Message us on WhatsApp</a>`
              : `<a href="/login?next=${encodeURIComponent(location.pathname + location.search)}" class="btn-crimson py-2.5 text-sm">Login</a>
                 <a href="/register?type=reseller" class="btn-ghost py-2.5 text-sm">Become a reseller</a>`}
          </div>
        </div>`);
      return m;
    }

    // Fetch the reseller view (the list on the page may have been loaded before login)
    const m = modal(`<div class="flex justify-center py-10"><span class="spinner"></span></div>`, { wide: true });
    AA.Products.get(product.id).then((p) => {
      const info = [
        p.title, "",
        `Fits: ${p.vehicle_make} ${p.vehicle_model}${p.vehicle_year_from ? ` (${p.vehicle_year_from}-${p.vehicle_year_to || ""})` : ""}`,
        `Price: ${AA.fmtPKR(p.retail_price)}`, "", p.description, "",
        `Order / details: ${location.origin}/products/${p.slug}`,
      ].join("\n");
      const box = m.el.querySelector("[role=dialog]");
      box.innerHTML = `
        <button data-close aria-label="Close" class="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-silver-dim hover:bg-carbon-700 hover:text-white">✕</button>
        <h3 class="pr-8 text-base font-bold text-silver-bright">${esc(p.title)}</h3>
        <p class="mt-1 text-xs text-silver-dim">${esc(p.category ? p.category.name : "")} · Fits ${esc(p.vehicle_make)} ${esc(p.vehicle_model)}</p>
        <div class="mt-4 grid grid-cols-3 gap-3 text-center">
          <div class="rounded-lg border border-carbon-600 bg-carbon-900 p-3"><p class="text-[11px] text-silver-dim">Wholesale</p><p class="text-sm font-bold text-silver-bright">${AA.fmtPKR(p.wholesale_price)}</p></div>
          <div class="rounded-lg border border-carbon-600 bg-carbon-900 p-3"><p class="text-[11px] text-silver-dim">Retail</p><p class="text-sm font-bold text-silver-bright">${AA.fmtPKR(p.retail_price)}</p></div>
          <div class="rounded-lg border border-green-600/40 bg-green-600/10 p-3"><p class="text-[11px] text-silver-dim">Max margin</p><p class="text-sm font-bold text-green-400">${AA.fmtPKR(p.margin)}</p></div>
        </div>
        <pre class="mt-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-carbon-600 bg-carbon-950 p-3 text-xs leading-relaxed text-silver">${esc(info)}</pre>
        <div class="mt-4 grid gap-2 sm:grid-cols-2">
          <button id="wsCopy" class="btn-ghost py-2.5 text-sm">📋 Copy info</button>
          <button id="wsZip" class="btn-crimson py-2.5 text-sm">⬇ Download images (ZIP)</button>
        </div>
        <p class="mt-3 text-[11px] text-silver-dim">The copied text shows retail price only — safe to forward to your customers. Wholesale price stays private.</p>`;
      box.querySelector("#wsCopy").addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(info); AA.toast("Product info copied"); }
        catch { AA.toast("Couldn't copy — select the text and copy manually", "err"); }
      });
      const zip = box.querySelector("#wsZip");
      zip.addEventListener("click", async () => {
        zip.disabled = true; zip.textContent = "Preparing ZIP…";
        try { await AA.Products.mediaZip(p.id); AA.toast("Download started"); }
        catch (ex) { AA.toast(ex.message, "err"); }
        finally { zip.disabled = false; zip.textContent = "⬇ Download images (ZIP)"; }
      });
    }).catch((ex) => { m.el.querySelector("[role=dialog]").innerHTML += `<p class="py-8 text-center text-sm text-crimson-bright">${esc(ex.message)}</p>`; });
    return m;
  }

  // ---------------------------------------------------------------- bulk downloader
  async function bulkDownload(btn, categorySlug) {
    const user = AA.getUser();
    if (!AA.isReseller(user)) { openWholesale({}); return; }
    const old = btn ? btn.innerHTML : "";
    if (btn) { btn.disabled = true; btn.innerHTML = "Preparing ZIP…"; }
    try { await AA.Products.bulkZip(categorySlug); AA.toast("ZIP download started"); }
    catch (ex) { AA.toast(ex.message, "err"); }
    finally { if (btn) { btn.disabled = false; btn.innerHTML = old; } }
  }

  // ---------------------------------------------------------------- global click actions
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;
    const product = el.dataset.id ? registry.get(el.dataset.id) : null;
    if (action === "order" && product) {
      if (product.stock_quantity <= 0) return AA.toast("Sorry, this item is out of stock.", "err");
      AA.Cart.add(product, 1);
      AA.toast("Added to cart");
      openCart();
    } else if (action === "wholesale" && product) {
      openWholesale(product);
    } else if (action === "visual-search") {
      if (window.AIWidget) window.AIWidget.open({ visual: true });
    } else if (action === "open-cart") {
      openCart();
    } else if (action === "bulk-zip") {
      bulkDownload(el, el.dataset.category || undefined);
    }
  });

  AA.Cart.onChange(() => {
    const n = AA.Cart.count();
    const badge = document.getElementById("cartBadge");
    if (badge) { badge.textContent = n; badge.classList.toggle("hidden", n === 0); badge.classList.toggle("flex", n > 0); }
    if (drawer && !orderResult) renderCart();
  });

  return { register, modal, openCart, openWholesale, bulkDownload };
})();
