/* =========================================================================
   MODE Lab — site behaviour
   Shared chrome injection · scroll reveal · nav · counters
   ========================================================================= */
(function () {
  "use strict";

  /* ---- Brand assets (inline so they tint with currentColor where needed) */
  var FLASK = '<svg class="flask" viewBox="-4 -4 99 129.33" aria-hidden="true" fill="currentColor"><path d="m36.71 150.24c-.55 1.19-1.1 2.39-1.66 3.58.06.67.6.91 1.17 1.1 8 3.19 16.7 4.48 25.28 4.19 5.03-.17 10.02-1.14 15.02-1.55 8.77-.85 17.59-1.27 26.4-.77 2.67.18 5.52.41 8.12.9.54-.48.65-.99.16-1.56-.65-1.2-1.19-2.49-1.9-3.63-.66-.48-1.57-.23-2.34-.39-6.95-.57-13.94-.69-20.88.02-7.71.72-15.38 1.73-23.11 2.24-3.89.19-7.86.15-11.75-.3-4.16-.49-8.41-1.37-12.26-3.22-.55-.21-1.06-.67-1.59-.82-.22.06-.45.13-.67.19z"/><path d="m96.85 65.47c-11.14.05-22.29.01-33.44.02-5.65.02-11.31-.04-16.96.03-2.13.28-3.29 2.48-3.65 4.4-.36 2.13-.19 4.31-.15 6.46.19 2.09 1.09 4.5 3.22 5.27.95.26 1.95.14 2.92.14 0 11.97 0 23.94 0 35.91-6.99 14.21-14.02 28.4-20.96 42.64-2.79 6.74-1.35 15.01 3.62 20.36 3.87 4.31 9.73 6.65 15.49 6.35 17.48-.01 34.96.03 52.45-.03 7.13-.33 13.85-4.99 16.65-11.56 2.4-5.43 2.15-11.98-.81-17.15-6.65-13.53-13.29-27.07-19.94-40.6.01-11.97-.02-23.98.01-35.92 1.5.07 3.3.22 4.37-1.07 1.76-1.84 1.89-4.55 1.82-6.96.06-2.51-.03-5.34-1.87-7.26-.73-.72-1.77-1.07-2.78-1.03zm-2.27 7.02c0 .77.14 1.65.01 2.36-2.77.2-5.62 2.14-6.06 5.02-.21 12.17-.09 24.34-.1 36.51.03 1.83.25 3.72 1.24 5.31 6.31 13.03 12.67 26.02 19.12 38.98 1.95 3.39 2.74 7.87 1.13 11.62-1.73 4.22-5.88 7.55-10.51 7.76-17.8.21-35.59.05-53.39.16-3.17-.1-6.69-1.25-9.02-3.66-3.32-3.33-4.68-8.67-2.92-13.08 6.53-13.86 13.5-27.52 20.16-41.33.7-1.48 1.44-3.02 1.35-4.7.14-11.97.08-23.95.1-35.92-.04-2.07-.78-4.29-2.59-5.47-1.04-.73-2.32-1.1-3.58-1.13-.02-.84-.04-1.69 0-2.53 15.02-.01 30.04-.02 45.06-.04z"/></svg>';

  var YEAR = new Date().getFullYear();

  /* ---- Navigation model ------------------------------------------------ */
  var NAV = [
    { href: "index.html",    label: "Home" },
    { href: "about.html",    label: "The Lab" },
    { href: "services.html", label: "Services" },
    { href: "packages.html", label: "Packages" },
    { href: "locations.html", label: "Locations" },
    { href: "policies.html", label: "Policies" },
    { href: "contact.html",  label: "Contact" }
  ];

  /* normalise a path/href to a comparable key, tolerant of clean URLs
     (e.g. "/locations", "locations.html" and "" all resolve correctly) */
  function navKey(p) {
    p = (p || "").toLowerCase().replace(/\.html$/, "");
    return (p === "" || p === "index") ? "home" : p;
  }
  var current = navKey(location.pathname.split("/").pop());

  /* ---- Header ----------------------------------------------------------- */
  function buildHeader() {
    var links = NAV.map(function (n) {
      var active = navKey(n.href) === current ? ' aria-current="page"' : "";
      return '<a href="' + n.href + '"' + active + ">" + n.label + "</a>";
    }).join("");

    return (
      '<header class="site-header" id="siteHeader">' +
        '<div class="container header-inner">' +
          '<a class="brand" href="index.html" aria-label="MODE Lab home">' +
            FLASK +
            '<span class="mono" style="font-size:0.82rem;letter-spacing:0.22em;color:var(--engineered-black)">MODE&nbsp;LAB</span>' +
          "</a>" +
          '<nav class="nav" id="primaryNav" aria-label="Primary">' + links + "</nav>" +
          '<div class="header-cta">' +
            '<a class="header-login" href="/login">Log in</a>' +
            '<a class="btn btn--ghost" href="contact.html">Book a session <span class="arrow">&rarr;</span></a>' +
            '<button class="nav-toggle" id="navToggle" aria-label="Menu" aria-expanded="false" aria-controls="primaryNav"><span></span><span></span><span></span></button>' +
          "</div>" +
        "</div>" +
      "</header>"
    );
  }

  /* ---- Footer ----------------------------------------------------------- */
  function buildFooter() {
    return (
      '<footer class="site-footer">' +
        '<div class="grid-bg"></div>' +
        '<div class="container">' +
          '<div class="footer-top">' +
            '<div class="footer-brandcol">' +
              '<a class="brand" href="index.html" style="color:var(--on-black)" aria-label="MODE Lab home">' + FLASK + "</a>" +
              "<p>Medical-grade fitness. We apply the rigour of exercise science and engineering principles to human health &mdash; measured, managed, and built to last.</p>" +
              '<div class="footer-tag">Metabolic &middot; Optimisation &middot; Design Engineering</div>' +
            "</div>" +
            '<div class="footer-col">' +
              "<h4>Explore</h4>" +
              "<ul>" +
                '<li><a href="about.html">The Lab</a></li>' +
                '<li><a href="services.html">Services</a></li>' +
                '<li><a href="packages.html">Packages</a></li>' +
                '<li><a href="locations.html">Locations</a></li>' +
                '<li><a href="policies.html">Policies</a></li>' +
              "</ul>" +
            "</div>" +
            '<div class="footer-col">' +
              "<h4>Members</h4>" +
              "<ul>" +
                '<li><a href="contact.html">Book a session</a></li>' +
                '<li><a href="packages.html#kickstart">Kickstart &mdash; $99</a></li>' +
                '<li><a href="/login">Member login</a></li>' +
                '<li><a href="/signup">Create account</a></li>' +
              "</ul>" +
            "</div>" +
            '<div class="footer-col">' +
              "<h4>Contact</h4>" +
              "<ul>" +
                '<li><a href="tel:+61407921137">0407 921 137</a></li>' +
                '<li><a href="mailto:jack@modelab.com.au">jack@modelab.com.au</a></li>' +
                '<li><a href="contact.html">Enquire</a></li>' +
              "</ul>" +
            "</div>" +
          "</div>" +
          '<div class="footer-bottom">' +
            "<p>&copy; " + YEAR + " MODE Lab. All rights reserved.</p>" +
            "<span>Medical Grade Fitness</span>" +
          "</div>" +
        "</div>" +
      "</footer>"
    );
  }

  /* ---- Inject chrome ---------------------------------------------------- */
  var headerMount = document.getElementById("header-mount");
  var footerMount = document.getElementById("footer-mount");
  if (headerMount) headerMount.outerHTML = buildHeader();
  if (footerMount) footerMount.outerHTML = buildFooter();

  /* fill any flask placeholders left in page markup */
  Array.prototype.forEach.call(document.querySelectorAll("[data-flask]"), function (el) {
    el.innerHTML = FLASK;
  });

  /* ---- Mobile nav toggle ------------------------------------------------ */
  var toggle = document.getElementById("navToggle");
  var nav = document.getElementById("primaryNav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  /* ---- Sticky header shadow on scroll ----------------------------------- */
  var header = document.getElementById("siteHeader");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---- Scroll reveal ---------------------------------------------------- */
  var revealEls = document.querySelectorAll("[data-reveal]");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduce || !("IntersectionObserver" in window)) {
    Array.prototype.forEach.call(revealEls, function (el) { el.classList.add("is-visible"); });
  } else {
    /* stagger children that share a [data-reveal-group] parent */
    Array.prototype.forEach.call(document.querySelectorAll("[data-reveal-group]"), function (group) {
      Array.prototype.forEach.call(group.querySelectorAll("[data-reveal]"), function (el, i) {
        el.style.setProperty("--reveal-delay", (i * 0.08) + "s");
      });
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

    Array.prototype.forEach.call(revealEls, function (el) { io.observe(el); });
  }

  /* ---- Count-up readouts ------------------------------------------------ */
  var counters = document.querySelectorAll("[data-count]");
  if (counters.length && "IntersectionObserver" in window && !reduce) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var target = parseFloat(el.getAttribute("data-count"));
        var prefix = el.getAttribute("data-prefix") || "";
        var suffix = el.getAttribute("data-suffix") || "";
        var decimals = (String(target).split(".")[1] || "").length;
        var start = null, dur = 1400;
        function tick(ts) {
          if (start === null) start = ts;
          var p = Math.min((ts - start) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          var val = (target * eased).toFixed(decimals);
          el.textContent = prefix + val + suffix;
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        cio.unobserve(el);
      });
    }, { threshold: 0.6 });
    Array.prototype.forEach.call(counters, function (el) { cio.observe(el); });
  }

  /* ---- Contact form (front-end only for now) ---------------------------- */
  var form = document.getElementById("enquiryForm");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = form.querySelector("button[type=submit]");
      var status = document.getElementById("formStatus");
      if (btn) { btn.disabled = true; btn.style.opacity = "0.6"; }
      if (status) {
        status.hidden = false;
        status.textContent = "Logged locally. Wiring this to Supabase + email is the next build step.";
      }
      form.reset();
      setTimeout(function () { if (btn) { btn.disabled = false; btn.style.opacity = "1"; } }, 600);
    });
  }
})();
