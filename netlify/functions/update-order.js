exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const supabaseUrl = process.env.SUPABASE_URL || 'https://wjhbkkthppbadcjnozal.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY not set in Netlify env vars' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { orderId, status } = body;
  const valid = ['received', 'preparing', 'oven', 'delivery', 'delivered'];
  if (!orderId || !valid.includes(status)) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid orderId or status' }) };
  }

  const res = await fetch(
    `${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ status })
    }
  );

  if (!res.ok) {
    const text = await res.text();
    return { statusCode: res.status, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: text }) };
  }

  return { statusCode: 200, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true }) };
};
