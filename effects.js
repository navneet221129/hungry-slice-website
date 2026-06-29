/* FHOOD-style effects: scroll-reveal, 3D card tilt, curved wave divider. Defensive + reduced-motion aware. */
(function () {
  if (window.__fxInit) return; window.__fxInit = true;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches;

  // ---- 1. Scroll reveal (IntersectionObserver + MutationObserver for async cards) ----
  var REVEAL_SEL = 'section, .plc, .reco-card, .offer-card, .testimonial-card, .review-card, .stat';
  var io = null;
  if (!reduce && 'IntersectionObserver' in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('fx-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  }
  function tagAndObserve(root) {
    var els = (root || document).querySelectorAll(REVEAL_SEL);
    els.forEach(function (el) {
      if (el.classList.contains('fx-reveal')) return;
      el.classList.add('fx-reveal');
      if (io) io.observe(el); else el.classList.add('fx-in');
    });
  }

  // ---- 2. 3D tilt on menu cards (desktop pointer only) ----
  function initTilt() {
    if (reduce || !finePointer) return;
    document.addEventListener('pointermove', function (e) {
      var card = e.target.closest && e.target.closest('.plc');
      if (!card) return;
      card.classList.add('fx-tilting');
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = 'perspective(820px) rotateX(' + (-py * 7).toFixed(2) + 'deg) rotateY(' + (px * 9).toFixed(2) + 'deg) translateY(-6px)';
    }, { passive: true });
    document.addEventListener('pointerout', function (e) {
      var card = e.target.closest && e.target.closest('.plc');
      if (card) { card.style.transform = ''; card.classList.remove('fx-tilting'); }
    }, { passive: true });
  }

  // ---- 3. Curved wave divider above the footer ----
  function initWave() {
    var footer = document.querySelector('footer.app-footer, .app-footer');
    if (!footer || document.querySelector('.fx-wave')) return;
    var wrap = document.createElement('div');
    wrap.className = 'fx-wave';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = '<svg viewBox="0 0 1440 56" preserveAspectRatio="none"><path d="M0,28 C240,56 480,4 720,22 C960,40 1200,56 1440,24 L1440,56 L0,56 Z" fill="currentColor"></path></svg>';
    footer.parentNode.insertBefore(wrap, footer);
  }

  function init() {
    tagAndObserve(document);
    initTilt();
    initWave();
    // catch async-rendered product cards
    if (!reduce && 'MutationObserver' in window) {
      var grid = document.getElementById('featured') || document.body;
      new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          m.addedNodes && m.addedNodes.forEach(function (n) {
            if (n.nodeType === 1) tagAndObserve(n.parentNode || n);
          });
        });
      }).observe(grid, { childList: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
