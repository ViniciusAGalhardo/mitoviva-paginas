// Comportamento das páginas de venda Mitoviva (VSL e back redirect).
// Configuração em window.PAGE, definida no <head> de cada página.
(function () {
  var P = window.PAGE || {};
  var params = new URLSearchParams(location.search);
  var PREVIEW = params.get("preview") === "1";

  // ---------- Ano no rodapé ----------
  document.querySelectorAll(".js-ano").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  // ---------- Checkout com UTMs repassadas (Hotmart aceita src/sck/utm_*) ----------
  function checkoutUrl() {
    if (!P.CHECKOUT_URL) return "#checkout-nao-configurado";
    var u = new URL(P.CHECKOUT_URL);
    params.forEach(function (v, k) { if (k !== "preview" && !u.searchParams.has(k)) u.searchParams.set(k, v); });
    return u.toString();
  }
  document.querySelectorAll(".js-checkout").forEach(function (a) {
    a.href = checkoutUrl();
    a.addEventListener("click", function () { if (window.fbq) fbq("track", "InitiateCheckout"); });
  });

  // ---------- Back redirect (só na VSL) ----------
  // Duas entradas no histórico: o "voltar" cai na primeira (state != null) e redireciona mantendo as UTMs.
  if (P.BACK_REDIRECT_URL && !PREVIEW) {
    history.pushState({ br: 1 }, "", location.href);
    history.pushState({ br: 2 }, "", location.href);
    window.addEventListener("popstate", function (e) {
      if (!e.state) return;
      location.href = P.BACK_REDIRECT_URL + location.search;
    });
  }

  // ---------- Pixel Meta (opcional) ----------
  if (P.META_PIXEL_ID) {
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,"script","https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", P.META_PIXEL_ID); fbq("track", "PageView");
  }

  // ---------- Conteúdo com atraso (.delay) ----------
  var KEY = "mv:delay:" + location.pathname;
  // Cada bloco .delay pode ter seu próprio segundo (data-delay); sem valor usa PAGE.DELAY_SECONDS.
  var blocos = Array.prototype.slice.call(document.querySelectorAll(".delay"));
  blocos.forEach(function (el) { if (!el.dataset.delay) el.dataset.delay = String(P.DELAY_SECONDS || 0); });
  var maxDelay = blocos.reduce(function (m, el) { return Math.max(m, Number(el.dataset.delay)); }, 0);

  // Mostra os blocos cujo segundo já foi alcançado e guarda o maior tempo visto (quem volta não espera de novo)
  function revealUntil(t) {
    blocos.forEach(function (el) { if (t >= Number(el.dataset.delay)) el.hidden = false; });
    try { if (t > Number(localStorage.getItem(KEY) || -1)) localStorage.setItem(KEY, String(t)); } catch (e) { /* sem storage */ }
  }
  function reveal() { revealUntil(Infinity); }
  var visto = -1;
  try { visto = Number(localStorage.getItem(KEY) ?? -1); } catch (e) {}
  if (P.SHOW_ALL || PREVIEW) reveal(); else if (visto >= 0) revealUntil(visto);

  // ---------- Player ----------
  var box = document.getElementById("player");
  if (!box) return;

  // TESTE LOCAL: ?video=/caminho.mp4 (&delays=seg1,seg2) toca um vídeo de referência para testar o layout.
  // Só funciona em localhost/127.0.0.1 — publicada, a página ignora o parâmetro e nada é exibido.
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  if (LOCAL && params.get("video")) {
    var ds = (params.get("delays") || "").split(",").filter(Boolean);
    if (ds.length) blocos.forEach(function (el, i) { el.dataset.delay = ds[Math.min(i, ds.length - 1)]; });
    box.innerHTML = '<video controls playsinline preload="metadata" style="width:100%;height:100%;background:#000"></video>';
    var v = box.querySelector("video");
    v.src = params.get("video");
    v.addEventListener("timeupdate", function () { revealUntil(Math.floor(v.currentTime)); });
    return;
  }

  // VSL própria auto-hospedada (mp4 na pasta da página). Sem seek: o play é por botão
  // e a barra só reflete o progresso, pra manter os CTAs no tempo certo do vídeo.
  if (P.VIDEO_SRC) {
    box.innerHTML =
      '<div class="player-demo">' +
      '<video playsinline preload="metadata" src="' + P.VIDEO_SRC + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000"></video>' +
      '<button type="button" aria-label="Reproducir" style="position:relative;z-index:2">▶</button>' +
      '<div class="player-bar"><i></i></div><span class="player-time">0:00</span></div>';
    var vid = box.querySelector("video");
    var vbtn = box.querySelector("button"), vbar = box.querySelector(".player-bar i"), vtm = box.querySelector(".player-time");
    function toggle() { if (vid.paused) vid.play(); else vid.pause(); }
    vbtn.addEventListener("click", toggle);
    vid.addEventListener("click", toggle);
    vid.addEventListener("play", function () { vbtn.hidden = true; });
    vid.addEventListener("pause", function () { if (!vid.ended) vbtn.hidden = false; });
    vid.addEventListener("timeupdate", function () {
      var t = Math.floor(vid.currentTime);
      if (vid.duration) vbar.style.width = Math.min(100, (vid.currentTime / vid.duration) * 100) + "%";
      vtm.textContent = Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
      revealUntil(t);
    });
    if (!maxDelay) reveal();
    return;
  }

  if (P.VTURB_PLAYER_ID && P.VTURB_ACCOUNT_ID) {
    // Embed VTurb smartplayer v4 (mesmo formato do script de embed do painel)
    box.innerHTML = '<vturb-smartplayer id="vid-' + P.VTURB_PLAYER_ID + '" style="display:block;margin:0 auto;width:100%"></vturb-smartplayer>';
    var s = document.createElement("script");
    s.src = "https://scripts.converteai.net/" + P.VTURB_ACCOUNT_ID + "/players/" + P.VTURB_PLAYER_ID + "/v4/player.js";
    s.async = true;
    document.head.appendChild(s);
    // Delay: usa o recurso nativo do VTurb quando disponível; senão, cronômetro a partir do play.
    // Validar no painel do VTurb qual API a sua versão expõe antes de subir.
    var el = box.querySelector("vturb-smartplayer");
    el.addEventListener("player:ready", function (ev) {
      var player = ev.target;
      if (typeof player.displayHiddenElements !== "function") return;
      // Um registro por segundo distinto: cada grupo de botões aparece no seu momento do vídeo
      var segundos = blocos.map(function (b) { return b.dataset.delay; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
      segundos.forEach(function (sec) {
        var sel = '.delay[data-delay="' + sec + '"]';
        document.querySelectorAll(sel).forEach(function (d) { if (d.hidden) { d.hidden = false; d.style.display = "none"; } });
        player.displayHiddenElements(Number(sec), [sel], { persist: true });
      });
    });
    if (!maxDelay) reveal();
    return;
  }

  // Player de exemplo (sem VSL configurada): mesmo tamanho 16:9 e simula o tempo do vídeo.
  box.innerHTML =
    '<div class="player-demo"><button type="button" aria-label="Reproducir">▶</button>' +
    '<p>{{VSL_MITOVIVA}}</p><small>Player de ejemplo · configura VTURB_PLAYER_ID</small>' +
    '<div class="player-bar"><i></i></div><span class="player-time">0:00</span></div>';
  var btn = box.querySelector("button"), bar = box.querySelector(".player-bar i"), tm = box.querySelector(".player-time");
  btn.addEventListener("click", function () {
    btn.hidden = true;
    var t = 0, total = Math.max(maxDelay + 5, 10);
    var it = setInterval(function () {
      t += 1;
      bar.style.width = Math.min(100, (t / total) * 100) + "%";
      tm.textContent = Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
      revealUntil(t);
      if (t >= total) clearInterval(it);
    }, 1000);
  });
})();
