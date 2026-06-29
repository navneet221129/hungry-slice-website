/* Hungry Slice Admin Console v2 — full integrated dashboard */
const SUPA_URL='https://wjhbkkthppbadcjnozal.supabase.co';
const SUPA_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqaGJra3RocHBiYWRjam5vemFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MDQ4MTUsImV4cCI6MjA5NjA4MDgxNX0.VC1rur9Y8lUCo_EW2DK3PJllsgyv6nIQEeEKJjg0IKs';
const sb = window.supabase.createClient(SUPA_URL, SUPA_ANON);
window.sb = sb;

let allOrders=[], allProducts=[], allCustomers={}, soundOn=true, currentFilter='active', currentView='kanban';
let currentTab='orders', currentOrderId=null, currentProduct=null;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const fmt = n => '$'+Number(n||0).toFixed(2);
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sid = id => String(id).slice(0,8);
const fmtNZTime = d => new Intl.DateTimeFormat('en-NZ',{timeZone:'Pacific/Auckland',hour:'2-digit',minute:'2-digit',hour12:true}).format(new Date(d)); // store TZ, not admin device
// items may arrive as an array (jsonb) or a JSON string; normalize so detail view never silently blanks
function parseItems(o){ let it=o&&o.items; if(typeof it==='string'){ try{ it=JSON.parse(it); }catch(_){ it=[]; } } return Array.isArray(it)?it:[]; }

