/* Hungry Slice — Admin Order Console */
const SUPA_URL = 'https://wjhbkkthppbadcjnozal.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqaGJra3RocHBiYWRjam5vemFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MDQ4MTUsImV4cCI6MjA5NjA4MDgxNX0.VC1rur9Y8lUCo_EW2DK3PJllsgyv6nIQEeEKJjg0IKs';
const sb = window.supabase.createClient(SUPA_URL, SUPA_ANON);

const STATUSES = [
  {key:'received',  label:'Received'},
  {key:'preparing', label:'Preparing'},
  {key:'oven',      label:'In Oven'},
  {key:'delivery',  label:'Out for Delivery'},
  {key:'delivered', label:'Delivered'},
];
const STATUS_LABEL = Object.fromEntries(STATUSES.map(s => [s.key, s.label]));

let allOrders = [];
let activeFilter = 'active';
let soundOn = true;
let channel = null;

const loginView = document.getElementById('login-view');
const dashView  = document.getElementById('dash-view');

async function init(){
  const { data:{ session } } = await sb.auth.getSession();
  session ? showDash() : showLogin();
  sb.auth.onAuthStateChange((_e, s) => { s ? showDash() : showLogin(); });
}
function showLogin(){
  loginView.hidden = false; dashView.hidden = true;
  if(channel){ sb.removeChannel(channel); channel = null; }
}
function showDash(){
  loginView.hidden = true; dashView.hidden = false;
  loadOrders(); subscribe();
  if('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  errEl.textContent = ''; btn.disabled = true; btn.textContent = 'Signing in…';
  const { error } = await sb.auth.signInWithPassword({ email, password });
  btn.disabled = false; btn.textContent = 'Sign In';
  if(error) errEl.textContent = error.message;
});
document.getElementById('logout-btn').addEventListener('click', () => sb.auth.signOut());

async function loadOrders(){
  const { data, error } = await sb.from('orders').select('*').order('created_at', { ascending:false }).limit(200);
  if(error){ document.getElementById('orders-list').innerHTML = `<div class="empty-state">Error loading orders: ${escapeHtml(error.message)}</div>`; return; }
  allOrders = data || [];
  render();
}

function subscribe(){
  if(channel) sb.removeChannel(channel);
  const dot = document.getElementById('live-dot');
  channel = sb.channel('admin-orders')
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'orders' }, (p) => {
      if(!allOrders.find(o => o.id === p.new.id)) allOrders.unshift(p.new);
      render(); onNewOrder(p.new);
    })
    .on('postgres_changes', { event:'UPDATE', schema:'public', table:'orders' }, (p) => {
      const i = allOrders.findIndex(o => o.id === p.new.id);
      if(i > -1) allOrders[i] = p.new; render();
    })
    .subscribe((st) => {
      if(dot){ dot.classList.toggle('off', st !== 'SUBSCRIBED'); dot.textContent = st === 'SUBSCRIBED' ? 'LIVE' : 'OFFLINE'; }
    });
}

async function setStatus(id, status){
  const i = allOrders.findIndex(o => o.id === id);
  const prev = i > -1 ? allOrders[i].status : null;
  if(i > -1){ allOrders[i].status = status; render(); }
  const { error } = await sb.from('orders').update({ status }).eq('id', id);
  if(error){ alert('Update failed: ' + error.message); if(i > -1){ allOrders[i].status = prev; render(); } }
}
window.setStatus = setStatus;

