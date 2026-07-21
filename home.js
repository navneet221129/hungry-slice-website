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
  function buildAds(products) {
    var slides = [
      { tag: 'First Order', h: '30% OFF Your First Bite', p: 'New here? Use code', code: 'BOOST30', cta: 'Order Now', href: 'menu.html', img: imgFor(products, 'traditional') },
      { tag: 'Free Delivery', h: 'Free Delivery Over $40', p: 'Pile it on. Code', code: 'HAMFREE', cta: 'See Menu', href: 'menu.html', img: imgFor(products, 'burger') },
      { tag: 'New Range', h: 'The Bollywood Range', p: 'Spiced to perfection — bold Indian-inspired flavours.', code: '', cta: 'Explore', href: 'menu.html', img: imgFor(products, 'bollywood') }
    ];
    var sec = document.createElement('section');
    sec.className = 'ad-slider'; sec.setAttribute('aria-label', 'Offers');
    sec.innerHTML =
      '<div class="ad-viewport"><div class="ad-track">' +
      slides.map(function (s) {
        return '<div class="ad-slide"><div class="ad-slide-bg" style="background-image:url(\'' + esc(s.img) + '\')"></div>' +
          '<div class="ad-slide-inner"><div class="ad-slide-tag">' + esc(s.tag) + '</div>' +
          '<div class="ad-slide-h">' + esc(s.h) + '</div>' +
          '<div class="ad-slide-p">' + esc(s.p) + (s.code ? ' <span class="ad-slide-code">' + esc(s.code) + '</span>' : '') + '</div>' +
          '<a class="ad-cta" href="' + esc(s.href) + '">' + esc(s.cta) + '</a></div></div>';
      }).join('') +
      '</div></div>' +
      '<button class="ad-arrow prev" aria-label="Previous">&#8249;</button><button class="ad-arrow next" aria-label="Next">&#8250;</button>' +
      '<div class="ad-dots"></div>';
    var track = sec.querySelector('.ad-track'), dotsWrap = sec.querySelector('.ad-dots'), i = 0, n = slides.length, timer;
    for (var d = 0; d < n; d++) { var b = document.createElement('button'); b.className = 'ad-dot' + (d === 0 ? ' on' : ''); b.dataset.i = d; dotsWrap.appendChild(b); }
    function go(k) { i = (k + n) % n; track.style.transform = 'translateX(' + (-i * 100) + '%)'; dotsWrap.querySelectorAll('.ad-dot').forEach(function (x, xi) { x.classList.toggle('on', xi === i); }); }
    function next() { go(i + 1); } function prev() { go(i - 1); }
    function play() { stop(); timer = setInterval(next, 5000); } function stop() { if (timer) clearInterval(timer); }
    sec.querySelector('.next').onclick = function () { next(); play(); };
    sec.querySelector('.prev').onclick = function () { prev(); play(); };
    dotsWrap.onclick = function (e) { if (e.target.dataset.i != null) { go(+e.target.dataset.i); play(); } };
    // swipe
    var sx = null; track.addEventListener('pointerdown', function (e) { sx = e.clientX; stop(); });
    window.addEventListener('pointerup', function (e) { if (sx == null) return; var dx = e.clientX - sx; if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); } sx = null; play(); });
    sec.addEventListener('mouseenter', stop); sec.addEventListener('mouseleave', play);
    play();
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

  function buildBrandVideo() {
    var sec = document.createElement('section');
    sec.className = 'brand-video';
    var hasVid = !!BRAND_VIDEO_URL;
    var media = hasVid
      ? '<video class="bv-media" autoplay muted loop playsinline preload="metadata" poster="' + esc(BRAND_POSTER) + '" src="' + esc(BRAND_VIDEO_URL) + '"></video>'
      : '<div class="bv-media" style="background:url(\'' + esc(BRAND_POSTER) + '\') center/cover;"></div>';
    sec.innerHTML =
      '<div class="bv-frame">' + media +
      '' +
      '<div class="bv-overlay">' +
        '<div class="bv-tag">Hamilton\'s Cloud Kitchen</div>' +
        '<h2 class="bv-name">THE HUNGRY <span class="bv-accent">SLICE</span></h2>' +
        '<div class="bv-tagline">Big Bites. Bold Flavours.</div>' +
        '<a class="bv-cta" href="menu.html">Order Now &rarr;</a>' +
      '</div></div>';
    var v = sec.querySelector('video');
    if (v && 'IntersectionObserver' in window) {
      new IntersectionObserver(function(en){en.forEach(function(e){ e.isIntersecting ? v.play().catch(function(){}) : v.pause(); });},{threshold:.3}).observe(v);
    }
    return sec;
  }


  function buildCraft(products) {
    var img = imgFor(products, 'traditional');
    var sec = document.createElement('section');
    sec.className = 'craft-band';
    sec.innerHTML =
      '<div class="craft-media"><img src="' + esc(img) + '" alt="Wood-fired pizza" loading="lazy" decoding="async">' +
        '<span class="craft-chip c1">48-hour fermented dough</span>' +
        '<span class="craft-chip c2">Wood-fired at 450&deg;C</span></div>' +
      '<div class="craft-copy"><div class="home-eyebrow">The Craft</div>' +
        '<h2 class="home-title">Slow dough.<br>Fast fire.</h2>' +
        '<p>Every base is cold-fermented for 48 hours, stretched by hand and blistered in a 450&deg;C wood-fired oven for ninety seconds. No shortcuts, no freezer &mdash; just fire and fresh ingredients.</p>' +
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
        '<div class="step-card"><span class="step-n">02</span><i data-lucide="flame"></i><h3>We fire it</h3><p>Hand-stretched and wood-fired at 450&deg;C in minutes.</p></div>' +
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
      nodes.push(buildAds(products));
      nodes.push(buildBrandVideo());
      var c = buildCategories(products); if (c) nodes.push(c);
      var d = buildDishes(products); if (d) nodes.push(d);
      var g = buildGallery(products); if (g) nodes.push(g);
      nodes.push(buildCraft(products));
      nodes.push(buildSteps());
      // video strip skipped: only stock placeholder clips exist (not food). Re-enable when real food videos are uploaded.
    } else {
      nodes.push(buildAds([{ image_url: 'assets/hero-pizza.png', category: '' }]));
    }
    nodes.forEach(function (nd) { insertAfter(nd, anchor); anchor = nd; });

    // CTA band before footer
    var footer = document.querySelector('footer.app-footer, .app-footer');
    var cta = buildCTA();
    if (footer && footer.parentNode) footer.parentNode.insertBefore(cta, footer);

    // let effects.js tag the new cards for scroll-reveal
    if (window.lucide && window.lucide.createIcons) try { window.lucide.createIcons(); } catch (e) {}
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
