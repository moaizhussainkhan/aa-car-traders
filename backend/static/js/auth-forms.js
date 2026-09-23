// Customer / reseller login + registration (the admin signs in on its own hidden page).
(function () {
  const next = new URLSearchParams(location.search).get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  const $ = (id) => document.getElementById(id);

  function fail(msg) { const e = $("formError"); e.textContent = msg; e.classList.remove("hidden"); }

  const loginForm = $("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("formSubmit");
      $("formError").classList.add("hidden");
      btn.disabled = true; btn.textContent = "Signing in…";
      try {
        const res = await AA.Auth.login($("email").value.trim(), $("password").value);
        AA.setSession(res.access_token, res.user);
        location.href = safeNext || (res.user.role === "reseller" ? "/reseller" : "/");
      } catch (err) { fail(err.message || "Login failed."); }
      finally { btn.disabled = false; btn.textContent = "Sign in"; }
    });
  }

  const regForm = $("registerForm");
  if (regForm) {
    let type = new URLSearchParams(location.search).get("type") === "reseller" ? "reseller" : "customer";
    function paintType() {
      document.querySelectorAll("#typeSwitch button").forEach((b) => {
        const on = b.dataset.type === type;
        b.className = `rounded-lg border py-2 font-semibold ${on ? "border-crimson bg-crimson/15 text-silver-bright" : "border-carbon-600 text-silver-dim"}`;
      });
      $("business_name").classList.toggle("hidden", type !== "reseller");
      $("resellerNote").classList.toggle("hidden", type !== "reseller");
    }
    document.querySelectorAll("#typeSwitch button").forEach((b) => b.addEventListener("click", () => { type = b.dataset.type; paintType(); }));
    paintType();

    regForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("formSubmit");
      $("formError").classList.add("hidden");
      btn.disabled = true; btn.textContent = "Creating account…";
      const email = $("email").value.trim(), password = $("password").value;
      try {
        await AA.Auth.register({
          name: $("name").value.trim(), email, password, phone: $("phone").value.trim(),
          business_name: type === "reseller" ? $("business_name").value.trim() || null : null, role: type,
        });
        const res = await AA.Auth.login(email, password);   // sign in straight away
        AA.setSession(res.access_token, res.user);
        location.href = safeNext || (type === "reseller" ? "/reseller" : "/");
      } catch (err) { fail(err.message || "Registration failed."); btn.disabled = false; btn.textContent = "Create account"; }
    });
  }
})();
