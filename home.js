/* Homepage rich content: ad slider + category rail + dishes carousel + video strip + CTA.
   Self-contained: fetches products via anon Supabase, injects sections after the hero. Defensive. */
(function () {
  if (window.__homeInit) return; window.__homeInit = true;
  // only run on the homepage
  var hero = document.querySelector('.hero-section');
  if (!hero) return;

  var SUPA_URL = 'https://wjhbkkthppbadcjnozal.supabase.co';
  var SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqaGJra3RocHBiYWRjam5vemFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MDQ4MTUsImV4cCI6MjA5NjA4MDgxNX0.VC1rur9Y8lUCo_EW2DK3PJllsgyv6nIQEeEKJjg0IKs';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var money = function (n) { return '$' + Number(n || 0).toFixed(2); };

  // Brand ad video — paste the uploaded clip URL here to go live (empty = branded poster placeholder)
  var BRAND_VIDEO_URL = '';
  var BRAND_POSTER = 'assets/hero-pizza.png';

  function getClient() {
    try { if (window.supabase && window.supabase.createClient) return window.supabase.createClient(SUPA_URL, SUPA_ANON); } catch (e) {}
    return null;
  }

  function imgFor(products, catMatch) {
    var p = products.find(function (x) { return x.image_url && (x.category || '').toLowerCase().indexOf(catMatch) > -1; });
    return (p && p.image_url) || (products[0] && products[0].image_url) || 'assets/hero-pizza.png';
  }

  // ---------- builders ----------
  function buildOffers(products) {
    var pizza = imgFor(products, 'traditional');
    var burger = imgFor(products, 'burger');
    var boll = imgFor(products, 'bollywood');
    var sec = document.createElement('section');
    sec.className = 'home-section offers-home';
    function coupon(img, badge, badgeSmall, badgeCls, kicker, title, desc, code, timerId) {
      return '<article class="offer-poster" style="--poster-img:url(' + esc(img) + ')">' +
        '<div class="offer-poster-media"></div><div class="offer-poster-scrim"></div>' +
        '<div class="offer-poster-badge ' + badgeCls + '">' + badge + (badgeSmall ? '<small>' + badgeSmall + '</small>' : '') + '</div>' +
        '<div class="offer-poster-body">' +
          '<span class="offer-poster-kicker">' + kicker + '</span>' +
          '<h3 class="offer-poster-title">' + title + '</h3>' +
          '<p class="offer-poster-desc">' + desc + '</p>' +
          '<div class="offer-poster-row">' +
            '<button class="coupon-chip" type="button" data-code="' + code + '" onclick="copyCoupon(this)"><span class="coupon-chip-label">CODE</span><span class="coupon-chip-code">' + code + '</span><i data-lucide="copy" class="coupon-chip-ic"></i></button>' +
            '<div class="offer-countdown"><span class="offer-countdown-lbl">Ends in</span><span id="' + timerId + '">00:00:00</span></div>' +
          '</div>' +
          '<button class="btn btn-primary btn-full offer-poster-cta" data-apply="' + code + '">Redeem &amp; Order <i data-lucide="arrow-right"></i></button>' +
        '</div></article>';
    }
    sec.innerHTML =
      '<div class="section-header"><span class="sub-heading">DEALS &amp; OFFERS</span>' +
      '<h2 class="section-title">Grab Today&#39;s Hottest Deals</h2>' +
      '<p class="section-subtitle">Tap a code to copy it, then redeem at checkout.</p></div>' +
      '<div class="offers-grid poster-grid">' +
      coupon(pizza, '30%', 'OFF', '', 'First Order Special', '30% Off Your First Bite', 'New here? Slice 30% off any order &mdash; pizzas, burgers, the lot.', 'BOOST30', 'timer-tues') +
      coupon(burger, 'FREE', 'DELIVERY', 'badge-gold', 'Hamilton Midweek', 'Free Delivery Over $40', 'Order $40+ anywhere in Hamilton and we&rsquo;ll bring it over &mdash; on the house.', 'HAMFREE', 'timer-free') +
      '<article class="offer-poster" style="--poster-img:url(' + esc(boll) + ')">' +
        '<div class="offer-poster-media"></div><div class="offer-poster-scrim"></div>' +
        '<div class="offer-poster-badge badge-new">NEW</div>' +
        '<div class="offer-poster-body">' +
          '<span class="offer-poster-kicker">Just Launched</span>' +
          '<h3 class="offer-poster-title">The Bollywood Range</h3>' +
          '<p class="offer-poster-desc">Butter chicken, tandoori, chilly paneer &amp; more &mdash; spiced to perfection.</p>' +
          '<div class="offer-poster-row"><span class="offer-tag-pill">&#127798; 10 new dishes</span></div>' +
          '<a class="btn btn-primary btn-full offer-poster-cta" href="menu.html?cat=Bollywood%20Range">Explore the Range <i data-lucide="arrow-right"></i></a>' +
        '</div></article>' +
      '</div>';
    sec.querySelectorAll('[data-apply]').forEach(function (btn) {
      btn.addEventListener('click', function () { try { applyCouponCode(btn.getAttribute('data-apply')); } catch (e) {} });
    });
    return sec;
  }

  function buildCategories(products) {
    var cats = {};
    products.forEach(function (p) { if (p.category && !cats[p.category] && p.image_url) cats[p.category] = p.image_url; });
    var list = Object.keys(cats);
    if (!list.length) return null;
    var sec = document.createElement('section'); sec.className = 'home-section';
    var tiles = list.map(function (c) {
      return '<a class="cat-tile" href="menu.html?cat=' + encodeURIComponent(c) + '"><span class="cat-tile-img" style="background-image:url(\'' + esc(cats[c]) + '\')"></span><span class="cat-tile-name">' + esc(c) + '</span></a>';
    }).join('');
    sec.innerHTML = '<div class="home-head"><div class="home-eyebrow">Explore</div><h2 class="home-title">Browse by Category</h2></div>' +
      '<div class="cat-rail-mask"><div class="cat-rail">' + tiles + tiles + '</div></div>';
    return sec;
  }

  function buildDishes(products) {
    var pick = products.filter(function (p) { return p.image_url && !p.out_of_stock; }).slice(0, 14);
    if (!pick.length) return null;
    var sec = document.createElement('section'); sec.className = 'home-section section-tint';
    sec.innerHTML = '<div class="home-head"><div class="home-eyebrow">Crowd Favourites</div><h2 class="home-title">Popular Right Now</h2></div>' +
      '<div class="dish-carousel"><button class="dish-arrow prev" aria-label="Previous">&#8249;</button>' +
      '<div class="dish-viewport"><div class="dish-track">' +
      pick.map(function (p) {
        return '<div class="dish-card"><img class="dish-img" src="' + esc(p.image_url) + '" alt="' + esc(p.name) + '" loading="lazy" decoding="async">' +
          '<div class="dish-body"><div class="dish-name">' + esc(p.name) + '</div>' +
          '<div class="dish-foot"><span class="dish-price">' + money(p.price) + '</span>' +
          '<button class="dish-add" data-id="' + esc(p.id) + '" data-name="' + esc(p.name) + '" data-price="' + Number(p.price) + '" data-img="' + esc(p.image_url) + '" aria-label="Add ' + esc(p.name) + '">+</button></div></div></div>';
      }).join('') +
      '</div></div><button class="dish-arrow next" aria-label="Next">&#8250;</button></div>';
    var track = sec.querySelector('.dish-track'), vp = sec.querySelector('.dish-viewport');
    var prevB = sec.querySelector('.dish-arrow.prev'), nextB = sec.querySelector('.dish-arrow.next'), pos = 0;
    function step() { return 246; } // 230 card + 16 gap
    function maxShift() { return Math.max(0, track.scrollWidth - vp.clientWidth); }
    function apply() { pos = Math.max(0, Math.min(pos, maxShift())); track.style.transform = 'translateX(' + (-pos) + 'px)'; prevB.disabled = pos <= 0; nextB.disabled = pos >= maxShift() - 1; }
    nextB.onclick = function () { pos += step() * 2; apply(); };
    prevB.onclick = function () { pos -= step() * 2; apply(); };
    sec.querySelector('.dish-track').addEventListener('click', function (e) {
      var btn = e.target.closest('.dish-add'); if (!btn) return;
      if (typeof window.addProductToCart === 'function') {
        window.addProductToCart(btn.dataset.id, btn.dataset.name, Number(btn.dataset.price), btn.dataset.img, '');
        btn.textContent = '✓'; setTimeout(function () { btn.textContent = '+'; }, 1200);
      }
    });
    // swipe
    var sx = null, sp = 0; vp.addEventListener('pointerdown', function (e) { sx = e.clientX; sp = pos; });
    window.addEventListener('pointermove', function (e) { if (sx == null) return; pos = sp - (e.clientX - sx); apply(); });
    window.addEventListener('pointerup', function () { sx = null; });
    setTimeout(apply, 50);
    return sec;
  }

  function buildVideos(products) {
    var vids = products.filter(function (p) { return p.video_url; }).slice(0, 4);
    if (!vids.length) return null;
    var sec = document.createElement('section'); sec.className = 'home-section';
    sec.innerHTML = '<div class="home-head"><div class="home-eyebrow">Straight from the oven</div><h2 class="home-title">Watch It Sizzle</h2></div>' +
      '<div class="video-strip">' + vids.map(function (p) {
        return '<div class="video-tile"><video src="' + esc(p.video_url) + '" muted loop playsinline preload="metadata" poster="' + esc(p.video_poster || p.image_url || '') + '"></video><div class="video-tile-cap">' + esc(p.name) + '</div></div>';
      }).join('') + '</div>';
    // autoplay on view
    setTimeout(function () {
      sec.querySelectorAll('video').forEach(function (v) {
        if ('IntersectionObserver' in window) {
          new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) { v.play().catch(function () {}); } else { v.pause(); } }); }, { threshold: .4 }).observe(v);
        } else { v.play().catch(function () {}); }
      });
    }, 100);
    return sec;
  }

  function buildCTA() {
    var sec = document.createElement('section'); sec.className = 'cta-band';
    sec.innerHTML = '<div class="cta-inner"><div class="cta-h">Still Hungry?</div><p class="cta-p">Big bites, bold flavours — delivered scorching hot across Hamilton.</p><a class="ad-cta" href="menu.html">Order Now &rarr;</a></div>';
    return sec;
  }

  function buildCraft(products) {
    var img = imgFor(products, 'traditional');
    var sec = document.createElement('section');
    sec.className = 'craft-band';
    sec.innerHTML =
      '<div class="craft-media"><img src="' + esc(img) + '" alt="Fresh pizza" loading="lazy" decoding="async">' +
        '<span class="craft-chip c1">Fresh dough</span>' +
        '<span class="craft-chip c2">Baked to order</span></div>' +
      '<div class="craft-copy"><div class="home-eyebrow">The Craft</div>' +
        '<h2 class="home-title">Made fresh.<br>Delivered fast.</h2>' +
        '<p>Every order is made from scratch in our Hamilton kitchen and goes straight into the oven &mdash; nothing sits under a heat lamp waiting for a rider. Fresh ingredients, cooked when you order.</p>' +
        '<div class="craft-cta-row"><a class="btn btn-primary" href="menu.html">Order now</a><a class="craft-story-link" href="story.html">Our story &rarr;</a></div></div>';
    return sec;
  }

  function buildGallery(products) {
    var seen = {};
    var pool = products.filter(function(p){
      if (!p.image_url || p.out_of_stock) return false;
      var c = p.category || 'x';
      if (seen[c] > 1) return false;
      seen[c] = (seen[c]||0) + 1;
      return true;
    });
    if (pool.length < 5) return null;
    var heroP = pool.find(function(p){ return p.video_url; }) || pool[0];
    var rest = pool.filter(function(p){ return p !== heroP; }).slice(0, 5);
    var total = products.filter(function(p){ return !p.out_of_stock; }).length;

    function tile(p, cls){
      return '<a class="bento-tile ' + cls + '" href="menu.html?cat=' + encodeURIComponent(p.category||'') + '" data-pid="' + esc(p.id) + '">' +
        '<img src="' + esc(p.image_url) + '" alt="' + esc(p.name) + '" loading="lazy" decoding="async">' +
        '<span class="gal-meta"><b>' + esc(p.name) + '</b><i>' + money(p.price) + '</i></span></a>';
    }
    var heroMedia = heroP.video_url
      ? '<video src="' + esc(heroP.video_url) + '" poster="' + esc(heroP.video_poster || heroP.image_url) + '" muted loop playsinline preload="none"></video>'
      : '<img class="kenburns" src="' + esc(heroP.image_url) + '" alt="' + esc(heroP.name) + '" loading="lazy" decoding="async">';
    var heroTile = '<a class="bento-tile bento-hero" href="menu.html?cat=' + encodeURIComponent(heroP.category||'') + '" data-pid="' + esc(heroP.id) + '">' +
      heroMedia +
      '<span class="gal-meta"><b>' + esc(heroP.name) + '</b><i>' + money(heroP.price) + '</i></span>' +
      '<span class="bento-flag">Signature</span></a>';
    var ctaTile = '<a class="bento-tile bento-cta" href="menu.html">' +
      '<span class="bcta-n">' + total + '</span><span class="bcta-l">items on the menu</span><span class="bcta-go">View full menu &rarr;</span></a>';

    var sec = document.createElement('section'); sec.className = 'home-section bento-section';
    sec.innerHTML = '<div class="home-head"><div class="home-eyebrow">Fresh from the pass</div><h2 class="home-title">The Lineup</h2></div>' +
      '<div class="bento-grid">' + heroTile + rest.map(function(p, i){ return tile(p, i === 0 ? 'bento-wide' : ''); }).join('') + ctaTile + '</div>';

    var v = sec.querySelector('video');
    if (v && 'IntersectionObserver' in window) {
      new IntersectionObserver(function(en){ en.forEach(function(e){ e.isIntersecting ? v.play().catch(function(){}) : v.pause(); }); }, { threshold: .3 }).observe(v);
    }
    return sec;
  }

  function buildSteps() {
    var sec = document.createElement('section'); sec.className = 'home-section steps-section section-tint';
    sec.innerHTML = '<div class="home-head"><div class="home-eyebrow">How it works</div><h2 class="home-title">Three steps to hot pizza</h2></div>' +
      '<div class="steps-grid">' +
        '<div class="step-card"><span class="step-n">01</span><i data-lucide="utensils-crossed"></i><h3>Pick your slice</h3><p>Browse the menu or build your own from the base up.</p></div>' +
        '<div class="step-card"><span class="step-n">02</span><i data-lucide="flame"></i><h3>We cook it</h3><p>Topped and baked to order in minutes, never pre-made.</p></div>' +
        '<div class="step-card"><span class="step-n">03</span><i data-lucide="bike"></i><h3>At your door</h3><p>Sealed hot and delivered across Hamilton in about 28 minutes.</p></div>' +
      '</div>';
    return sec;
  }

  function insertAfter(node, ref) { ref.parentNode.insertBefore(node, ref.nextSibling); }

  async function init() {
    var sb = getClient();
    var products = [];
    if (sb) {
      try { var r = await sb.from('products').select('id,name,price,image_url,category,video_url,video_poster,out_of_stock').order('name'); if (r.data) products = r.data; } catch (e) {}
    }
    if (!products.length && window.MOCK_PRODUCTS) products = window.MOCK_PRODUCTS;

    var anchor = hero; // insert sequence right after hero
    var nodes = [];
    if (products.length) {
      nodes.push(buildOffers(products));
      var c = buildCategories(products); if (c) nodes.push(c);
      var d = buildDishes(products); if (d) nodes.push(d);
      var g = buildGallery(products); if (g) nodes.push(g);
      nodes.push(buildCraft(products));
      nodes.push(buildSteps());
      // video strip skipped: only stock placeholder clips exist (not food). Re-enable when real food videos are uploaded.
    } else {
      nodes.push(buildOffers([]));
    }
    nodes.forEach(function (nd) { insertAfter(nd, anchor); anchor = nd; });

    // CTA band before footer
    var footer = document.querySelector('footer.app-footer, .app-footer');
    var cta = buildCTA();
    if (footer && footer.parentNode) footer.parentNode.insertBefore(cta, footer);

    // let effects.js tag the new cards for scroll-reveal
    if (window.lucide && window.lucide.createIcons) try { window.lucide.createIcons(); } catch (e) {}
    // offer posters were injected async -> (re)start their end-of-day countdowns now that the elements exist
    if (typeof initCountdownTimers === 'function') try { initCountdownTimers(); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* ===== CINEMATIC HERO (2026-07-03): word-stagger headline + scroll parallax + shine ===== */
(function(){
  var hero = document.querySelector('.hero-section');
  if (!hero) return;

  // word-stagger headline entrance
  var h1 = hero.querySelector('.hero-title');
  if (h1 && !h1.dataset.stagger) {
    h1.dataset.stagger = '1';
    (function wrap(node){
      Array.prototype.slice.call(node.childNodes).forEach(function(ch){
        if (ch.nodeType === 3) {
          var frag = document.createDocumentFragment();
          ch.textContent.split(/(\s+)/).forEach(function(w){
            if (!w) return;
            if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
            var s = document.createElement('span');
            s.className = 'hw'; s.textContent = w;
            frag.appendChild(s);
          });
          node.replaceChild(frag, ch);
        } else if (ch.nodeType === 1 && ch.tagName !== 'BR') wrap(ch);
      });
    })(h1);
    var i = 0;
    h1.querySelectorAll('.hw').forEach(function(s){ s.style.animationDelay = (0.09 * i++) + 's'; });
    h1.classList.add('hw-go');
  }

  // scroll parallax: video drifts slow + zooms, text lifts + fades, pizza floats
  var vid = hero.querySelector('.hero-video');
  var txt = hero.querySelector('.hero-text-content');
  var vis = hero.querySelector('.hero-visual-container');
  var tick = false;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function upd(){
    tick = false;
    if (reduceMotion) return;
    var y = window.scrollY, h = hero.offsetHeight || 1;
    if (y > h) return;
    var k = y / h;
    var _isMob = window.matchMedia && window.matchMedia('(max-width:768px)').matches;
    if (vid && !_isMob) vid.style.transform = 'translateY(' + (y * 0.35) + 'px) scale(' + (1 + k * 0.08) + ')';
    if (txt) { txt.style.transform = 'translateY(' + (y * 0.18) + 'px)'; txt.style.opacity = String(Math.max(0, 1 - k * 1.15)); }
    if (vis) vis.style.transform = 'translateY(' + (y * 0.10) + 'px)';
  }
  window.addEventListener('scroll', function(){ if (!tick) { tick = true; requestAnimationFrame(upd); } }, {passive:true});

  // periodic shine sweep across the hero pizza
  var pz = document.getElementById('hero-pizza-real');
  var host = pz && pz.closest('.hero-pizza-wrapper');
  if (host) {
    host.classList.add('shine-host');
    setInterval(function(){
      host.classList.remove('shine-run');
      void host.offsetWidth;
      host.classList.add('shine-run');
    }, 6000);
  }
})();


/* ============================================================
   Homepage favourites rail: live products, one-tap add to cart.
   Reuses app.js globals (databaseProducts, addProductToCart, hsEsc).
   ============================================================ */
(function () {
  var GRID = 'hs-fav-grid';
  var WANT = 8;

  var FALLBACK_IMG = 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=420&q=80&fit=crop';

  function esc(v) {
    return typeof hsEsc === 'function' ? hsEsc(String(v == null ? '' : v))
      : String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
  }

  // Highest-rated first when ratings exist, then Hungry Special, then price.
  function pick(all) {
    var live = all.filter(function (p) { return p.is_available !== false; });
    var ratings = window.PRODUCT_RATINGS || {};
    return live.slice().sort(function (a, b) {
      var ra = (ratings[a.id] && ratings[a.id].avg) || 0;
      var rb = (ratings[b.id] && ratings[b.id].avg) || 0;
      if (rb !== ra) return rb - ra;
      var fa = a.category === 'Hungry Special' ? 1 : 0;
      var fb = b.category === 'Hungry Special' ? 1 : 0;
      if (fb !== fa) return fb - fa;
      return (Number(b.price) || 0) - (Number(a.price) || 0);
    }).slice(0, WANT);
  }

  function card(p) {
    var img = p.image_url || (window.PRODUCT_IMAGES && window.PRODUCT_IMAGES[p.id]) || FALLBACK_IMG;
    var price = Number(p.price) || 0;
    var top = p.category === 'Hungry Special';
    return '' +
      '<article class="hs-card">' +
        '<div class="hs-card__media">' +
          '<span class="hs-card__veg ' + (p.is_veg ? 'veg' : 'nonveg') + '" title="' + (p.is_veg ? 'Veg' : 'Non-veg') + '"></span>' +
          (top ? '<span class="hs-card__flag">TOP PICK</span>' : '') +
          '<img src="' + esc(img) + '" alt="' + esc(p.name) + '" loading="lazy" decoding="async">' +
        '</div>' +
        '<div class="hs-card__body">' +
          '<h3 class="hs-card__name">' + esc(p.name) + '</h3>' +
          '<p class="hs-card__desc">' + esc(p.description || '') + '</p>' +
          '<div class="hs-card__foot">' +
            '<span class="hs-card__price">$' + price.toFixed(2) + '</span>' +
            '<button class="hs-card__add" type="button" data-id="' + esc(p.id) + '" data-name="' + esc(p.name) + '" data-price="' + price + '" data-img="' + esc(img) + '">+ Add</button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function render(list) {
    var grid = document.getElementById(GRID);
    if (!grid) return;
    grid.innerHTML = list.map(card).join('');
    grid.querySelectorAll('.hs-card__add').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (typeof addProductToCart !== 'function') return;
        addProductToCart(btn.dataset.id, btn.dataset.name, Number(btn.dataset.price), btn.dataset.img);
        btn.classList.add('added');
        btn.textContent = 'Added ✓';
        setTimeout(function () { btn.classList.remove('added'); btn.textContent = '+ Add'; }, 1400);
      });
    });
  }

  // databaseProducts is populated asynchronously by app.js; wait for it.
  function start(tries) {
    if (!document.getElementById(GRID)) return;
    var all = (typeof databaseProducts !== 'undefined' && databaseProducts) || [];
    if (all.length) { render(pick(all)); return; }
    if (tries > 60) {
      var grid = document.getElementById(GRID);
      if (grid) grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted)">Menu is loading &mdash; <a href="menu.html">browse the full menu</a>.</p>';
      return;
    }
    setTimeout(function () { start(tries + 1); }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { start(0); });
  } else {
    start(0);
  }
})();

