import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function utf8Base64(str: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(str)));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  const k = (Deno.env.get("TILL_API_KEY") || "").trim();
  const u = (Deno.env.get("TILL_USERNAME") || "").trim();
  const p = (Deno.env.get("TILL_PASSWORD") || "").trim();
  const host = (Deno.env.get("TILL_HOST") || "https://gateway.tillpayments.com").trim();

  if (!k || !u || !p) {
    return new Response(
      JSON.stringify({ success: false, error: "Payment gateway not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid JSON" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { token, amount, currency, description } = body;
  if (!token || !amount) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing token or amount" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const merchantTxnId = "HS-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

  const payload: Record<string, any> = {
    merchantTransactionId: merchantTxnId,
    amount: parseFloat(amount).toFixed(2),
    currency: currency || "NZD",
    transactionToken: token,
    description: description || "The Hungry Slice Order",
  };

  try {
    const url = `${host}/api/v3/transaction/${k}/debit`;
    const auth = utf8Base64(`${u}:${p}`);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    const tillStatus = res.status;

    const out: Record<string, any> = {
      success: data.success === true,
      tillStatus,
      merchantTransactionId: merchantTxnId,
    };

    if (data.uuid) out.chargeRef = data.uuid;
    if (data.result) out.result = data.result;
    if (data.error) out.error = data.error;
    if (data.errors) out.errors = data.errors;

    return new Response(JSON.stringify(out), {
      status: tillStatus,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
