/* Motion (motion.dev) powered scroll effects: progress bar + a subtle settle animation
   on the bento grid and step cards. Loaded as a module; any failure here is a silent
   no-op. Free, MIT-licensed core library via CDN, no account needed.

   Deliberately never hides content to reveal it later -- tiles/cards keep their normal
   default appearance the whole time. If the animation fires, it's a nice bonus polish
   (subtle scale + lift settle). If it never fires (slow network, blocked CDN, browser
   quirk), the page looks exactly like it did before this file existed. No dependency
   between "content is visible" and "JS ran". */
(async function () {
  try {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var mod = await import('https://cdn.jsdelivr.net/npm/motion@latest/+esm');
    var animate = mod.animate, scroll = mod.scroll, inView = mod.inView;
    if (!animate || !scroll || !inView) return;

    // ---- 1. Scroll progress bar ----
    var bar = document.createElement('div');
    bar.className = 'motion-progress-bar';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    scroll(function (progress) { bar.style.transform = 'scaleX(' + progress + ')'; });

    // ---- 2. Subtle settle animation on bento tiles + step cards (never hides content) ----
    function settleIn(selector, delayStep) {
      var seen = 0;
      inView(selector, function (el) {
        var d = Math.min(seen++, 6) * (delayStep || 0.06);
        animate(el, { transform: ['translateY(16px) scale(.98)', 'translateY(0) scale(1)'] },
          { duration: 0.5, delay: d, easing: [0.22, 1, 0.36, 1] });
      }, { amount: 0.2 });
    }
    function armWhenPresent(selector, delayStep, tries) {
      if (document.querySelectorAll(selector).length) { settleIn(selector, delayStep); return; }
      if ((tries || 0) < 30) setTimeout(function () { armWhenPresent(selector, delayStep, (tries || 0) + 1); }, 200);
    }
    armWhenPresent('.bento-tile', 0.06);
    armWhenPresent('.step-card', 0.08);
  } catch (e) {
    // progressive enhancement only -- silently no-op on any failure
  }
})();
