

window.zomSetActive = function(el) {
  document.querySelectorAll('.zom-nav-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
};

function closePromoBar() {
  const bar = document.getElementById('promo-bar');
  const spacer = document.getElementById('nav-spacer');
  if (bar) bar.style.display = 'none';
  if (spacer) spacer.style.height = '80px';
  document.body.classList.add('promo-closed');
}
let supabaseClient = null;
let activeTrackingChannel = null;
let databaseProducts = [];
let databaseCategories = [];
let selectedCategory = 'All';
let searchQuery = '';
let vegMode = (typeof localStorage !== 'undefined' ? localStorage.getItem('hs_veg') : null) || 'all';


// Day/Night Theme Toggling & Paynuts Sync
window.toggleTheme = function() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updatePaynutsThemeStyles(newTheme);
};

window.updatePaynutsThemeStyles = function(theme) {
  if (paynutsInstance) {
    const textColor = theme === 'dark' ? '#e2dcd5' : '#111111';
    const placeholderColor = theme === 'dark' ? '#9a9286' : '#6b7280';
    try {
      if (typeof paynutsInstance.setNumberStyle === 'function') {
        paynutsInstance.setNumberStyle({
          'font-family': 'Outfit, sans-serif',
          'font-size': '15px',
          'color': textColor,
          'placeholder': {
            'color': placeholderColor
          }
        });
      }
      if (typeof paynutsInstance.setCvvStyle === 'function') {
        paynutsInstance.setCvvStyle({
          'font-family': 'Outfit, sans-serif',
          'font-size': '15px',
          'color': textColor,
          'placeholder': {
            'color': placeholderColor
          }
        });
      }
    } catch (e) {
      console.warn("Could not dynamically update Paynuts iframe styling:", e);
    }
  }
};

// Initialize Lucide Icons & Supabase client
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  initHero3D(); // Setup 3D Hero Pizza
  initParallaxHero();
  initScrollAnimations();
  initCountdownTimers();
  initBuilder();
  initSupabase(); // Setup database configuration
  initPaynutsGateway(); // Setup payment gateway configuration
  initCardFormatting(); // Auto-format card number / expiry / cvc
  updateCartUI();
});

// ========================================================
// 0. SUPABASE DATABASE CONFIGURATION & INTEGRATION
// ========================================================
function loadOfflineMockData() {
  if (window.MOCK_PRODUCTS && window.MOCK_CATEGORIES) {
    databaseProducts = window.MOCK_PRODUCTS;
    databaseCategories = window.MOCK_CATEGORIES;
    renderDynamicCategories();
    renderDynamicProducts();
  }
}

function initSupabase() {
  // Force-clear old sb_publishable_ key — incompatible with supabase-js DB ops
  const _existingKey = localStorage.getItem('supabase_key');
  if (_existingKey && !_existingKey.startsWith('eyJ')) { localStorage.removeItem('supabase_key'); }

  const statusIndicator = document.getElementById('dev-status');
  const isOffline = localStorage.getItem('supabase_offline') === 'true';

  if (isOffline) {
    supabaseClient = null;
    if (statusIndicator) {
      statusIndicator.innerHTML = `
        <span class="status-dot offline"></span>
        <span class="status-text">OFFLINE MOCK DB ACTIVE</span>
      `;
    }
    const urlInput = document.getElementById('dev-supabase-url');
    const keyInput = document.getElementById('dev-supabase-key');
    if (urlInput) urlInput.value = '';
    if (keyInput) keyInput.value = '';
    loadOfflineMockData();
    return;
  }

  let savedUrl = localStorage.getItem('supabase_url');
  // Self-healing URL check: reset if missing or invalid
  if (!savedUrl || !savedUrl.startsWith('https://') || !savedUrl.includes('supabase.co')) {
    savedUrl = 'https://wjhbkkthppbadcjnozal.supabase.co';
    localStorage.setItem('supabase_url', savedUrl);
  }
  
  let savedKey = localStorage.getItem('supabase_key');
  // Self-healing Key check: reset if missing, placeholder, or invalid
  if (!savedKey || !savedKey.startsWith('eyJ')) {
    savedKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqaGJra3RocHBiYWRjam5vemFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MDQ4MTUsImV4cCI6MjA5NjA4MDgxNX0.VC1rur9Y8lUCo_EW2DK3PJllsgyv6nIQEeEKJjg0IKs';
    localStorage.setItem('supabase_key', savedKey);
  }
  
  // Fill developer control panel inputs
  const urlInput = document.getElementById('dev-supabase-url');
  const keyInput = document.getElementById('dev-supabase-key');
  if (urlInput && savedUrl) urlInput.value = savedUrl;
  if (keyInput && savedKey) keyInput.value = savedKey;

  if (savedUrl && savedKey && window.supabase) {
    try {
      supabaseClient = window.supabase.createClient(savedUrl, savedKey);
      
      if (statusIndicator) {
        statusIndicator.innerHTML = `
          <span class="status-dot online"></span>
          <span class="status-text" style="color: #10b981;">LIVE DATABASE ACTIVE (SUPABASE)</span>
        `;
      }
      
      // Pull dynamic reviews, products, and categories from DB
      fetchSupabaseReviews();
      fetchSupabaseProducts();
      fetchSupabaseCategories();
      fetchProductRatings();
    } catch (err) {
      console.error("Supabase Client init failed:", err);
      supabaseClient = null;
      loadOfflineMockData();
    }
  } else {
    supabaseClient = null;
    if (statusIndicator) {
      statusIndicator.innerHTML = `
        <span class="status-dot offline"></span>
        <span class="status-text">OFFLINE MOCK DB ACTIVE</span>
      `;
    }
    loadOfflineMockData();
  }
}

function toggleDevPanel() {
  const panel = document.getElementById('developer-panel');
  if (panel) panel.classList.toggle('collapsed');
}

function toggleMobileNav() {
  const overlay = document.getElementById('mobile-nav-overlay');
  if (overlay) overlay.classList.toggle('active');
}

let paynutsInstance = null;

// Category-specific fallback images (Unsplash) for when product images fail to load
window.CATEGORY_FALLBACK_IMGS = {
  'Traditional Pizzas':  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=420&q=80&auto=format&fit=crop',
  'Extra Value Pizza':   'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=420&q=80&auto=format&fit=crop',
  'Value Pizza':         'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=420&q=80&auto=format&fit=crop',
  'Bollywood Range':     'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=420&q=80&auto=format&fit=crop',
  'Hungry Special':      'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=420&q=80&auto=format&fit=crop',
  'Gourmet Burgers':     'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=420&q=80&auto=format&fit=crop',
  'Value Burgers':       'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=420&q=80&auto=format&fit=crop',
  'Chicken Wings':       'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=420&q=80&auto=format&fit=crop',
  'Loaded Fries':        'https://images.unsplash.com/photo-1518013431117-eb1465fa5752?w=420&q=80&auto=format&fit=crop',
  'Value Sides':         'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=420&q=80&auto=format&fit=crop',
  'Desserts':            'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=420&q=80&auto=format&fit=crop',
  'default':             'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=420&q=80&auto=format&fit=crop'
};

// Per-product menu images (verified Unsplash, unique within each category)
window.PRODUCT_IMAGES = {
  "f0000051-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=440&q=80&auto=format&fit=crop",
  "f0000053-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=440&q=80&auto=format&fit=crop",
  "f0000055-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=440&q=80&auto=format&fit=crop",
  "f0000060-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=440&q=80&auto=format&fit=crop",
  "f0000054-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=440&q=80&auto=format&fit=crop",
  "f0000059-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=440&q=80&auto=format&fit=crop",
  "f0000056-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1542367592-8849eb950fd8?w=440&q=80&auto=format&fit=crop",
  "f0000057-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=440&q=80&auto=format&fit=crop",
  "f0000058-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=440&q=80&auto=format&fit=crop",
  "f0000052-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=440&q=80&auto=format&fit=crop",
  "f0000089-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=440&q=80&auto=format&fit=crop",
  "f0000098-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=440&q=80&auto=format&fit=crop",
  "f0000095-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=440&q=80&auto=format&fit=crop",
  "f0000097-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=440&q=80&auto=format&fit=crop",
  "f0000096-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=440&q=80&auto=format&fit=crop",
  "f0000019-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1571066811602-716837d681de?w=440&q=80&auto=format&fit=crop",
  "f0000016-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1548369937-47519962c11a?w=440&q=80&auto=format&fit=crop",
  "f0000021-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1542834291-c514e77b215f?w=440&q=80&auto=format&fit=crop",
  "f0000022-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1593504049359-74330189a345?w=440&q=80&auto=format&fit=crop",
  "f0000018-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1595708684082-a173bb3a06c5?w=440&q=80&auto=format&fit=crop",
  "f0000017-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1581873372796-635b67ca2008?w=440&q=80&auto=format&fit=crop",
  "f0000015-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=440&q=80&auto=format&fit=crop",
  "f0000024-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=440&q=80&auto=format&fit=crop",
  "f0000025-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=440&q=80&auto=format&fit=crop",
  "f0000020-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=440&q=80&auto=format&fit=crop",
  "f0000023-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=440&q=80&auto=format&fit=crop",
  "f0000068-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=440&q=80&auto=format&fit=crop",
  "f0000066-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=440&q=80&auto=format&fit=crop",
  "f0000076-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=440&q=80&auto=format&fit=crop",
  "f0000072-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=440&q=80&auto=format&fit=crop",
  "f0000074-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=440&q=80&auto=format&fit=crop",
  "f0000067-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=440&q=80&auto=format&fit=crop",
  "f0000071-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1610440042657-612c34d95e9f?w=440&q=80&auto=format&fit=crop",
  "f0000075-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1607013251379-e6eecfffe234?w=440&q=80&auto=format&fit=crop",
  "f0000069-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1520072959219-c595dc870360?w=440&q=80&auto=format&fit=crop",
  "f0000070-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1550317138-10000687a72b?w=440&q=80&auto=format&fit=crop",
  "f0000073-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=440&q=80&auto=format&fit=crop",
  "f0000047-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1593504049359-74330189a345?w=440&q=80&auto=format&fit=crop",
  "f0000043-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1595708684082-a173bb3a06c5?w=440&q=80&auto=format&fit=crop",
  "f0000049-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1581873372796-635b67ca2008?w=440&q=80&auto=format&fit=crop",
  "f0000050-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=440&q=80&auto=format&fit=crop",
  "f0000045-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=440&q=80&auto=format&fit=crop",
  "f0000042-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=440&q=80&auto=format&fit=crop",
  "f0000044-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=440&q=80&auto=format&fit=crop",
  "f0000046-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=440&q=80&auto=format&fit=crop",
  "f0000048-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1552539618-7eec9b4d1796?w=440&q=80&auto=format&fit=crop",
  "f0000093-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1518013431117-eb1465fa5752?w=440&q=80&auto=format&fit=crop",
  "f0000092-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=440&q=80&auto=format&fit=crop",
  "f0000091-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?w=440&q=80&auto=format&fit=crop",
  "f0000094-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1639024471283-03518883512d?w=440&q=80&auto=format&fit=crop",
  "f0000090-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1518013431117-eb1465fa5752?w=440&q=80&auto=format&fit=crop",
  "f0000026-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=440&q=80&auto=format&fit=crop",
  "f0000029-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=440&q=80&auto=format&fit=crop",
  "f0000030-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=440&q=80&auto=format&fit=crop",
  "f0000027-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=440&q=80&auto=format&fit=crop",
  "f0000038-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=440&q=80&auto=format&fit=crop",
  "f0000041-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1552539618-7eec9b4d1796?w=440&q=80&auto=format&fit=crop",
  "f0000036-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=440&q=80&auto=format&fit=crop",
  "f0000031-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1594007654729-407eedc4be65?w=440&q=80&auto=format&fit=crop",
  "f0000034-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1590947132387-155cc02f3212?w=440&q=80&auto=format&fit=crop",
  "f0000040-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1601924582970-9238bcb495d9?w=440&q=80&auto=format&fit=crop",
  "f0000039-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=440&q=80&auto=format&fit=crop",
  "f0000037-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1571066811602-716837d681de?w=440&q=80&auto=format&fit=crop",
  "f0000028-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1548369937-47519962c11a?w=440&q=80&auto=format&fit=crop",
  "f0000032-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1542834291-c514e77b215f?w=440&q=80&auto=format&fit=crop",
  "f0000033-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1593504049359-74330189a345?w=440&q=80&auto=format&fit=crop",
  "f0000035-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1595708684082-a173bb3a06c5?w=440&q=80&auto=format&fit=crop",
  "f0000062-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=440&q=80&auto=format&fit=crop",
  "f0000065-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=440&q=80&auto=format&fit=crop",
  "f0000063-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=440&q=80&auto=format&fit=crop",
  "f0000061-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=440&q=80&auto=format&fit=crop",
  "f0000064-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=440&q=80&auto=format&fit=crop",
  "f0000005-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1552539618-7eec9b4d1796?w=440&q=80&auto=format&fit=crop",
  "f0000008-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=440&q=80&auto=format&fit=crop",
  "f0000007-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1594007654729-407eedc4be65?w=440&q=80&auto=format&fit=crop",
  "f0000012-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1590947132387-155cc02f3212?w=440&q=80&auto=format&fit=crop",
  "f0000004-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1601924582970-9238bcb495d9?w=440&q=80&auto=format&fit=crop",
  "f0000009-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=440&q=80&auto=format&fit=crop",
  "f0000006-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1571066811602-716837d681de?w=440&q=80&auto=format&fit=crop",
  "f0000002-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1548369937-47519962c11a?w=440&q=80&auto=format&fit=crop",
  "f0000003-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1542834291-c514e77b215f?w=440&q=80&auto=format&fit=crop",
  "f0000013-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1593504049359-74330189a345?w=440&q=80&auto=format&fit=crop",
  "f0000001-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1595708684082-a173bb3a06c5?w=440&q=80&auto=format&fit=crop",
  "f0000010-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1581873372796-635b67ca2008?w=440&q=80&auto=format&fit=crop",
  "f0000014-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=440&q=80&auto=format&fit=crop",
  "f0000011-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=440&q=80&auto=format&fit=crop",
  "f0000085-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=440&q=80&auto=format&fit=crop",
  "f0000087-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=440&q=80&auto=format&fit=crop",
  "f0000080-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=440&q=80&auto=format&fit=crop",
  "f0000081-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1619535860434-ba1d8fa12536?w=440&q=80&auto=format&fit=crop",
  "f0000084-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=440&q=80&auto=format&fit=crop",
  "f0000077-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1619740455993-9e612b1af08a?w=440&q=80&auto=format&fit=crop",
  "f0000079-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1518013431117-eb1465fa5752?w=440&q=80&auto=format&fit=crop",
  "f0000088-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=440&q=80&auto=format&fit=crop",
  "f0000083-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?w=440&q=80&auto=format&fit=crop",
  "f0000086-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1639024471283-03518883512d?w=440&q=80&auto=format&fit=crop",
  "f0000078-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=440&q=80&auto=format&fit=crop",
  "f0000082-0000-0000-0000-000000000000": "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=440&q=80&auto=format&fit=crop",
};

function initPaynutsGateway() {
  const paynutsStatus = document.getElementById('dev-paynuts-status');
  const paynutsFields = document.getElementById('paynuts-payment-fields');
  const mockFields = document.getElementById('mock-payment-fields');
  
  let savedHost = localStorage.getItem('paynuts_host');
  if (!savedHost || savedHost === 'https://gateway.paynuts.com.au') {
    savedHost = 'https://gateway.tillpayments.com';
    localStorage.setItem('paynuts_host', savedHost);
  }
  let savedKey = localStorage.getItem('paynuts_key');
  if (!savedKey) {
    savedKey = '01d7ya36zbTps7Xmsaer__t';
    localStorage.setItem('paynuts_key', savedKey);
  }
  const savedMid = localStorage.getItem('paynuts_mid');
  
  // Fill inputs
  const hostInput = document.getElementById('dev-paynuts-host');
  const keyInput = document.getElementById('dev-paynuts-key');
  const midInput = document.getElementById('dev-paynuts-mid');
  if (hostInput) hostInput.value = savedHost;
  if (keyInput) keyInput.value = savedKey || '';
  if (midInput) midInput.value = savedMid || '';
  
  if (!savedKey) {
    paynutsInstance = null;
    if (paynutsStatus) {
      paynutsStatus.innerHTML = `
        <span class="status-dot offline"></span>
        <span class="status-text">PAYNUTS GATEWAY INACTIVE (MOCK ACTIVE)</span>
      `;
    }
    if (paynutsFields) paynutsFields.style.display = 'none';
    if (mockFields) mockFields.style.display = 'block';
    return;
  }
  
  if (paynutsStatus) {
    paynutsStatus.innerHTML = `
      <span class="status-dot online"></span>
      <span class="status-text" style="color: #10b981;">PAYNUTS ACTIVE (${savedHost})</span>
    `;
  }
  
  if (paynutsFields) paynutsFields.style.display = 'block';
  if (mockFields) mockFields.style.display = 'none';
  
  // Load PaymentJs script dynamically if not loaded
  const scriptId = 'paynuts-paymentjs-script';
  let script = document.getElementById(scriptId);
  
  const initPaymentLibrary = () => {
    try {
      if (typeof PaymentJs === 'undefined') {
        console.error("PaymentJs not defined after loading script.");
        return;
      }
      
      // Instantiate PaymentJs client
      paynutsInstance = new PaymentJs("1.2");
      paynutsInstance.init(savedKey, 'paynuts-card-number', 'paynuts-cvc', function(instance) {
        console.log("Paynuts secure fields initialized successfully.");
        
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const textColor = currentTheme === 'dark' ? '#e2dcd5' : '#111111';
        const placeholderColor = currentTheme === 'dark' ? '#9a9286' : '#6b7280';
        
        // Add styling styles for font inside iframe
        instance.setNumberStyle({
          'font-family': 'Outfit, sans-serif',
          'font-size': '15px',
          'color': textColor,
          'placeholder': {
            'color': placeholderColor
          }
        });
        instance.setCvvStyle({
          'font-family': 'Outfit, sans-serif',
          'font-size': '15px',
          'color': textColor,
          'placeholder': {
            'color': placeholderColor
          }
        });

        // Focus/blur styling handled via CSS :focus-within on iframe containers
      });
    } catch (err) {
      console.error("Paynuts initialization failed:", err);
    }
  };
  
  if (!script) {
    script = document.createElement('script');
    script.id = scriptId;
    script.src = `${savedHost}/js/integrated/payment.1.3.min.js`;
    script.setAttribute('data-main', 'payment-js');
    script.onload = initPaymentLibrary;
    script.onerror = () => {
      console.warn("Failed to load Paynuts script from gateway. Falling back to local script copy.");
      if (script && script.parentNode) script.parentNode.removeChild(script);
      
      const fallbackScript = document.createElement('script');
      fallbackScript.id = scriptId;
      fallbackScript.src = 'assets/payment.1.3.min.js';
      fallbackScript.setAttribute('data-main', 'payment-js');
      fallbackScript.onload = initPaymentLibrary;
      fallbackScript.onerror = () => {
        console.error("Failed to load both remote and local Paynuts scripts.");
        if (paynutsStatus) {
          paynutsStatus.innerHTML = `
            <span class="status-dot offline"></span>
            <span class="status-text">FAILED TO LOAD PAYNUTS SCRIPT</span>
          `;
        }
      };
      document.head.appendChild(fallbackScript);
    };
    document.head.appendChild(script);
  } else {
    // If script is already loaded, re-initialize
    if (typeof PaymentJs !== 'undefined') {
      initPaymentLibrary();
    } else {
      script.onload = initPaymentLibrary;
    }
  }
}

