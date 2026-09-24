// Edge Function "social-facebook" — MAYELA CRM
// Complète le flux OAuth Meta (Facebook Login) initié par le navigateur.
// Appel : POST /functions/v1/social-facebook (Authorization: Bearer <access_token>)
// Body  : { action: "exchange", code: string, redirect_uri: string }
//       | { action: "refresh" }
// Retour: { ok: true, display_name, page_id } ou { error: string }
//
// L'App ID / App Secret Meta sont stockés dans social_accounts.config
// (platform = "facebook"). Après échange du code, la ligne reçoit un Page Access
// Token (longue durée, stocké dans access_token pour social-publish / social-health /
// social-insights), le user token longue durée, l'id/nom de la Page et la liste des
// Pages gérées par le compte.

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

const GRAPH = "https://graph.facebook.com/v21.0";

// Org "active" de l'appelant, équivalent côté serveur de current_org_id().
async function callerOrg(sb: any, userId: string): Promise<string | null> {
  const { data: prof } = await sb.from("profiles")
    .select("org_id, active_org_id")
    .eq("id", userId)
    .maybeSingle();
  if (!prof?.org_id) return null;
  if (prof.active_org_id && prof.active_org_id !== prof.org_id) {
    const { data: mem } = await sb.from("org_members")
      .select("org_id").eq("user_id", userId).eq("org_id", prof.active_org_id)
      .maybeSingle();
    if (mem?.org_id) return mem.org_id;
  }
  return prof.org_id;
}

// Échange le code d'autorisation contre un user token court (2 h)...
async function exchangeCode(appId: string, appSecret: string, code: string, redirectUri: string) {
  const q = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });
  const r = await fetch(`${GRAPH}/oauth/access_token?${q.toString()}`);
  const out = await r.json().catch(() => null);
  return out;
}

// ...puis l'échange contre un user token longue durée (~60 jours).
async function longLived(appId: string, appSecret: string, shortToken: string) {
  const q = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortToken,
  });
  const r = await fetch(`${GRAPH}/oauth/access_token?${q.toString()}`);
  const out = await r.json().catch(() => null);
  return out;
}