function timeAgo(ts){
  const d = (Date.now() - new Date(ts).getTime()) / 1000;
  if(d < 60) return Math.floor(d) + 's ago';
  if(d < 3600) return Math.floor(d/60) + 'm ago';
  if(d < 86400) return Math.floor(d/3600) + 'h ago';
  return new Date(ts).toLocaleDateString();
}
function money(n){ return '$' + Number(n || 0).toFixed(2); }
function escapeHtml(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function render(){
  const today = new Date(); today.setHours(0,0,0,0);
  const todays = allOrders.filter(o => new Date(o.created_at) >= today);
  document.getElementById('stat-today').textContent = todays.length;
  document.getElementById('stat-revenue').textContent = '$' + todays.reduce((s,o) => s + Number(o.total||0), 0).toFixed(0);
  document.getElementById('stat-active').textContent = allOrders.filter(o => o.status !== 'delivered').length;

  let list = allOrders;
  if(activeFilter === 'active') list = allOrders.filter(o => o.status !== 'delivered');
  else if(activeFilter !== 'all') list = allOrders.filter(o => o.status === activeFilter);

  const el = document.getElementById('orders-list');
  el.innerHTML = list.length ? list.map(orderCard).join('') : `<div class="empty-state">No orders here yet.</div>`;
}

function orderCard(o){
  const items = (o.items || []).map(it =>
    `<li><span class="q">${Number(it.qty)||1}×</span> ${escapeHtml(it.name)}${it.details ? ` <em>(${escapeHtml(it.details)})</em>` : ''}</li>`
  ).join('') || '<li><em>No items</em></li>';
  const addr = o.delivery_method === 'delivery'
    ? `${escapeHtml(o.delivery_address || '')}${o.postcode ? ' · ' + escapeHtml(o.postcode) : ''}`
    : 'Customer pickup';
  const steps = STATUSES.map(s =>
    `<button class="st-btn ${s.key === o.status ? 'on' : ''}" onclick="setStatus('${o.id}','${s.key}')">${s.label}</button>`
  ).join('');
  return `
  <article class="order-card status-${escapeHtml(o.status)}" data-id="${o.id}">
    <div class="oc-top">
      <div><span class="oc-id">#${escapeHtml(String(o.id).slice(0,8))}</span><span class="oc-time">${timeAgo(o.created_at)}</span></div>
      <span class="oc-badge badge-${escapeHtml(o.status)}">${escapeHtml(STATUS_LABEL[o.status] || o.status)}</span>
    </div>
    <div class="oc-cust">
      <strong>${escapeHtml(o.customer_name || '—')}</strong>
      <a href="tel:${escapeHtml(o.customer_phone || '')}" class="oc-phone">${escapeHtml(o.customer_phone || '')}</a>
    </div>
    <div class="oc-addr"><span class="oc-method">${o.delivery_method === 'delivery' ? '🛵 Delivery' : '🏪 Pickup'}</span>${addr}</div>
    <ul class="oc-items">${items}</ul>
    <div class="oc-foot">
      <span class="oc-total">${money(o.total)}</span>
      <span class="oc-breakdown">sub ${money(o.subtotal)} · del ${money(o.delivery_fee)}${Number(o.discount) > 0 ? ' · -' + money(o.discount) : ''}</span>
    </div>
    <div class="oc-steps">${steps}</div>
  </article>`;
}

function onNewOrder(o){
  if(soundOn) ding();
  if('Notification' in window && Notification.permission === 'granted'){
    try{ new Notification('New order — ' + money(o.total), { body:(o.customer_name||'') + ' · ' + (o.delivery_method||'') }); }catch(e){}
  }
  const card = document.querySelector(`[data-id="${o.id}"]`);
  if(card){ card.classList.add('flash'); setTimeout(() => card.classList.remove('flash'), 1900); }
}
function ding(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, t);
    o.frequency.setValueAtTime(1320, t + 0.13);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.56);
  }catch(e){}
}

document.getElementById('filter-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('.ftab'); if(!b) return;
  document.querySelectorAll('.ftab').forEach(t => t.classList.remove('active'));
  b.classList.add('active'); activeFilter = b.dataset.f; render();
});
document.getElementById('refresh-btn').addEventListener('click', loadOrders);
document.getElementById('sound-toggle').addEventListener('click', (e) => {
  soundOn = !soundOn; e.target.textContent = 'Sound: ' + (soundOn ? 'On' : 'Off'); e.target.style.opacity = soundOn ? 1 : .5;
});
setInterval(() => { if(!dashView.hidden) loadOrders(); }, 5000);

init();