/* ============ AUTH ============ */
async function login(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
async function logout() { await sb.auth.signOut(); location.reload(); }
async function logActivity(action, target_type, target_id, details) {
  try {
    const { data:{user} } = await sb.auth.getUser();
    await sb.from('admin_activity').insert({
      user_id:user?.id, user_email:user?.email,
      action, target_type, target_id: target_id?String(target_id):null, details
    });
  } catch(e) { console.warn('log fail', e); }
}

/* ============ ORDERS ============ */
async function loadOrders() {
  const { data, error } = await sb.from('orders').select('*').order('created_at',{ascending:false}).limit(200);
  if (error) { console.warn(error); }
  allOrders = data || [];
  renderOrders();
  renderStats();
  // 0 rows can mean: expired session, OR signed in as a non-admin (e.g. customer) account.
  // RLS hides orders from non-admins silently. Tell the user which it is.
  if (!error && allOrders.length === 0) {
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        showOrdersBanner('Your sign-in expired on this device — orders can\'t load.');
      } else {
        showOrdersBanner('Signed in as ' + (user.email || 'this account') + ' — it can\'t see orders. Sign out and sign in with your admin account.');
      }
    } catch (_) {
      showOrdersBanner('Your sign-in expired — please sign out and sign in again.');
    }
  } else {
    hideOrdersBanner();
  }
}
function showOrdersBanner(msg) {
  let b = document.getElementById('orders-banner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'orders-banner';
    b.style.cssText = 'background:#7f1d1d;color:#fff;padding:12px 16px;text-align:center;font-weight:600;font-size:0.9rem;line-height:1.5;';
    const dash = document.getElementById('dash-view');
    if (dash) dash.insertBefore(b, dash.firstChild);
  }
  b.textContent = msg + '  ';
  const btn = document.createElement('button');
  btn.textContent = 'Sign out';
  btn.style.cssText = 'margin-left:10px;padding:6px 12px;border:0;border-radius:8px;background:#fff;color:#7f1d1d;font-weight:700;cursor:pointer;';
  btn.onclick = logout;
  b.appendChild(btn);
}
function hideOrdersBanner() {
  const b = document.getElementById('orders-banner');
  if (b) b.remove();
}
function statusKey(s) { return s==='preparing'?'preparing':s==='oven'?'oven':s==='delivery'?'delivery':s==='delivered'?'delivered':s==='cancelled'?'cancelled':'received'; }
function filterOrders() {
  if (currentFilter==='all') return allOrders;
  if (currentFilter==='active') return allOrders.filter(o => !['delivered','cancelled'].includes(o.status));
  if (currentFilter==='recent') {
    const cutoff = Date.now() - 24*60*60*1000;
    return allOrders.filter(o => new Date(o.created_at).getTime() >= cutoff);
  }
  return allOrders.filter(o => statusKey(o.status)===currentFilter);
}
function renderOrders() {
  if (currentView==='kanban') renderKanban(); else renderList();
}
function renderKanban() {
  $('#kanban-board').style.display='grid';
  $('#orders-list').hidden=true;
  const cols = ['received','preparing','oven','delivery','delivered'];
  const filtered = filterOrders();
  cols.forEach(col => {
    const orders = filtered.filter(o => statusKey(o.status)===col);
    const container = document.querySelector(`[data-cards="${col}"]`);
    document.querySelector(`[data-count="${col}"]`).textContent = orders.length;
    container.innerHTML = orders.map(o => kanbanCardHTML(o)).join('') || '<div style="color:#444;font-size:.75rem;text-align:center;padding:20px;">— empty —</div>';
  });
  wireKanbanDrag();
}
function kanbanCardHTML(o) {
  const arr = parseItems(o);
  // show the FULL order on the card itself (kitchen reads it without opening)
  const itemsHtml = arr.length
    ? arr.map(i => `<div class="kc-line">${i.qty}× ${esc(i.name)}${i.details ? ` <span class="kc-detail">${esc(i.details)}</span>` : ''}</div>`).join('')
    : '<div class="kc-line" style="color:#666;">No items recorded</div>';
  const t = new Date(o.created_at);
  const pickupBadge = o.delivery_method==='pickup' && o.pickup_time
    ? `<div class="kc-pickup">Pickup ${fmtNZTime(o.pickup_time)}</div>`
    : '';
  const methodBadge = `<span class="kc-method">${o.delivery_method==='pickup'?'🏬 Pickup':'🛵 Delivery'}</span>`;
  return `<div class="kanban-card" draggable="true" data-oid="${o.id}" onclick="openOrderModal('${o.id}')">
    <div class="kc-id">#${sid(o.id)} ${methodBadge}</div>
    <div class="kc-name">${esc(o.customer_name||'Anonymous')}</div>
    <div class="kc-items">${itemsHtml}</div>
    ${pickupBadge}
    <div class="kc-meta"><span>${t.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span><span class="kc-total">${fmt(o.total)}</span></div>
  </div>`;
}
function renderList() {
  $('#kanban-board').style.display='none';
  $('#orders-list').hidden=false;
  const filtered = filterOrders();
  $('#orders-list').innerHTML = filtered.length ? filtered.map(o => kanbanCardHTML(o)).join('') : '<div class="empty-state">No orders</div>';
}
function wireKanbanDrag() {
  $$('.kanban-card').forEach(c => {
    c.ondragstart = e => { c.classList.add('dragging'); e.dataTransfer.setData('oid', c.dataset.oid); };
    c.ondragend = () => c.classList.remove('dragging');
  });
  $$('.kanban-cards').forEach(col => {
    col.ondragover = e => { e.preventDefault(); col.classList.add('drop-target'); };
    col.ondragleave = () => col.classList.remove('drop-target');
    col.ondrop = async e => {
      e.preventDefault(); col.classList.remove('drop-target');
      const oid = e.dataTransfer.getData('oid');
      const newStatus = col.dataset.cards;
      await updateOrderStatus(oid, newStatus);
    };
  });
}
async function updateOrderStatus(oid, newStatus) {
  const { error } = await sb.from('orders').update({ status:newStatus }).eq('id',oid);
  if (error) return alert('Update failed: '+error.message);
  await logActivity('status_change', 'order', oid, { to:newStatus });
  await loadOrders();
}
function renderStats() {
  const today = new Date(); today.setHours(0,0,0,0);
  const todays = allOrders.filter(o => new Date(o.created_at)>=today && o.status!=='cancelled');
  const revenue = todays.reduce((s,o) => s+Number(o.total||0), 0);
  const active = allOrders.filter(o => !['delivered','cancelled'].includes(o.status)).length;
  $('#stat-today').textContent = todays.length;
  $('#stat-revenue').textContent = fmt(revenue);
  $('#stat-active').textContent = active;
  $('#stat-aov').textContent = fmt(todays.length ? revenue/todays.length : 0);
}