// Pages gérées par le compte (chacune porte un Page Access Token longue durée).
async function myPages(userToken: string) {
  const r = await fetch(`${GRAPH}/me/accounts?access_token=${encodeURIComponent(userToken)}`);
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

  // Client admin (service_role) : les secrets de config ne sont pas exposés à la
  // session utilisateur (revoke SELECT(config) — migration V7).
  const adminSb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Ligne social_accounts de l'org ACTIVE de l'appelant (équivalent RLS, explicite)
  const orgId = await callerOrg(sb, user.id);
  if (!orgId) return json({ error: "espace introuvable" }, 400);

  const { data: acc } = await adminSb.from("social_accounts")
    .select("id, config")
    .eq("platform", "facebook")
    .eq("org_id", orgId)
    .maybeSingle();

  const cfg = (acc?.config ?? {}) as Record<string, unknown>;
  const appId = cfg?.client_id as string | undefined;
  const appSecret = cfg?.client_secret as string | undefined;

  // ---- Échange du code contre le Page Access Token (connexion) ----
  if (action === "exchange") {
    if (!appId || !appSecret) {
      return json({ error: "App Meta non enregistrée : entrez d'abord l'App ID et l'App Secret." }, 400);
    }
    if (!code || !redirectUri) return json({ error: "code/redirect_uri manquants" }, 400);

    const short = await exchangeCode(appId, appSecret, code, redirectUri);
    if (!short?.access_token) {
      return json({ error: "Meta a refusé le code : " + (short?.error?.message || short?.error || "réponse invalide") }, 502);
    }

    const long = await longLived(appId, appSecret, String(short.access_token));
    const userToken = String(long?.access_token ?? short.access_token ?? "");
    if (!userToken) {
      return json({ error: "Meta a refusé l'échange du token : " + (long?.error?.message || "réponse invalide") }, 502);
    }
    const userExpiresAt = Date.now() + Number(long?.expires_in ?? 5184000) * 1000 - 60_000;

    const pages = await myPages(userToken);
    const pageList = Array.isArray(pages?.data) ? pages.data : [];
    if (!pageList.length) {
      return json({ error: "Aucune Page gérée par ce compte. Utilisez un compte admin d'une Page Facebook." }, 400);
    }

    const page = pageList[0];
    const pageId = String(page.id ?? "");
    const pageToken = String(page.access_token ?? "");
    if (!pageId || !pageToken) {
      return json({ error: "Meta n'a pas renvoyé de Page Access Token." }, 502);
    }
    const pageName = String(page.name ?? "Page Facebook");

    const newConfig = {
      ...cfg,
      page_id: pageId,
      access_token: pageToken,
      page_name: pageName,
      user_access_token: userToken,
      user_access_token_expires_at: userExpiresAt,
      pages: pageList.map((p: any) => ({
        id: String(p.id ?? ""),
        name: String(p.name ?? ""),
        category: String(p.category ?? ""),
      })),
      instagram_business_account_id: page.instagram_business_account?.id
        ? String(page.instagram_business_account.id)
        : null,
      scopes: "pages_show_list,pages_manage_posts,pages_read_engagement,read_insights",
      connected_at: Date.now(),
    };

    if (acc) {
      const { error } = await sb.from("social_accounts").update({
        config: newConfig,
        display_name: pageName,
      }).eq("id", acc.id);
      if (error) return json({ error: error.message }, 500);
    } else {
      const { data: prof } = await sb.from("profiles").select("org_id, active_org_id").eq("id", user.id).single();
      const oid = prof?.active_org_id ?? prof?.org_id;
      const { error } = await sb.from("social_accounts").insert({
        org_id: oid,
        platform: "facebook",
        display_name: pageName,
        config: newConfig,
        connected_by: user.id,
      });
      if (error) return json({ error: error.message }, 500);
    }

    return json({ ok: true, display_name: pageName, page_id: pageId });
  }

  // ---- Rafraîchissement : re-cur les Pages avec le user token longue durée ----
  if (action === "refresh") {
    if (!appId || !appSecret) return json({ error: "App Meta non enregistrée." }, 400);
    if (!acc) return json({ error: "compte non connecté" }, 404);

    const userToken = cfg?.user_access_token as string | undefined;
    if (!userToken) return json({ error: "Aucun user token : reconnectez le compte." }, 400);

    // Token utilisateur expiré (~60 j) → on retente un échange, sinon erreur claire.
    if (cfg?.user_access_token_expires_at && Date.now() > Number(cfg.user_access_token_expires_at)) {
      return json({ error: "Session Meta expirée : reconnectez le compte (bouton Autoriser)." }, 401);
    }

    const pages = await myPages(userToken);
    const pageList = Array.isArray(pages?.data) ? pages.data : [];
    const currentPageId = String(cfg?.page_id ?? "");
    const page = currentPageId
      ? pageList.find((p: any) => String(p.id ?? "") === currentPageId)
      : pageList[0];
    if (!page) return json({ error: "Cette Page n'est plus gérée par le compte : reconnectez la Page." }, 400);
    const pageToken = String(page.access_token ?? "");
    if (!pageToken) return json({ error: "Meta n'a pas renvoyé de Page Access Token." }, 502);

    const { error } = await adminSb.from("social_accounts").update({
      config: {
        ...cfg,
        page_id: String(page.id),
        access_token: pageToken,
        page_name: String(page.name ?? cfg.page_name ?? "Page Facebook"),
        pages: pageList.map((p: any) => ({
          id: String(p.id ?? ""),
          name: String(p.name ?? ""),
          category: String(p.category ?? ""),
        })),
        connected_at: Date.now(),
      },
      display_name: String(page.name ?? cfg.page_name ?? "Page Facebook"),
    }).eq("id", acc.id);
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, display_name: String(page.name ?? cfg.page_name ?? "Page Facebook") });
  }

  return json({ error: "action inconnue" }, 400);
});