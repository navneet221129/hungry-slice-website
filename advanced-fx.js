/* ============================================================
   ADVANCED FX PACK (2026-07-18)
   Pairs with advanced-fx.css. Progressive enhancement only —
   any failure here silently no-ops and never blocks the page.
   - Cursor spotlight glow + accent ring (desktop fine-pointer only)
   - Magnetic pull on primary CTA buttons
   - Cinematic film-grain overlay
   - Animated count-up for any [data-count-to] element on scroll-in
   ============================================================ */
(function () {
  try {
    if (window.__advFxInit) return; window.__advFxInit = true;

    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var finePointer = window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches;

    /* ---- Count-up on scroll-into-view (works on every device) ---- */
    function initCountUp() {
      var els = document.querySelectorAll('[data-count-to]');
      if (!els.length || !('IntersectionObserver' in window)) return;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          var el = entry.target;
          var target = parseFloat(el.getAttribute('data-count-to'));
          if (isNaN(target)) return;
          var suffix = el.getAttribute('data-count-suffix') || '';
          var prefix = el.getAttribute('data-count-prefix') || '';
          var decimals = parseInt(el.getAttribute('data-count-decimals') || '0', 10);
          var dur = reduce ? 0 : 1200;
          var start = performance.now();
          function tick(now) {
            var p = dur ? Math.min(1, (now - start) / dur) : 1;
            var eased = 1 - Math.pow(1 - p, 3);
            var val = target * eased;
            el.textContent = prefix + val.toFixed(decimals) + suffix;
            if (p < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
        });
      }, { threshold: 0.4 });
      els.forEach(function (el) { io.observe(el); });
    }

    /* ---- Desktop-only cinematic layer: grain + cursor glow/ring + magnetism ---- */
    function initDesktopFx() {
      if (reduce || !finePointer) return;

      var grain = document.createElement('div');
      grain.className = 'fx-grain';
      grain.setAttribute('aria-hidden', 'true');
      document.body.appendChild(grain);

      var glow = document.createElement('div');
      glow.className = 'fx-cursor-glow';
      glow.setAttribute('aria-hidden', 'true');
      document.body.appendChild(glow);

      var ring = document.createElement('div');
      ring.className = 'fx-cursor-ring';
      ring.setAttribute('aria-hidden', 'true');
      document.body.appendChild(ring);

      var mx = window.innerWidth / 2, my = window.innerHeight / 2;
      var gx = mx, gy = my;
      var hoverSel = 'a, button, .plc, .review-card, .offer-card, .bento-tile, .glass-card, input, select, textarea, [role="button"]';

      document.addEventListener('pointermove', function (e) {
        mx = e.clientX; my = e.clientY;
        document.body.classList.add('fx-pointer-active');
        ring.style.transform = 'translate(' + mx + 'px,' + my + 'px) translate(-50%,-50%)';
        var target = e.target && e.target.closest ? e.target.closest(hoverSel) : null;
        ring.classList.toggle('fx-cursor-hover', !!target);
      }, { passive: true });

      document.addEventListener('pointerleave', function () {
        document.body.classList.remove('fx-pointer-active');
      });

      (function raf() {
        gx += (mx - gx) * 0.09;
        gy += (my - gy) * 0.09;
        glow.style.transform = 'translate(' + gx + 'px,' + gy + 'px) translate(-50%,-50%)';
        requestAnimationFrame(raf);
      })();

      /* Magnetic pull on primary CTAs */
      var magnets = [];
      function collectMagnets() {
        magnets = Array.prototype.slice.call(
          document.querySelectorAll('.btn-primary, .order-now-btn, .review-cta-btn')
        );
      }
      collectMagnets();
      if ('MutationObserver' in window) {
        new MutationObserver(function () { collectMagnets(); }).observe(document.body, { childList: true, subtree: true });
      }

      document.addEventListener('pointermove', function (e) {
        for (var i = 0; i < magnets.length; i++) {
          var btn = magnets[i];
          var r = btn.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          var dx = e.clientX - cx, dy = e.clientY - cy;
          var dist = Math.hypot(dx, dy);
          var radius = Math.max(r.width, r.height) * 1.3;
          if (dist < radius) {
            var pull = (1 - dist / radius) * 0.3;
            btn.style.transform = 'translate(' + (dx * pull).toFixed(1) + 'px,' + (dy * pull).toFixed(1) + 'px)';
          } else if (btn.style.transform) {
            btn.style.transform = '';
          }
        }
      }, { passive: true });
    }

    /* ============================================================
       CINEMATIC COLOR GRADE + SCROLL EFFECTS (v2)
       Scroll-linked hue shift, gradient-ink titles, underline
       sweeps, clip reveals, velocity skew, layered parallax.
       Requires GSAP + ScrollTrigger (already on every page);
       dynamically loads them as a fallback.
       ============================================================ */
    function loadScript(src) {
      return new Promise(function (res, rej) {
        var s = document.createElement('script');
        s.src = src; s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }

    function ensureGsap() {
      if (window.gsap && window.ScrollTrigger) return Promise.resolve();
      var base = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/';
      var chain = window.gsap ? Promise.resolve() : loadScript(base + 'gsap.min.js');
      return chain.then(function () {
        return window.ScrollTrigger ? null : loadScript(base + 'ScrollTrigger.min.js');
      });
    }

    function initCineGrade() {
      document.body.classList.add('fx-cine');

      /* ambient color wash layer */
      var wash = document.createElement('div');
      wash.className = 'fx-color-wash';
      wash.setAttribute('aria-hidden', 'true');
      document.body.appendChild(wash);

      if (reduce) {
        /* static polish only: open all underlines + reveals, skip motion */
        document.documentElement.style.setProperty('--fx-glow', '0.45');
        document.querySelectorAll('.section-title').forEach(function (el) {
          el.style.setProperty('--fx-under', '1');
          el.style.setProperty('--fx-ink', '55%');
        });
        return;
      }

      ensureGsap().then(function () {
        var gsap = window.gsap;
        if (!gsap || !window.ScrollTrigger) return;
        gsap.registerPlugin(window.ScrollTrigger);
        var ST = window.ScrollTrigger;

        /* ---- 1. Whole-page color grade scrub: hue drifts warm -> rose-gold ---- */
        var hueState = { h: -8, glow: 0.55 };
        function applyWash() {
          document.documentElement.style.setProperty('--fx-hue', hueState.h.toFixed(1) + 'deg');
          document.documentElement.style.setProperty('--fx-glow', hueState.glow.toFixed(3));
        }
        applyWash();
        gsap.to(hueState, {
          h: 26, glow: 0.75, ease: 'none', onUpdate: applyWash,
          scrollTrigger: { trigger: document.body, start: 'top top', end: 'max', scrub: 1.2 }
        });

        /* ---- 2. Section titles: ink flow + underline sweep + clip reveal ---- */
        document.querySelectorAll('.section-title').forEach(function (title) {
          title.classList.add('fx-clip');
          ST.create({
            trigger: title, start: 'top 88%', once: true,
            onEnter: function () { title.classList.add('fx-clip-in'); }
          });
          var ink = { p: 96, u: 0 };
          gsap.to(ink, {
            p: 30, u: 1, ease: 'none',
            onUpdate: function () {
              title.style.setProperty('--fx-ink', ink.p.toFixed(1) + '%');
              title.style.setProperty('--fx-under', ink.u.toFixed(2));
            },
            scrollTrigger: { trigger: title, start: 'top 92%', end: 'top 40%', scrub: 0.6 }
          });
        });

        /* ---- 3. Velocity skew: card tracks lean with scroll speed ---- */
        var skewTargets = document.querySelectorAll(
          '.testimonials-track, .bento-grid, .offers-grid, .numbers-grid, .product-list-grid, .plc-grid, .timeline-stack'
        );
        if (skewTargets.length) {
          skewTargets.forEach(function (el) { el.classList.add('fx-skew'); });
          var skewSetters = Array.prototype.map.call(skewTargets, function (el) {
            return gsap.quickTo(el, '--fx-skew', { duration: 0.4, ease: 'power3.out', unit: 'deg' });
          });
          ST.create({
            start: 0, end: 'max',
            onUpdate: function (self) {
              var v = gsap.utils.clamp(-1.6, 1.6, self.getVelocity() / -420);
              skewSetters.forEach(function (setter) { setter(v); });
            }
          });
        }

        /* ---- 4. Layered drift parallax on cards (alternating depth) ---- */
        document.querySelectorAll('.review-card, .bento-tile, .offer-card, .step-card').forEach(function (card, i) {
          gsap.fromTo(card,
            { y: (i % 3 === 0 ? 34 : i % 3 === 1 ? 14 : 24) },
            {
              y: (i % 3 === 0 ? -22 : i % 3 === 1 ? -8 : -16), ease: 'none',
              scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: 0.8 }
            });
        });

        /* ---- 5. Hero cinematic grade: video warms & deepens as you scroll away ---- */
        var heroVideo = document.querySelector('.hero-video');
        if (heroVideo) {
          gsap.fromTo(heroVideo,
            { filter: 'saturate(1.05) contrast(1.02) brightness(1)' },
            {
              filter: 'saturate(1.35) contrast(1.12) brightness(0.82) hue-rotate(-6deg)', ease: 'none',
              scrollTrigger: { trigger: '.hero-section', start: 'top top', end: 'bottom top', scrub: 0.5 }
            });
        }

        /* ---- 6. Footer approach: wash cools into deep ember night ---- */
        var footer = document.querySelector('.app-footer');
        if (footer) {
          gsap.to(hueState, {
            h: -30, ease: 'none', onUpdate: applyWash,
            scrollTrigger: { trigger: footer, start: 'top bottom', end: 'top 55%', scrub: 0.8 }
          });
        }
      }).catch(function () { /* no-op */ });
    }

    function init() {
      initCountUp();
      initDesktopFx();
      initCineGrade();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  } catch (e) {
    /* progressive enhancement only -- silently no-op on any failure */
  }
})();