/* ============ ORDER MODAL ============ */
window.openOrderModal = async function(oid) {
  currentOrderId = oid;
  const o = allOrders.find(x => x.id===oid);
  if (!o) return;
  const _items = parseItems(o);
  const items = _items.length ? _items.map(i => `<li><span>${i.qty}× ${esc(i.name)}</span><span>${fmt(i.price*i.qty)}</span></li>`).join('') : '<li style="color:#888;">No items recorded for this order</li>';
  const t = new Date(o.created_at);
  const statusBtns = ['received','preparing','oven','delivery','delivered'].map(s =>
    `<button class="om-status-btn ${statusKey(o.status)===s?'active':''}" onclick="setOrderStatus('${oid}','${s}')">${s}</button>`
  ).join('');
  $('#order-modal-body').innerHTML = `
    <h2>${esc(o.customer_name||'Anonymous')} <small>#${sid(oid)}</small></h2>
    <div style="color:#888; font-size:0.85rem;">${t.toLocaleString()}</div>
    <div class="om-section"><strong>Contact</strong>
      Phone: ${esc(o.customer_phone||'—')}<br>
      Email: ${esc(o.customer_email||'—')}
    </div>
    <div class="om-section"><strong>${o.delivery_method==='pickup'?'Pickup':'Delivery'}</strong>
      ${o.delivery_method==='delivery' ? esc(o.delivery_address||'—')+'<br>Postcode: '+esc(o.postcode||'—') : 'Customer collects in-store — ' + (o.pickup_time ? 'Scheduled for ' + fmtNZTime(o.pickup_time) : 'ASAP')}
    </div>
    <div class="om-section"><strong>Items</strong>
      <ul class="om-items">${items}</ul>
      <div style="display:flex;justify-content:space-between;margin-top:8px;color:#888;">
        <span>Subtotal</span><span>${fmt(o.subtotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;color:#888;">
        <span>Delivery</span><span>${fmt(o.delivery_fee)}</span>
      </div>
      ${o.discount>0?`<div style="display:flex;justify-content:space-between;color:#888;"><span>Discount</span><span>-${fmt(o.discount)}</span></div>`:''}
      <div class="om-total">${fmt(o.total)}</div>
    </div>
    <div class="om-section"><strong>Update Status</strong>
      <div class="om-status-btns">${statusBtns}</div>
    </div>
    ${o.cancellation_reason?`<div class="om-section" style="background:rgba(239,68,68,0.1);"><strong>Cancelled</strong>${esc(o.cancellation_reason)}</div>`:''}
    <div class="modal-actions">
      ${o.status!=='cancelled'?`<button class="om-danger-btn" onclick="cancelOrder('${oid}')">Cancel Order</button>`:''}
      <button class="ghost-btn" onclick="notifyOrderCustomer('${oid}')">Resend Receipt</button>
    </div>
  `;
  $('#order-modal').hidden = false;
};
window.closeOrderModal = () => { $('#order-modal').hidden=true; currentOrderId=null; };
window.setOrderStatus = async (oid, s) => { await updateOrderStatus(oid, s); openOrderModal(oid); };
window.cancelOrder = async (oid) => {
  const reason = prompt('Reason for cancellation?'); if (!reason) return;
  await sb.from('orders').update({ status:'cancelled', cancellation_reason:reason }).eq('id', oid);
  await logActivity('cancel', 'order', oid, { reason });
  await loadOrders(); closeOrderModal();
};
window.notifyOrderCustomer = async (oid) => {
  const r = await fetch(`${SUPA_URL}/functions/v1/notify-order`, {
    method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${SUPA_ANON}`,'apikey':SUPA_ANON},
    body: JSON.stringify({ orderId: oid })
  });
  const d = await r.json();
  alert('Email: '+d.email+'\nSMS: '+d.sms);
  await logActivity('resend_receipt','order',oid,d);
};

/* ============ MENU CRUD ============ */
async function loadProducts() {
  const { data } = await sb.from('products').select('*').order('category').order('name');
  allProducts = data || [];
  const cats = [...new Set(allProducts.map(p => p.category).filter(Boolean))];
  $('#menu-cat-filter').innerHTML = '<option value="">All categories</option>'+cats.map(c => `<option>${esc(c)}</option>`).join('');
  $('#cat-list').innerHTML = cats.map(c => `<option value="${esc(c)}">`).join('');
  renderProducts();
}
function renderProducts() {
  const q = $('#menu-search').value.toLowerCase();
  const cat = $('#menu-cat-filter').value;
  const filtered = allProducts.filter(p =>
    (!q || p.name.toLowerCase().includes(q) || (p.description||'').toLowerCase().includes(q))
    && (!cat || p.category===cat)
  );
  $('#products-grid').innerHTML = filtered.length ? filtered.map(productCardHTML).join('') : '<div class="empty-state">No products</div>';
}
function productCardHTML(p) {
  const flag = !p.is_available ? '<span class="prod-flag unavailable">UNAVAILABLE</span>' : p.out_of_stock ? '<span class="prod-flag oos">OUT OF STOCK</span>' : '<span class="prod-flag available">AVAILABLE</span>';
  return `<div class="prod-card" onclick="openProductEditor('${p.id}')">
    <div class="prod-img" style="background-image:url('${esc(p.image_url||'')}')"></div>
    <div class="prod-info">
      <div class="prod-cat">${esc(p.category||'—')}</div>
      <div class="prod-name">${esc(p.name)}</div>
      <div class="prod-price">${fmt(p.price)}</div>
      <div class="prod-flags">${flag}</div>
    </div>
  </div>`;
}
window.openProductEditor = function(pid) {
  currentProduct = pid ? allProducts.find(p => p.id===pid) : null;
  $('#product-modal-title').textContent = pid ? 'Edit Product' : 'New Product';
  $('#pf-name').value = currentProduct?.name || '';
  $('#pf-category').value = currentProduct?.category || '';
  $('#pf-price').value = currentProduct?.price || '';
  $('#pf-description').value = currentProduct?.description || '';
  $('#pf-image').value = currentProduct?.image_url || '';
  $('#pf-video').value = currentProduct?.video_url || '';
  $('#pf-video-poster').value = currentProduct?.video_poster || '';
  const _vs = $('#pf-video-status'); if (_vs) _vs.textContent = '';
  const _vf = $('#pf-video-file'); if (_vf) _vf.value = '';
  $('#pf-available').checked = currentProduct ? !!currentProduct.is_available : true;
  $('#pf-oos').checked = currentProduct ? !!currentProduct.out_of_stock : false;
  $('#pf-delete').hidden = !pid;
  $('#product-modal').hidden = false;
};
window.closeProductModal = () => { $('#product-modal').hidden=true; };
async function saveProduct(e) {
  e.preventDefault();
  const obj = {
    name:$('#pf-name').value.trim(),
    category:$('#pf-category').value.trim(),
    price:Number($('#pf-price').value),
    description:$('#pf-description').value.trim(),
    image_url:$('#pf-image').value.trim(),
    video_url:$('#pf-video').value.trim() || null,
    video_poster:$('#pf-video-poster').value.trim() || null,
    is_available:$('#pf-available').checked,
    out_of_stock:$('#pf-oos').checked
  };
  if (currentProduct) {
    const { error } = await sb.from('products').update(obj).eq('id', currentProduct.id);
    if (error) return alert(error.message);
    await logActivity('update','product',currentProduct.id,obj);
  } else {
    const { error } = await sb.from('products').insert(obj);
    if (error) return alert(error.message);
    await logActivity('create','product',null,obj);
  }
  closeProductModal(); await loadProducts();
}
async function deleteProduct() {
  if (!currentProduct || !confirm(`Delete "${currentProduct.name}"?`)) return;
  const { error } = await sb.from('products').delete().eq('id', currentProduct.id);
  if (error) return alert(error.message);
  await logActivity('delete','product',currentProduct.id,{name:currentProduct.name});
  closeProductModal(); await loadProducts();
}

/* ============ CUSTOMERS ============ */
async function loadCustomers() {
  const { data } = await sb.from('orders').select('customer_name,customer_phone,customer_email,total,created_at').order('created_at',{ascending:false}).limit(500);
  const map = {};
  (data||[]).forEach(o => {
    const key = o.customer_phone || o.customer_email || o.customer_name || 'anon';
    if (!map[key]) map[key] = { key, name:o.customer_name, phone:o.customer_phone, email:o.customer_email, orders:0, spent:0, last:o.created_at };
    map[key].orders++; map[key].spent += Number(o.total||0);
    if (o.created_at > map[key].last) map[key].last = o.created_at;
  });
  allCustomers = map;
  renderCustomers();
}
function renderCustomers() {
  const q = $('#cust-search').value.toLowerCase();
  const list = Object.values(allCustomers).filter(c =>
    !q || (c.name||'').toLowerCase().includes(q) || (c.phone||'').includes(q) || (c.email||'').toLowerCase().includes(q)
  ).sort((a,b) => b.spent - a.spent);
  $('#customers-list').innerHTML = list.length ? list.map(c => `
    <div class="cust-row">
      <div>
        <div class="cust-name">${esc(c.name||'Anonymous')}</div>
        <div class="cust-meta">${esc(c.phone||'—')} • ${esc(c.email||'—')} • last ${new Date(c.last).toLocaleDateString()}</div>
      </div>
      <div class="cust-stats">
        <div class="cust-stat"><div class="cust-stat-num">${c.orders}</div><div class="cust-stat-lbl">Orders</div></div>
        <div class="cust-stat"><div class="cust-stat-num">${fmt(c.spent)}</div><div class="cust-stat-lbl">Spent</div></div>
      </div>
    </div>`).join('') : '<div class="empty-state">No customers yet</div>';
}

/* ============ ANALYTICS ============ */
let charts = {};
async function loadAnalytics() {
  const [{data:daily}, {data:hourly}, {data:top}, {data:suburb}] = await Promise.all([
    sb.from('daily_sales').select('*').limit(7),
    sb.from('hourly_orders').select('*'),
    sb.from('product_sales').select('*').limit(10),
    sb.from('suburb_orders').select('*').limit(15)
  ]);
  renderRevenueChart(daily||[]);
  renderHourlyChart(hourly||[]);
  renderTopChart(top||[]);
  renderSuburb(suburb||[]);
}
function renderRevenueChart(data) {
  const labels = data.slice().reverse().map(d => new Date(d.day).toLocaleDateString([],{month:'short',day:'numeric'}));
  const values = data.slice().reverse().map(d => Number(d.revenue));
  charts.revenue?.destroy();
  charts.revenue = new Chart($('#chart-revenue'), {
    type:'line', data:{labels, datasets:[{label:'Revenue $', data:values, borderColor:'#ff5500', backgroundColor:'rgba(255,85,0,0.1)', fill:true, tension:0.3}]},
    options:{plugins:{legend:{labels:{color:'#888'}}}, scales:{y:{ticks:{color:'#888'}, grid:{color:'rgba(255,255,255,0.05)'}}, x:{ticks:{color:'#888'}, grid:{color:'rgba(255,255,255,0.05)'}}}}
  });
}
function renderHourlyChart(data) {
  const byHour = {};
  data.forEach(d => { byHour[d.hour] = (byHour[d.hour]||0) + d.orders; });
  const labels = [];
  const values = [];
  for (let h=0; h<24; h++) { labels.push(h+'h'); values.push(byHour[h]||0); }
  charts.hourly?.destroy();
  charts.hourly = new Chart($('#chart-hourly'), {
    type:'bar', data:{labels, datasets:[{label:'Orders', data:values, backgroundColor:'rgba(255,85,0,0.7)'}]},
    options:{plugins:{legend:{labels:{color:'#888'}}}, scales:{y:{ticks:{color:'#888'}, grid:{color:'rgba(255,255,255,0.05)'}}, x:{ticks:{color:'#888'}, grid:{display:false}}}}
  });
}
function renderTopChart(data) {
  const labels = data.map(d => d.product_name);
  const values = data.map(d => d.units_sold);
  charts.top?.destroy();
  charts.top = new Chart($('#chart-top'), {
    type:'bar', data:{labels, datasets:[{label:'Units sold', data:values, backgroundColor:'rgba(255,85,0,0.7)'}]},
    options:{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{ticks:{color:'#888'}, grid:{color:'rgba(255,255,255,0.05)'}}, y:{ticks:{color:'#888',font:{size:11}}, grid:{display:false}}}}
  });
}
function renderSuburb(data) {
  $('#suburb-list').innerHTML = data.length ? data.map(s => `<div class="suburb-row"><span>${esc(s.postcode)}</span><span><strong>${s.orders}</strong> orders · ${fmt(s.revenue)}</span></div>`).join('') : '<div class="empty-state">No data</div>';
}

/* ============ REVIEWS ============ */
async function loadReviews() {
  const { data } = await sb.from('reviews').select('*').order('created_at',{ascending:false}).limit(200);
  renderReviews(data || []);
}
function renderReviews(reviews) {
  const f = $('#rev-filter').value;
  let list = reviews;
  if (f==='visible') list = list.filter(r => !r.hidden);
  if (f==='hidden') list = list.filter(r => r.hidden);
  if (f==='low') list = list.filter(r => r.rating<=2);
  $('#reviews-list').innerHTML = list.length ? list.map(r => `
    <div class="rev-row ${r.hidden?'hidden-rev':''}">
      <div class="rev-stars">${'★'.repeat(r.rating||0)}${'☆'.repeat(5-(r.rating||0))}</div>
      <div class="rev-body">
        <strong>${esc(r.customer_name||'Anonymous')}</strong>
        <p>${esc(r.comment||'')}</p>
        <small style="color:#666;">${new Date(r.created_at).toLocaleString()}</small>
      </div>
      <div class="rev-actions">
        <button class="ghost-btn" onclick="toggleReviewHidden('${r.id}', ${r.hidden})">${r.hidden?'Show':'Hide'}</button>
        <button class="ghost-btn" onclick="deleteReview('${r.id}')">Delete</button>
      </div>
    </div>`).join('') : '<div class="empty-state">No reviews</div>';
}
window.toggleReviewHidden = async (id, was) => {
  await sb.from('reviews').update({ hidden: !was }).eq('id', id);
  await logActivity(was?'unhide':'hide','review',id,null);
  await loadReviews();
};
window.deleteReview = async (id) => {
  if (!confirm('Delete this review?')) return;
  await sb.from('reviews').delete().eq('id', id);
  await logActivity('delete','review',id,null);
  await loadReviews();
};

/* ============ SETTINGS ============ */
async function loadSettings() {
  const { data } = await sb.from('store_settings').select('*').eq('id',1).single();
  if (!data) return;
  $('#set-isopen').checked = data.is_open;
  $('#set-busy').checked = data.busy_mode;
  $('#set-prep').value = data.prep_time_minutes;
  $('#set-open').value = data.open_hour;
  $('#set-close').value = data.close_hour;
  $('#set-msg').value = data.store_message || '';
  updateStorePill(data);
}
function updateStorePill(s) {
  const pill = $('#store-status-pill');
  pill.textContent = s.is_open ? '● OPEN' : '● CLOSED';
  pill.className = 'status-pill '+(s.is_open?'open':'closed');
  $('#busy-pill').hidden = !s.busy_mode;
}
async function saveSettings() {
  const obj = {
    is_open: $('#set-isopen').checked,
    busy_mode: $('#set-busy').checked,
    prep_time_minutes: Number($('#set-prep').value),
    open_hour: Number($('#set-open').value),
    close_hour: Number($('#set-close').value),
    store_message: $('#set-msg').value.trim() || null,
    updated_at: new Date().toISOString()
  };
  const { error } = await sb.from('store_settings').update(obj).eq('id',1);
  if (error) return alert(error.message);
  await logActivity('update','settings',1,obj);
  updateStorePill(obj);
  alert('Saved');
}

/* ============ ACTIVITY ============ */
async function loadActivity() {
  const { data } = await sb.from('admin_activity').select('*').order('created_at',{ascending:false}).limit(200);
  $('#activity-list').innerHTML = (data||[]).length ? data.map(a => `
    <div class="act-row">
      <div>
        <div class="act-user">${esc(a.user_email||'system')}</div>
        <div class="act-action">${esc(a.action)} ${a.target_type?'• '+a.target_type:''} ${a.target_id?'#'+sid(a.target_id):''}</div>
      </div>
      <div class="act-time">${new Date(a.created_at).toLocaleString()}</div>
    </div>`).join('') : '<div class="empty-state">No activity yet</div>';
}

/* ============ TABS ============ */
function switchTab(tab) {
  currentTab = tab;
  $$('.ptab').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
  $$('.tab-pane').forEach(p => p.classList.toggle('active', p.id==='tab-'+tab));
  if (tab==='menu' && !allProducts.length) loadProducts();
  if (tab==='customers' && !Object.keys(allCustomers).length) loadCustomers();
  if (tab==='analytics') loadAnalytics();
  if (tab==='reviews') loadReviews();
  if (tab==='settings') loadSettings();
  if (tab==='activity') loadActivity();
}

/* ============ REALTIME + SOUND ============ */
function playBeep() {
  if (!soundOn) return;
  try {
    const ac = new (window.AudioContext||window.webkitAudioContext)();
    const o = ac.createOscillator(); const g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.frequency.value = 880; g.gain.value = 0.1;
    o.start(); setTimeout(()=>{o.stop(); ac.close();}, 200);
  } catch(e) {}
}
function notify(o) {
  playBeep();
  if (Notification && Notification.permission==='granted') {
    new Notification('New Order #'+sid(o.id), { body: (o.customer_name||'') + ' • ' + fmt(o.total) });
  }
}
function startRealtime() {
  sb.channel('orders-rt').on('postgres_changes', {event:'INSERT', schema:'public', table:'orders'}, (p) => {
    notify(p.new); loadOrders();
  }).on('postgres_changes', {event:'UPDATE', schema:'public', table:'orders'}, () => loadOrders()).subscribe();
}

/* ============ INIT ============ */
async function showDash() {
  $('#login-view').hidden = true;
  $('#dash-view').hidden = false;
  if (Notification && Notification.permission==='default') Notification.requestPermission();
  await loadOrders();
  await loadSettings();
  startRealtime();
  setInterval(loadOrders, 30000);
}
document.addEventListener('DOMContentLoaded', async () => {
  const { data:{session} } = await sb.auth.getSession();
  if (session) showDash();
  $('#login-form').onsubmit = async e => {
    e.preventDefault();
    try { await login($('#login-email').value, $('#login-password').value); await logActivity('login','auth',null,null); showDash(); }
    catch(err) { $('#login-error').textContent = err.message; }
  };
  $('#logout-btn').onclick = async () => { await logActivity('logout','auth',null,null); logout(); };
  $('#sound-toggle').onclick = () => {
    soundOn = !soundOn;
    $('#sound-toggle').textContent = '🔔 Sound: '+(soundOn?'On':'Off');
  };
  $$('.ptab').forEach(b => b.onclick = () => switchTab(b.dataset.tab));
  $$('.ftab').forEach(b => b.onclick = () => {
    $$('.ftab').forEach(x => x.classList.remove('active')); b.classList.add('active');
    currentFilter = b.dataset.f; renderOrders();
  });
  $$('.vt-btn').forEach(b => b.onclick = () => {
    $$('.vt-btn').forEach(x => x.classList.remove('active')); b.classList.add('active');
    currentView = b.dataset.view; renderOrders();
  });
  $('#menu-search').oninput = renderProducts;
  $('#menu-cat-filter').onchange = renderProducts;
  $('#cust-search').oninput = renderCustomers;
  $('#rev-filter').onchange = loadReviews;
  $('#product-form').onsubmit = saveProduct;
  $('#pf-delete').onclick = deleteProduct;
  $('#save-settings').onclick = saveSettings;
  // close modals on overlay click
  $$('.modal-overlay').forEach(m => m.onclick = e => { if (e.target===m) m.hidden=true; });
});


/* ===== Product video upload ===== */
(function wireVideoUpload(){
  function attach(){
    var btn = document.getElementById('pf-video-upload-btn');
    if (!btn || btn._wired) return;
    btn._wired = true;
    btn.addEventListener('click', async function(){
      var fileEl = document.getElementById('pf-video-file');
      var statusEl = document.getElementById('pf-video-status');
      var urlEl = document.getElementById('pf-video');
      if (!fileEl || !fileEl.files || !fileEl.files[0]) { if (statusEl) statusEl.textContent = 'Pick a file first.'; return; }
      var file = fileEl.files[0];
      if (file.size > 20 * 1024 * 1024) { if (statusEl) statusEl.textContent = 'Max 20MB.'; return; }
      btn.disabled = true;
      if (statusEl) statusEl.textContent = 'Uploading...';
      try {
        var ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
        var safeId = (typeof currentProduct !== 'undefined' && currentProduct && currentProduct.id) ? currentProduct.id : 'new-' + Date.now();
        var key = 'videos/' + safeId + '-' + Date.now() + '.' + ext;
        var up = await sb.storage.from('product-media').upload(key, file, { contentType: file.type, upsert: true });
        if (up.error) throw up.error;
        var pub = sb.storage.from('product-media').getPublicUrl(key);
        var publicUrl = pub.data && pub.data.publicUrl;
        if (!publicUrl) throw new Error('No public URL returned');
        urlEl.value = publicUrl;
        if (statusEl) statusEl.textContent = 'Uploaded ✓  ' + (file.size/1024/1024).toFixed(2) + ' MB';
      } catch (err) {
        if (statusEl) statusEl.textContent = 'Upload failed: ' + (err.message || err);
        console.error(err);
      } finally { btn.disabled = false; }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
  else attach();
})();
