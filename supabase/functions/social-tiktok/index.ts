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
const BUSINESS_API = "https://business-api.tiktok.com/open_api/v1.3";

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

async function tiktokToken(body: Record<string, string>) {
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const out = await r.json().catch(() => null);
  return out;
}

// TikTok Marketing API (business-api.tiktok.com) : échange d'un auth_code OAuth
// contre un access_token longue durée (pas d'expiration timer ; invalide si l'annonceur révoque).
// Enveloppe de réponse TikTok : { code, message, request_id, data: { access_token, advertiser_ids } }
async function marketingToken(appId: string, secret: string, authCode: string) {
  const r = await fetch(`${BUSINESS_API}/oauth2/access_token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, secret, auth_code: authCode }),
  });
  const out = await r.json().catch(() => null);
  return out;
}

// Liste des advertiseur(s) autorisés par le token Marketing API (introspection).
// GET /open_api/v1.3/oauth2/advertiser/get/ avec app_id + secret + Access-Token (header).
async function marketingAdvertisers(appId: string, secret: string, accessToken: string) {
  const q = new URLSearchParams({ app_id: appId, secret });
  const r = await fetch(`${BUSINESS_API}/oauth2/advertiser/get/?${q.toString()}`, {
    headers: { "Access-Token": accessToken },
  });
  const out = await r.json().catch(() => null);
  return out;
}

// Métriques de campagne via /report/integrated/get/ (data_level = AUCTION_CAMPAIGN).
async function marketingReport(accessToken: string, advertiserId: string, startDate: string, endDate: string) {
  const q = new URLSearchParams({
    advertiser_id: advertiserId,
    service_type: "AUCTION",
    report_type: "BASIC",
    data_level: "AUCTION_CAMPAIGN",
    dimensions: JSON.stringify(["campaign_id", "campaign_name"]),
    metrics: JSON.stringify(["spend", "impressions", "clicks", "reach"]),
    start_date: startDate,
    end_date: endDate,
    page_size: "200",
  });
  const r = await fetch(`${BUSINESS_API}/report/integrated/get/?${q.toString()}`, {
    headers: { "Access-Token": accessToken },
  });
  const out = await r.json().catch(() => null);
  return out;
}

// Format "YYYY-MM-DD" du jour / il y a N mois (pratique pour report/integrated/get).
function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
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
    code = String(body.code ?? body.auth_code ?? "");
    redirectUri = String(body.redirect_uri ?? "");
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  // Client admin (service_role) : les secrets de config ne sont plus exposés
  // à la session utilisateur (revoke SELECT(config) — migration V7).
  const adminSb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Ligne social_accounts de l'org ACTIVE de l'appelant (équivalent RLS, explicite)
  const orgId = await callerOrg(sb, user.id);
  if (!orgId) return json({ error: "espace introuvable" }, 400);

  const { data: acc } = await adminSb.from("social_accounts")
    .select("id, config")
    .eq("platform", "tiktok")
    .eq("org_id", orgId)
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
      const { data: prof } = await sb.from("profiles").select("org_id, active_org_id").eq("id", user.id).single();
      const orgId = prof?.active_org_id ?? prof?.org_id;
      const { error } = await sb.from("social_accounts").insert({
        org_id: orgId,
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
        refresh_token: tok.refresh_token ?? cfg.refresh_token,
        expires_at: Date.now() + Number(tok.expires_in ?? 86400) * 1000 - 60_000,
      },
    }).eq("id", acc.id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  // ---- Marketing API (pub) : échange d'un auth_code OAuth côté ads.tiktok.com ----
  else if (action === "exchange_marketing") {
    if (!code) return json({ error: "auth_code manquant" }, 400);

    const tok = await marketingToken(clientKey, clientSecret, code);
    const data = tok?.data ?? tok;
    if (!data?.access_token) {
      return json({ error: "TikTok a refusé le code Marketing API : " + (tok?.message || tok?.error_description || "réponse invalide") }, 502);
    }

    const advertiserIds = Array.isArray(data.advertiser_ids) ? data.advertiser_ids.map(String) : [];

    // Introspection : nom du (des) compte(s) publicitaire(s) autorisé(s).
    let advertiserName = "";
    let advertiserNames: string[] = [];
    if (advertiserIds.length) {
      try {
        const adv = await marketingAdvertisers(clientKey, clientSecret, data.access_token);
        const advData = adv?.data ?? adv;
        const list = Array.isArray(advData?.list) ? advData.list : [];
        advertiserNames = list.map((a: any) => String(a?.advertiser_name ?? a?.name ?? "").trim()).filter(Boolean);
        advertiserName = advertiserNames[0] ?? "";
      } catch (_e) { /* non bloquant */ }
    }

    const newConfig = {
      ...cfg,
      marketing_access_token: data.access_token,
      marketing_advertiser_ids: advertiserIds,
      marketing_advertiser_names: advertiserNames,
      marketing_connected_at: Date.now(),
    };

    const displayName = advertiserName || (advertiserIds[0] ? "Compte publicitaire " + advertiserIds[0] : "TikTok Ads");

    try {
      if (acc) {
        const { error } = await sb.from("social_accounts").update({
          config: newConfig,
          display_name: displayName,
        }).eq("id", acc.id);
        if (error) return json({ error: error.message }, 500);
      } else {
        const { data: prof } = await sb.from("profiles").select("org_id, active_org_id").eq("id", user.id).single();
        const oid = prof?.active_org_id ?? prof?.org_id;
        const { error } = await sb.from("social_accounts").insert({
          org_id: oid,
          platform: "tiktok",
          display_name: displayName,
          config: newConfig,
          connected_by: user.id,
        });
        if (error) return json({ error: error.message }, 500);
      }
    } catch (ex: any) {
      return json({ error: ex?.message ?? "Enregistrement en échec." }, 500);
    }

    return json({ ok: true, display_name: displayName, advertiser_ids: advertiserIds, advertiser_names: advertiserNames });
  }

  // ---- Marketing API (pub) : synchronisation des campagnes publicitaires ----
  else if (action === "marketing_sync") {
    const mkToken = cfg?.marketing_access_token as string | undefined;
    const mkIds = (Array.isArray(cfg?.marketing_advertiser_ids) ? cfg.marketing_advertiser_ids : []) as string[];
    if (!mkToken) return json({ error: "Analyse publicitaire non connectée : cliquez d'abord sur « Se connecter à l'analyse publicitaire »." }, 400);
    if (!mkIds.length) return json({ error: "Aucun compte publicitaire autorisé." }, 400);
    if (!acc) return json({ error: "compte non connecté" }, 404);

    const startDate = isoDaysAgo(30);
    const endDate = isoDaysAgo(0);
    let inserted = 0, updated = 0, errors: string[] = [];

    for (const advertiserId of mkIds) {
      const rep = await marketingReport(mkToken, advertiserId, startDate, endDate);
      const repData = rep?.data ?? rep;
      if (rep?.code !== 0 && rep?.code !== undefined) {
        errors.push(`Publicité ${advertiserId} : ${rep?.message || "réponse invalide"}`);
        continue;
      }
      const rows = Array.isArray(repData?.list) ? repData.list : [];
      for (const row of rows) {
        const dims = row?.dimensions ?? {};
        const metrics = row?.metrics ?? {};
        const nom = String(dims?.campaign_name ?? "").trim();
        if (!nom) continue;
        const depense = Number(metrics?.spend ?? 0);
        const impressions = Number(metrics?.impressions ?? 0);
        const clics = Number(metrics?.clicks ?? 0);
        const portee = Number(metrics?.reach ?? 0);

        const { data: existing } = await adminSb.from("campaigns")
          .select("id").eq("org_id", orgId).eq("plateforme", "tiktok").eq("nom", nom).maybeSingle();

        if (existing?.id) {
          const { error } = await adminSb.from("campaigns").update({
            depense_reelle: depense,
            impressions,
            clics,
            portee,
            date_debut: startDate,
            date_fin: endDate,
          }).eq("id", existing.id);
          if (error) errors.push(nom + " : " + error.message);
          else updated++;
        } else {
          const { error } = await adminSb.from("campaigns").insert({
            org_id: orgId,
            nom,
            plateforme: "tiktok",
            depense_reelle: depense,
            impressions,
            clics,
            portee,
            date_debut: startDate,
            date_fin: endDate,
            created_by: user.id,
          });
          if (error) errors.push(nom + " : " + error.message);
          else inserted++;
        }
      }
    }

    return json({
      ok: true,
      inserted,
      updated,
      errors,
      message: `${inserted} campagne(s) ajoutée(s), ${updated} mise(s) à jour` + (errors.length ? ` — ${errors.length} erreur(s)` : ""),
    });
  }

  return json({ error: "action inconnue" }, 400);
});
