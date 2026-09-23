// Markaz-style reseller profit calculator.
// Enter what the product costs you and what you sell it for; the delivery / COD / return
// costs that eat into a reseller's profit are included so the number is realistic.
window.initProfitCalculator = function (container, products) {
  const esc = AA.escapeHtml;
  container.innerHTML = `
    <div class="mb-3 flex items-center gap-2"><span class="flex h-8 w-8 items-center justify-center rounded-md bg-green-600/15">🧮</span>
      <div><h2 class="text-base font-bold text-silver-bright">Profit Calculator</h2><p class="text-[11px] text-silver-dim">Markaz-style: your cost, your price, your real profit</p></div></div>
    ${products && products.length ? `
    <label class="lbl">Pick a product (optional)</label>
    <select id="pcProduct" class="field mb-3"><option value="">— enter numbers manually —</option>
      ${products.map((p) => `<option value="${esc(p.id)}">${esc(p.title)} — WS ${AA.fmtPKR(p.wholesale_price)}</option>`).join("")}</select>` : ""}
    <div class="grid grid-cols-2 gap-3">
      <div><label class="lbl">Wholesale cost (PKR)</label><input id="pcCost" type="number" min="0" class="field" value="0" /></div>
      <div><label class="lbl">Your selling price (PKR)</label><input id="pcSell" type="number" min="0" class="field" value="0" /></div>
      <div><label class="lbl">Quantity</label><input id="pcQty" type="number" min="1" class="field" value="1" /></div>
      <div><label class="lbl">Courier / delivery (PKR)</label><input id="pcShip" type="number" min="0" class="field" value="250" /></div>
      <div><label class="lbl">Packaging (PKR)</label><input id="pcPack" type="number" min="0" class="field" value="0" /></div>
      <div><label class="lbl">COD fee (%)</label><input id="pcCod" type="number" min="0" step="0.1" class="field" value="0" /></div>
      <div><label class="lbl">Return rate (%)</label><input id="pcRet" type="number" min="0" max="100" class="field" value="0" /></div>
      <label class="flex items-end gap-2 pb-2 text-xs text-silver"><input id="pcCustPays" type="checkbox" class="accent-[#E50914]" checked /> Customer pays delivery</label>
    </div>
    <div class="mt-4 grid grid-cols-3 gap-2.5 text-center">
      <div class="rounded-lg border border-carbon-600 bg-carbon-900 p-3"><p class="text-[11px] text-silver-dim">Profit / order</p><p id="pcProfit" class="text-base font-bold"></p></div>
      <div class="rounded-lg border border-carbon-600 bg-carbon-900 p-3"><p class="text-[11px] text-silver-dim">Profit margin</p><p id="pcMargin" class="text-base font-bold text-silver-bright"></p></div>
      <div class="rounded-lg border border-carbon-600 bg-carbon-900 p-3"><p class="text-[11px] text-silver-dim">ROI on cost</p><p id="pcRoi" class="text-base font-bold text-silver-bright"></p></div>
    </div>
    <p id="pcNote" class="mt-3 text-[11px] leading-snug text-silver-dim"></p>`;

  const $ = (id) => container.querySelector("#" + id);
  const num = (id) => Math.max(0, Number($(id).value) || 0);

  function calc() {
    const cost = num("pcCost"), sell = num("pcSell"), qty = Math.max(1, num("pcQty")), ship = num("pcShip"),
      pack = num("pcPack"), cod = num("pcCod"), ret = num("pcRet");
    const custPays = $("pcCustPays").checked;
    const revenue = sell * qty + (custPays ? ship : 0);
    const codFee = (sell * qty * cod) / 100;
    const returnLoss = ((ship + pack) * ret) / 100;           // expected courier + packing lost on returns
    const spend = cost * qty + ship + pack + codFee + returnLoss;
    const profit = revenue - spend;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const roi = cost * qty > 0 ? (profit / (cost * qty)) * 100 : 0;
    const p = $("pcProfit");
    p.textContent = AA.fmtPKR(Math.round(profit));
    p.className = `text-base font-bold ${profit >= 0 ? "text-green-400" : "text-crimson-bright"}`;
    $("pcMargin").textContent = `${margin.toFixed(1)}%`;
    $("pcRoi").textContent = `${roi.toFixed(1)}%`;
    $("pcNote").textContent = profit < 0
      ? "⚠ You'd lose money at this price — raise the selling price or reduce costs."
      : `Break-even selling price: ${AA.fmtPKR(Math.ceil((spend - (custPays ? ship : 0)) / qty / (1 - cod / 100)))} per unit.`;
  }
  container.querySelectorAll("input").forEach((i) => i.addEventListener("input", calc));

  const sel = $("pcProduct");
  if (sel) sel.addEventListener("change", () => {
    const p = products.find((x) => x.id === sel.value);
    if (!p) return;
    $("pcCost").value = p.wholesale_price;
    $("pcSell").value = p.retail_price;
    calc();
  });
  calc();
};
