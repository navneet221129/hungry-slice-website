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
        title: 'It begins the night before.',
        body: 'Cold-fermented for 48 hours, then hand-stretched to order — never a pressed disc from a bag.',
        tags: ['48-hour ferment', 'Hand-stretched']
      },
      {
        id: 'fire', label: 'The Fire',
        still: 'assets/sw-fire.webp',
        clip: 'assets/vid/fire.mp4',
        clipMobile: 'assets/vid/fire-m.mp4',
        accent: '#D85326',
        eyebrow: 'The part you can taste',
        title: 'Ninety seconds in the fire.',
        body: 'A stone deck that hot blisters the crust and locks the char in before the cheese ever turns to rubber.',
        tags: ['Wood-fired', 'Stone deck'],
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