/* Copy a promo code from the deals band. */
function hsCopyCode(el, code) {
  var done = function () {
    var tag = el.querySelector('.hs-deal__code em');
    if (!tag) return;
    var prev = tag.textContent;
    tag.textContent = 'copied!';
    setTimeout(function () { tag.textContent = prev; }, 1600);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(done, done);
  } else {
    done();
  }
}


/* Fill the hero backdrop with real product photography from the menu. */
(function () {
  function fill(tries) {
    var host = document.getElementById('hs-hero-media');
    if (!host) return;
    var all = (typeof databaseProducts !== 'undefined' && databaseProducts) || [];
    var pics = all.filter(function (p) { return p.image_url && p.is_available !== false; });
    if (!pics.length) { if (tries < 60) setTimeout(function () { fill(tries + 1); }, 250); return; }
    // Lead with the signature range, then one shot per other category so
    // the strip reads varied rather than three near-identical pizzas.
    var order = ['Hungry Special', 'Gourmet Burgers', 'Loaded Fries'];
    pics.sort(function (a, b) {
      var ia = order.indexOf(a.category), ib = order.indexOf(b.category);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    var seen = {}, picked = [];
    pics.forEach(function (p) {
      var c = p.category || 'x';
      if (seen[c] || picked.length >= 3) return;
      seen[c] = 1; picked.push(p);
    });
    while (picked.length < 3 && pics.length) picked.push(pics[picked.length % pics.length]);
    host.innerHTML = picked.map(function (p) {
      return '<img src="' + String(p.image_url).replace(/"/g, '&quot;') + '" alt="" decoding="async">';
    }).join('');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { fill(0); });
  } else { fill(0); }
})();
