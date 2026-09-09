/* ============================================================
   renuteck.js — small accessibility/behaviour layer
   Kept separate from the vendor theme so it survives theme updates.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Client Login disclosure ----------
     Real disclosure semantics: aria-expanded tracks visibility,
     Escape closes and returns focus, outside click closes,
     and it works by keyboard as well as pointer. */
  function initLoginDisclosure() {
    var wrappers = document.querySelectorAll(".rt-login-dropdown");

    Array.prototype.forEach.call(wrappers, function (wrap) {
      var btn = wrap.querySelector("button");
      var menu = wrap.querySelector(".rt-login-menu");
      if (!btn || !menu) return;

      if (!menu.id) {
        menu.id = "rt-login-menu-" + Math.random().toString(36).slice(2, 8);
      }
      btn.setAttribute("aria-controls", menu.id);
      btn.setAttribute("aria-expanded", "false");

      function open() {
        wrap.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
      }
      function close(returnFocus) {
        wrap.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
        if (returnFocus) btn.focus();
      }
      function isOpen() {
        return wrap.classList.contains("is-open");
      }

      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        isOpen() ? close(false) : open();
      });

      // Escape closes and returns focus to the trigger
      wrap.addEventListener("keydown", function (e) {
        if (e.key === "Escape" || e.key === "Esc") {
          if (isOpen()) {
            e.stopPropagation();
            close(true);
          }
        }
      });

      // Click outside closes
      document.addEventListener("click", function (e) {
        if (isOpen() && !wrap.contains(e.target)) close(false);
      });

      // Moving focus out of the group closes it
      wrap.addEventListener("focusout", function () {
        window.setTimeout(function () {
          if (isOpen() && !wrap.contains(document.activeElement)) close(false);
        }, 0);
      });

      // Pointer users still get hover convenience, with state kept in sync
      wrap.addEventListener("mouseenter", function () {
        if (window.matchMedia("(hover: hover)").matches) open();
      });
      wrap.addEventListener("mouseleave", function () {
        if (
          window.matchMedia("(hover: hover)").matches &&
          !wrap.contains(document.activeElement)
        ) {
          close(false);
        }
      });
    });
  }

  /* ---------- Pause hero / testimonial autoplay on hover & focus ----------
     Long quotes advancing every few seconds are hard to read. Also honour
     the user's reduced-motion preference. */
  function initAutoplayControls() {
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var sliders = document.querySelectorAll(".swiper");

    Array.prototype.forEach.call(sliders, function (el) {
      function stop() {
        if (el.swiper && el.swiper.autoplay && el.swiper.autoplay.stop) {
          el.swiper.autoplay.stop();
        }
      }
      function start() {
        if (
          !reduce &&
          el.swiper &&
          el.swiper.autoplay &&
          el.swiper.autoplay.start
        ) {
          el.swiper.autoplay.start();
        }
      }
      if (reduce) {
        // Stop once the theme has initialised the slider
        window.setTimeout(stop, 600);
      }
      el.addEventListener("mouseenter", stop);
      el.addEventListener("mouseleave", start);
      el.addEventListener("focusin", stop);
      el.addEventListener("focusout", start);
    });
  }

  /* ---------- Contact forms ----------
     The vendor theme binds to clicks on `.submit` (so Enter-to-submit is
     missed), validates email with a regex that caps the final domain at
     four characters (rejecting .hotels/.travel/.online), clears the form
     on any HTTP 200 even when the application reports failure, and hides
     the result after a few seconds. We take these forms over instead. */
  function initContactForms() {
    var forms = document.querySelectorAll('form[action*="contact-form.php"]');

    Array.prototype.forEach.call(forms, function (form) {
      // Stop the theme's document-level ".submit" click handler from
      // also firing on this form (which would double-send).
      var themeBtn = form.querySelector(".submit");
      if (themeBtn) themeBtn.classList.remove("submit");

      var button = form.querySelector('[type="submit"], button');
      var results = form.querySelector(".form-results");

      if (!results) {
        results = document.createElement("div");
        results.className = "form-results mt-20px";
        form.appendChild(results);
      }
      // Announce results to assistive technology.
      results.setAttribute("role", "status");
      results.setAttribute("aria-live", "polite");

      var sending = false;

      function showResult(ok, text) {
        results.classList.remove("d-none", "alert-success", "alert-danger");
        results.classList.add("alert", ok ? "alert-success" : "alert-danger");
        results.textContent = text;
      }

      function markInvalid(field, invalid) {
        if (!field) return;
        if (invalid) field.setAttribute("aria-invalid", "true");
        else field.removeAttribute("aria-invalid");
      }

      // Practical email check: something@something.tld, no length cap on TLD.
      function emailLooksValid(value) {
        return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value.trim());
      }

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (sending) return; // duplicate-send guard

        var nameField = form.querySelector('[name="name"]');
        var emailField = form.querySelector('[name="email"]');
        var firstBad = null;

        markInvalid(nameField, false);
        markInvalid(emailField, false);

        if (nameField && nameField.value.trim() === "") {
          markInvalid(nameField, true);
          firstBad = firstBad || nameField;
        }
        if (emailField && !emailLooksValid(emailField.value)) {
          markInvalid(emailField, true);
          firstBad = firstBad || emailField;
        }
        if (firstBad) {
          showResult(false, "Please check the highlighted fields and try again.");
          firstBad.focus();
          return;
        }

        sending = true;
        if (button) {
          button.disabled = true;
          button.dataset.rtLabel = button.textContent;
          button.textContent = "Sending…";
        }
        showResult(true, "Sending your message…");

        fetch(form.getAttribute("action"), {
          method: "POST",
          body: new FormData(form),
          headers: { "X-Requested-With": "XMLHttpRequest" },
        })
          .then(function (res) {
            return res.text().then(function (text) {
              var data = null;
              try {
                data = JSON.parse(text);
              } catch (err) {
                /* non-JSON response */
              }
              return { ok: res.ok, status: res.status, data: data };
            });
          })
          .then(function (r) {
            var succeeded =
              r.data &&
              (r.data.success === true ||
                (typeof r.data.alert === "string" &&
                  r.data.alert.indexOf("success") !== -1));

            if (succeeded) {
              showResult(true, r.data.message || "Your message has been sent.");
              form.reset(); // only clear after confirmed success
            } else if (r.data && r.data.message) {
              // Application-level failure: keep what the visitor typed.
              showResult(false, r.data.message);
            } else {
              showResult(
                false,
                "Sorry, something went wrong (error " +
                  r.status +
                  "). Please call 972-999-4393."
              );
            }
          })
          .catch(function () {
            showResult(
              false,
              "We could not reach the server. Please check your connection, or call 972-999-4393."
            );
          })
          .then(function () {
            sending = false;
            if (button) {
              button.disabled = false;
              if (button.dataset.rtLabel) button.textContent = button.dataset.rtLabel;
            }
          });
      });
    });
  }



  /* ---------- Primary nav dropdowns: keyboard ----------
     Two theme behaviours make this awkward. On desktop the chevron toggle is
     display:none and the menus open on hover, so a keyboard user could not
     reach a submenu at all. And the theme re-creates nav nodes after load, so
     listeners bound to the menu or its items are silently discarded. Hence a
     single delegated listener on document, in the capture phase, which also
     beats the bundled Bootstrap to ArrowUp/ArrowDown/Escape. */
  function initNavDropdownKeys() {
    var NAV = "header .navbar-nav";

    function partsFor(el) {
      var item = el.closest(NAV + " .nav-item.dropdown");
      if (!item) return null;
      var link = item.querySelector(":scope > .nav-link");
      var menu = item.querySelector(".dropdown-menu");
      var button = item.querySelector(".rt-nav-toggle");
      if (!link || !menu) return null;
      return { item: item, link: link, menu: menu, button: button };
    }

    function itemsOf(p) {
      return Array.prototype.slice.call(p.menu.querySelectorAll("a"));
    }
    function isOpen(p) {
      return p.menu.classList.contains("show");
    }
    function open(p, focusFirst) {
      p.menu.classList.add("show");
      if (p.button) p.button.setAttribute("aria-expanded", "true");
      if (focusFirst) {
        var l = itemsOf(p);
        if (l.length) l[0].focus();
      }
    }
    function close(p, returnFocus) {
      p.menu.classList.remove("show");
      if (p.button) p.button.setAttribute("aria-expanded", "false");
      // Focus goes back to the control that opened the menu — the button —
      // not the link beside it, which only navigates to the hub page.
      if (returnFocus) (p.button || p.link).focus();
    }
    function move(p, from, step) {
      var l = itemsOf(p);
      if (!l.length) return;
      var i = l.indexOf(from);
      var next = i === -1 ? 0 : (i + step + l.length) % l.length;
      l[next].focus();
    }

    // Describe the relationship for assistive tech, and keep it current even
    // if the theme swaps nodes underneath us.
    function label() {
      var items = document.querySelectorAll(NAV + " .nav-item.dropdown");
      Array.prototype.forEach.call(items, function (item) {
        var link = item.querySelector(":scope > .nav-link");
        var menu = item.querySelector(".dropdown-menu");
        if (!link || !menu) return;
        if (!menu.id) menu.id = "rt-nav-menu-" + Math.random().toString(36).slice(2, 8);
        var button = item.querySelector(".rt-nav-toggle");
        if (button) {
          button.setAttribute("aria-haspopup", "true");
          button.setAttribute("aria-controls", menu.id);
          if (!button.hasAttribute("aria-expanded")) {
            button.setAttribute("aria-expanded", menu.classList.contains("show") ? "true" : "false");
          }
        }
        // The link only navigates to the hub page. Having it also advertise a
        // popup gave screen readers two controls for one menu.
        link.removeAttribute("aria-haspopup");
        link.removeAttribute("aria-controls");
        link.removeAttribute("aria-expanded");
      });
    }
    label();
    window.setTimeout(label, 1200);

    document.addEventListener(
      "keydown",
      function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var p = partsFor(t);
        if (!p) return;

        var inMenu = !!t.closest(".dropdown-menu");
        var handled = true;

        if (!inMenu) {
          // Focus is on the top-level link. Enter still follows it.
          if (e.key === "ArrowDown") open(p, true);
          else if (e.key === "Escape" && isOpen(p)) close(p, false);
          else handled = false;
        } else {
          switch (e.key) {
            case "Escape": close(p, true); break;
            case "ArrowDown": move(p, t, 1); break;
            case "ArrowUp": move(p, t, -1); break;
            case "Home": move(p, null, 0); break;
            case "End":
              var l = itemsOf(p);
              if (l.length) l[l.length - 1].focus();
              break;
            default: handled = false;
          }
        }

        if (handled) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true
    );

    // Close when focus or the pointer leaves the group.
    document.addEventListener("focusout", function () {
      window.setTimeout(function () {
        var items = document.querySelectorAll(NAV + " .nav-item.dropdown");
        Array.prototype.forEach.call(items, function (item) {
          var menu = item.querySelector(".dropdown-menu");
          var button = item.querySelector(".rt-nav-toggle");
          if (menu && menu.classList.contains("show") && !item.contains(document.activeElement)) {
            menu.classList.remove("show");
            if (button) button.setAttribute("aria-expanded", "false");
          }
        });
      }, 0);
    });
  }

  /* ---------- Deep links to a section ----------
     The theme's initScrollNavigate() passes a nav link's whole href to
     jQuery as a selector, so any "page.php#anchor" in the menu throws a
     syntax error on the page that owns the anchor. We use ?section=<id>
     in the nav instead and do the scrolling here. Without JS the visitor
     simply lands at the top of the right page. */
  function initNavHoverBridge() {
    var SEL = "header .navbar-nav .nav-item.dropdown";
    var TOL = 16;
    var DELAY = 300;
    var timer = null;
    var px = -1;
    var py = -1;

    function openItem() {
      var list = document.querySelectorAll(SEL + ".open");
      return list.length ? list[list.length - 1] : null;
    }

    // The <li> and its menu together, as one rectangle. The union covers the
    // corner that belongs to neither, which is where the pointer is caught.
    function zoneOf(li) {
      var a = li.getBoundingClientRect();
      var menu = li.querySelector(".dropdown-menu");
      if (!menu) return a;
      var b = menu.getBoundingClientRect();
      if (!b.width || !b.height) return a;
      return {
        left: Math.min(a.left, b.left),
        right: Math.max(a.right, b.right),
        top: Math.min(a.top, b.top),
        bottom: Math.max(a.bottom, b.bottom)
      };
    }

    function inside(z, x, y) {
      return (
        x >= z.left - TOL &&
        x <= z.right + TOL &&
        y >= z.top - TOL &&
        y <= z.bottom + TOL
      );
    }

    function shut(li) {
      li.classList.remove("open");
      li.classList.remove("menu-left");
      var menu = li.querySelector(".dropdown-menu");
      if (menu) menu.classList.remove("show");
      var btn = li.querySelector(".rt-nav-toggle");
      if (btn) btn.setAttribute("aria-expanded", "false");
    }

    // The theme closes the menu the instant the pointer leaves the <li>. The
    // menu is three times wider than the <li>, so a diagonal path towards an
    // item on its right passes through a corner belonging to neither box, and
    // the menu disappears mid-reach. Swallow that close and decide ourselves.
    // jQuery maps .on("mouseleave") onto a native mouseout listener, so both
    // event names have to be intercepted for the theme's handler to be denied.
    function swallow(e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (e.type === "mouseout" && !e.relatedTarget) return; // leaving the window
      var li = t.closest(SEL);
      if (!li || !li.classList.contains("open")) return;
      if (!inside(zoneOf(li), px, py)) return; // pointer is genuinely away
      e.stopPropagation();
    }
    document.addEventListener("mouseleave", swallow, true);
    document.addEventListener("mouseout", swallow, true);

    // The real cause of a menu vanishing mid-reach: the menu is wider than its
    // own <li> and renders underneath the next nav items, so a diagonal path
    // towards an item on its right crosses the sibling's link. The theme's
    // mouseenter then closes every sibling menu, including the one being
    // reached for. Deny that takeover until the pointer has actually settled
    // on the sibling, so travelling across it is free but aiming at it works.
    var DWELL = 180;
    var dwellTimer = null;
    var dwellFor = null;
    var passing = false;

    document.addEventListener(
      "mouseover",
      function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var open = openItem();
        if (!open) return;
        if (passing) return; // our own hand-off, let the theme have it
        var sib = t.closest(SEL);
        if (sib === open) return;
        if (!t.closest("header .navbar-nav")) return;
        if (!inside(zoneOf(open), px, py)) return;

        e.stopPropagation();

        if (dwellFor === t) return;
        dwellFor = t;
        window.clearTimeout(dwellTimer);
        dwellTimer = window.setTimeout(function () {
          // Still on the same element? Then it was aimed at, not crossed.
          var under = document.elementFromPoint(px, py);
          if (under !== t && !t.contains(under)) return;
          passing = true;
          t.dispatchEvent(
            new MouseEvent("mouseover", {
              bubbles: true,
              relatedTarget: document.body
            })
          );
          passing = false;
        }, DWELL);
      },
      true
    );

    document.addEventListener(
      "mousemove",
      function (e) {
        px = e.clientX;
        py = e.clientY;
        if (dwellFor && document.elementFromPoint(px, py) !== dwellFor) {
          dwellFor = null;
          window.clearTimeout(dwellTimer);
        }
        var li = openItem();
        window.clearTimeout(timer);
        if (!li || inside(zoneOf(li), px, py)) return;
        timer = window.setTimeout(function () {
          shut(li);
        }, DELAY);
      },
      true
    );

    // Pointer left the window altogether.
    document.addEventListener("mouseout", function (e) {
      if (e.relatedTarget) return;
      var li = openItem();
      if (!li) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        shut(li);
      }, DELAY);
    });
  }

  function initSectionDeepLink() {
    var id = new URLSearchParams(window.location.search).get("section");
    if (!id) return;
    // Only ever treat this as an element id, never as a selector.
    if (!/^[A-Za-z][\w-]*$/.test(id)) return;
    var el = document.getElementById(id);
    if (!el) return;

    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function target() {
      var header = document.querySelector("header nav.navbar");
      var offset = (header ? header.getBoundingClientRect().height : 0) + 16;
      return el.getBoundingClientRect().top + window.pageYOffset - offset;
    }

    function go(smooth) {
      window.scrollTo({ top: target(), behavior: smooth && !reduce ? "smooth" : "auto" });
    }

    // Jump immediately, then correct once late-loading images and fonts have
    // settled the layout — a single fixed timeout lands in the wrong place.
    go(false);
    window.addEventListener("load", function () {
      window.setTimeout(function () { go(false); }, 120);
    });

    el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  }

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    initLoginDisclosure();
    initAutoplayControls();
    initContactForms();
    initNavDropdownKeys();
    initNavHoverBridge();
    initSectionDeepLink();
  });
})();
