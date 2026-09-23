// Floating AI Adviser: chat (text / voice, English + Urdu), read-aloud, and photo (visual) search.
(function () {
  const $ = (id) => document.getElementById(id);
  const toggleBtn = $("aiWidgetToggle"), panel = $("aiWidgetPanel");
  if (!toggleBtn || !panel) return;
  const iconBot = $("aiIconBot"), iconClose = $("aiIconClose");
  const messagesEl = $("aiMessages"), form = $("aiForm"), input = $("aiInput");
  const makeInput = $("aiMake"), modelInput = $("aiModel");
  const imageBtn = $("aiImageBtn"), imageInput = $("aiImageInput");
  const micBtn = $("aiMicBtn"), langBtn = $("aiLangBtn"), speakBtn = $("aiSpeakBtn");
  const hint = $("aiBubbleHint");
  const esc = AA.escapeHtml;

  let isOpen = false, loading = false, listening = false, speak = false, lang = "en-US", recognition = null;

  // ---- speech-bubble hint (dismissible, remembered for the session)
  if (hint) {
    if (sessionStorage.getItem("aact_hint_closed")) hint.classList.add("!hidden");
    hint.addEventListener("click", () => setOpen(true));
    $("aiHintClose").addEventListener("click", (e) => { e.stopPropagation(); hint.classList.add("!hidden"); sessionStorage.setItem("aact_hint_closed", "1"); });
  }

  function setOpen(open) {
    isOpen = open;
    panel.classList.toggle("hidden", !open);
    panel.classList.toggle("flex", open);
    iconBot.classList.toggle("hidden", open);
    iconClose.classList.toggle("hidden", !open);
    if (open && hint) hint.classList.add("!hidden");
    if (open) setTimeout(() => input.focus(), 50);
  }
  toggleBtn.addEventListener("click", () => setOpen(!isOpen));

  function addMessage(role, text, products) {
    const wrap = document.createElement("div");
    wrap.className = role === "user" ? "flex justify-end" : "flex flex-col items-start gap-2";
    const bubble = document.createElement("div");
    bubble.className = "max-w-[88%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm leading-relaxed " +
      (role === "user" ? "rounded-br-sm bg-crimson text-white" : "rounded-bl-sm border border-carbon-600 bg-carbon-900 text-silver");
    bubble.textContent = text;
    wrap.appendChild(bubble);

    if (products && products.length) {
      ShopUI.register(products);
      const list = document.createElement("div");
      list.className = "w-full space-y-2";
      list.innerHTML = products.map((p) => `
        <a href="/products/${esc(p.slug)}" class="flex items-center gap-2.5 rounded-xl border border-carbon-600 bg-carbon-900 p-2 transition hover:border-crimson">
          <span class="h-12 w-14 shrink-0 overflow-hidden rounded-md bg-carbon-800">${AA.imgTag(p.thumbnail_url, p.title, "h-full w-full object-cover")}</span>
          <span class="min-w-0"><span class="line-clamp-2 block text-xs font-semibold text-silver-bright">${esc(p.title)}</span>
          <span class="block text-xs font-bold text-crimson-bright">${AA.fmtPKR(p.retail_price)}</span></span>
        </a>`).join("");
      wrap.appendChild(list);
    }
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    if (role === "assistant" && speak && "speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(text.replace(/[•*_]/g, ""));
      u.lang = lang === "ur-PK" ? "ur-PK" : "en-US";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  }

  function setLoading(on) {
    loading = on;
    const old = $("aiLoadingRow");
    if (old) old.remove();
    if (on) {
      const el = document.createElement("div");
      el.id = "aiLoadingRow";
      el.className = "flex items-center gap-2 text-xs text-silver-dim";
      el.innerHTML = `<span class="spinner"></span> Thinking…`;
      messagesEl.appendChild(el);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }

  addMessage("assistant", "Assalam o Alaikum! I'm the AA Car Traders AI Adviser. Tell me your car (make & model) and what you're after — body kit, LED lights, spoiler, anything. You can type, speak 🎤, or upload a photo 📷.");

  async function sendMessage(text) {
    text = (text || "").trim();
    if (!text || loading) return;
    addMessage("user", text);
    input.value = "";
    setLoading(true);
    try {
      const res = await AA.Ai.chat({
        message: text,
        vehicle_make: makeInput.value || undefined,
        vehicle_model: modelInput.value || undefined,
      });
      setLoading(false);
      addMessage("assistant", res.reply, res.recommended_products);
    } catch {
      setLoading(false);
      addMessage("assistant", "Sorry, I couldn't reach the adviser right now. Please try again or message us on WhatsApp.");
    }
  }
  form.addEventListener("submit", (e) => { e.preventDefault(); sendMessage(input.value); });

  // ---- visual search
  imageBtn.addEventListener("click", () => imageInput.click());
  imageInput.addEventListener("change", async () => {
    const file = imageInput.files[0];
    if (!file) return;
    addMessage("user", `📷 Photo uploaded${makeInput.value || modelInput.value ? ` (${makeInput.value} ${modelInput.value})` : ""}`);
    setLoading(true);
    try {
      const res = await AA.Ai.visualSearch(file, makeInput.value || undefined, modelInput.value || undefined);
      setLoading(false);
      addMessage("assistant", res.note, res.matches.slice(0, 4));
    } catch {
      setLoading(false);
      addMessage("assistant", "Visual search failed — please try again.");
    } finally { imageInput.value = ""; }
  });

  // ---- voice input (Chrome / Edge / Android) + read-aloud + language
  langBtn.addEventListener("click", () => {
    lang = lang === "en-US" ? "ur-PK" : "en-US";
    langBtn.textContent = lang === "en-US" ? "EN" : "اردو";
  });
  speakBtn.addEventListener("click", () => {
    speak = !speak;
    speakBtn.textContent = speak ? "🔊 On" : "🔈 Off";
    if (!speak && "speechSynthesis" in window) window.speechSynthesis.cancel();
  });
  micBtn.addEventListener("click", () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { AA.toast("Voice input isn't supported in this browser. Try Chrome on desktop or Android.", "err"); return; }
    if (listening && recognition) { recognition.stop(); return; }
    recognition = new SR();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.onresult = (e) => { input.value = e.results[0][0].transcript; sendMessage(input.value); };
    const stop = () => { listening = false; micBtn.classList.remove("text-crimson-bright", "border-crimson"); };
    recognition.onend = stop; recognition.onerror = stop;
    recognition.start();
    listening = true;
    micBtn.classList.add("text-crimson-bright", "border-crimson");
  });

  window.AIWidget = {
    open(opts = {}) {
      setOpen(true);
    },
  };
})();
