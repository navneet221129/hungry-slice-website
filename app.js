

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

function renderDynamicProducts() {
  const track = document.getElementById('product-showcase-track');
  if (!track) return;

  let filtered = databaseProducts;
  if (selectedCategory !== 'All') filtered = filtered.filter(p => p.category === selectedCategory);
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
      'https://images.unsplash.com/photo-1550547660-d9450f8a745b?w=420&q=80&fit=crop',
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
      'https://images.unsplash.com/photo-1573080496219-bb964c6be19c?w=420&q=80&fit=crop',
    ],
    'Value Sides': [
      'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1518013431117-eb1465fa5752?w=420&q=80&fit=crop',
    ],
    'Desserts': [
      'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=420&q=80&fit=crop',
      'https://images.unsplash.com/photo-1548365328-8c6db3220f2e?w=420&q=80&fit=crop',
    ],
  };
  const _default = ['https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=420&q=80&fit=crop'];

  // Track index per category for rotation
  const _catIdx = {};

  track.innerHTML = filtered.map(p => {
    if (!p.is_available) return '';
    const pool = _imgPools[p.category] || _default;
    _catIdx[p.category] = (_catIdx[p.category] || 0);
    const img = pool[_catIdx[p.category] % pool.length];
    _catIdx[p.category]++;
    const safeName = p.name.replace(/'/g, "\'");
    return `
      <div class="plc" data-pizza-id="${p.id}" data-name="${p.name}" data-price="${p.price}">
        <div class="plc-img-wrap">
          <img src="${img}" alt="${p.name}" class="plc-img" loading="lazy">
          <span class="plc-cat-tag">${p.category}</span>
        </div>
        <div class="plc-body">
          <h3 class="plc-name">${p.name}</h3>
          <p class="plc-desc">${p.description || ''}</p>
          <div class="plc-foot">
            <div>
              <div class="plc-stars">★★★★★ <span>4.9</span></div>
              <div class="plc-price">$${Number(p.price).toFixed(2)}</div>
            </div>
            <button class="plc-add-btn" onclick="addProductToCart('${p.id}','${safeName}',${p.price},'${img}')">+ Add</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  if (typeof syncMenuCardSteppers === 'function') syncMenuCardSteppers();
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
  
  track.innerHTML = reviewsList.map(r => `
    <div class="review-card glass-card">
      <div class="review-rating">${'⭐'.repeat(r.rating)}${'•'.repeat(5 - r.rating)}</div>
      <p>"${r.comment}"</p>
      <div class="reviewer-meta">
        <div class="reviewer-avatar">${r.customer_name.charAt(0)}</div>
        <div>
          <h4>${r.customer_name}</h4>
          <span>${r.neighborhood}, Hamilton</span>
        </div>
      </div>
    </div>
  `).join('');
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

function addToppingsToCanvas(topping) {
  const container = document.getElementById('rendered-toppings');
  if (!container) return;

  const toppingPhotos = {
    pepperoni: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=80&q=80&fit=crop&crop=center',
    basil:     'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=80&q=80&fit=crop&crop=center',
    jalapeno:  'https://images.unsplash.com/photo-1588169770080-c33b4e39cf44?w=80&q=80&fit=crop&crop=center',
    mushrooms: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=80&q=80&fit=crop&crop=center',
    chicken:   'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=80&q=80&fit=crop&crop=center',
    onions:    'https://images.unsplash.com/photo-1598511796432-32d9c0ed32c5?w=80&q=80&fit=crop&crop=center',
  };

  const imgSrc = toppingPhotos[topping] || toppingPhotos.pepperoni;

  toppingCoordinates.forEach((coord, i) => {
    const item = document.createElement('div');
    item.className = `rendered-topping topping-node-${topping}`;
    item.style.top = coord.top;
    item.style.left = coord.left;
    item.style.animationDelay = `${i * 30}ms`;

    const img = document.createElement('img');
    img.src = imgSrc;
    img.alt = topping;
    item.appendChild(img);

    container.appendChild(item);
  });
}

function removeToppingsFromCanvas(topping) {
  const container = document.getElementById('rendered-toppings');
  if (!container) return;
  const nodes = container.querySelectorAll(`.topping-node-${topping}`);
  nodes.forEach(n => n.remove());
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
  }, 25000); // Progresses step every 25 seconds in simulator
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
        if (entry.isIntersecting && !simulationStarted) {
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
  checkoutStep: 1
};

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

  if (method === 'delivery') {
    if (delBtn) delBtn.classList.add('active');
    if (pickBtn) pickBtn.classList.remove('active');
    if (addressBox) addressBox.style.display = 'flex';
    if (landmarkBox) landmarkBox.style.display = 'flex';
  } else {
    if (delBtn) delBtn.classList.remove('active');
    if (pickBtn) pickBtn.classList.add('active');
    if (addressBox) addressBox.style.display = 'none';
    if (landmarkBox) landmarkBox.style.display = 'none';
  }

  updateCartUI();
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

// Gathers totals and pushes order to Supabase table
async function submitOrderToDatabase(paymentToken) {
  const totals = calculateCartTotals();
  const phone = document.getElementById('ship-phone').value.trim();
  const address = document.getElementById('ship-address') ? document.getElementById('ship-address').value.trim() : '';
  const landmark = document.getElementById('ship-landmark') ? document.getElementById('ship-landmark').value.trim() : '';
  const fullAddress = landmark ? `${address} (Landmark: ${landmark})` : address;
  const postcode = document.getElementById('ship-postcode').value.trim();
  const cardName = document.getElementById('paynuts-cardholder').value.trim() || 'Anonymous Customer';

  const orderItems = cartState.items.map(item => ({
    id: item.id,
    name: item.name,
    qty: item.qty,
    price: item.price,
    details: item.details
  }));

  // Attempt charge via Till Payments gateway (with 3DS/OTP support)
  let chargeRef = null;
  const paynuKey = localStorage.getItem('paynuts_key');
  const paynuHost = localStorage.getItem('paynuts_host') || 'https://gateway.tillpayments.com';

  const orderData = {
    customer_name: cardName,
    customer_phone: phone,
    delivery_method: cartState.deliveryMethod,
    delivery_address: cartState.deliveryMethod === 'delivery' ? fullAddress : 'Pickup',
    postcode: postcode,
    items: orderItems,
    subtotal: totals.subtotal,
    delivery_fee: totals.deliveryFee,
    discount: totals.discount,
    total: totals.total,
    status: 'received',
    payment_token: paymentToken || null
  };

  if (paymentToken && paynuKey && !paymentToken.startsWith('mock_tok_')) {
    try {
      const SUPA_URL = 'https://wjhbkkthppbadcjnozal.supabase.co';
      const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqaGJra3RocHBiYWRjam5vemFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MDQ4MTUsImV4cCI6MjA5NjA4MDgxNX0.VC1rur9Y8lUCo_EW2DK3PJllsgyv6nIQEeEKJjg0IKs';
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
          description: 'The Hungry Slice Order'
        })
      });
      const chargeData = await chargeRes.json();
      console.log('Till charge response:', chargeData);
      if (chargeData.success) {
        chargeRef = chargeData.chargeRef || 'charged';
        console.log('Till Payments charge successful:', chargeData);
      } else {
        console.warn('Till Payments charge declined/failed:', chargeData.error, chargeData);
      }
    } catch (err) {
      console.warn('Till Payments charge attempt failed (CORS or network):', err.message);
    }
  }

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('orders')
        .insert([orderData])
        .select();

      if (error) {
        console.error("Supabase insert error:", error);
        alert(`Order placed! Running in Offline Simulator Mode (Database fallback active).\nPayment Token: ${paymentToken || 'None'}`);
        openSuccessModal('Order Placed!', 'Running in Offline Simulator Mode. Your order is registered locally!');
        runSimulatedOrder();
      } else if (data && data.length > 0) {
        const orderId = data[0].id;
        alert(`Order placed! Your order has been registered in the database.\nLive Tracking ID: ${orderId}\nPayment Token: ${paymentToken || 'None'}`);
        openSuccessModal('Order Placed!', `Your order has been registered in the database. Live Tracking ID: ${orderId}`);
        subscribeToOrderTracker(orderId);
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
  
  activeTrackingChannel = supabaseClient
    .channel(`order-status-${orderId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`
      },
      (payload) => {
        console.log("Realtime order status change received:", payload.new.status);
        const statusMap = { 'preparing': 'prep' };
        const trackerKey = statusMap[payload.new.status] || payload.new.status;
        updateTrackerUI(trackerKey);
      }
    )
    .subscribe((status) => {
      console.log("Supabase Realtime subscription state:", status);
    });
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