function saveDevSettings() {
  const url = document.getElementById('dev-supabase-url').value.trim();
  const key = document.getElementById('dev-supabase-key').value.trim();
  const paynutsHost = document.getElementById('dev-paynuts-host').value.trim();
  const paynutsKey = document.getElementById('dev-paynuts-key').value.trim();
  const paynutsMid = document.getElementById('dev-paynuts-mid').value.trim();
  
  if (url && key) {
    localStorage.setItem('supabase_offline', 'false');
    localStorage.setItem('supabase_url', url);
    localStorage.setItem('supabase_key', key);
  } else {
    localStorage.setItem('supabase_offline', 'true');
    localStorage.removeItem('supabase_url');
    localStorage.removeItem('supabase_key');
  }

  if (paynutsKey) {
    localStorage.setItem('paynuts_host', paynutsHost || 'https://gateway.tillpayments.com');
    localStorage.setItem('paynuts_key', paynutsKey);
    if (paynutsMid) {
      localStorage.setItem('paynuts_mid', paynutsMid);
    } else {
      localStorage.removeItem('paynuts_mid');
    }
  } else {
    localStorage.removeItem('paynuts_host');
    localStorage.removeItem('paynuts_key');
    localStorage.removeItem('paynuts_mid');
  }
  
  initSupabase();
  initPaynutsGateway();
  alert("Developer configurations applied successfully!");
  toggleDevPanel();
}

function clearDevSettings() {
  localStorage.setItem('supabase_offline', 'true');
  localStorage.removeItem('supabase_url');
  localStorage.removeItem('supabase_key');
  localStorage.removeItem('paynuts_host');
  localStorage.removeItem('paynuts_key');
  localStorage.removeItem('paynuts_mid');
  
  const urlInput = document.getElementById('dev-supabase-url');
  const keyInput = document.getElementById('dev-supabase-key');
  const hostInput = document.getElementById('dev-paynuts-host');
  const keyPaynutsInput = document.getElementById('dev-paynuts-key');
  const midPaynutsInput = document.getElementById('dev-paynuts-mid');
  
  if (urlInput) urlInput.value = '';
  if (keyInput) keyInput.value = '';
  if (hostInput) hostInput.value = 'https://gateway.tillpayments.com';
  if (keyPaynutsInput) keyPaynutsInput.value = '';
  if (midPaynutsInput) midPaynutsInput.value = '';

  initSupabase();
  initPaynutsGateway();
  alert("Settings cleared. Switched to offline mock operations.");
  toggleDevPanel();
  renderDefaultReviews();
}

async function fetchSupabaseReviews() {
  if (!supabaseClient) return;
  try {
    const { data, error } = await supabaseClient
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (error) {
      console.error("Failed to load reviews:", error);
      return;
    }
    
    if (data && data.length > 0) {
      renderReviews(data);
      try {
        const _avg = data.reduce((s,r)=>s+(Number(r.rating)||0),0)/data.length;
        setTimeout(()=>{ const _el=[...document.querySelectorAll('.proof-number')].find(e=>e.textContent.includes('★')); if(_el) _el.textContent=_avg.toFixed(1)+'★'; }, 1300);
      } catch(_e){}
    }
  } catch (err) {
    console.error("Reviews connection error:", err);
  }
}

async function fetchSupabaseProducts() {
  if (!supabaseClient) {
    loadOfflineMockData();
    return;
  }
  try {
    const { data, error } = await supabaseClient
      .from('products')
      .select('*')
      .order('name');
      
    if (error) {
      console.error("Failed to load products from database:", error);
      loadOfflineMockData();
      return;
    }
    
    if (data && data.length > 0) {
      databaseProducts = data;
      renderDynamicProducts();
    } else {
      loadOfflineMockData();
    }
  } catch (err) {
    console.error("Products connection error:", err);
    loadOfflineMockData();
  }
}

async function fetchSupabaseCategories() {
  if (!supabaseClient) {
    loadOfflineMockData();
    return;
  }
  try {
    const { data, error } = await supabaseClient
      .from('categories')
      .select('*')
      .order('name');
      
    if (error) {
      console.error("Failed to load categories from database:", error);
      loadOfflineMockData();
      return;
    }
    
    if (data && data.length > 0) {
      databaseCategories = data;
      renderDynamicCategories();
    } else {
      loadOfflineMockData();
    }
  } catch (err) {
    console.error("Categories connection error:", err);
    loadOfflineMockData();
  }
}

function renderDynamicCategories() {
  const filterContainer = document.getElementById('category-filters');
  if (!filterContainer) return;

  const catEmoji = {
    'All':               '🍽️',
    'Traditional Pizzas':'🍕',
    'Extra Value Pizza': '🍕',
    'Value Pizza':       '🍕',
    'Bollywood Range':   '🌶️',
    'Hungry Special':    '⭐',
    'Gourmet Burgers':   '🍔',
    'Value Burgers':     '🍔',
    'Chicken Wings':     '🍗',
    'Loaded Fries':      '🍟',
    'Value Sides':       '🥗',
    'Desserts':          '🍰',
  };

  const icon = (name) => catEmoji[name] ? `<span class="pill-icon">${catEmoji[name]}</span>` : '';

  let html = `<button class="filter-pill ${selectedCategory === 'All' ? 'active' : ''}" onclick="filterCategory('All')">${icon('All')}All</button>`;
  
  databaseCategories.forEach(cat => {
    html += `<button class="filter-pill ${selectedCategory === cat.name ? 'active' : ''}" onclick="filterCategory('${cat.name}')">${icon(cat.name)}${cat.name}</button>`;
  });
  
  filterContainer.innerHTML = html;
}

window.PRODUCT_RATINGS = {};
async function fetchProductRatings() {
  if (!supabaseClient) return;
  try {
    const { data, error } = await supabaseClient.from('product_rating_stats').select('*');
    if (error) { console.warn('ratings load failed:', error.message); return; }
    const map = {};
    (data || []).forEach(r => { map[r.product_id] = { avg: Number(r.avg), cnt: Number(r.cnt) }; });
    window.PRODUCT_RATINGS = map;
    if (typeof renderDynamicProducts === 'function') renderDynamicProducts();
  } catch (e) { console.warn('ratings error:', e); }
}
function ratingStarsHTML(pid) {
  const s = window.PRODUCT_RATINGS && window.PRODUCT_RATINGS[pid];
  if (!s || !s.cnt) return '<span class="plc-rate-empty">☆☆☆☆☆ <em>Rate this</em></span>';
  const full = Math.max(0, Math.min(5, Math.round(s.avg)));
  return '★'.repeat(full) + '☆'.repeat(5 - full) + ' <span>' + s.avg.toFixed(1) + '</span> <em>(' + s.cnt + ')</em>';
}

