// Edge Function "social-tiktok" — MAYELA CRM
// Complète le flux OAuth TikTok (Login Kit) initié par le navigateur.
// Appel : POST /functions/v1/social-tiktok (Authorization: Bearer <access_token>)
// Body  : { action: "exchange", code: string, redirect_uri: string }
//       | { action: "refresh" }
// Retour: { ok: true, display_name } ou { error: string }
//
// Les Client Key/Secret de l'app TikTok sont stockés dans social_accounts.config
// (platform = "tiktok"). Après échange du code, la ligne reçoit access_token,
// refresh_token, expires_at, open_id et le nom du compte créateur.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const OPEN_API = "https://open.tiktokapis.com/v2";

async function tiktokToken(body: Record<string, string>) {
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const out = await r.json().catch(() => null);
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  let action = "";
  let code = "";
  let redirectUri = "";
  try {
    const body = await req.json();
    action = String(body.action ?? "");
    code = String(body.code ?? "");
    redirectUri = String(body.redirect_uri ?? "");
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  // Ligne social_accounts de l'org courante pour TikTok (isolation par RLS)
  const { data: acc } = await sb.from("social_accounts")
    .select("id, config")
    .eq("platform", "tiktok")
    .maybeSingle();

  const cfg = (acc?.config ?? {}) as Record<string, unknown>;
  const clientKey = cfg?.client_key as string | undefined;
  const clientSecret = cfg?.client_secret as string | undefined;

  if (!clientKey || !clientSecret) {
    return json({ error: "App TikTok non enregistrée : entrez d'abord la Client Key et le Client Secret." }, 400);
  }

  // ---- Échange du code d'autorisation contre les tokens ----
  if (action === "exchange") {
    if (!code || !redirectUri) return json({ error: "code/redirect_uri manquants" }, 400);

    const tok = await tiktokToken({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });
    if (!tok?.access_token) {
      return json({ error: "TikTok a refusé le code : " + (tok?.error_description || tok?.error || "réponse invalide") }, 502);
    }

    // Infos du créateur (nom public affiché sur la carte)
    let nickname = "";
    try {
      const ci = await fetch(`${OPEN_API}/post/publish/creator_info/query/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tok.access_token}` },
      });
      const cij = await ci.json().catch(() => null);
      nickname = String(cij?.data?.creator_nickname ?? "");
    } catch (_e) { /* non bloquant */ }

    const newConfig = {
      ...cfg,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_at: Date.now() + Number(tok.expires_in ?? 86400) * 1000 - 60_000,
      open_id: tok.open_id,
      scopes: tok.scope ?? "",
    };

    if (acc) {
      const { error } = await sb.from("social_accounts").update({
        config: newConfig,
        display_name: nickname || "Compte TikTok",
      }).eq("id", acc.id);
      if (error) return json({ error: error.message }, 500);
    } else {
      const { data: prof } = await sb.from("profiles").select("org_id").eq("id", user.id).single();
      const { error } = await sb.from("social_accounts").insert({
        org_id: prof?.org_id,
        platform: "tiktok",
        display_name: nickname || "Compte TikTok",
        config: newConfig,
        connected_by: user.id,
      });
      if (error) return json({ error: error.message }, 500);
    }

    return json({ ok: true, display_name: nickname || "Compte TikTok" });
  }

  // ---- Rafraîchissement manuel du token ----
  if (action === "refresh") {
    const refreshToken = cfg?.refresh_token as string | undefined;
    if (!refreshToken) return json({ error: "Aucun refresh_token : reconnectez le compte." }, 400);
    if (!acc) return json({ error: "compte non connecté" }, 404);

    const tok = await tiktokToken({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    if (!tok?.access_token) {
      return json({ error: "Session TikTok expirée : reconnectez le compte." }, 401);
    }
    const { error } = await sb.from("social_accounts").update({
      config: {
        ...cfg,
        access_token: tok.access_token,
        refresh_token: tok.refresh_token,
        expires_at: Date.now() + Number(tok.expires_in ?? 86400) * 1000 - 60_000,
      },
    }).eq("id", acc.id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  return json({ error: "action inconnue" }, 400);
});
