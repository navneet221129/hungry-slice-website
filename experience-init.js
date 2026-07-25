/* The Hungry Slice — scroll-world mount.
   Architecture A (continuous forward take): the legs ARE the journey, so
   `connectors` is empty and each seam is a frame handoff, not a clip. */
(function () {
  var el = document.getElementById('sw-world');
  if (!el || typeof mountScrollWorld !== 'function') return;

  mountScrollWorld(el, {
    // no `brand`: the site's own .main-header already carries the logo.
    hint: 'scroll to step inside',
    nav: true,
    atmosphere: true,
    diveScroll: 1.4,
    crossfade: 0.08,
    sections: [
      {
        id: 'dough', label: 'The Dough',
        still: 'assets/sw-dough.webp',
        clip: 'assets/vid/dough.mp4',
        clipMobile: 'assets/vid/dough-m.mp4',
        accent: '#D85326',
        eyebrow: 'Where it starts',
        title: 'It starts with fresh dough.',
        body: 'Every base is prepped in our Hamilton kitchen and topped the moment your order lands.',
        tags: ['Fresh dough', 'Hamilton kitchen']
      },
      {
        id: 'fire', label: 'The Bake',
        still: 'assets/sw-fire.webp',
        clip: 'assets/vid/fire.mp4',
        clipMobile: 'assets/vid/fire-m.mp4',
        accent: '#D85326',
        eyebrow: 'The part you can taste',
        title: 'Straight into the oven.',
        body: 'Baked to order until the cheese is bubbling and the base is crisp — never sitting under a heat lamp.',
        tags: ['Baked to order', 'Crisp base'],
        scroll: 1.6, linger: 0.35
      },
      {
        id: 'table', label: 'The Slice',
        still: 'assets/sw-table.webp',
        clip: 'assets/vid/table.mp4',
        clipMobile: 'assets/vid/table-m.mp4',
        accent: '#D85326',
        eyebrow: 'At your door',
        title: 'Hot, in thirty.',
        body: 'Straight off the deck, into an insulated box, onto a rider. Hamilton-wide.',
        tags: ['30-min delivery', 'Hamilton-wide'],
        scroll: 1.8, linger: 0.45,
        cta: {
          primary:   { label: 'Order Now',        href: 'menu.html' },
          secondary: { label: 'Build Your Pizza', href: 'build.html' }
        }
      }
    ],
    connectors: []
  });
})();

/* The engine's layers are all position:fixed and it never unmounts them, so
   after .sw-track scrolls past they keep painting over the rest of the page.
   Flag the root once the track is out of view; experience.css hides them. */
(function () {
  function arm() {
    var root = document.querySelector('.sw-root');
    var track = root && root.querySelector('.sw-track');
    if (!track) { return setTimeout(arm, 200); }
    new IntersectionObserver(function (entries) {
      root.classList.toggle('sw-done', !entries[0].isIntersecting);
    }, { threshold: 0 }).observe(track);
  }
  arm();
})();
