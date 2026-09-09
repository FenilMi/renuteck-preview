/* ------------------------------------------------------------------
   Local review overlay -- NOT part of the public site.

   header.php only emits the <script> tag when the page is being served
   from 127.0.0.1 or localhost, so this never reaches a real visitor even
   if the site is deployed. The guard below is a second belt.

   It shows one dismissible panel listing what changed in the current
   batch, and pins a NEW badge next to each change you can actually see.
   Dismissing it stores the batch id, so it never reappears for that
   batch. Bump BATCH when there is something new to show.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var host = location.hostname;
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") return;
  // lets the screenshot and audit tooling see the page without the overlay
  if (location.search.indexOf("rt-no-overlay") !== -1) return;

  var BATCH = "2026-09-09-b";
  var KEY = "rt-whatsnew-seen";
  var TITLE = "What changed";
  var DATE = "9 September 2026";

  /* page: which file this belongs to; sel: what to pin the badge to.
     A null sel means there is nothing to point at -- it still gets a line
     in the panel so nothing is invisible to you. */
  var ITEMS = [
    {
      page: "voip-phone.php",
      sel: ".rt-guestroom-banner",
      label: "New hero",
      text: "New guest-room photo at the top of this page, replacing the old hotel banner. The telephone is deliberately unbranded. On a phone the picture now shifts across to keep the telephone in shot -- a centred crop cut it out completely."
    }
  ];

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function seen() {
    try { return window.localStorage.getItem(KEY) === BATCH; } catch (e) { return false; }
  }
  function markSeen() {
    try { window.localStorage.setItem(KEY, BATCH); } catch (e) { /* private mode */ }
  }

  function styles() {
    var css = [
      ".rt-wn-badge{position:absolute;z-index:99998;background:#ff5e03;color:#fff;",
      "font:700 10px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;",
      "padding:5px 8px;border-radius:4px;box-shadow:0 2px 10px rgba(0,0,0,.35);pointer-events:none;",
      "white-space:nowrap;animation:rt-wn-pulse 2s ease-in-out 3}",
      "@keyframes rt-wn-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}",
      "@media (prefers-reduced-motion:reduce){.rt-wn-badge{animation:none}}",
      ".rt-wn-panel{position:fixed;right:18px;bottom:18px;z-index:99999;width:min(360px,calc(100vw - 36px));",
      "background:#11161d;color:#e8ecf1;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.45);",
      "font:14px/1.5 system-ui,sans-serif;overflow:hidden}",
      ".rt-wn-head{display:flex;align-items:baseline;gap:8px;padding:14px 16px 8px}",
      ".rt-wn-head b{font-size:15px}",
      ".rt-wn-head span{font-size:11px;opacity:.6;margin-left:auto}",
      ".rt-wn-list{margin:0;padding:0 16px 4px;list-style:none;max-height:46vh;overflow:auto}",
      ".rt-wn-list li{padding:9px 0;border-top:1px solid rgba(255,255,255,.09);font-size:13px}",
      ".rt-wn-list li:first-child{border-top:0}",
      // on a phone the panel would otherwise cover most of the page
      "@media (max-width:575px),(max-height:700px){.rt-wn-list{max-height:32vh}}",
      ".rt-wn-list em{display:block;font-style:normal;font-size:11px;opacity:.55;margin-top:3px}",
      ".rt-wn-here{color:#ff8a3d;font-weight:700}",
      ".rt-wn-foot{display:flex;gap:8px;padding:10px 16px 14px}",
      ".rt-wn-foot button{flex:1;font:600 13px system-ui,sans-serif;padding:9px 10px;border-radius:6px;cursor:pointer;border:0}",
      ".rt-wn-ok{background:#ff5e03;color:#fff}",
      ".rt-wn-later{background:transparent;color:#aab3bf;border:1px solid rgba(255,255,255,.18)!important}"
    ].join("");
    var el = document.createElement("style");
    el.textContent = css;
    document.head.appendChild(el);
  }

  function pageName() {
    var p = location.pathname.split("/").pop();
    return p === "" ? "index.php" : p;
  }

  function badge(item) {
    var target;
    try { target = document.querySelector(item.sel); } catch (e) { return false; }
    if (!target) return false;
    var r = target.getBoundingClientRect();
    if (!r.width && !r.height) return false;
    var b = document.createElement("div");
    b.className = "rt-wn-badge";
    b.textContent = item.label || "New";
    document.body.appendChild(b);
    // place it just above the element, kept inside the viewport width
    var top = r.top + window.pageYOffset - 26;
    var left = r.left + window.pageXOffset;
    if (top < window.pageYOffset + 4) top = r.bottom + window.pageYOffset + 6;
    b.style.top = Math.round(top) + "px";
    b.style.left = Math.round(Math.max(6, Math.min(left, document.documentElement.clientWidth - b.offsetWidth - 6))) + "px";
    return true;
  }

  function panel(here, elsewhere) {
    var wrap = document.createElement("div");
    wrap.className = "rt-wn-panel";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-label", TITLE);

    var html = '<div class="rt-wn-head"><b>' + TITLE + "</b><span>" + DATE + "</span></div><ul class='rt-wn-list'>";
    here.forEach(function (i) {
      html += "<li><span class='rt-wn-here'>On this page</span> &mdash; " + i.text + "</li>";
    });
    elsewhere.forEach(function (i) {
      html += "<li>" + i.text + " <em>" + i.page + "</em></li>";
    });
    html += "</ul><div class='rt-wn-foot'>";
    html += "<button class='rt-wn-ok' type='button'>Got it &mdash; don't show again</button>";
    html += "<button class='rt-wn-later' type='button'>Later</button></div>";
    wrap.innerHTML = html;
    document.body.appendChild(wrap);

    wrap.querySelector(".rt-wn-ok").addEventListener("click", function () {
      markSeen();
      wrap.remove();
      Array.prototype.forEach.call(document.querySelectorAll(".rt-wn-badge"), function (b) { b.remove(); });
    });
    wrap.querySelector(".rt-wn-later").addEventListener("click", function () {
      wrap.remove();
    });
  }

  ready(function () {
    try {
      if (seen()) return;
      var page = pageName();
      var here = ITEMS.filter(function (i) { return i.page === page; });
      var elsewhere = ITEMS.filter(function (i) { return i.page !== page; });
      if (!here.length && !elsewhere.length) return;
      styles();
      // the theme re-lays things out after load, so badge once it has settled
      window.setTimeout(function () {
        here.forEach(function (i) { if (i.sel) badge(i); });
      }, 1200);
      panel(here, elsewhere);
    } catch (e) {
      if (window.console && console.warn) console.warn("what's-new overlay skipped:", e);
    }
  });
})();