function renderDynamicProducts() {
  const track = document.getElementById('product-showcase-track');
  if (!track) return;

  let filtered = databaseProducts;
  if (selectedCategory !== 'All') filtered = filtered.filter(p => p.category === selectedCategory);
  if (vegMode === 'veg') filtered = filtered.filter(p => p.is_veg === true);
  else if (vegMode === 'nonveg') filtered = filtered.filter(p => p.is_veg === false);
  if (searchQuery) filtered = filtered.filter(p =>
    p.name.toLowerCase().includes(searchQuery) ||
    (p.description && p.description.toLowerCase().includes(searchQuery))
  );

  if (filtered.length === 0) {
    track.innerHTML = `<div class="no-products-msg" style="padding:40px;color:var(--text-muted);text-align:center;width:100%;">No products found.</div>`;
    return;
  }

  // Multiple images per category — rotate by index so each card looks different
  const _imgPools = {
    'Traditional Pizzas': [
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=420&q=80&fit=crop',
    ],
    'Extra Value Pizza': [
      'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1552539618-7eec9b4d1796?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=420&q=80&fit=crop',
    ],
    'Value Pizza': [
      'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1552539618-7eec9b4d1796?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=420&q=80&fit=crop',
    ],
    'Bollywood Range': [
      'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=420&q=80&fit=crop',
    ],
    'Hungry Special': [
      'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=420&q=80&fit=crop',
    ],
    'Gourmet Burgers': [
      'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1610440042657-612c34d95e9f?w=420&q=80&fit=crop',
    ],
    'Value Burgers': [
      'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=420&q=80&fit=crop',
    ],
    'Chicken Wings': [
      'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=420&q=80&fit=crop',
    ],
    'Loaded Fries': [
      'https://images.unsplash.com/photo-1518013431117-eb1465fa5752?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=420&q=80&fit=crop',
    ],
    'Value Sides': [
      'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1518013431117-eb1465fa5752?w=420&q=80&fit=crop',
    ],
    'Desserts': [
      'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=420&q=80&fit=crop',
    ],
  };
  const _default = ['https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=420&q=80&fit=crop'];

  // Track index per category for rotation
  const _catIdx = {};

  // Group products by category for section-based bento layout
  const byCat = {};
  const catOrder = [];
  filtered.forEach(p => {
    if (!p.is_available) return;
    if (!byCat[p.category]) { byCat[p.category] = []; catOrder.push(p.category); }
    byCat[p.category].push(p);
  });
  const buildCard = (p) => {
    const pool = _imgPools[p.category] || _default;
    _catIdx[p.category] = (_catIdx[p.category] || 0);
    const img = p.image_url || (window.PRODUCT_IMAGES && window.PRODUCT_IMAGES[p.id]) || pool[_catIdx[p.category] % pool.length];
    _catIdx[p.category]++;
    const safeName = p.name.replace(/'/g, "\'");
    const featured = p.category === 'Hungry Special';
    return `
      <div class="plc ${featured ? 'plc-featured' : ''}" data-pizza-id="${p.id}" data-name="${p.name}" data-price="${p.price}">
        <div class="plc-img-wrap">
          <div class="plc-veg-badge ${p.is_veg ? 'veg' : 'nonveg'}" title="${p.is_veg ? 'Veg' : 'Non-Veg'}"></div>
          ${p.video_url ? `<video class="plc-img plc-video" data-src="${p.video_url}" poster="${p.video_poster || img}" muted loop playsinline preload="none" aria-label="${p.name}"></video><span class="plc-video-badge" aria-hidden="true">▶</span>` : `<img src="${img}" alt="${p.name}" class="plc-img" loading="lazy">`}
          ${featured ? '<span class="plc-flag-overlay">★ TOP PICK</span>' : ''}
          <div class="plc-img-overlay">
            <div class="plc-stars-overlay" title="Tap to rate" onclick="event.stopPropagation();openReviewModal('${p.id}','${safeName}')">${ratingStarsHTML(p.id)}</div>
          </div>
          <button class="plc-quick-add" onclick="addProductToCart('${p.id}','${safeName}',${p.price},'${img}')" aria-label="Add ${p.name}">+</button>
        </div>
        <div class="plc-body">
          <h3 class="plc-name">${p.name}</h3>
          <p class="plc-desc">${p.description || ''}</p>
          <div class="plc-foot-clean">
            <div class="plc-price">$${Number(p.price).toFixed(2)}</div>
            <button class="plc-add-btn" onclick="addProductToCart('${p.id}','${safeName}',${p.price},'${img}')">+ Add</button>
          </div>
        </div>
      </div>
    `;
  };
  track.innerHTML = catOrder.map(cat => `
    <div class="menu-cat-section">
      <div class="menu-cat-header">
        <span class="menu-cat-accent"></span>
        <h2 class="menu-cat-title">${cat}</h2>
        <span class="menu-cat-count">${byCat[cat].length} item${byCat[cat].length===1?'':'s'}</span>
      </div>
      <div class="menu-cat-grid">
        ${byCat[cat].map(buildCard).join('')}
      </div>
    </div>
  `).join('');
  if (typeof syncMenuCardSteppers === 'function') syncMenuCardSteppers();
  if (typeof initVideoCardObserver === 'function') initVideoCardObserver();
}

function filterCategory(categoryName) {
  selectedCategory = categoryName;
  
  const pills = document.querySelectorAll('#category-filters .filter-pill');
  pills.forEach(pill => {
    if (pill.innerText.trim() === categoryName) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });
  
  renderDynamicProducts();
}

// Search handlers
window.handleSearch = function(event) {
  searchQuery = event.target.value.toLowerCase().trim();
  const clearBtn = document.getElementById('clear-search-btn');
  if (clearBtn) {
    clearBtn.style.display = searchQuery ? 'block' : 'none';
  }
  renderDynamicProducts();
};

window.clearSearch = function() {
  const input = document.getElementById('menu-search-input');
  if (input) input.value = '';
  searchQuery = '';
  const clearBtn = document.getElementById('clear-search-btn');
  if (clearBtn) clearBtn.style.display = 'none';
  renderDynamicProducts();
};

function renderReviews(reviewsList) {
  const track = document.querySelector('.testimonials-track');
  if (!track) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  track.innerHTML = reviewsList.map(r => {
    const rt = Math.max(0, Math.min(5, Number(r.rating) || 0));
    const name = esc(r.customer_name || 'Anonymous');
    return `
    <div class="review-card glass-card">
      <div class="review-rating">${'⭐'.repeat(rt)}${'•'.repeat(5 - rt)}</div>
      <p>"${esc(r.comment)}"</p>
      <div class="reviewer-meta">
        <div class="reviewer-avatar">${name.charAt(0)}</div>
        <div>
          <h4>${name}</h4>
          <span>${esc(r.neighborhood || 'Hamilton')}, Hamilton</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderDefaultReviews() {
  const track = document.querySelector('.testimonials-track');
  if (!track) return;
  track.innerHTML = `
    <div class="review-card glass-card">
      <div class="review-rating">⭐⭐⭐⭐•</div>
      <p>"The Hamilton Hero arrives so fast the cheese stretch is still structural. This is food delivery at Tesla-level efficiency."</p>
      <div class="reviewer-meta">
        <div class="reviewer-avatar">S</div>
        <div>
          <h4>Sarah Connor</h4>
          <span>Hillcrest, Hamilton</span>
        </div>
      </div>
    </div>
    <div class="review-card glass-card">
      <div class="review-rating">⭐⭐⭐⭐⭐</div>
      <p>"Truffle White pizza is absolute perfection. Crust has those beautiful woodfire charcoal bubbles. Incredible food tech platform!"</p>
      <div class="reviewer-meta">
        <div class="reviewer-avatar">L</div>
        <div>
          <h4>Liam Miller</h4>
          <span>Rototuna, Hamilton</span>
        </div>
      </div>
    </div>
    <div class="review-card glass-card">
      <div class="review-rating">⭐⭐⭐⭐⭐</div>
      <p>"Customizing toppings with instant pricing was amazing. The order was on my table in 22 minutes. Outstanding."</p>
      <div class="reviewer-meta">
        <div class="reviewer-avatar">E</div>
        <div>
          <h4>Emma Watson</h4>
          <span>Ruakura, Hamilton</span>
        </div>
      </div>
    </div>
  `;
}

// ========================================================
// 1. HERO MOUSE PARALLAX EFFECT
// ========================================================
function initParallaxHero() {
  const hero = document.querySelector('.hero-section');
  const items = document.querySelectorAll('.floating-ingredient');
  const imgWrapper = document.querySelector('.hero-pizza-wrapper');
  
  if (!hero) return;

  hero.addEventListener('mousemove', (e) => {
    const { clientX, clientY } = e;
    const { width, height, left, top } = hero.getBoundingClientRect();
    const x = (clientX - left) / width - 0.5; // range -0.5 to 0.5
    const y = (clientY - top) / height - 0.5;

    // Translate floating elements at different depths
    items.forEach(item => {
      const speed = parseFloat(item.getAttribute('data-speed')) || 1;
      const offsetX = x * 80 * speed;
      const offsetY = y * 80 * speed;
      item.style.transform = `translate(${offsetX}px, ${offsetY}px) rotate(${offsetX * 0.1}deg)`;
    });

    // Tilt the main pizza slightly
    if (imgWrapper) {
      const tiltX = y * 15;
      const tiltY = -x * 15;
      imgWrapper.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
    }
  });

  hero.addEventListener('mouseleave', () => {
    items.forEach(item => {
      item.style.transform = 'translate(0px, 0px) rotate(0deg)';
    });
    if (imgWrapper) {
      imgWrapper.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
    }
  });
}

// ========================================================
// 2. SCROLL ANIMATIONS TIMELINE FALLBACK
// ========================================================
function initScrollAnimations() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    console.warn("GSAP or ScrollTrigger not loaded. Scroll animations inactive.");
    return;
  }

  // Register ScrollTrigger plugin
  gsap.registerPlugin(ScrollTrigger);

  // 1. Timeline Progress Fill Animation
  const timeline = document.querySelector('.timeline-container');
  const fill = document.querySelector('.timeline-progress-fill');
  if (timeline && fill) {
    gsap.fromTo(fill, 
      { height: '0%' },
      {
        height: '100%',
        ease: 'none',
        scrollTrigger: {
          trigger: timeline,
          start: 'top center',
          end: 'bottom center',
          scrub: true
        }
      }
    );
  }

  // 2. Timeline Item Node Reveals
  const items = document.querySelectorAll('.timeline-item');
  items.forEach((item) => {
    gsap.fromTo(item, 
      { opacity: 0, y: 50 },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        scrollTrigger: {
          trigger: item,
          start: 'top 80%',
          toggleActions: 'play none none reverse',
          onEnter: () => item.classList.add('timeline-active'),
          onLeaveBack: () => item.classList.remove('timeline-active')
        }
      }
    );
  });

  // 3. Section Header Entrance animations
  const sections = document.querySelectorAll('.story-section, .featured-section, .builder-section, .delivery-section, .tracker-section, .offers-section, .reviews-section');
  sections.forEach(sec => {
    const header = sec.querySelector('.section-header');
    if (header) {
      gsap.fromTo(header,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          scrollTrigger: {
            trigger: sec,
            start: 'top 85%',
            toggleActions: 'play none none reverse'
          }
        }
      );
    }
  });

  // 4. Hero Parallax Ingredients Scroll Animation
  const floatingItems = document.querySelectorAll('.floating-ingredient');
  floatingItems.forEach(el => {
    const speed = parseFloat(el.getAttribute('data-speed')) || 1.5;
    gsap.to(el, {
      y: -150 * speed,
      rotate: 15 * speed,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hero-section',
        start: 'top top',
        end: 'bottom top',
        scrub: true
      }
    });
  });
}

// ========================================================
// 3. UTILITIES & SCROLL HELPER
// ========================================================
function scrollToSection(id) {
  const element = document.getElementById(id);
  if (element) {
    const headerHeight = 80;
    const offset = element.offsetTop - headerHeight;
    window.scrollTo({
      top: offset,
      behavior: 'smooth'
    });
  }
}

// ========================================================
// 4. PIZZA BUILDER LAB LOGIC
// ========================================================
const builderState = {
  crust: 'neapolitan',
  sauce: 'tomato',
  cheese: 'normal',
  toppings: new Set()
};

const builderPrices = {
  base: 18.00,
  crust: { neapolitan: 0.00, 'thin-crispy': 1.00, 'gluten-free': 3.00 },
  sauce: { tomato: 0.00, truffle: 2.00, bbq: 0.00 },
  cheese: { light: -0.50, normal: 0.00, double: 2.50, vegan: 2.00 },
  toppingCost: 2.00
};

// Coordinate mapping for top-down topping layout distribution
const toppingCoordinates = [
  { top: '30%', left: '35%' }, { top: '35%', left: '60%' }, { top: '55%', left: '28%' },
  { top: '65%', left: '50%' }, { top: '48%', left: '46%' }, { top: '22%', left: '50%' },
  { top: '60%', left: '68%' }, { top: '40%', left: '20%' }, { top: '75%', left: '38%' },
  { top: '28%', left: '22%' }, { top: '25%', left: '62%' }, { top: '70%', left: '25%' },
  { top: '52%', left: '75%' }, { top: '18%', left: '38%' }
];

// Three.js 3D Hero Pizza Globals & Functions
let hero3D = {
  scene: null,
  camera: null,
  renderer: null,
  pizzaGroup: null,
  textures: {}
};

function initHero3D() {
  if (typeof THREE === 'undefined') {
    console.warn("Three.js not loaded. 3D hero pizza canvas inactive.");
    return;
  }
  const canvas = document.getElementById('hero-3d-canvas');
  if (!canvas) return;

  try {
    const scene = new THREE.Scene();
    hero3D.scene = scene;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(0, 5, 7.5);
    camera.lookAt(0, 0, 0);
    hero3D.camera = camera;

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(420, 420);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    hero3D.renderer = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xfff5ea, 0.6, 15);
    pointLight.position.set(0, 4, 3);
    scene.add(pointLight);

    const pizzaGroup = new THREE.Group();
    scene.add(pizzaGroup);
    hero3D.pizzaGroup = pizzaGroup;

    // Load textures
    const textureLoader = new THREE.TextureLoader();
    hero3D.textures.crust = textureLoader.load('assets/hero-pizza.png');
    hero3D.textures.pepperoni = textureLoader.load('assets/pepperoni.png');
    hero3D.textures.basil = textureLoader.load('assets/basil.png');
    hero3D.textures.jalapeno = textureLoader.load('assets/jalapeno.png');

    // Crust Mesh
    const crustGeo = new THREE.CylinderGeometry(2.7, 2.8, 0.35, 32);
    const crustMat = new THREE.MeshStandardMaterial({
      map: hero3D.textures.crust,
      roughness: 0.85,
      metalness: 0.05
    });
    const crustMesh = new THREE.Mesh(crustGeo, crustMat);
    crustMesh.position.y = 0.15;
    pizzaGroup.add(crustMesh);

    // Sauce Mesh
    const sauceGeo = new THREE.CylinderGeometry(2.5, 2.5, 0.04, 32);
    const sauceMat = new THREE.MeshStandardMaterial({
      color: 0xcc1100,
      roughness: 0.6
    });
    const sauceMesh = new THREE.Mesh(sauceGeo, sauceMat);
    sauceMesh.position.y = 0.31;
    pizzaGroup.add(sauceMesh);

    // Cheese Mesh
    const cheeseGeo = new THREE.CylinderGeometry(2.4, 2.4, 0.04, 32);
    const cheeseMat = new THREE.MeshStandardMaterial({
      color: 0xfff8db,
      roughness: 0.4,
      transparent: true,
      opacity: 0.8
    });
    const cheeseMesh = new THREE.Mesh(cheeseGeo, cheeseMat);
    cheeseMesh.position.y = 0.33;
    pizzaGroup.add(cheeseMesh);

    // Add Toppings (Pepperoni, Basil, Jalapeños)
    const toppingsGroup = new THREE.Group();
    pizzaGroup.add(toppingsGroup);

    // Pepperoni positions
    const pepPositions = [
      { r: 0.6, angle: 0 }, { r: 1.2, angle: Math.PI / 4 }, { r: 1.3, angle: 3 * Math.PI / 4 },
      { r: 1.4, angle: 5 * Math.PI / 4 }, { r: 1.2, angle: 7 * Math.PI / 4 }, { r: 2.0, angle: Math.PI / 8 },
      { r: 2.1, angle: 5 * Math.PI / 8 }, { r: 1.9, angle: 9 * Math.PI / 8 }, { r: 2.0, angle: 13 * Math.PI / 8 }
    ];
    pepPositions.forEach(pos => {
      const px = Math.cos(pos.angle) * pos.r;
      const pz = Math.sin(pos.angle) * pos.r;
      const py = 0.355 + Math.random() * 0.01;
      const geo = new THREE.CylinderGeometry(0.3, 0.3, 0.03, 16);
      const mat = new THREE.MeshStandardMaterial({ map: hero3D.textures.pepperoni, roughness: 0.5 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(px, py, pz);
      mesh.rotation.set(Math.random() * 0.05, Math.random() * Math.PI * 2, Math.random() * 0.05);
      toppingsGroup.add(mesh);
    });

    // Basil positions
    const basilPositions = [
      { r: 0.8, angle: Math.PI / 3 }, { r: 1.0, angle: 4 * Math.PI / 3 }, { r: 1.6, angle: 11 * Math.PI / 6 },
      { r: 1.7, angle: 7 * Math.PI / 6 }
    ];
    basilPositions.forEach(pos => {
      const px = Math.cos(pos.angle) * pos.r;
      const pz = Math.sin(pos.angle) * pos.r;
      const py = 0.365 + Math.random() * 0.01;
      const geo = new THREE.PlaneGeometry(0.38, 0.26);
      const mat = new THREE.MeshStandardMaterial({ map: hero3D.textures.basil, transparent: true, side: THREE.DoubleSide, roughness: 0.9 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(px, py, pz);
      mesh.rotation.set(-Math.PI / 2 + (Math.random() * 0.1), Math.random() * Math.PI * 2, Math.random() * 0.2 - 0.1);
      toppingsGroup.add(mesh);
    });

    // Jalapeno positions
    const jalaPositions = [
      { r: 0.9, angle: 5 * Math.PI / 6 }, { r: 1.5, angle: Math.PI / 6 }, { r: 1.8, angle: 3 * Math.PI / 2 }
    ];
    jalaPositions.forEach(pos => {
      const px = Math.cos(pos.angle) * pos.r;
      const pz = Math.sin(pos.angle) * pos.r;
      const py = 0.358 + Math.random() * 0.005;
      const geo = new THREE.PlaneGeometry(0.3, 0.3);
      const mat = new THREE.MeshStandardMaterial({ map: hero3D.textures.jalapeno, transparent: true, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(px, py, pz);
      mesh.rotation.set(-Math.PI / 2, Math.random() * Math.PI * 2, 0);
      toppingsGroup.add(mesh);
    });

    // Rotation Loop
    function animate() {
      requestAnimationFrame(animate);
      pizzaGroup.rotation.y += 0.004;
      renderer.render(scene, camera);
    }
    animate();

    // Mouse tilt interaction
    const heroSection = document.querySelector('.hero-section');
    if (heroSection) {
      heroSection.addEventListener('mousemove', (e) => {
        const { clientX, clientY } = e;
        const { width, height, left, top } = heroSection.getBoundingClientRect();
        const x = (clientX - left) / width - 0.5;
        const y = (clientY - top) / height - 0.5;

        pizzaGroup.rotation.z = -x * 0.4;
        pizzaGroup.rotation.x = y * 0.4;
      });

      heroSection.addEventListener('mouseleave', () => {
        pizzaGroup.rotation.z = 0;
        pizzaGroup.rotation.x = 0;
      });
    }
  } catch (e) {
    console.error("Three.js Hero Pizza load failed:", e);
  }
}

// Three.js 3D Pizza Builder Globals & Functions
let pizza3D = {
  scene: null,
  camera: null,
  renderer: null,
  pizzaGroup: null,
  crustMesh: null,
  sauceMesh: null,
  cheeseMesh: null,
  toppingGroups: {},
  textures: {},
  isDragging: false,
  previousMousePosition: { x: 0, y: 0 }
};

function initPizza3D() {
  if (typeof THREE === 'undefined') {
    console.warn("Three.js not loaded. 3D pizza constructor inactive.");
    return;
  }
  const canvas = document.getElementById('pizza-3d-canvas');
  if (!canvas) return;

  try {
    const scene = new THREE.Scene();
    pizza3D.scene = scene;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(0, 5.5, 7);
    camera.lookAt(0, 0.3, 0);
    pizza3D.camera = camera;

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(320, 320);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    pizza3D.renderer = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xfff5ea, 0.6, 15);
    pointLight.position.set(0, 4, 3);
    scene.add(pointLight);

    const pizzaGroup = new THREE.Group();
    scene.add(pizzaGroup);
    pizza3D.pizzaGroup = pizzaGroup;

    // Load textures
    const textureLoader = new THREE.TextureLoader();
    pizza3D.textures.crust = textureLoader.load('assets/hero-pizza.png');
    pizza3D.textures.pepperoni = textureLoader.load('assets/pepperoni.png');
    pizza3D.textures.basil = textureLoader.load('assets/basil.png');
    pizza3D.textures.jalapeno = textureLoader.load('assets/jalapeno.png');
    pizza3D.textures.cheese = textureLoader.load('assets/cheese-slice.png');

    // Crust Mesh
    const crustGeo = new THREE.CylinderGeometry(2.5, 2.6, 0.3, 32);
    const crustMat = new THREE.MeshStandardMaterial({
      map: pizza3D.textures.crust,
      roughness: 0.85,
      metalness: 0.05
    });
    pizza3D.crustMesh = new THREE.Mesh(crustGeo, crustMat);
    pizza3D.crustMesh.position.y = 0.15;
    pizzaGroup.add(pizza3D.crustMesh);

    // Sauce Mesh
    const sauceGeo = new THREE.CylinderGeometry(2.3, 2.3, 0.04, 32);
    const sauceMat = new THREE.MeshStandardMaterial({
      color: 0xcc1100,
      roughness: 0.6
    });
    pizza3D.sauceMesh = new THREE.Mesh(sauceGeo, sauceMat);
    pizza3D.sauceMesh.position.y = 0.31;
    pizzaGroup.add(pizza3D.sauceMesh);

    // Cheese Mesh
    const cheeseGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.04, 32);
    const cheeseMat = new THREE.MeshStandardMaterial({
      color: 0xfff8db,
      roughness: 0.4,
      transparent: true,
      opacity: 0.75
    });
    pizza3D.cheeseMesh = new THREE.Mesh(cheeseGeo, cheeseMat);
    pizza3D.cheeseMesh.position.y = 0.33;
    pizzaGroup.add(pizza3D.cheeseMesh);

    // Topping Groups
    const toppings = ['pepperoni', 'basil', 'jalapeno', 'mushrooms', 'chicken', 'onions'];
    toppings.forEach(t => {
      const group = new THREE.Group();
      pizzaGroup.add(group);
      pizza3D.toppingGroups[t] = group;
    });

    // Rotation Drag interaction
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const startDrag = (x, y) => {
      isDragging = true;
      previousMousePosition = { x, y };
    };

    const moveDrag = (x, y) => {
      if (!isDragging) return;
      const deltaX = x - previousMousePosition.x;
      const deltaY = y - previousMousePosition.y;

      pizzaGroup.rotation.y += deltaX * 0.008;
      pizzaGroup.rotation.x += deltaY * 0.008;
      pizzaGroup.rotation.x = Math.max(-0.4, Math.min(0.8, pizzaGroup.rotation.x));

      previousMousePosition = { x, y };
    };

    const endDrag = () => {
      isDragging = false;
    };

    canvas.addEventListener('mousedown', (e) => startDrag(e.clientX, e.clientY));
    canvas.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
    window.addEventListener('mouseup', endDrag);

    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) startDrag(e.touches[0].clientX, e.touches[0].clientY);
    });
    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });
    window.addEventListener('touchend', endDrag);

    function animate() {
      requestAnimationFrame(animate);
      if (!isDragging) {
        pizzaGroup.rotation.y += 0.002;
      }
      renderer.render(scene, camera);
    }
    animate();

    update3DPizza();
  } catch (e) {
    console.error("Three.js initialization error:", e);
  }
}

function update3DPizza() {
  if (!pizza3D.scene) return;

  if (pizza3D.sauceMesh) {
    let sauceColor = 0xcc1100;
    if (builderState.sauce === 'truffle') sauceColor = 0xf5edd7;
    if (builderState.sauce === 'bbq') sauceColor = 0x5a1807;
    pizza3D.sauceMesh.material.color.setHex(sauceColor);
  }

  if (pizza3D.cheeseMesh) {
    let cheeseColor = 0xfff8db;
    let opacity = 0.75;
    
    if (builderState.cheese === 'light') {
      opacity = 0.4;
    } else if (builderState.cheese === 'normal') {
      opacity = 0.75;
    } else if (builderState.cheese === 'double') {
      cheeseColor = 0xfacc15;
      opacity = 0.95;
    } else if (builderState.cheese === 'vegan') {
      cheeseColor = 0xffedd5;
      opacity = 0.7;
    }
    
    pizza3D.cheeseMesh.material.color.setHex(cheeseColor);
    pizza3D.cheeseMesh.material.opacity = opacity;
  }

  const toppingsList = ['pepperoni', 'basil', 'jalapeno', 'mushrooms', 'chicken', 'onions'];
  toppingsList.forEach(t => {
    const group = pizza3D.toppingGroups[t];
    if (!group) return;
    
    while(group.children.length > 0) {
      group.remove(group.children[0]);
    }
    
    if (builderState.toppings.has(t)) {
      generate3DToppingItems(t, group);
    }
  });
}

function generate3DToppingItems(topping, group) {
  if (typeof THREE === 'undefined') return;
  const count = 9;
  const positions = [
    { r: 0.6, angle: 0 },
    { r: 1.1, angle: Math.PI / 4 },
    { r: 1.2, angle: 3 * Math.PI / 4 },
    { r: 1.3, angle: 5 * Math.PI / 4 },
    { r: 1.1, angle: 7 * Math.PI / 4 },
    { r: 1.8, angle: Math.PI / 8 },
    { r: 1.9, angle: 5 * Math.PI / 8 },
    { r: 1.7, angle: 9 * Math.PI / 8 },
    { r: 1.8, angle: 13 * Math.PI / 8 }
  ];

  positions.forEach((pos, idx) => {
    const x = Math.cos(pos.angle) * pos.r;
    const z = Math.sin(pos.angle) * pos.r;
    const y = 0.35 + Math.random() * 0.02;

    let mesh;

    if (topping === 'pepperoni') {
      const geo = new THREE.CylinderGeometry(0.28, 0.28, 0.03, 16);
      const mat = new THREE.MeshStandardMaterial({
        map: pizza3D.textures.pepperoni,
        roughness: 0.5
      });
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.rotation.set(
        Math.random() * 0.1,
        Math.random() * Math.PI * 2,
        Math.random() * 0.1
      );
    } 
    else if (topping === 'basil') {
      const geo = new THREE.PlaneGeometry(0.35, 0.24);
      const mat = new THREE.MeshStandardMaterial({
        map: pizza3D.textures.basil,
        transparent: true,
        side: THREE.DoubleSide,
        roughness: 0.9
      });
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y + 0.015, z);
      mesh.rotation.set(
        -Math.PI / 2 + (Math.random() * 0.15 - 0.075),
        Math.random() * Math.PI * 2,
        Math.random() * 0.2 - 0.1
      );
    } 
    else if (topping === 'jalapeno') {
      const geo = new THREE.PlaneGeometry(0.28, 0.28);
      const mat = new THREE.MeshStandardMaterial({
        map: pizza3D.textures.jalapeno,
        transparent: true,
        side: THREE.DoubleSide
      });
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y + 0.008, z);
      mesh.rotation.set(
        -Math.PI / 2,
        Math.random() * Math.PI * 2,
        0
      );
    } 
    else if (topping === 'onions') {
      const geo = new THREE.TorusGeometry(0.2, 0.03, 6, 12, Math.PI);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x86198f,
        roughness: 0.4
      });
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y + 0.03, z);
      mesh.rotation.set(
        Math.PI / 2 + (Math.random() * 0.2 - 0.1),
        Math.random() * Math.PI * 2,
        Math.random() * 0.1
      );
    } 
    else if (topping === 'mushrooms') {
      const mushGroup = new THREE.Group();
      const capGeo = new THREE.SphereGeometry(0.14, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const capMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.8 });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.scale.y = 0.5;
      cap.position.y = 0.06;
      mushGroup.add(cap);

      const stemGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.1, 8);
      const stemMat = new THREE.MeshStandardMaterial({ color: 0xfef08a });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = 0.02;
      mushGroup.add(stem);

      mushGroup.position.set(x, y, z);
      mushGroup.rotation.set(
        Math.random() * 0.3 - 0.15,
        Math.random() * Math.PI * 2,
        Math.random() * 0.3 - 0.15
      );
      mesh = mushGroup;
    } 
    else if (topping === 'chicken') {
      const geo = new THREE.BoxGeometry(0.12 + Math.random() * 0.08, 0.08 + Math.random() * 0.08, 0.12 + Math.random() * 0.08);
      const mat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 });
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y + 0.04, z);
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
    }

    if (mesh) {
      mesh.scale.set(0.01, 0.01, 0.01);
      group.add(mesh);
      if (window.Motion && typeof window.Motion.animate === 'function') {
        window.Motion.animate(mesh.scale, { x: 1, y: 1, z: 1 }, { duration: 0.35, ease: "backOut", delay: idx * 0.015 });
      } else {
        mesh.scale.set(1, 1, 1);
      }
    }
  });
}

function initBuilder() {
  const options = document.querySelectorAll('.option-btn');
  const toppings = document.querySelectorAll('.topping-btn');

  // Use crisp SVG sprites for the picker icons too (consistent with the pizza).
  toppings.forEach(b => { const tt = b.getAttribute('data-topping'); const th = b.querySelector('.topping-thumb'); if (th) th.innerHTML = toppingSVG(tt); });

  // Handle Crust, Sauce, Cheese choices
  options.forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-type');
      const val = btn.getAttribute('data-val');
      
      // Update UI active class
      document.querySelectorAll(`.option-btn[data-type="${type}"]`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update State
      builderState[type] = val;
      
      // Update Visual canvas class representations
      updateBuilderLayers();
      // Update Pricing
      calculateBuilderPrice();
      // Update 3D pizza constructor
      update3DPizza();
    });
  });

  // Handle Toppings choices
  toppings.forEach(btn => {
    btn.addEventListener('click', () => {
      const topping = btn.getAttribute('data-topping');
      
      if (builderState.toppings.has(topping)) {
        builderState.toppings.delete(topping);
        btn.classList.remove('active');
        removeToppingsFromCanvas(topping);
      } else {
        builderState.toppings.add(topping);
        btn.classList.add('active');
        addToppingsToCanvas(topping);
      }

      calculateBuilderPrice();
      // Update 3D pizza constructor
      update3DPizza();
    });
  });

  updateBuilderLayers();
  calculateBuilderPrice();
  
  // Initialize 3D Pizza Canvas
  initPizza3D();
}

function updateBuilderLayers() {
  const sauceLayer = document.getElementById('p-sauce');
  const cheeseLayer = document.getElementById('p-cheese');
  
  if (!sauceLayer || !cheeseLayer) return;

  // Clear existing active sauce classes
  sauceLayer.className = 'builder-layer layer-sauce';
  sauceLayer.classList.add(`active-${builderState.sauce}`);

  // Clear existing cheese classes
  cheeseLayer.className = 'builder-layer layer-cheese';
  cheeseLayer.classList.add(`active-${builderState.cheese}`);
}

// Realistic SVG ingredient sprites for the pizza builder (no external images = always renders).
const TOPPING_SVG = {
  pepperoni: '<svg viewBox="0 0 40 40"><defs><radialGradient id="pepG" cx="40%" cy="34%"><stop offset="0%" stop-color="#e2675a"/><stop offset="65%" stop-color="#c63b2f"/><stop offset="100%" stop-color="#9c2a21"/></radialGradient></defs><circle cx="20" cy="20" r="18" fill="url(#pepG)" stroke="#86231b" stroke-width="1"/><circle cx="14" cy="15" r="2.3" fill="#7a1e17"/><circle cx="26" cy="14" r="1.8" fill="#7a1e17"/><circle cx="22" cy="26" r="2.5" fill="#7a1e17"/><circle cx="13" cy="25" r="1.6" fill="#7a1e17"/><circle cx="28" cy="23" r="1.5" fill="#7a1e17"/><circle cx="19" cy="19" r="1.4" fill="#7a1e17"/></svg>',
  basil: '<svg viewBox="0 0 40 40"><defs><linearGradient id="basG" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#5cb85c"/><stop offset="100%" stop-color="#2e7d32"/></linearGradient></defs><path d="M20 3 C31 9 33 27 20 37 C7 27 9 9 20 3 Z" fill="url(#basG)" stroke="#1b5e20" stroke-width="1"/><path d="M20 6 L20 34" stroke="#1b5e20" stroke-width="1.2" opacity=".55"/><path d="M20 14 L14 12 M20 20 L13 19 M20 26 L15 27 M20 14 L26 12 M20 20 L27 19 M20 26 L25 27" stroke="#1b5e20" stroke-width="0.8" opacity=".4"/></svg>',
  jalapeno: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#6aa84f" stroke="#365f1c" stroke-width="1.2"/><circle cx="20" cy="20" r="8.5" fill="#e6f0d4"/><circle cx="17" cy="18" r="1" fill="#c7d6a8"/><circle cx="22" cy="21" r="1" fill="#c7d6a8"/><circle cx="19" cy="23" r="0.9" fill="#c7d6a8"/></svg>',
  mushrooms: '<svg viewBox="0 0 40 40"><defs><linearGradient id="mushG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f3e7d2"/><stop offset="100%" stop-color="#d6b487"/></linearGradient></defs><path d="M5 22 C5 9 35 9 35 22 L35 24 C35 28 5 28 5 24 Z" fill="url(#mushG)" stroke="#b5916a" stroke-width="1"/><rect x="16.5" y="22" width="7" height="10" rx="2.5" fill="#ecdcc0" stroke="#b5916a" stroke-width="1"/><path d="M13 20 L13 24 M20 19 L20 24 M27 20 L27 24" stroke="#c3a079" stroke-width="1"/></svg>',
  chicken: '<svg viewBox="0 0 40 40"><defs><radialGradient id="chkG" cx="40%" cy="34%"><stop offset="0%" stop-color="#ecbf7d"/><stop offset="100%" stop-color="#b97c39"/></radialGradient></defs><path d="M10 13 Q14 6 23 8 Q34 11 31 22 Q30 33 18 31 Q7 29 9 19 Z" fill="url(#chkG)" stroke="#94601f" stroke-width="1"/><circle cx="16" cy="16" r="1.3" fill="#9c6a2c" opacity=".6"/><circle cx="24" cy="22" r="1.5" fill="#9c6a2c" opacity=".5"/><circle cx="19" cy="24" r="1" fill="#9c6a2c" opacity=".5"/></svg>',
  onions: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17.5" fill="none" stroke="#a86fb0" stroke-width="3.5"/><circle cx="20" cy="20" r="12.5" fill="none" stroke="#c79ccd" stroke-width="2.5"/><circle cx="20" cy="20" r="8" fill="none" stroke="#e3cce6" stroke-width="2.5"/><circle cx="20" cy="20" r="3.5" fill="none" stroke="#f0e3f2" stroke-width="2"/></svg>'
};
function toppingSVG(t){ return TOPPING_SVG[t] || TOPPING_SVG.pepperoni; }

// Sprinkle realistic toppings across the pizza (randomised polar scatter, staggered drop-in).
function addToppingsToCanvas(topping) {
  const container = document.getElementById('rendered-toppings');
  if (!container) return;
  const svg = toppingSVG(topping);
  const COUNT = 13;
  for (let i = 0; i < COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 6 + Math.sqrt(Math.random()) * 34; // area-uniform, keep off the crust edge
    const top = 50 + radius * Math.sin(angle);
    const left = 50 + radius * Math.cos(angle);
    const size = 22 + Math.random() * 12;
    const rot = Math.floor(Math.random() * 360);

    const item = document.createElement('div');
    item.className = `rendered-topping topping-node-${topping}`;
    item.style.top = top + '%';
    item.style.left = left + '%';
    item.style.width = size + 'px';
    item.style.height = size + 'px';
    item.style.animationDelay = `${i * 45}ms`;

    const inner = document.createElement('div');
    inner.className = 'rt-inner';
    inner.style.transform = `rotate(${rot}deg)`;
    inner.innerHTML = svg;

    item.appendChild(inner);
    container.appendChild(item);
  }
}

function removeToppingsFromCanvas(topping) {
  const container = document.getElementById('rendered-toppings');
  if (!container) return;
  const nodes = container.querySelectorAll(`.topping-node-${topping}`);
  nodes.forEach(n => {
    n.style.animation = 'none';
    n.style.transition = 'opacity .18s ease, transform .18s ease';
    n.style.opacity = '0';
    n.style.transform = 'translate(-50%, -50%) scale(0.3)';
    setTimeout(() => n.remove(), 180);
  });
}

function calculateBuilderPrice() {
  let cost = builderPrices.base;
  cost += builderPrices.crust[builderState.crust];
  cost += builderPrices.sauce[builderState.sauce];
  cost += builderPrices.cheese[builderState.cheese];
  cost += builderState.toppings.size * builderPrices.toppingCost;

  const priceEl = document.getElementById('builder-price');
  if (priceEl) {
    priceEl.innerText = `$${cost.toFixed(2)}`;
  }
  return cost;
}

function addCustomPizzaToCart() {
  const price = calculateBuilderPrice();
  // Build details string
  const details = [];
  details.push(`Crust: ${builderState.crust}`);
  details.push(`Sauce: ${builderState.sauce}`);
  details.push(`Cheese: ${builderState.cheese}`);
  if (builderState.toppings.size > 0) {
    details.push(`Toppings: ${Array.from(builderState.toppings).join(', ')}`);
  }
  const detailsStr = details.join(' | ');

  addProductToCart('custom-pizza-' + Date.now(), 'Custom Crafted Pizza', price, 'assets/hero-pizza.gif', detailsStr);
  
  // Visual Confetti explosion
  triggerConfettiExplosion();
  
  // Show Cart Drawer
  toggleCartDrawer(true);
}

// ========================================================
// 5. HAMILTON POSTCODE VERIFICATION & MAP ROUTE PATH
// ========================================================
const validHamiltonZones = {
  '3200': { center: 'Central Hamilton', time: '18-22 mins', coords: 'M 200 180 L 160 210' },
  '3201': { center: 'Hamilton West', time: '20-25 mins', coords: 'M 200 180 Q 150 140 100 150' },
  '3204': { center: 'Hamilton East', time: '15-20 mins', coords: 'M 200 180 L 260 220 L 280 260' },
  '3206': { center: 'Melville', time: '24-28 mins', coords: 'M 200 180 Q 170 270 120 330' },
  '3210': { center: 'Chartwell', time: '22-26 mins', coords: 'M 200 180 L 230 110 L 260 80' },
  '3214': { center: 'Te Rapa', time: '22-28 mins', coords: 'M 200 180 L 160 120 Q 130 90 90 70' },
  '3216': { center: 'Hillcrest / University', time: '15-20 mins', coords: 'M 200 180 L 280 260 L 330 310' },
  '3281': { center: 'Rototuna', time: '25-30 mins', coords: 'M 200 180 L 210 100 Q 230 60 280 40' }
};

function verifyPostcode() {
  const input = document.getElementById('postcode-input');
  const resultsBox = document.getElementById('postcode-status');
  const routePath = document.getElementById('delivery-route');
  const targetPin = document.getElementById('map-target');
  
  if (!input || !resultsBox) return;

  const val = input.value.trim();
  const zoneData = validHamiltonZones[val];

  if (zoneData) {
    // Delivery Available
    resultsBox.innerHTML = `
      <div class="success-result-box">
        <span class="status-badge"><i data-lucide="check-circle" style="width:14px;height:14px;"></i> DELIVERY AVAILABLE</span>
        <div class="status-time">${zoneData.time}</div>
        <div class="status-desc">Freshly dispatched to <strong>${zoneData.center} (${val})</strong>. Premium thermal packaging active.</div>
      </div>
    `;
    lucide.createIcons();

    // Route Tracing Map animation
    if (routePath && targetPin) {
      // Apply path string
      routePath.setAttribute('d', zoneData.coords);
      
      // Calculate length of SVG path dynamically
      const pathLength = routePath.getTotalLength();
      routePath.style.strokeDasharray = pathLength;
      routePath.style.strokeDashoffset = pathLength;
      
      // Force repaint to reset animation state
      routePath.getBoundingClientRect();
      
      // Animate path stroke
      routePath.style.strokeDashoffset = '0';

      // Position pin at end of SVG path after animation duration
      const points = zoneData.coords.split(/[L|Q]/);
      const finalPoint = points[points.length - 1].trim().split(' ');
      let px = parseFloat(finalPoint[0]);
      let py = parseFloat(finalPoint[1]);
      
      // If it is quadratic curve end coordinates
      if (finalPoint.length > 2) {
        px = parseFloat(finalPoint[2]);
        py = parseFloat(finalPoint[3]);
      }

      setTimeout(() => {
        targetPin.setAttribute('cx', px);
        targetPin.setAttribute('cy', py);
        targetPin.style.opacity = '1';
      }, 150);
    }
  } else {
    // Delivery unavailable
    resultsBox.innerHTML = `
      <div class="success-result-box" style="animation: revealTimelineContent 0.5s ease-out;">
        <span class="status-badge" style="background: rgba(224, 36, 36, 0.08); color: #e02424;">
          <i data-lucide="alert-triangle" style="width:14px;height:14px;"></i> ZONE OUTSIDE HUB
        </span>
        <div class="status-time">Store Pickup Only</div>
        <div class="status-desc">Sorry, postcode <strong>${val}</strong> falls outside our 28-min thermal zone. Select pickup at checkout!</div>
      </div>
    `;
    lucide.createIcons();
    
    // Hide delivery route & target pin
    if (routePath) routePath.style.strokeDashoffset = routePath.getTotalLength();
    if (targetPin) targetPin.style.opacity = '0';
  }
}

// ========================================================
// 6. LIVE ORDER TRACKER SYSTEM
// ========================================================
let trackingInterval = null;
let realOrderActive = false; // true once a real DB order is being tracked (disables the demo simulation)
const trackerSteps = ['received', 'prep', 'oven', 'delivery', 'delivered'];
const trackerStepDetails = {
  'received': { title: 'Order Locked In', desc: 'Hamilton hub database verified your coordinates. Core prep sequence initialized.', progress: '10%', scooterX: 0 },
  'prep': { title: 'Dough Formulation', desc: 'Artisanal Neapolitan double-fermented dough stretched. Custom toppings arranged.', progress: '35%', scooterX: 30 },
  'oven': { title: 'Wood-fired Oven Chamber', desc: 'Baking at 450°C. Mozzarella melting. Micro-bubbles expanding in the crust.', progress: '60%', scooterX: 65 },
  'delivery': { title: 'Thermal Dispatched Flight', desc: 'Out for courier flight across Hamilton. Sealed in thermal-lock chambers.', progress: '85%', scooterX: 105 },
  'delivered': { title: 'Mission Complete', desc: 'Arrived at target address. Scorch-hot temperature secured. Bon appétit!', progress: '100%', scooterX: 135 }
};

function runSimulatedOrder() {
  if (trackingInterval) clearInterval(trackingInterval);

  let currentStepIdx = 0;
  updateTrackerUI(trackerSteps[currentStepIdx]);

  trackingInterval = setInterval(() => {
    currentStepIdx++;
    if (currentStepIdx >= trackerSteps.length) {
      clearInterval(trackingInterval);
      return;
    }
    updateTrackerUI(trackerSteps[currentStepIdx]);
  }, 1500); // Progresses step every 1.5s (fast, visible demo cycle)
}

function updateTrackerUI(stepKey) {
  const stepData = trackerStepDetails[stepKey];
  if (!stepData) return;

  // Update stepper active classes
  let hitActive = true;
  trackerSteps.forEach(key => {
    const node = document.getElementById(`step-${key}`);
    if (node) {
      if (hitActive) {
        node.classList.add('active');
      } else {
        node.classList.remove('active');
      }
    }
    if (key === stepKey) {
      hitActive = false; // Disable for following nodes
    }
  });

  // Update Progress Track Bar
  const trackFill = document.getElementById('track-fill');
  if (trackFill) {
    if (window.Motion && typeof window.Motion.animate === 'function') {
      window.Motion.animate(trackFill, { width: stepData.progress }, { duration: 0.8, ease: "easeOut" });
    } else {
      trackFill.style.width = stepData.progress;
    }
  }

  // Update Status Details
  const titleEl = document.getElementById('tracker-status-title');
  const descEl = document.getElementById('tracker-status-desc');
  if (titleEl) titleEl.innerText = stepData.title;
  if (descEl) descEl.innerText = stepData.desc;

  // Move Scooter SVG group
  const scooterGroup = document.getElementById('scooter-body');
  if (scooterGroup) {
    if (window.Motion && typeof window.Motion.animate === 'function') {
      window.Motion.animate(scooterGroup, { x: stepData.scooterX }, { type: "spring", stiffness: 80, damping: 15 });
    } else {
      scooterGroup.style.transform = `translateX(${stepData.scooterX}px)`;
    }
    if (stepKey === 'delivered') {
      scooterGroup.classList.remove('animated-scooter-moving');
    } else {
      scooterGroup.classList.add('animated-scooter-moving');
    }
  }

  // Confetti at delivery completion
  if (stepKey === 'delivered') {
    triggerConfettiExplosion();
  }
}

// Simulation starts only when user scrolls to tracker section (not on load)
let simulationStarted = false;
document.addEventListener('DOMContentLoaded', () => {
  const trackerSection = document.getElementById('tracker');
  if (trackerSection && 'IntersectionObserver' in window) {
    const trackerObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !simulationStarted && !realOrderActive) {
          simulationStarted = true;
          setTimeout(runSimulatedOrder, 500);
        }
      });
    }, { threshold: 0.3 });
    trackerObserver.observe(trackerSection);
  }
});
// setTimeout(runSimulatedOrder, 2000); — disabled to prevent auto-confetti

// ========================================================
// 7. COUNTDOWN TIMERS LOGIC
// ========================================================
function initCountdownTimers() {
  const timerTues = document.getElementById('timer-tues');
  const timerFree = document.getElementById('timer-free');
  
  // Set target to end of current day
  function updateTimers() {
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const diff = endOfDay - now;

    if (diff <= 0) {
      if (timerTues) timerTues.innerText = '00:00:00';
      if (timerFree) timerFree.innerText = '00:00:00';
      return;
    }

    const hrs = Math.floor(diff / 3600000).toString().padStart(2, '0');
    const mins = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
    const secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');

    const formatted = `${hrs}:${mins}:${secs}`;
    if (timerTues) timerTues.innerText = formatted;
    if (timerFree) timerFree.innerText = formatted;
  }

  setInterval(updateTimers, 1000);
  updateTimers();
}

// ========================================================
// 8. CART & CHECKOUT DRAWER STATE MANAGEMENT
// ========================================================
const cartState = {
  items: [],
  deliveryMethod: 'delivery', // 'delivery' or 'pickup'
  couponDiscount: 0, // fraction (e.g. 0.3)
  freeDelivery: false,
  checkoutStep: 1,
  pickupTiming: 'asap', // 'asap' or 'schedule'
  pickupTime: null // ISO string when pickupTiming === 'schedule'
};

// --- Cart persistence: survive page navigation (multi-page site) ---
const HS_CART_KEY = 'hs_cart_v1';
function saveCart() {
  try {
    localStorage.setItem(HS_CART_KEY, JSON.stringify({
      items: cartState.items,
      deliveryMethod: cartState.deliveryMethod,
      couponDiscount: cartState.couponDiscount,
      freeDelivery: cartState.freeDelivery,
      pickupTiming: cartState.pickupTiming,
      pickupTime: cartState.pickupTime
    }));
  } catch (_) {}
}
function loadCart() {
  try {
    const raw = localStorage.getItem(HS_CART_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (Array.isArray(s.items)) cartState.items = s.items;
    if (s.deliveryMethod) cartState.deliveryMethod = s.deliveryMethod;
    if (typeof s.couponDiscount === 'number') cartState.couponDiscount = s.couponDiscount;
    if (typeof s.freeDelivery === 'boolean') cartState.freeDelivery = s.freeDelivery;
    if (s.pickupTiming) cartState.pickupTiming = s.pickupTiming;
    if (s.pickupTime) cartState.pickupTime = s.pickupTime;
  } catch (_) {}
}
loadCart();

let storeHours = { open_hour: 11, close_hour: 22, prep_time_minutes: 20 };
let storeHoursLoaded = false;

async function loadStoreHours() {
  if (storeHoursLoaded || !supabaseClient) return;
  try {
    const { data } = await supabaseClient.from('store_settings').select('open_hour,close_hour,prep_time_minutes').eq('id', 1).single();
    if (data) storeHours = data;
    storeHoursLoaded = true;
  } catch (e) {
    console.warn('Using default store hours', e);
  }
}

const STORE_TZ = 'Pacific/Auckland'; // store hours are NZ wall-clock, not customer device time

// current NZ wall-clock parts + the NZ->UTC offset for now
function nzNow() {
  const d = new Date();
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: STORE_TZ, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
  const p = {};
  for (const part of f.formatToParts(d)) p[part.type] = part.value;
  const y=+p.year, mo=+p.month, dd=+p.day, h=+p.hour, mi=+p.minute, s=+(p.second||0);
  const asUTC = Date.UTC(y, mo-1, dd, h, mi, s);
  const offsetMs = asUTC - Math.floor(d.getTime()/1000)*1000; // NZ offset from UTC (handles DST)
  return { y, mo, d: dd, h, mi, offsetMs };
}
// NZ wall-clock (today) at h:mi -> absolute Date instant
function nzWallToInstant(y, mo, d, h, mi, offsetMs) {
  return new Date(Date.UTC(y, mo-1, d, h, mi, 0) - offsetMs);
}
// format an instant as NZ local time label, regardless of device TZ
function fmtNZTime(date) {
  return new Intl.DateTimeFormat('en-NZ', { timeZone: STORE_TZ, hour:'2-digit', minute:'2-digit', hour12:true }).format(date);
}

function generatePickupSlots() {
  const nz = nzNow();
  let startMin = nz.h*60 + nz.mi + storeHours.prep_time_minutes; // earliest = now + prep (NZ)
  if (startMin % 15 !== 0) startMin += (15 - startMin % 15);      // round up to next 15
  const openMin = storeHours.open_hour*60;                       // don't offer slots before opening
  if (startMin < openMin) startMin = openMin;
  const lastMin = storeHours.close_hour*60 - 15;                 // last slot 15 min before close
  const slots = [];
  for (let m = startMin; m <= lastMin; m += 15) {
    const inst = nzWallToInstant(nz.y, nz.mo, nz.d, Math.floor(m/60), m%60, nz.offsetMs);
    slots.push({ iso: inst.toISOString(), label: fmtNZTime(inst) });
  }
  return slots;
}

function toggleCartDrawer(forceShow = false) {
  const drawer = document.getElementById('cart-drawer');
  if (!drawer) return;

  if (forceShow) {
    drawer.classList.add('active');
  } else {
    drawer.classList.toggle('active');
  }
  if (typeof updateCartUI === 'function') updateCartUI();
}

function addProductToCart(id, name, price, img, details = '') {
  // Check if item exists in bag
  const existing = cartState.items.find(item => item.id === id);
  if (existing) {
    existing.qty++;
  } else {
    cartState.items.push({ id, name, price, img, details, qty: 1 });
  }

  updateCartUI();
  
  // Micro interaction - Bounce the cart icon on add
  const cartBtn = document.querySelector('.cart-btn');
  if (cartBtn) {
    cartBtn.style.transform = 'scale(1.2)';
    setTimeout(() => {
      cartBtn.style.transform = 'none';
    }, 200);
  }
}

function updateQty(id, delta) {
  const index = cartState.items.findIndex(item => item.id === id);
  if (index === -1) return;

  cartState.items[index].qty += delta;
  if (cartState.items[index].qty <= 0) {
    // Track as negative signal — user removed it
    try { if (typeof window.__trackHsNeg === 'function') window.__trackHsNeg(id); } catch(e){}
    cartState.items.splice(index, 1);
  }
  updateCartUI();
}

function calculateCartTotals() {
  let subtotal = 0;
  cartState.items.forEach(item => {
    subtotal += item.price * item.qty;
  });

  // Calculate delivery fee
  let deliveryFee = cartState.deliveryMethod === 'delivery' ? 5.00 : 0.00;
  if (cartState.freeDelivery || (subtotal > 40.00 && cartState.deliveryMethod === 'delivery')) {
    deliveryFee = 0.00;
  }

  // Calculate discount
  const discount = subtotal * cartState.couponDiscount;
  const total = subtotal + deliveryFee - discount;

  return { subtotal, deliveryFee, discount, total };
}

function updateCartUI() {
  saveCart(); // persist on every cart change so it survives page navigation
  const listContainer = document.getElementById('cart-items-list');
  const cartBadge = document.querySelector('.cart-badge');
  const stickyItems = document.querySelector('.mb-items');
  const stickyPrice = document.querySelector('.mb-price');
  
  const { subtotal, deliveryFee, discount, total } = calculateCartTotals();

  // Update counters
  const totalItems = cartState.items.reduce((acc, item) => acc + item.qty, 0);
  if (cartBadge) cartBadge.innerText = totalItems;
  if (stickyItems) stickyItems.innerText = `${totalItems} ${totalItems === 1 ? 'item' : 'items'}`;
  if (stickyPrice) stickyPrice.innerText = `$${total.toFixed(2)}`;
  const zomBadge = document.getElementById('zom-cart-count');
  if (zomBadge) {
    zomBadge.textContent = totalItems;
    zomBadge.style.display = totalItems > 0 ? 'flex' : 'none';
  }

  // Mobile sticky cart CTA sync
  const mcart = document.getElementById('mcart-cta');
  if (mcart) {
    const mc = document.getElementById('mcart-count');
    const mt = document.getElementById('mcart-total');
    if (mc) mc.textContent = totalItems;
    if (mt) mt.textContent = `$${total.toFixed(2)}`;
    const _drawer = document.getElementById('cart-drawer');
    const _drawerOpen = _drawer && _drawer.classList.contains('active');
    mcart.style.display = (totalItems > 0 && !_drawerOpen) ? 'flex' : 'none';
  }
  if (typeof syncMenuCardSteppers === 'function') syncMenuCardSteppers();

  // Update Drawer totals
  const totalText = document.getElementById('drawer-price-total');
  if (totalText) totalText.innerText = `$${total.toFixed(2)}`;

  // If Cart is Empty
  if (cartState.items.length === 0) {
    if (listContainer) {
      listContainer.innerHTML = `
        <div class="cart-empty-message">
          <i data-lucide="shopping-cart"></i>
          <p>Your bag is empty. Start adding pizzas!</p>
        </div>
      `;
      lucide.createIcons();
    }
    return;
  }

  // Render items
  if (listContainer) {
    listContainer.innerHTML = cartState.items.map(item => `
      <div class="cart-item">
        <img src="${item.img}" alt="${item.name}" class="cart-item-img">
        <div class="cart-item-details">
          <h4>${item.name}</h4>
          ${item.details ? `<p style="font-size:0.7rem; color:var(--text-muted); margin-bottom:4px;">${item.details}</p>` : ''}
          <span>$${(item.price * item.qty).toFixed(2)}</span>
        </div>
        <div class="cart-item-actions">
          <button class="qty-btn" onclick="updateQty('${item.id}', -1)">-</button>
          <span class="qty-val">${item.qty}</span>
          <button class="qty-btn" onclick="updateQty('${item.id}', 1)">+</button>
        </div>
      </div>
    `).join('');
    lucide.createIcons();
  }
}

function setDeliveryMethod(method) {
  cartState.deliveryMethod = method;
  
  // Highlight UI button
  const delBtn = document.getElementById('m-delivery');
  const pickBtn = document.getElementById('m-pickup');
  const addressBox = document.getElementById('address-field-box');
  const landmarkBox = document.getElementById('landmark-field-box');
  const pickupTimeBox = document.getElementById('pickup-time-box');

  if (method === 'delivery') {
    if (delBtn) delBtn.classList.add('active');
    if (pickBtn) pickBtn.classList.remove('active');
    if (addressBox) addressBox.style.display = 'flex';
    if (landmarkBox) landmarkBox.style.display = 'flex';
    if (pickupTimeBox) pickupTimeBox.style.display = 'none';
  } else {
    if (delBtn) delBtn.classList.remove('active');
    if (pickBtn) pickBtn.classList.add('active');
    if (addressBox) addressBox.style.display = 'none';
    if (landmarkBox) landmarkBox.style.display = 'none';
    if (pickupTimeBox) pickupTimeBox.style.display = 'flex';
    setPickupTiming('asap');
  }

  updateCartUI();
}

async function setPickupTiming(requestedMode) {
  await loadStoreHours();
  const select = document.getElementById('pickup-time-select');
  const note = document.getElementById('pickup-time-note');
  const asapBtn = document.getElementById('pt-asap');
  const scheduleBtn = document.getElementById('pt-schedule');

  let mode = requestedMode;
  let slots = [];
  let noSlotsToday = false;

  if (mode === 'schedule') {
    slots = generatePickupSlots();
    if (!slots.length) { mode = 'asap'; noSlotsToday = true; }
  }

  cartState.pickupTiming = mode;
  if (asapBtn) asapBtn.classList.toggle('active', mode === 'asap');
  if (scheduleBtn) scheduleBtn.classList.toggle('active', mode === 'schedule');

  if (mode === 'schedule') {
    cartState.pickupTime = slots[0].iso;
    if (select) {
      select.innerHTML = slots.map(s => `<option value="${s.iso}">${s.label}</option>`).join('');
      select.style.display = 'block';
      select.onchange = () => { cartState.pickupTime = select.value; };
    }
    if (note) note.textContent = '';
  } else {
    cartState.pickupTime = null;
    if (select) select.style.display = 'none';
    if (note) note.textContent = noSlotsToday
      ? 'No more pickup slots today — order will be ASAP.'
      : `Ready in ~${storeHours.prep_time_minutes} min`;
  }
}

function applyCouponCode(code) {
  const success = applyCouponLogic(code);
  if (success) {
    triggerConfettiExplosion();
  }
}

function submitCoupon() {
  const entry = document.getElementById('coupon-entry');
  if (!entry) return;
  const val = entry.value.trim().toUpperCase();
  applyCouponCode(val);
}

function applyCouponLogic(code) {
  if (code === 'BOOST30') {
    cartState.couponDiscount = 0.3;
    updateCartUI();
    openSuccessModal('30% Discount Activated!', 'Coupon Code BOOST30 active: 30% discount applied to your flight bag!');
    return true;
  } else if (code === 'HAMFREE') {
    cartState.freeDelivery = true;
    updateCartUI();
    openSuccessModal('Free Delivery Activated!', 'Coupon Code HAMFREE active: Free Hamilton delivery routing unlocked!');
    return true;
  }
  alert('Invalid Coupon Code format. Enter BOOST30 or HAMFREE.');
  return false;
}

// 3-Step Apple Checkout Navigation
async function stepCheckoutNext() {
  const step = cartState.checkoutStep;
  const { subtotal, deliveryFee, discount, total } = calculateCartTotals();

  if (cartState.items.length === 0) {
    alert('Add pizzas to your bag to proceed!');
    return;
  }

  if (step === 1) {
    // Transition to Step 2 (Route / Shipping details)
    cartState.checkoutStep = 2;
    toggleStepUI(2);
    
    // UI Label text updates
    document.getElementById('next-checkout-btn').innerHTML = 'Proceed to Pay <i data-lucide="chevron-right"></i>';
    document.getElementById('back-checkout-btn').style.display = 'block';
    lucide.createIcons();
  } else if (step === 2) {
    // Validate inputs
    const phone = document.getElementById('ship-phone').value.trim();
    const postcode = document.getElementById('ship-postcode').value.trim();
    if (!phone || (cartState.deliveryMethod === 'delivery' && !document.getElementById('ship-address').value.trim())) {
      alert('Please fill out all address and contact details.');
      return;
    }

    // Populate billing values
    document.getElementById('p-subtotal').innerText = `$${subtotal.toFixed(2)}`;
    document.getElementById('p-delivery-fee').innerText = `$${deliveryFee.toFixed(2)}`;
    if (discount > 0) {
      document.getElementById('summary-discount-line').style.display = 'flex';
      document.getElementById('p-discount').innerText = `-$${discount.toFixed(2)}`;
    } else {
      document.getElementById('summary-discount-line').style.display = 'none';
    }
    document.getElementById('p-total').innerText = `$${total.toFixed(2)}`;

    // Transition to Step 3 (Payment Details)
    cartState.checkoutStep = 3;
    toggleStepUI(3);
    document.getElementById('next-checkout-btn').innerHTML = 'Confirm Order <i data-lucide="check-circle"></i>';
    lucide.createIcons();
  } else if (step === 3) {
    const confirmBtn = document.getElementById('next-checkout-btn');
    confirmBtn.disabled = true;
    confirmBtn.innerText = 'Processing Payment...';

    const cardholder = document.getElementById('paynuts-cardholder').value.trim();

    if (!cardholder) {
      alert("Please enter the Cardholder Name.");
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = 'Confirm Order <i data-lucide="check-circle"></i>';
      lucide.createIcons();
      return;
    }

    if (paynutsInstance) {
      // Paynuts live checkout flow
      const month = document.getElementById('paynuts-expiry-month').value.trim();
      const year = document.getElementById('paynuts-expiry-year').value.trim();

      if (!month || month.length !== 2 || isNaN(month) || parseInt(month) < 1 || parseInt(month) > 12) {
        alert("Please enter a valid 2-digit Expiry Month (MM).");
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'Confirm Order <i data-lucide="check-circle"></i>';
        lucide.createIcons();
        return;
      }
      if (!year || (year.length !== 2 && year.length !== 4) || isNaN(year)) {
        alert("Please enter a valid 2-digit or 4-digit Expiry Year (YY or YYYY).");
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'Confirm Order <i data-lucide="check-circle"></i>';
        lucide.createIcons();
        return;
      }

      // Invoke Paynuts tokenize API
      paynutsInstance.tokenize(
        {
          card_holder: cardholder,
          month: month,
          year: year
        },
        async function(token, response) {
          console.log("Paynuts Tokenization Success:", token, response);
          await submitOrderToDatabase(token);
        },
        function(errors) {
          console.error("Paynuts Tokenization Errors:", errors);
          let errorMsg = "Card tokenization failed:\n";
          if (Array.isArray(errors)) {
            errorMsg += errors.map(e => e.message || e.err_msg || JSON.stringify(e)).join("\n");
          } else if (errors && errors.message) {
            errorMsg += errors.message;
          } else {
            errorMsg += JSON.stringify(errors);
          }
          alert(errorMsg);
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = 'Confirm Order <i data-lucide="check-circle"></i>';
          lucide.createIcons();
        }
      );
    } else {
      // Mock payment gateway flow
      const cardNumber = document.getElementById('mock-card-number').value.trim();
      const expiry = document.getElementById('mock-expiry').value.trim();
      const cvc = document.getElementById('mock-cvc').value.trim();

      if (!cardNumber || cardNumber.replace(/\s+/g, '').length < 12) {
        alert("Please enter a valid Card Number.");
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'Confirm Order <i data-lucide="check-circle"></i>';
        lucide.createIcons();
        return;
      }
      const expiryRegex = /^(0[1-9]|1[0-2])\/?([0-9]{2})$/;
      if (!expiry || !expiryRegex.test(expiry)) {
        alert("Please enter a valid Expiry Date (MM/YY).");
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'Confirm Order <i data-lucide="check-circle"></i>';
        lucide.createIcons();
        return;
      }
      if (!cvc || cvc.length < 3) {
        alert("Please enter a valid CVC security code.");
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'Confirm Order <i data-lucide="check-circle"></i>';
        lucide.createIcons();
        return;
      }

      // Generate simulated token
      const mockToken = 'mock_tok_' + Math.random().toString(36).substr(2, 9);
      await submitOrderToDatabase(mockToken);
    }
  }
}

// Fire order receipt (email + SMS) via edge function — dormant until Resend/Twilio keys added
async function notifyOrder(orderId) {
  try {
    const SUPA_URL = 'https://wjhbkkthppbadcjnozal.supabase.co';
    const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqaGJra3RocHBiYWRjam5vemFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MDQ4MTUsImV4cCI6MjA5NjA4MDgxNX0.VC1rur9Y8lUCo_EW2DK3PJllsgyv6nIQEeEKJjg0IKs';
    await fetch(`${SUPA_URL}/functions/v1/notify-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPA_ANON}`, 'apikey': SUPA_ANON },
      body: JSON.stringify({ orderId: orderId })
    });
  } catch (e) { console.warn('notify-order failed:', e.message); }
}

// Gathers totals and pushes order to Supabase table
async function submitOrderToDatabase(paymentToken) {
  const SUPA_URL = 'https://wjhbkkthppbadcjnozal.supabase.co';
  const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqaGJra3RocHBiYWRjam5vemFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MDQ4MTUsImV4cCI6MjA5NjA4MDgxNX0.VC1rur9Y8lUCo_EW2DK3PJllsgyv6nIQEeEKJjg0IKs';
  const totals = calculateCartTotals();
  const phone = document.getElementById('ship-phone').value.trim();
  const address = document.getElementById('ship-address') ? document.getElementById('ship-address').value.trim() : '';
  const landmark = document.getElementById('ship-landmark') ? document.getElementById('ship-landmark').value.trim() : '';
  const fullAddress = landmark ? `${address} (Landmark: ${landmark})` : address;
  const postcode = document.getElementById('ship-postcode').value.trim();
  const cardName = document.getElementById('paynuts-cardholder').value.trim() || 'Anonymous Customer';
  const email = document.getElementById('ship-email') ? document.getElementById('ship-email').value.trim() : '';
  const orderId = (self.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('ord-' + Date.now() + Math.random().toString(36).slice(2,8));

  const orderItems = cartState.items.map(item => ({
    id: item.id,
    name: item.name,
    qty: item.qty,
    price: item.price,
    details: item.details
  }));

  // Attempt charge via Till Payments gateway (with 3DS/OTP support)
  let chargeRef = null;
  let chargeData = null;
  let paymentStatus = 'pending';
  const paynuKey = localStorage.getItem('paynuts_key');
  const paynuHost = localStorage.getItem('paynuts_host') || 'https://gateway.tillpayments.com';
  const isMockPayment = !paymentToken || paymentToken.startsWith('mock_tok_');
  const isRealPayment = paymentToken && paynuKey && !isMockPayment;

  if (isRealPayment) {
    try {
      const chargeRes = await fetch(`${SUPA_URL}/functions/v1/charge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPA_ANON}`,
          'apikey': SUPA_ANON
        },
        body: JSON.stringify({
          token: paymentToken,
          amount: totals.total,
          currency: 'NZD',
          description: 'The Hungry Slice Order #' + String(orderId).slice(0, 8)
        })
      });
      chargeData = await chargeRes.json();
      console.log('Till charge response:', chargeData);
      if (chargeData && chargeData.success) {
        chargeRef = chargeData.chargeRef || chargeData.uuid || 'charged';
        paymentStatus = 'paid';
      } else {
        // HARD GATE: declined or failed real payment — DO NOT save order
        paymentStatus = 'declined';
        const reason = (chargeData && (chargeData.error || chargeData.errorMessage)) || 'Card declined by payment gateway';
        console.error('Till charge DECLINED — order NOT saved:', chargeData);
        openSuccessModal('Payment Declined', 'Your card was declined: ' + reason + '. Please try another card. No order has been placed.');
        return;
      }
    } catch (err) {
      // Network / CORS failure on real payment — also hard gate
      paymentStatus = 'error';
      console.error('Till charge attempt failed — order NOT saved:', err);
      openSuccessModal('Payment Error', 'Could not process card payment: ' + err.message + '. Please try again. No order has been placed.');
      return;
    }
  } else if (isMockPayment) {
    // Mock/demo path — let order through for testing
    paymentStatus = 'demo';
    chargeRef = 'mock_' + (paymentToken || 'none');
  }

  const orderData = {
    id: orderId,
    customer_email: email || null,
    customer_name: cardName,
    customer_phone: phone,
    delivery_method: cartState.deliveryMethod,
    delivery_address: cartState.deliveryMethod === 'delivery' ? fullAddress : 'Pickup',
    pickup_time: cartState.deliveryMethod === 'pickup' ? cartState.pickupTime : null,
    postcode: postcode,
    items: orderItems,
    subtotal: totals.subtotal,
    delivery_fee: totals.deliveryFee,
    discount: totals.discount,
    total: totals.total,
    status: 'received',
    payment_token: paymentToken || null,
    charge_ref: chargeRef,
    payment_status: paymentStatus,
    merchant_txn_id: chargeData && (chargeData.merchantTransactionId || chargeData.transactionId) || null,
    charge_response: chargeData
  };

  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('orders')
        .insert([orderData]);

      if (error) {
        console.error("Supabase insert error:", error);
        alert(`Order placed! Running in Offline Simulator Mode (Database fallback active).\nPayment Token: ${paymentToken || 'None'}`);
        openSuccessModal('Order Placed!', 'Running in Offline Simulator Mode. Your order is registered locally!');
        runSimulatedOrder();
      } else {
        openSuccessModal('Order Placed!', `Your order is in! Live Tracking ID: ${String(orderId).slice(0,8)}`);
        subscribeToOrderTracker(orderId);
        notifyOrder(orderId);
      }
    } catch (err) {
      console.error("Database connection failed:", err);
      alert(`Order placed! Running in Offline Simulator Mode (Database fallback active).\nPayment Token: ${paymentToken || 'None'}`);
      openSuccessModal('Order Placed!', 'Running in Offline Simulator Mode. Your order is registered locally!');
      runSimulatedOrder();
    }
  } else {
    // Offline local simulation
    alert(`Order placed! Running in Offline Simulator Mode (Real-time tracking mock active).\nPayment Token: ${paymentToken || 'None'}`);
    openSuccessModal('Order Placed!', 'Running in Offline Simulator Mode. Real-time tracking mock is active!');
    runSimulatedOrder();
  }

  // Clear Cart State & Redirect
  cartState.items = [];
  cartState.checkoutStep = 1;
  cartState.couponDiscount = 0;
  cartState.freeDelivery = false;
  
  updateCartUI();
  toggleCartDrawer(false);
  toggleStepUI(1);
  
  // Smooth scroll to live tracker section
  setTimeout(() => {
    const trackerSection = document.getElementById('tracker');
    if (trackerSection) {
      trackerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 400);
  
  const confirmBtn = document.getElementById('next-checkout-btn');
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = 'Proceed to Route <i data-lucide="chevron-right"></i>';
  }
  const backBtn = document.getElementById('back-checkout-btn');
  if (backBtn) backBtn.style.display = 'none';
  lucide.createIcons();
  
  // Scroll to tracking section
  scrollToSection('tracker');
}


// Subscribes to Supabase Realtime channel for status changes on the placed order
function subscribeToOrderTracker(orderId) {
  // Clear any active simulated tracking timers
  if (trackingInterval) clearInterval(trackingInterval);
  
  // Set tracker status to received
  updateTrackerUI('received');

  if (!supabaseClient) return;

  // Unsubscribe from any previous channels
  if (activeTrackingChannel) {
    supabaseClient.removeChannel(activeTrackingChannel);
  }

  console.log("Subscribing to realtime updates for order ID:", orderId);
  // A real order is now live — stop/disable the demo simulation so it can't override real status.
  realOrderActive = true;
  simulationStarted = true;
  if (trackingInterval) { clearInterval(trackingInterval); trackingInterval = null; }
  updateTrackerUI('received');
  
  // Poll the status-only RPC. Realtime postgres_changes needs SELECT on orders,
  // which anon lost in the PII lockdown — get_order_status (SECURITY DEFINER) is anon-safe.
  let _trackStopped = false;
  const _statusMap = { 'preparing': 'prep' };
  const pollStatus = async () => {
    if (_trackStopped) return;
    try {
      const { data, error } = await supabaseClient.rpc('get_order_status', { p_id: orderId });
      if (!error && data) {
        updateTrackerUI(_statusMap[data] || data);
        if (data === 'delivered') { _trackStopped = true; return; }
      }
    } catch (e) { /* transient network — keep polling */ }
    setTimeout(pollStatus, 8000);
  };
  setTimeout(pollStatus, 4000);
}

function stepCheckoutBack() {
  const step = cartState.checkoutStep;
  if (step === 2) {
    cartState.checkoutStep = 1;
    toggleStepUI(1);
    document.getElementById('next-checkout-btn').innerHTML = 'Proceed to Route <i data-lucide="chevron-right"></i>';
    document.getElementById('back-checkout-btn').style.display = 'none';
    lucide.createIcons();
  } else if (step === 3) {
    cartState.checkoutStep = 2;
    toggleStepUI(2);
    document.getElementById('next-checkout-btn').innerHTML = 'Proceed to Pay <i data-lucide="chevron-right"></i>';
    lucide.createIcons();
  }
}

function toggleStepUI(stepNum) {
  // Toggle step class bars
  document.querySelectorAll('.c-step').forEach(node => node.classList.remove('active'));
  document.getElementById(`c-step-${stepNum}`).classList.add('active');

  // Toggle active form block
  document.querySelectorAll('.checkout-view').forEach(view => view.classList.remove('active'));
  document.getElementById(`checkout-view-${stepNum}`).classList.add('active');
}

// ========================================================
// 9. CANVAS CONFETTI ENGINE
// ========================================================
let confettiActive = false;
const canvas = document.getElementById('confetti-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
let particles = [];

function resizeCanvas() {
  if (canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class ConfettiParticle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = Math.random() * 8 + 4;
    this.color = `hsl(${Math.random() * 360}, 90%, 60%)`;
    this.speedX = Math.random() * 10 - 5;
    this.speedY = Math.random() * -12 - 4; // Spawn upwards
    this.gravity = 0.35;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = Math.random() * 10 - 5;
  }

  update() {
    this.x += this.speedX;
    this.speedY += this.gravity;
    this.y += this.speedY;
    this.rotation += this.rotationSpeed;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    ctx.restore();
  }
}

function triggerConfettiExplosion() {
  if (!canvas || !ctx) return;
  
  particles = [];
  // Spawn 120 particles centered on screen or spread out
  for (let i = 0; i < 150; i++) {
    particles.push(new ConfettiParticle(window.innerWidth / 2, window.innerHeight * 0.8));
  }

  if (!confettiActive) {
    confettiActive = true;
    animateConfetti();
  }
}

function animateConfetti() {
  if (particles.length === 0) {
    confettiActive = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  particles = particles.filter(p => {
    p.update();
    p.draw();
    // Keep only particles still on screen
    return p.y <= window.innerHeight + 20 && p.x >= -100 && p.x <= window.innerWidth + 100;
  });

  requestAnimationFrame(animateConfetti);
}

// Lottie Modal Success Dialog Helpers
window.openSuccessModal = function(title, desc) {
  const modal = document.getElementById('success-modal');
  const titleEl = document.getElementById('success-modal-title');
  const descEl = document.getElementById('success-modal-desc');
  const lottie = document.getElementById('success-lottie');

  if (modal) {
    if (titleEl) titleEl.innerText = title;
    if (descEl) descEl.innerText = desc;
    modal.classList.add('active');
    
    // Play/Restart Lottie animation
    if (lottie && typeof lottie.seek === 'function') {
      lottie.seek(0);
    }
  }
};

window.closeSuccessModal = function() {
  const modal = document.getElementById('success-modal');
  if (modal) {
    modal.classList.remove('active');
  }
};


// ============================================================
// ENHANCEMENT 3: Hero Order Method Toggle
// ============================================================
window.setHeroOrderMethod = function(method) {
  const deliveryBtn = document.getElementById('ombar-delivery');
  const pickupBtn   = document.getElementById('ombar-pickup');
  const etaText     = document.getElementById('ombar-eta-text');
  if (!deliveryBtn || !pickupBtn) return;

  if (method === 'delivery') {
    deliveryBtn.classList.add('active');
    pickupBtn.classList.remove('active');
    if (etaText) etaText.textContent = '~28 min • Hamilton';
    // sync with checkout method
    if (typeof setDeliveryMethod === 'function') setDeliveryMethod('delivery');
  } else {
    pickupBtn.classList.add('active');
    deliveryBtn.classList.remove('active');
    if (etaText) etaText.textContent = 'Ready in ~15 min • Self Collect';
    if (typeof setDeliveryMethod === 'function') setDeliveryMethod('pickup');
  }
};

// ============================================================
// ENHANCEMENT 4: Social proof live counter animation
// ============================================================
(function initSocialProofCounter() {
  const el = document.getElementById('live-order-count');
  if (!el) return;
  // Animate up from a lower number on load
  const target = 142 + Math.floor(Math.random() * 30);
  let current = Math.max(target - 40, 80);
  el.textContent = current;
  const step = () => {
    if (current < target) {
      current += Math.ceil((target - current) / 8);
      el.textContent = current;
      requestAnimationFrame(step);
    } else {
      el.textContent = target;
    }
  };
  // Start after 800ms so page loads first
  setTimeout(() => requestAnimationFrame(step), 800);

  // Increment counter randomly every 90-180s (simulate live orders)
  setInterval(() => {
    const c = parseInt(el.textContent) || target;
    el.textContent = c + Math.floor(Math.random() * 3 + 1);
  }, 90000 + Math.random() * 90000);
})();

// ============================================================
// ENHANCEMENT 5: Free delivery progress bar updater
// ============================================================
const FREE_DELIVERY_THRESHOLD = 45;

function updateFreeDeliveryBar() {
  const bar = document.getElementById('free-delivery-bar');
  const fill = document.getElementById('fdp-fill');
  const remaining = document.getElementById('fdp-remaining');
  const msg = document.getElementById('fdp-message');
  if (!bar || !fill) return;

  // Calculate cart subtotal from cart array (cart is module-scoped, use DOM fallback)
  const subtotalEl = document.getElementById('p-subtotal');
  let subtotal = 0;
  if (subtotalEl && subtotalEl.textContent) {
    subtotal = parseFloat(subtotalEl.textContent.replace('$', '')) || 0;
  }

  const cartItems = document.querySelectorAll('.cart-item');
  if (cartItems.length === 0) {
    bar.classList.remove('visible', 'achieved');
    return;
  }

  bar.classList.add('visible');
  const pct = Math.min((subtotal / FREE_DELIVERY_THRESHOLD) * 100, 100);
  fill.style.width = pct + '%';

  const diff = FREE_DELIVERY_THRESHOLD - subtotal;
  if (diff <= 0) {
    bar.classList.add('achieved');
    if (msg) msg.innerHTML = '🎉 You\'ve unlocked <strong>free delivery!</strong>';
  } else {
    bar.classList.remove('achieved');
    if (remaining) remaining.textContent = '$' + diff.toFixed(2);
    if (msg) msg.innerHTML = 'Add <strong id="fdp-remaining">$' + diff.toFixed(2) + '</strong> more for <strong>free delivery!</strong>';
  }
}

// Hook into cart updates — patch updateCartUI to also call updateFreeDeliveryBar
const _origUpdateCartUI = typeof updateCartUI === 'function' ? updateCartUI : null;
// We override it after page load to also refresh the bar
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const cartContainer = document.getElementById('cart-items-list');
    if (cartContainer) {
      const obs = new MutationObserver(updateFreeDeliveryBar);
      obs.observe(cartContainer, { childList: true, subtree: true });
    }
    updateFreeDeliveryBar();
  }, 1500);
});


/* ===== Premium UI: hero video fade-in + scroll reveal ===== */
(function(){
  function initHeroVideo(){
    var hv=document.getElementById('hero-video');
    if(!hv)return;
    var play=function(){var p=hv.play();if(p&&p.catch)p.catch(function(){});};
    var go=function(){hv.classList.add('is-ready');play();};
    if(hv.readyState>=2)go();
    hv.addEventListener('loadeddata',go);
    hv.addEventListener('canplay',go);
    document.addEventListener('click',function once(){play();document.removeEventListener('click',once);});
  }
  function initReveal(){
    if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    if(!('IntersectionObserver' in window))return;
    var els=[].slice.call(document.querySelectorAll('.section-header, .timeline-item, .glass-card'));
    els.forEach(function(el){el.classList.add('reveal');});
    var io=new IntersectionObserver(function(entries){
      entries.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in-view');io.unobserve(e.target);}});
    },{threshold:0.12,rootMargin:'0px 0px -6% 0px'});
    els.forEach(function(el){io.observe(el);});
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',function(){initHeroVideo();});}
  else{initHeroVideo();}
})();


/* ===== On-card quantity steppers (Add button morphs to stepper) ===== */
function syncMenuCardSteppers(){
  var items = (typeof cartState !== 'undefined' && cartState.items) ? cartState.items : [];
  document.querySelectorAll('.plc').forEach(function(card){
    var id = card.getAttribute('data-pizza-id');
    if(!id) return;
    var foot = card.querySelector('.plc-foot');
    var addBtn = card.querySelector('.plc-add-btn');
    if(!foot) return;
    var item = items.find(function(i){ return i.id === id; });
    var stepper = foot.querySelector('.plc-stepper');
    if(item){
      if(addBtn) addBtn.style.display = 'none';
      if(!stepper){
        stepper = document.createElement('div');
        stepper.className = 'plc-stepper';
        var minus = document.createElement('button');
        minus.type='button'; minus.className='plc-step-btn'; minus.textContent='\u2212';
        var q = document.createElement('span'); q.className='plc-step-qty';
        var plus = document.createElement('button');
        plus.type='button'; plus.className='plc-step-btn'; plus.textContent='+';
        minus.addEventListener('click', function(e){ e.stopPropagation(); updateQty(id,-1); });
        plus.addEventListener('click', function(e){ e.stopPropagation(); updateQty(id,1); });
        stepper.appendChild(minus); stepper.appendChild(q); stepper.appendChild(plus);
        foot.appendChild(stepper);
      }
      stepper.style.display = 'inline-flex';
      stepper.querySelector('.plc-step-qty').textContent = item.qty;
    } else {
      if(stepper) stepper.style.display = 'none';
      if(addBtn) addBtn.style.display = '';
    }
  });
}
window.syncMenuCardSteppers = syncMenuCardSteppers;


// ========================================================
// Card field auto-formatting (mock gateway, professional UX)
// ========================================================
function initCardFormatting(){
  const cn = document.getElementById('mock-card-number');
  if (cn && !cn.dataset.fmt){
    cn.dataset.fmt = '1';
    cn.addEventListener('input', function(){
      const v = this.value.replace(/\D/g,'').slice(0,16);
      this.value = v.replace(/(.{4})/g,'$1 ').trim();
    });
  }
  const ex = document.getElementById('mock-expiry');
  if (ex && !ex.dataset.fmt){
    ex.dataset.fmt = '1';
    ex.addEventListener('input', function(){
      let v = this.value.replace(/\D/g,'').slice(0,4);
      if (v.length >= 3) v = v.slice(0,2) + '/' + v.slice(2);
      this.value = v;
    });
  }
  const cvc = document.getElementById('mock-cvc');
  if (cvc && !cvc.dataset.fmt){
    cvc.dataset.fmt = '1';
    cvc.addEventListener('input', function(){
      this.value = this.value.replace(/\D/g,'').slice(0,4);
    });
  }
}


/* ===================== UI Sound Engine (scenario-aware) + Welcome voice ===================== */
(function(){
  let _actx = null;
  function _ctx(){
    if(!_actx){ try { _actx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){ return null; } }
    if(_actx.state === 'suspended') _actx.resume();
    return _actx;
  }
  // Each sound = sequence of tones. f: freq or [from,to] glide; d: dur(s); g: peak gain; delay: start offset(s)
  const SOUNDS = {
    click:   [{f:600, d:0.05, type:'triangle', g:0.11}],
    tab:     [{f:[760,1020], d:0.07, type:'sine', g:0.13}],
    add:     [{f:[520,780], d:0.10, type:'sine', g:0.16},{f:1040, d:0.08, type:'sine', g:0.09, delay:0.085}],
    pop:     [{f:980, d:0.055, type:'triangle', g:0.14}],
    remove:  [{f:[560,300], d:0.12, type:'sine', g:0.14}],
    confirm: [{f:660, d:0.09, type:'sine', g:0.15},{f:990, d:0.13, type:'sine', g:0.15, delay:0.09}],
    success: [{f:660,d:0.10,type:'sine',g:0.16},{f:880,d:0.10,type:'sine',g:0.16,delay:0.10},{f:1320,d:0.20,type:'sine',g:0.16,delay:0.20}],
    error:   [{f:210, d:0.16, type:'sawtooth', g:0.11},{f:150, d:0.18, type:'sawtooth', g:0.11, delay:0.13}],
    open:    [{f:[420,720], d:0.12, type:'sine', g:0.12}]
  };
  function tone(ctx, t0, n){
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = n.type || 'sine';
    const t = t0 + (n.delay || 0);
    if(Array.isArray(n.f)){ o.frequency.setValueAtTime(n.f[0], t); o.frequency.exponentialRampToValueAtTime(n.f[1], t + n.d); }
    else { o.frequency.setValueAtTime(n.f, t); }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(n.g || 0.14, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + n.d);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + n.d + 0.03);
  }
  window.playSound = function(type){
    if(window.__muteSounds) return;
    const ctx = _ctx(); if(!ctx) return;
    const seq = SOUNDS[type] || SOUNDS.click;
    const t0 = ctx.currentTime;
    seq.forEach(n => tone(ctx, t0, n));
  };
  window.playClickSound = function(){ window.playSound('click'); }; // back-compat

  // Pick the right sound for whatever was clicked.
  function classify(el){
    const oc = (el.getAttribute && el.getAttribute('onclick')) || '';
    if(el.closest('.plc-add-btn') || /addProductToCart|addCustomPizzaToCart/.test(oc)) return 'add';
    if(/updateQty\([^)]*,\s*1\s*\)/.test(oc)) return 'add';
    if(/updateQty\([^)]*,\s*-1\s*\)/.test(oc)) return 'remove';
    if(/removeFrom|removeItem|deleteItem/.test(oc)) return 'remove';
    if(el.closest('.topping-btn') || el.closest('.option-btn')) return 'pop';
    if(el.closest('.filter-pill, .c-step, .zom-nav-tab') || /filterCategory|scrollToSection|zomSetActive|toggleStepUI/.test(oc)) return 'tab';
    if(el.id === 'next-checkout-btn' || el.closest('#next-checkout-btn') || /stepCheckoutNext/.test(oc)) return 'confirm';
    if(el.closest('.footer-staff-link') || el.closest('.cart-btn') || /openStaffLogin|toggleCartDrawer/.test(oc)) return 'open';
    return 'click';
  }
  const SEL = 'button, a, [role="button"], input[type="button"], input[type="submit"], .plc, .qty-btn, .filter-pill, .topping-btn, .option-btn';
  document.addEventListener('click', function(e){
    const el = e.target && e.target.closest && e.target.closest(SEL);
    if(el) window.playSound(classify(el));
  }, true);

  /* ---- Spoken welcome greeting (once per page open) ---- */
  let _spoke = false;
  function attemptGreet(){
    if(_spoke) return;
    if(!('speechSynthesis' in window)){ _spoke = true; return; }
    try{
      const vs = window.speechSynthesis.getVoices() || [];
      const u = new SpeechSynthesisUtterance('Welcome to the Hungry Slice');
      u.rate = 0.96; u.pitch = 1.0; u.volume = 1.0;
      const pref = vs.find(v => /^en/i.test(v.lang) && /female|samantha|karen|victoria|moira|tessa|fiona|google uk english female|zira|aria|jenny/i.test(v.name))
                || vs.find(v => /en-GB|en-AU/.test(v.lang))
                || vs.find(v => /^en/i.test(v.lang));
      if(pref) u.voice = pref;
      u.onstart = () => { _spoke = true; };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }catch(e){}
  }
  function greetWhenReady(){
    if(!('speechSynthesis' in window)) return;
    if(window.speechSynthesis.getVoices().length) attemptGreet();
    else { window.speechSynthesis.addEventListener('voiceschanged', attemptGreet, { once:true }); setTimeout(attemptGreet, 600); }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', greetWhenReady); else greetWhenReady();
  // Browsers usually block audio/speech until a user gesture — retry on the first interaction.
  ['pointerdown','keydown','touchstart'].forEach(ev => window.addEventListener(ev, attemptGreet, { passive:true }));
})();


/* ===================== Staff (Admin) Login ===================== */
const STAFF_SUPA_URL = 'https://wjhbkkthppbadcjnozal.supabase.co';
const STAFF_SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqaGJra3RocHBiYWRjam5vemFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MDQ4MTUsImV4cCI6MjA5NjA4MDgxNX0.VC1rur9Y8lUCo_EW2DK3PJllsgyv6nIQEeEKJjg0IKs';
let _staffAuthClient = null;
function _staffClient(){
  if (_staffAuthClient) return _staffAuthClient;
  if (typeof supabaseClient !== 'undefined' && supabaseClient && supabaseClient.auth) { _staffAuthClient = supabaseClient; return _staffAuthClient; }
  if (window.supabase && window.supabase.createClient) { _staffAuthClient = window.supabase.createClient(STAFF_SUPA_URL, STAFF_SUPA_ANON); return _staffAuthClient; }
  return null;
}
function openStaffLogin(e){ if(e && e.preventDefault) e.preventDefault(); const m=document.getElementById('staff-modal'); if(m){ m.classList.add('active'); const em=document.getElementById('staff-email'); if(em) setTimeout(()=>em.focus(),60); } }
function closeStaffLogin(){ const m=document.getElementById('staff-modal'); if(m) m.classList.remove('active'); }
(function initStaffLogin(){
  function wire(){
    const form=document.getElementById('staff-login-form');
    if(form && !form.dataset.wired){
      form.dataset.wired='1';
      form.addEventListener('submit', async (e)=>{
        e.preventDefault();
        const email=document.getElementById('staff-email').value.trim();
        const password=document.getElementById('staff-password').value;
        const errEl=document.getElementById('staff-login-error');
        const btn=document.getElementById('staff-login-btn');
        const client=_staffClient();
        if(!client){ errEl.textContent='Login unavailable right now. Please refresh.'; return; }
        errEl.textContent=''; btn.disabled=true; btn.textContent='Signing in\u2026';
        try{
          const { error } = await client.auth.signInWithPassword({ email, password });
          if(error){ errEl.textContent=error.message; btn.disabled=false; btn.textContent='Sign In'; return; }
          window.location.href='admin.html';
        }catch(err){ errEl.textContent='Login failed. Please try again.'; btn.disabled=false; btn.textContent='Sign In'; }
      });
    }
    const overlay=document.getElementById('staff-modal');
    if(overlay && !overlay.dataset.wired){
      overlay.dataset.wired='1';
      overlay.addEventListener('click', (e)=>{ if(e.target===overlay) closeStaffLogin(); });
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();


/* FX v2: count-up + parallax orbs */
(function(){
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* --- count-up stats --- */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(ents){
      ents.forEach(function(e){
        if(!e.isIntersecting) return; var el=e.target; io.unobserve(el);
        var m = el.textContent.trim().match(/^([^\d]*)([\d.]+)(.*)$/); if(!m) return;
        var pre=m[1], target=parseFloat(m[2]), suf=m[3], dec=(m[2].split('.')[1]||'').length;
        if(reduce){ el.textContent = pre+target.toFixed(dec)+suf; return; }
        var dur=1100, t0=performance.now();
        (function tick(now){
          var p=Math.min(1,(now-t0)/dur), val=target*(1-Math.pow(1-p,3));
          el.textContent = pre+val.toFixed(dec)+suf;
          if(p<1) requestAnimationFrame(tick); else el.textContent=pre+target.toFixed(dec)+suf;
        })(t0);
      });
    }, {threshold:0.45});
    document.querySelectorAll('.proof-number').forEach(function(el){ io.observe(el); });
  }
  /* --- parallax glow orbs (isolated; no conflict with hero mouse-parallax) --- */
  var specs = [
    ['.story-section',  [{c:'orb-a',top:'28%',left:'-3%',size:300,speed:0.10}]],
    ['.featured-section',[{c:'orb-b',top:'12%',right:'-2%',size:320,speed:-0.08}]],
    ['.builder-section',[{c:'orb-b',top:'18%',left:'-3%',size:320,speed:0.10}]],
    ['.offers-section', [{c:'orb-a',top:'8%',left:'-2%',size:340,speed:0.12},{c:'orb-b',top:'52%',right:'-2%',size:300,speed:-0.08}]],
    ['.reviews-section',[{c:'orb-b',top:'6%',right:'1%',size:320,speed:0.10}]]
  ];
  var orbs=[];
  specs.forEach(function(pair){
    var sec=document.querySelector(pair[0]); if(!sec) return;
    pair[1].forEach(function(o){
      var d=document.createElement('div'); d.className='fx-orb '+o.c; d.setAttribute('aria-hidden','true');
      d.style.width=d.style.height=o.size+'px';
      if(o.top)d.style.top=o.top; if(o.left)d.style.left=o.left; if(o.right)d.style.right=o.right;
      sec.insertBefore(d, sec.firstChild);
      orbs.push({el:d, sec:sec, speed:o.speed});
    });
  });
  if(reduce || !orbs.length) return;
  var ticking=false;
  function update(){
    var vh=window.innerHeight;
    orbs.forEach(function(o){
      var r=o.sec.getBoundingClientRect();
      var prog=(vh - r.top)/(vh + r.height);
      o.el.style.transform='translateY('+(prog*o.speed*220).toFixed(1)+'px)';
    });
    ticking=false;
  }
  window.addEventListener('scroll', function(){ if(!ticking){ ticking=true; requestAnimationFrame(update); } }, {passive:true});
  window.addEventListener('resize', update, {passive:true});
  update();
})();


/* Review submit system */
(function(){
  var rating = 0;
  window.openReviewModal = function(productId, productName){
    var m=document.getElementById('review-modal'); if(!m) return;
    window.__reviewProductId = productId || null;
    var ctx=document.getElementById('rm-context');
    if(ctx){ if(productId){ ctx.textContent='Reviewing: '+productName; ctx.style.display='block'; } else { ctx.textContent=''; ctx.style.display='none'; } }
    m.classList.add('active');
    var n=document.getElementById('rm-name'); if(n) setTimeout(function(){n.focus();},60);
  };
  window.closeReviewModal = function(){ var m=document.getElementById('review-modal'); if(m) m.classList.remove('active'); window.__reviewProductId=null; };
  function wire(){
    var form=document.getElementById('review-form'); var stars=document.getElementById('rm-stars');
    if(form && !form.dataset.wired){
      form.dataset.wired='1';
      var btns=[].slice.call(stars.querySelectorAll('.rm-star'));
      function paint(n){ btns.forEach(function(b){ b.classList.toggle('on', (+b.dataset.v)<=n); }); }
      btns.forEach(function(b){
        b.addEventListener('mouseenter', function(){ paint(+b.dataset.v); });
        b.addEventListener('click', function(){ rating=+b.dataset.v; paint(rating); });
      });
      stars.addEventListener('mouseleave', function(){ paint(rating); });
      form.addEventListener('submit', async function(e){
        e.preventDefault();
        var msg=document.getElementById('rm-msg');
        var name=document.getElementById('rm-name').value.trim();
        var hood=document.getElementById('rm-hood').value.trim();
        var comment=document.getElementById('rm-comment').value.trim();
        var btn=document.getElementById('rm-submit');
        msg.className='rm-msg';
        if(rating<1){ msg.textContent='Please tap a star rating.'; msg.classList.add('err'); return; }
        if(!name || !comment){ msg.textContent='Name and review are required.'; msg.classList.add('err'); return; }
        var last=+(localStorage.getItem('hs_review_ts')||0);
        if(Date.now()-last < 600000){ msg.textContent='Thanks — you just posted a review. Try again later.'; msg.classList.add('err'); return; }
        if(typeof supabaseClient==='undefined' || !supabaseClient){ msg.textContent='Reviews unavailable right now.'; msg.classList.add('err'); return; }
        btn.disabled=true; btn.textContent='Posting…';
        var row={ customer_name:name.slice(0,80), rating:rating, comment:comment.slice(0,600), neighborhood:(hood.slice(0,60)||'Hamilton'), product_id: window.__reviewProductId || null };
        var res=await supabaseClient.from('reviews').insert([row]);
        btn.disabled=false; btn.textContent='Post Review';
        if(res.error){ msg.textContent='Could not post: '+res.error.message; msg.classList.add('err'); return; }
        localStorage.setItem('hs_review_ts', Date.now());
        msg.textContent='Thanks! Your review is live.'; msg.classList.add('ok');
        if(typeof fetchSupabaseReviews==='function') fetchSupabaseReviews();
        if(window.__reviewProductId && typeof fetchProductRatings==='function') fetchProductRatings();
        if(typeof window.playSound==='function') window.playSound('success');
        setTimeout(function(){ closeReviewModal(); form.reset(); rating=0; paint(0); msg.textContent=''; msg.className='rm-msg'; }, 1500);
      });
    }
    var ov=document.getElementById('review-modal');
    if(ov && !ov.dataset.wired){ ov.dataset.wired='1'; ov.addEventListener('click', function(e){ if(e.target===ov) closeReviewModal(); }); }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();


/* Phase 3: recommender surfaces */
(function(){
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function getSeen(){ try{ return JSON.parse(localStorage.getItem('hs_seen')||'[]'); }catch(e){ return []; } }
  function trackSeen(id){ if(!id) return; try{ var a=getSeen(); a=[id].concat(a.filter(function(x){return x!==id;})).slice(0,12); localStorage.setItem('hs_seen', JSON.stringify(a)); }catch(e){} }
  function prodById(id){ return (databaseProducts||[]).find(function(p){return p.id===id;}); }
  function recoImg(p){ return p.image_url || (window.PRODUCT_IMAGES && window.PRODUCT_IMAGES[p.id]) || ''; }
  function recoCardHTML(p){
    var img=recoImg(p); var safe=(p.name||'').replace(/'/g,"\\'");
    var reasonBadge = p.__reason ? '<div class="reco-reason">'+esc(p.__reason)+'</div>' : '';
    return '<div class="reco-card" data-id="'+p.id+'">'
      + '<div class="reco-img" style="background-image:url(\''+img+'\')">'+reasonBadge+'</div>'
      + '<button class="reco-add" aria-label="Add '+esc(p.name)+'" onclick="addProductToCart(\''+p.id+'\',\''+safe+'\','+Number(p.price)+',\''+img+'\')">+</button>'
      + '<div class="reco-info"><span class="reco-name">'+esc(p.name)+'</span><span class="reco-price">$'+Number(p.price).toFixed(2)+'</span></div>'
      + '</div>';
  }
  function renderRecoSection(box, title, products){
    if(!box) return;
    if(!products || !products.length){ box.innerHTML=''; box.style.display='none'; return; }
    box.style.display='';
    box.innerHTML='<h3 class="reco-title">'+esc(title)+'</h3><div class="reco-strip">'+products.map(recoCardHTML).join('')+'</div>';
  }
  function getNegatives(){ try{ return JSON.parse(localStorage.getItem('hs_neg')||'[]'); }catch(e){ return []; } }
  function trackNegative(id){ if(!id) return; try{ var a=getNegatives(); a=[id].concat(a.filter(function(x){return x!==id;})).slice(0,8); localStorage.setItem('hs_neg', JSON.stringify(a)); }catch(e){} }
  async function rpcRecommend(seedIds,k){ if(typeof supabaseClient==='undefined'||!supabaseClient) return []; var negs=getNegatives(); var hour=new Date().getHours(); var r; if(seedIds && seedIds.length){ r=await supabaseClient.rpc('recommend_enhanced',{p_seed_ids:seedIds,p_negative_ids:negs,p_k:k,p_hour:hour,p_diversify:true}); } else { r=await supabaseClient.rpc('cold_start_picks',{k:k}); } if(r.error){console.warn('reco',r.error.message);return[];} return (r.data||[]).map(function(x){ var p=prodById(x.id); if(p) p.__reason=x.reason; return p; }).filter(Boolean); }
  async function rpcSimilar(pid,k){ if(typeof supabaseClient==='undefined'||!supabaseClient||!pid) return []; var r=await supabaseClient.rpc('similar_products',{p_id:pid,k:k}); if(r.error){console.warn('similar',r.error.message);return[];} return (r.data||[]).map(function(x){return prodById(x.id);}).filter(Boolean); }
  async function popularProducts(k){
    var recs=[];
    if(typeof supabaseClient!=='undefined'&&supabaseClient){ var r=await supabaseClient.from('product_popularity').select('*').order('units',{ascending:false}).limit(k); recs=((r&&r.data)||[]).map(function(x){return prodById(x.product_id);}).filter(Boolean); }
    if(recs.length<k){ for(var i=0;i<(databaseProducts||[]).length && recs.length<k;i++){ var p=databaseProducts[i]; if(p.is_available!==false && !recs.find(function(x){return x.id===p.id;})) recs.push(p); } }
    return recs.slice(0,k);
  }
  function injectContainers(){
    var showcase=document.querySelector('.product-showcase-container');
    var searchBar=document.querySelector('.search-below-reco');
    var anchor = searchBar || showcase;  // insert reco BEFORE search if present, else before showcase
    if(showcase && showcase.parentNode && !document.getElementById('menu-reco-for-you')){
      var f=document.createElement('div'); f.id='menu-reco-for-you'; f.className='menu-reco'; f.style.display='none';
      anchor.parentNode.insertBefore(f, anchor);
    }
    if(showcase && showcase.parentNode && !document.getElementById('menu-similar')){
      var s=document.createElement('div'); s.id='menu-similar'; s.className='menu-reco'; s.style.display='none';
      showcase.parentNode.insertBefore(s, showcase.nextSibling);
    }
    var cv1=document.getElementById('checkout-view-1');
    if(cv1 && !document.getElementById('cart-recos')){ var c=document.createElement('div'); c.id='cart-recos'; c.className='cart-recos'; cv1.appendChild(c); }
  }
  var _fySig=null, _simSig=null;
  async function updateMenuRecos(){
    if(!(databaseProducts||[]).length) return;
    var seen=getSeen();
    var box=document.getElementById('menu-reco-for-you');
    var sig=seen.join(',');
    if(box && sig!==_fySig){
      _fySig=sig;
      var recs= seen.length ? await rpcRecommend(seen,8) : [];
      if(!recs.length) recs=await popularProducts(8);
      recs=recs.filter(function(p){return seen.indexOf(p.id)<0;}).slice(0,8);
      renderRecoSection(box, seen.length?'Recommended for you':'Popular right now', recs);
    }
    var sbox=document.getElementById('menu-similar');
    var last=seen[0]||'';
    if(sbox && last!==_simSig){
      _simSig=last;
      var sr= last ? await rpcSimilar(last,8) : [];
      sr=sr.filter(function(p){return seen.indexOf(p.id)<0;}).slice(0,8);
      renderRecoSection(sbox, 'You may also like', sr);
    }
  }
  async function updateCartRecos(){
    var box=document.getElementById('cart-recos'); if(!box) return;
    if(typeof cartState==='undefined' || !cartState.items) return;
    var ids=cartState.items.map(function(i){return i.id;}).filter(Boolean);
    if(!ids.length){ box.innerHTML=''; box.style.display='none'; return; }
    var recs=await rpcRecommend(ids,4);
    recs=recs.filter(function(p){return ids.indexOf(p.id)<0;}).slice(0,4);
    renderRecoSection(box, 'Complete your meal', recs);
  }
  function init(){
    injectContainers();
    if(window.addProductToCart && !window.addProductToCart.__reco){
      var _add=window.addProductToCart;
      window.addProductToCart=function(id,name,price,img,details){ _add(id,name,price,img,details); trackSeen(id); updateMenuRecos(); };
      window.addProductToCart.__reco=true;
    }
    if(window.updateCartUI && !window.updateCartUI.__reco){
      var _u=window.updateCartUI;
      window.updateCartUI=function(){ _u(); updateCartRecos(); };
      window.updateCartUI.__reco=true;
    }
    if(window.renderDynamicProducts && !window.renderDynamicProducts.__reco){
      var _r=window.renderDynamicProducts;
      window.renderDynamicProducts=function(){ _r(); updateMenuRecos(); };
      window.renderDynamicProducts.__reco=true;
    }
    if(window.openReviewModal && !window.openReviewModal.__reco){
      var _o=window.openReviewModal;
      window.openReviewModal=function(pid,pname){ if(pid) trackSeen(pid); _o(pid,pname); if(pid) updateMenuRecos(); };
      window.openReviewModal.__reco=true;
    }
    updateMenuRecos();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();


/* Auth: email OTP + Google */
(function(){
  var _user=null;
  function el(id){ return document.getElementById(id); }
  function msg(t, ok){ var m=el('auth-msg'); if(m){ m.textContent=t||''; m.className='auth-msg'+(ok?' ok':(t?' err':'')); } }
  window.openAuthModal=function(){ var m=el('auth-modal'); if(m){ renderAuthState(); m.classList.add('active'); } };
  window.closeAuthModal=function(){ var m=el('auth-modal'); if(m) m.classList.remove('active'); };
  window.onAccountClick=function(){ openAuthModal(); };
  function renderAuthState(){
    var out=el('auth-signedout'), inn=el('auth-signedin');
    if(_user){ if(out)out.style.display='none'; if(inn){ inn.style.display='block'; var e=el('auth-user-email'); if(e) e.textContent=_user.email||'signed in'; } }
    else { if(out)out.style.display='block'; if(inn)inn.style.display='none'; if(el('auth-otp-step'))el('auth-otp-step').style.display='none'; if(el('auth-email-step'))el('auth-email-step').style.display='block'; }
    msg('');
  }
  window.signInGoogle=async function(){
    if(typeof supabaseClient==='undefined'||!supabaseClient){ msg('Auth unavailable.'); return; }
    msg('Redirecting to Google\u2026');
    var r=await supabaseClient.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: location.origin + location.pathname } });
    if(r.error) msg(r.error.message);
  };
  window.sendEmailOtp=async function(){
    if(typeof supabaseClient==='undefined'||!supabaseClient){ msg('Auth unavailable.'); return; }
    var email=(el('auth-email').value||'').trim();
    if(!email||email.indexOf('@')<0){ msg('Enter a valid email.'); return; }
    var btn=el('auth-send-btn'); if(btn){btn.disabled=true; btn.textContent='Sending\u2026';}
    var r=await supabaseClient.auth.signInWithOtp({ email:email, options:{ shouldCreateUser:true, emailRedirectTo: location.origin + location.pathname } });
    if(btn){btn.disabled=false; btn.textContent='Email me a code';}
    if(r.error){ msg(r.error.message); return; }
    window.__authEmail=email; el('auth-email-step').style.display='none'; el('auth-otp-step').style.display='block';
    msg('Check your email \u2014 enter the code (or tap the link).', true);
  };
  window.verifyEmailOtp=async function(){
    if(typeof supabaseClient==='undefined'||!supabaseClient){ msg('Auth unavailable.'); return; }
    var token=(el('auth-otp').value||'').trim();
    if(token.length<6){ msg('Enter the 6-digit code.'); return; }
    var btn=el('auth-verify-btn'); if(btn){btn.disabled=true; btn.textContent='Verifying\u2026';}
    var r=await supabaseClient.auth.verifyOtp({ email: window.__authEmail, token:token, type:'email' });
    if(btn){btn.disabled=false; btn.textContent='Verify & sign in';}
    if(r.error){ msg(r.error.message); return; }
    msg('Signed in!', true); setTimeout(closeAuthModal, 900);
  };
  window.signOut=async function(){ if(typeof supabaseClient!=='undefined'&&supabaseClient){ await supabaseClient.auth.signOut(); } };
  function updateAccountUI(){
    var b=el('account-btn'); if(!b) return;
    if(_user){ b.classList.add('signed-in'); b.innerHTML='<span class="acct-initial">'+((_user.email||'?').charAt(0).toUpperCase())+'</span>'; b.setAttribute('aria-label','Account ('+(_user.email||'')+')'); }
    else { b.classList.remove('signed-in'); b.innerHTML='<i data-lucide="user"></i>'; if(window.lucide) lucide.createIcons(); }
  }
  async function syncPrefs(){
    if(!_user||typeof supabaseClient==='undefined'||!supabaseClient) return;
    try{
      var local=[]; try{ local=JSON.parse(localStorage.getItem('hs_seen')||'[]'); }catch(e){}
      var r=await supabaseClient.from('user_preferences').select('seen').eq('user_id', _user.id).maybeSingle();
      var dbSeen=(r.data&&r.data.seen)||[];
      var merged=Array.from(new Set(local.concat(dbSeen))).slice(0,12);
      localStorage.setItem('hs_seen', JSON.stringify(merged));
      await supabaseClient.from('user_preferences').upsert({ user_id:_user.id, seen:merged, updated_at:new Date().toISOString() });
      if(window.renderDynamicProducts) window.renderDynamicProducts();
    }catch(e){ console.warn('prefs sync', e); }
  }
  function init(){
    if(typeof supabaseClient==='undefined'||!supabaseClient) return;
    supabaseClient.auth.getSession().then(function(o){ _user=o.data.session?o.data.session.user:null; updateAccountUI(); if(_user) syncPrefs(); else { setTimeout(function(){ openAuthModal(); }, 800); } });
    supabaseClient.auth.onAuthStateChange(function(_e, session){ _user=session?session.user:null; updateAccountUI(); renderAuthState(); if(_user) syncPrefs(); });
    setInterval(function(){ if(_user) syncPrefs(); }, 45000);
    var ov=el('auth-modal'); if(ov && !ov.dataset.wired){ ov.dataset.wired='1'; ov.addEventListener('click', function(e){ if(e.target===ov) closeAuthModal(); }); }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

window.setVegMode = function(mode) {
  vegMode = mode;
  try { localStorage.setItem('hs_veg', mode); } catch(e) {}
  document.querySelectorAll('.veg-pill').forEach(b => b.classList.toggle('active', b.dataset.veg === mode));
  if (typeof renderDynamicProducts === 'function') renderDynamicProducts();
};
// Initialize active pill on load
if (document.readyState !== 'loading') {
  document.querySelectorAll('.veg-pill').forEach(b => b.classList.toggle('active', b.dataset.veg === vegMode));
} else {
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.veg-pill').forEach(b => b.classList.toggle('active', b.dataset.veg === vegMode));
  });
}

// ===== AI Chat Order Widget =====
function _initAIChat(){
  var SUPABASE_URL = (typeof STAFF_SUPA_URL !== 'undefined') ? STAFF_SUPA_URL :
    (typeof SUPABASE_URL_PUBLIC !== 'undefined') ? SUPABASE_URL_PUBLIC : null;
  var SUPABASE_KEY = (typeof STAFF_SUPA_ANON !== 'undefined') ? STAFF_SUPA_ANON :
    (typeof SUPABASE_ANON_KEY !== 'undefined') ? SUPABASE_ANON_KEY : null;

  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function mdRender(s){
    var t = esc(s);
    t = t.replace(/\[([^\]]+)\]\(((?:https?:\/\/|#|mailto:)[^)]+)\)/g, function(_, label, url){
      var safeUrl = url.replace(/"/g, '&quot;');
      return '<a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
    });
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/\n/g, '<br>');
    return t;
  }

  var fab = $('aiChatFab'), drawer = $('aiChatDrawer'), closeBtn = $('aiChatClose'),
      log = $('aiChatLog'), form = $('aiChatForm'), input = $('aiChatInput'), sendBtn = form ? form.querySelector('.ai-chat-send') : null;

  if (!fab || !drawer) return;

  var opened = false, greeted = false;

  function openDrawer(){
    drawer.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
    fab.setAttribute('data-state', 'open');
    opened = true;
    if (!greeted) { greet(); greeted = true; }
    setTimeout(function(){ if (input) input.focus(); }, 100);
  }
  function closeDrawer(){
    drawer.hidden = true;
    drawer.setAttribute('aria-hidden', 'true');
    fab.setAttribute('data-state', 'closed');
    opened = false;
  }
  fab.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && opened) closeDrawer(); });

  function addBot(html){
    var div = document.createElement('div');
    div.className = 'ai-chat-msg bot';
    div.innerHTML = html;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }
  function addUser(text){
    var div = document.createElement('div');
    div.className = 'ai-chat-msg user';
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }
  function addTyping(){
    var div = document.createElement('div');
    div.className = 'ai-chat-msg bot typing';
    div.innerHTML = '<span></span><span></span><span></span>';
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  function greet(){
    addBot('Hey! I can help you find your perfect pizza. Try <strong>"spicy chicken under $20"</strong> or tap a suggestion below.');
  }

  function renderProducts(products){
    if (!products || !products.length) return;
    var wrap = document.createElement('div');
    wrap.className = 'ai-chat-products';
    products.forEach(function(p){
      var card = document.createElement('div');
      card.className = 'ai-chat-product';
      card.setAttribute('data-pid', p.id);
      var img = p.image_url || 'assets/hero-pizza.png';
      var vegCls = p.is_veg ? '' : 'nonveg';
      var vegLbl = p.is_veg ? 'Veg' : 'Non-veg';
      card.innerHTML =
        '<img class="ai-chat-product-img" src="' + esc(img) + '" alt="' + esc(p.name) + '" loading="lazy">' +
        '<div class="ai-chat-product-body">' +
          '<div class="ai-chat-product-name">' + esc(p.name) + '</div>' +
          '<div class="ai-chat-product-meta">' +
            '<span class="ai-chat-product-veg ' + vegCls + '" title="' + vegLbl + '"></span>' +
            '<span class="ai-chat-product-price">$' + Number(p.price).toFixed(2) + '</span>' +
            '<span>&middot; ' + esc(p.category || '') + '</span>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="ai-chat-product-add">Add</button>';
      wrap.appendChild(card);
    });
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
    wrap.querySelectorAll('.ai-chat-product').forEach(function(card){
      var addBtn = card.querySelector('.ai-chat-product-add');
      function doAdd(e){
        if (e) e.stopPropagation();
        var pid = card.getAttribute('data-pid');
        addToCartFromChat(pid, addBtn);
      }
      addBtn.addEventListener('click', doAdd);
      card.addEventListener('click', doAdd);
    });
  }

  function addToCartFromChat(pid, btn){
    var added = false;
    try {
      if (typeof window.addToCart === 'function') {
        var prod = (typeof prodById === 'function') ? prodById(pid) : null;
        if (prod) { window.addToCart(prod); added = true; }
        else { window.addToCart(pid); added = true; }
      } else if (typeof window.cart !== 'undefined' && typeof prodById === 'function') {
        var p2 = prodById(pid);
        if (p2 && typeof window.cart.add === 'function') { window.cart.add(p2); added = true; }
      }
    } catch (err) { console.warn('addToCart failed', err); }
    if (added && btn) {
      btn.textContent = 'Added \u2713';
      btn.classList.add('added');
      setTimeout(function(){ btn.textContent = 'Add'; btn.classList.remove('added'); }, 1800);
    } else if (!added) {
      addBot('Couldn\'t add to cart automatically. Find it on the menu and tap Add.');
    }
  }

  async function sendMessage(text){
    text = String(text || '').trim();
    if (!text) return;
    addUser(text);
    input.value = '';
    if (sendBtn) sendBtn.disabled = true;
    var typing = addTyping();
    try {
      if (!SUPABASE_URL) throw new Error('Supabase not configured');
      var res = await fetch(SUPABASE_URL + '/functions/v1/chat-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY || '', 'Authorization': 'Bearer ' + (SUPABASE_KEY || '') },
        body: JSON.stringify({ message: text }),
      });
      var data = await res.json();
      typing.remove();
      addBot(mdRender(data.reply || 'Hmm.'));
      if (data.products && data.products.length) renderProducts(data.products);
    } catch (err) {
      typing.remove();
      addBot('Connection hiccup. Try again in a sec?');
      console.warn('chat error', err);
    } finally {
      if (sendBtn) sendBtn.disabled = false;
      if (input) input.focus();
    }
  }

  form.addEventListener('submit', function(e){ e.preventDefault(); sendMessage(input.value); });
  document.querySelectorAll('.ai-chat-chip').forEach(function(chip){
    chip.addEventListener('click', function(){ sendMessage(chip.getAttribute('data-q') || chip.textContent); });
  });
}
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', _initAIChat); } else { _initAIChat(); }


// ===== Pizza Lab 3D tilt parallax =====
(function initPizzaLabTilt(){
  function attach(){
    var stage = document.getElementById('bpStage');
    if (!stage || stage._tilt) return;
    stage._tilt = true;
    var box = stage.closest('.builder-canvas-box') || stage;
    var raf = null, tx = 0, ty = 0;
    box.addEventListener('pointermove', function(e){
      var r = stage.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      tx = px * 16; ty = -py * 16;
      if (!raf) raf = requestAnimationFrame(function(){
        stage.style.transform = 'rotateY(' + tx + 'deg) rotateX(' + ty + 'deg)';
        raf = null;
      });
    });
    box.addEventListener('pointerleave', function(){
      stage.style.transform = 'rotateY(0deg) rotateX(0deg)';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
  else attach();
})();
