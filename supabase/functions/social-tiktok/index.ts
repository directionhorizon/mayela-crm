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

// Historique quotidien de depense, meme source que marketingReport mais avec la
// dimension "date" : une ligne par campagne et par jour. Alimente
// campaign_spend_daily pour que le ROAS porte sur la meme fenetre que le CA.
// "reach" est volontairement absent : TikTok ne le restitue pas de facon fiable
// au niveau journalier, et l'ecrire sur chaque jour gonflerait le cumul.
async function marketingReportDaily(accessToken: string, advertiserId: string, startDate: string, endDate: string) {
  const q = new URLSearchParams({
    advertiser_id: advertiserId,
    service_type: "AUCTION",
    report_type: "BASIC",
    data_level: "AUCTION_CAMPAIGN",
    dimensions: JSON.stringify(["campaign_id", "campaign_name", "date"]),
    metrics: JSON.stringify(["spend", "impressions", "clicks"]),
    start_date: startDate,
    end_date: endDate,
    page_size: "1000",
  });
  const r = await fetch(`${BUSINESS_API}/report/integrated/get/?${q.toString()}`, {
    headers: { "Access-Token": accessToken },
  });
  const out = await r.json().catch(() => null);
  if (out?.code !== 0 && out?.code !== undefined) return [];
  const data = out?.data ?? out;
  return Array.isArray(data?.list) ? data.list : [];
}

// Devise du compte publicitaire. Sans elle, depense_reelle serait une valeur
// sans unite et l'affichage "FCFA" mentirait sur les comptes en USD.
async function tiktokCurrency(accessToken: string, advertiserId: string): Promise<string> {
  const r = await busReq(accessToken, "GET", "/advertiser/info/", { advertiser_id: advertiserId });
  if (!r.ok) return "";
  const l = Array.isArray(r.data?.list) ? r.data.list : [];
  return String(l[0]?.currency ?? "") || "";
}

// Format "YYYY-MM-DD" du jour / il y a N mois (pratique pour report/integrated/get).
function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Helpers Gestion Ads (campagnes / ad groups / audiences / leads)
// ---------------------------------------------------------------------------

// Enveloppe générique d'appel à la TikTok Business API (v1.3).
// GET  → paramètres en query string ; POST → corps JSON.
async function busReq(
  token: string,
  method: "GET" | "POST",
  path: string,
  query: Record<string, string | number | string[]> = {},
  body?: Record<string, unknown>,
  region?: string,
): Promise<{ ok: boolean; code?: number; message: string; data?: any; request_id?: string }> {
  const url = new URL(BUSINESS_API + path);
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, Array.isArray(v) ? v.join(",") : String(v));
  }
  const headers: Record<string, string> = { "Access-Token": token };
  if (region) headers["x-lead-region"] = region;
  if (method === "POST") headers["Content-Type"] = "application/json";
  const r = await fetch(url.toString(), {
    method,
    headers,
    body: method === "POST" && body ? JSON.stringify(body) : undefined,
  });
  let out: any = null;
  try { out = await r.json(); } catch { return { ok: false, message: "Réponse invalide de TikTok (" + r.status + ")" }; }
  return {
    ok: Number(out?.code) === 0,
    code: out?.code,
    message: String(out?.message ?? (Number(out?.code) === 0 ? "ok" : "erreur")),
    data: out?.data,
    request_id: out?.request_id,
  };
}

// SHA-256 hexadécimal (pour les identifiants d'audience, exigence TikTok).
async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Normalisation des identifiants avant hash (règles TikTok).
function normalizeId(value: string, calculateType: string): string {
  const v = String(value ?? "").trim();
  if (!v) return "";
  if (calculateType === "EMAIL_SHA256") return v.toLowerCase();
  if (calculateType === "PHONE_SHA256") return v.replace(/\D/g, "");
  return v;
}

// MD5 compact (file_signature exigé par /dmp/custom_audience/file/upload/).
function md5Hex(input: string): string {
  const KEY: number[] = [];
  for (let i = 0; i < 64; i++) KEY[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000);
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const bytes = new TextEncoder().encode(String(input));
  const bitLen = bytes.length * 8;
  const padded = new Uint8Array((((bytes.length + 8) >> 6) + 1) * 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, bitLen >>> 0, true);
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296), true);

  const rotl = (x: number, c: number) => (x << c) | (x >>> (32 - c));
  const add = (a: number, b: number) => (a + b) >>> 0;
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const X = new Int32Array(16);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) X[i] = dv.getInt32(off + i * 4, true);
    let A = a0, B = b0, C = c0, D = d0;
    for (let g = 0; g < 64; g++) {
      let F: number, G: number;
      if (g < 16) { F = (B & C) | (~B & D); G = g; }
      else if (g < 32) { F = (D & B) | (~D & C); G = (5 * g + 1) % 16; }
      else if (g < 48) { F = B ^ C ^ D; G = (3 * g + 5) % 16; }
      else { F = C ^ (B | ~D); G = (7 * g) % 16; }
      const T = add(add(add(A, F), add(KEY[g], X[G])), S[g]) | 0;
      A = D; D = C; C = B; B = add(B, rotl(T, S[g]));
    }
    a0 = add(a0, A); b0 = add(b0, B); c0 = add(c0, C); d0 = add(d0, D);
  }
  const pad = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return pad(a0) + pad(b0) + pad(c0) + pad(d0);
}

// Type "source" du contrat user. Ajouté en V10.1 : gestion Ads.
type Ctx = {
  token: string;
  advertiserIds: string[];
  orgId: string;
  userId: string;
  sb: any;
  admin: any;
};

// Lit la config marketing (token + advertiser IDs) et fabrique le contexte.
async function marketingCtx(cfg: Record<string, unknown>, orgId: string, userId: string, sb: any, admin: any): Promise<{ ctx?: Ctx; error?: string }> {
  const mkToken = cfg?.marketing_access_token as string | undefined;
  const mkIds = (Array.isArray(cfg?.marketing_advertiser_ids) ? cfg.marketing_advertiser_ids : []) as string[];
  if (!mkToken) return { error: "Analyse publicitaire non connectée : cliquez d'abord sur « Se connecter à l'analyse publicitaire »." };
  if (!mkIds.length) return { error: "Aucun compte publicitaire autorisé." };
  return { ctx: { token: mkToken, advertiserIds: mkIds, orgId, userId, sb, admin } };
}

// Convertit le statut TikTok (ENABLE/DISABLE ou ACTIVE/PAUSED/DELETED) en état CRM.
function tikStateLabel(s: string): string {
  const v = String(s ?? "").toUpperCase();
  if (v === "ENABLE" || v === "ACTIVE") return "ACTIVE";
  if (v === "DISABLE" || v === "PAUSED") return "PAUSED";
  return v || "—";
}

// Emplacement pour le corps des actions Ads (ajoutées ci-dessous dans Deno.serve).

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
  let params: Record<string, any> = {};
  try {
    const body = await req.json();
    params = (body ?? {}) as Record<string, any>;
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
      // Historique quotidien, indexé par nom de campagne : la boucle principale
      // récupère ainsi son détail sans relancer le rapport pour chaque ligne.
      const dailyByName = new Map<string, any[]>();
      const currency = await tiktokCurrency(mkToken, advertiserId);
      for (const d of await marketingReportDaily(mkToken, advertiserId, startDate, endDate)) {
        const key = String(d?.dimensions?.campaign_name ?? "").trim();
        if (!key) continue;
        const arr = dailyByName.get(key) ?? [];
        arr.push(d);
        dailyByName.set(key, arr);
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

        // Historique journalier du meme compte publicitaire. On ne demande que
        // les lignes de cette campagne pour eviter de retraiter tout le rapport
        // a chaque campagne.
        const dailyRows = (dailyByName.get(nom) || []).map((d: any) => {
          const dm = d?.metrics ?? {};
          return {
            jour: String(d?.dimensions?.date ?? "").slice(0, 10),
            depense: Number(dm?.spend ?? 0),
            impressions: Math.round(Number(dm?.impressions ?? 0)),
            clics: Math.round(Number(dm?.clicks ?? 0)),
          };
        }).filter((d: any) => /^\d{4}-\d{2}-\d{2}$/.test(d.jour));

        let campaignId = existing?.id ?? null;
        if (campaignId) {
          const { error } = await adminSb.from("campaigns").update({
            source: "tik",
            depense_reelle: depense,
            impressions,
            clics,
            portee,
            date_debut: startDate,
            date_fin: endDate,
            depense_devise: currency || null,
            depense_source: "api",
            depense_periode_debut: dailyRows.length ? dailyRows[0].jour : startDate,
            depense_periode_fin: dailyRows.length ? dailyRows[dailyRows.length - 1].jour : endDate,
          }).eq("id", campaignId);
          if (error) errors.push(nom + " : " + error.message);
          else updated++;
        } else {
          const { data: ins, error } = await adminSb.from("campaigns").insert({
            org_id: orgId,
            nom,
            plateforme: "tiktok",
            source: "tik",
            depense_reelle: depense,
            impressions,
            clics,
            portee,
            date_debut: startDate,
            date_fin: endDate,
            depense_devise: currency || null,
            depense_source: "api",
            depense_periode_debut: dailyRows.length ? dailyRows[0].jour : startDate,
            depense_periode_fin: dailyRows.length ? dailyRows[dailyRows.length - 1].jour : endDate,
            created_by: user.id,
          }).select("id").maybeSingle();
          if (error) errors.push(nom + " : " + error.message);
          else { inserted++; campaignId = ins?.id ?? null; }
        }

        // Upsert sur (campaign_id, jour) : rejouer la synchronisation corrige
        // un jour au lieu de le dupliquer.
        if (campaignId && dailyRows.length) {
          const { error: de } = await adminSb.from("campaign_spend_daily").upsert(
            dailyRows.map((d: any) => ({
              org_id: orgId,
              campaign_id: campaignId,
              jour: d.jour,
              depense: d.depense,
              impressions: d.impressions,
              clics: d.clics,
              portee: 0,
              devise: currency || null,
              source: "api",
              synced_at: new Date().toISOString(),
            })),
            { onConflict: "campaign_id,jour" },
          );
          if (de) errors.push(nom + " (historique) : " + de.message);
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

  // ---------------------------------------------------------------------------
  // GESTION ADS v1.3 — Campagnes, Ad Groups, Audiences, Leads (V10.1)
  // ---------------------------------------------------------------------------

  // ---- 1) Lire les campagnes publicitaires depuis TikTok (upsert dans campaigns) ----
  else if (action === "ads_campaigns_get") {
    const { ctx, error } = await marketingCtx(cfg, orgId, user.id, sb, adminSb);
    if (error) return json({ error }, 400);
    if (!ctx) return json({ error: "Analyse publicitaire non connectée." }, 400);

    let inserted = 0, updated = 0, errors: string[] = [];
    const currencies: Record<string, string> = {};
    for (const adv of ctx.advertiserIds) {
      if (currencies[adv] === undefined) {
        try {
          const ci = await busReq(ctx.token, "GET", "/advertiser/info/", { advertiser_id: adv });
          const l = Array.isArray(ci.data?.list) ? ci.data.list : [];
          currencies[adv] = String(l[0]?.currency ?? "") || "";
        } catch { currencies[adv] = ""; }
      }
      const r = await busReq(ctx.token, "GET", "/campaign/get/", {
        advertiser_id: adv,
        page: 1,
        page_size: 100,
        fields: JSON.stringify(["campaign_id", "campaign_name", "objective_type", "budget", "budget_mode", "status", "operation_status"]),
      });
      if (!r.ok) {
        errors.push(`Publicité ${adv} : ${r.message}`);
        continue;
      }
      const list = Array.isArray(r.data?.list) ? r.data.list : [];
      for (const c of list) {
        const nom = String(c?.campaign_name ?? "").trim();
        const cid = String(c?.campaign_id ?? "").trim();
        if (!nom || !cid) continue;
        const sync = {
          source: "tik",
          tik_campaign_id: cid,
          tik_advertiser_id: adv,
          tik_budget_mode: String(c?.budget_mode ?? "") || null,
          tik_budget: c?.budget != null ? Number(c.budget) : null,
          tik_currency: currencies[adv] || null,
          tik_status: tikStateLabel(c?.operation_status ?? c?.status),
          tik_objective: String(c?.objective_type ?? "") || null,
          tik_synced_at: new Date().toISOString(),
        };
        const { data: existing } = await adminSb.from("campaigns")
          .select("id").eq("org_id", orgId).eq("source", "tik").eq("tik_campaign_id", cid).maybeSingle();
        if (existing?.id) {
          const { error: ue } = await adminSb.from("campaigns").update({ ...sync, nom }).eq("id", existing.id);
          if (ue) errors.push(nom + " : " + ue.message); else updated++;
        } else {
          // rattrapage : une campagne déjà synchronisée par marketing_sync (par nom) porte le même nom →
          // on l'enrichit au lieu de créer un doublon.
          const { data: byName } = await adminSb.from("campaigns")
            .select("id").eq("org_id", orgId).eq("source", "tik").eq("nom", nom).maybeSingle();
          if (byName?.id) {
            const { error: ue } = await adminSb.from("campaigns").update({ ...sync }).eq("id", byName.id);
            if (ue) errors.push(nom + " : " + ue.message); else updated++;
          } else {
            const { error: ie } = await adminSb.from("campaigns").insert({
              org_id: orgId, nom, plateforme: "tiktok", created_by: user.id, ...sync,
            });
            if (ie) errors.push(nom + " : " + ie.message); else inserted++;
          }
        }
      }
    }
    const { data: list, error: le } = await adminSb.from("campaigns")
      .select("id, nom, tik_campaign_id, tik_advertiser_id, tik_budget_mode, tik_budget, tik_currency, tik_status, tik_objective, tik_synced_at")
      .eq("org_id", orgId).eq("source", "tik").order("tik_synced_at", { ascending: false });
    if (le) return json({ error: le.message }, 500);
    return json({ ok: true, inserted, updated, errors, campaigns: list ?? [],
      message: `${inserted} campagne(s) ajoutée(s), ${updated} mise(s) à jour` + (errors.length ? ` — ${errors.length} erreur(s)` : "") });
  }

  // ---- 2) Créer une campagne publicitaire ----
  else if (action === "ads_campaign_create") {
    const { ctx, error } = await marketingCtx(cfg, orgId, user.id, sb, adminSb);
    if (error) return json({ error }, 400);
    if (!ctx) return json({ error: "Analyse publicitaire non connectée." }, 400);

    const adv = String(params?.advertiser_id ?? "").trim() || ctx.advertiserIds[0] || "";
    const nom = String(params?.campaign_name ?? "").trim();
    const objective = String(params?.objective_type ?? "").trim();
    const budgetMode = String(params?.budget_mode ?? "BUDGET_MODE_DAY").trim();
    const budget = params?.budget != null && params.budget !== "" ? Number(params.budget) : NaN;
    const operationStatus = String(params?.operation_status ?? "ENABLE").trim();
    if (!nom) return json({ error: "Nom de campagne manquant." }, 400);
    if (!objective) return json({ error: "Objectif de campagne manquant." }, 400);
    if (!(budget > 0)) return json({ error: "Budget invalide (doit être supérieur à 0)." }, 400);

    const r = await busReq(ctx.token, "POST", "/campaign/create/", {}, {
      advertiser_id: adv, campaign_name: nom, objective_type: objective,
      budget_mode: budgetMode, budget, operation_status: operationStatus,
    });
    if (!r.ok) return json({ error: "Création refusée par TikTok : " + r.message }, 502);
    const cid = String(r.data?.campaign_id ?? "");
    if (!cid) return json({ error: "TikTok n'a pas renvoyé d'identifiant de campagne." }, 502);

    const { error: ie } = await adminSb.from("campaigns").insert({
      org_id: orgId, nom, plateforme: "tiktok", source: "tik",
      tik_campaign_id: cid, tik_advertiser_id: adv, tik_budget_mode: budgetMode, tik_budget: budget,
      tik_status: tikStateLabel(operationStatus), tik_objective: objective,
      tik_synced_at: new Date().toISOString(), created_by: user.id,
    });
    if (ie) return json({ error: "Campagne créée mais non enregistrée en local : " + ie.message }, 500);
    return json({ ok: true, campaign_id: cid, nom });
  }

  // ---- 3) Modifier le budget d'une campagne ----
  else if (action === "ads_campaign_update") {
    const { ctx, error } = await marketingCtx(cfg, orgId, user.id, sb, adminSb);
    if (error) return json({ error }, 400);
    if (!ctx) return json({ error: "Analyse publicitaire non connectée." }, 400);

    const adv = String(params?.advertiser_id ?? "").trim();
    const cid = String(params?.campaign_id ?? "").trim();
    const budget = Number(params?.budget);
    if (!adv || !cid) return json({ error: "advertiser_id / campaign_id manquants." }, 400);
    if (!(budget > 0)) return json({ error: "Budget invalide." }, 400);

    const r = await busReq(ctx.token, "POST", "/campaign/update/", {}, { advertiser_id: adv, campaign_id: cid, budget });
    if (!r.ok) return json({ error: "Échec de la mise à jour du budget : " + r.message }, 502);
    const { error: ue } = await adminSb.from("campaigns").update({
      tik_budget: budget, tik_synced_at: new Date().toISOString(),
    }).eq("org_id", orgId).eq("source", "tik").eq("tik_campaign_id", cid);
    if (ue) return json({ error: "Budget à jour sur TikTok mais pas en local : " + ue.message }, 500);
    return json({ ok: true, campaign_id: cid, budget });
  }

  // ---- 4) Activer / mettre en pause des campagnes ----
  else if (action === "ads_campaign_status") {
    const { ctx, error } = await marketingCtx(cfg, orgId, user.id, sb, adminSb);
    if (error) return json({ error }, 400);
    if (!ctx) return json({ error: "Analyse publicitaire non connectée." }, 400);

    const adv = String(params?.advertiser_id ?? "").trim();
    const ids = (Array.isArray(params?.campaign_ids) ? params.campaign_ids : []).map(String).filter(Boolean);
    const op = String(params?.operation_status ?? "").trim();
    if (!adv || !ids.length) return json({ error: "advertiser_id / campaign_ids manquants." }, 400);
    if (!["ENABLE", "DISABLE"].includes(op)) return json({ error: "operation_status : ENABLE ou DISABLE." }, 400);

    const r = await busReq(ctx.token, "POST", "/campaign/status/update/", {}, { advertiser_id: adv, campaign_ids: ids, operation_status: op });
    if (!r.ok) return json({ error: "Changement de statut refusé : " + r.message }, 502);
    await adminSb.from("campaigns").update({
      tik_status: tikStateLabel(op), tik_synced_at: new Date().toISOString(),
    }).eq("org_id", orgId).eq("source", "tik").in("tik_campaign_id", ids);
    return json({ ok: true, campaign_ids: ids, operation_status: op });
  }

  // ---- 5) Lire les ad groups (classes d'achats d'une campagne) ----
  else if (action === "ads_adgroups_get") {
    const { ctx, error } = await marketingCtx(cfg, orgId, user.id, sb, adminSb);
    if (error) return json({ error }, 400);
    if (!ctx) return json({ error: "Analyse publicitaire non connectée." }, 400);

    const reqCampaign = String(params?.campaign_id ?? "").trim();
    let inserted = 0, updated = 0, errors: string[] = [];
    const currencies: Record<string, string> = {};
    for (const adv of ctx.advertiserIds) {
      if (currencies[adv] === undefined) {
        try {
          const ci = await busReq(ctx.token, "GET", "/advertiser/info/", { advertiser_id: adv });
          const l = Array.isArray(ci.data?.list) ? ci.data.list : [];
          currencies[adv] = String(l[0]?.currency ?? "") || "";
        } catch { currencies[adv] = ""; }
      }
      const q: Record<string, string | number> = { advertiser_id: adv, page: 1, page_size: 100,
        fields: JSON.stringify(["adgroup_id", "adgroup_name", "campaign_id", "status", "operation_status", "budget", "budget_mode", "bid", "bid_strategy", "optimization_goal"]) };
      if (reqCampaign) q.campaign_id = reqCampaign;
      const r = await busReq(ctx.token, "GET", "/adgroup/get/", q);
      if (!r.ok) { errors.push(`Publicité ${adv} : ${r.message}`); continue; }
      const list = Array.isArray(r.data?.list) ? r.data.list : [];
      for (const g of list) {
        const nom = String(g?.adgroup_name ?? "").trim();
        const gid = String(g?.adgroup_id ?? "").trim();
        if (!nom || !gid) continue;
        const { data: existing } = await adminSb.from("tik_adgroups")
          .select("id").eq("org_id", orgId).eq("tik_adgroup_id", gid).maybeSingle();
        if (existing?.id) {
          const { error: ue } = await adminSb.from("tik_adgroups").update({
            advertiser_id: adv, tik_campaign_id: String(g?.campaign_id ?? "") || null,
            nom, budget_mode: String(g?.budget_mode ?? "") || null,
            budget: g?.budget != null ? Number(g.budget) : null,
            bid: g?.bid != null ? Number(g.bid) : null,
            bid_strategy: String(g?.bid_strategy ?? "") || null,
            optimize_goal: String(g?.optimization_goal ?? "") || null,
            operation_status: String(g?.operation_status ?? g?.status ?? "") || null,
            status: String(g?.status ?? "") || null,
            currency: currencies[adv] || null,
            synced_at: new Date().toISOString(),
          }).eq("id", existing.id);
          if (ue) errors.push(nom + " : " + ue.message); else updated++;
        } else {
          const { error: ie } = await adminSb.from("tik_adgroups").insert({
            org_id: orgId, advertiser_id: adv, tik_campaign_id: String(g?.campaign_id ?? "") || null,
            tik_adgroup_id: gid, nom,
            budget_mode: String(g?.budget_mode ?? "") || null,
            budget: g?.budget != null ? Number(g.budget) : null,
            bid: g?.bid != null ? Number(g.bid) : null,
            bid_strategy: String(g?.bid_strategy ?? "") || null,
            optimize_goal: String(g?.optimization_goal ?? "") || null,
            operation_status: String(g?.operation_status ?? g?.status ?? "") || null,
            status: String(g?.status ?? "") || null,
            currency: currencies[adv] || null,
          });
          if (ie) errors.push(nom + " : " + ie.message); else inserted++;
        }
      }
    }
    const { data: ags, error: ae } = await adminSb.from("tik_adgroups")
      .select("*").eq("org_id", orgId)
      .order("created_at", { ascending: true });
    if (ae) return json({ error: ae.message }, 500);
    return json({ ok: true, inserted, updated, errors, adgroups: ags ?? [],
      message: `${inserted} ad group(s) ajouté(s), ${updated} mis à jour` + (errors.length ? ` — ${errors.length} erreur(s)` : "") });
  }

  // ---- 6) Mettre à jour un ad group (budget / enchère) ----
  else if (action === "ads_adgroup_update") {
    const { ctx, error } = await marketingCtx(cfg, orgId, user.id, sb, adminSb);
    if (error) return json({ error }, 400);
    if (!ctx) return json({ error: "Analyse publicitaire non connectée." }, 400);

    const adv = String(params?.advertiser_id ?? "").trim();
    const gid = String(params?.adgroup_id ?? "").trim();
    if (!adv || !gid) return json({ error: "advertiser_id / adgroup_id manquants." }, 400);

    const payload: Record<string, unknown> = { advertiser_id: adv, adgroup_id: gid };
    const patch: Record<string, unknown> = {};
    if (params?.budget != null && params.budget !== "") {
      const b = Number(params.budget);
      if (!(b > 0)) return json({ error: "Budget invalide." }, 400);
      payload.budget = b; patch.budget = b;
    }
    if (params?.bid != null && params.bid !== "") {
      const bid = Number(params.bid);
      if (!(bid > 0)) return json({ error: "Enchère invalide." }, 400);
      payload.bid = bid; patch.bid = bid;
    }
    if (params?.bid_strategy) { payload.bid_strategy = String(params.bid_strategy); patch.bid_strategy = payload.bid_strategy; }
    if (!Object.keys(patch).length) return json({ error: "Rien à modifier." }, 400);

    const r = await busReq(ctx.token, "POST", "/adgroup/update/", {}, payload);
    if (!r.ok) return json({ error: "Mise à jour refusée : " + r.message }, 502);
    const { error: ue } = await adminSb.from("tik_adgroups").update({ ...patch, synced_at: new Date().toISOString() })
      .eq("org_id", orgId).eq("tik_adgroup_id", gid);
    if (ue) return json({ error: "Mis à jour sur TikTok mais pas en local : " + ue.message }, 500);
    return json({ ok: true, adgroup_id: gid, ...patch });
  }

  // ---- 7) Activer / mettre en pause des ad groups ----
  else if (action === "ads_adgroup_status") {
    const { ctx, error } = await marketingCtx(cfg, orgId, user.id, sb, adminSb);
    if (error) return json({ error }, 400);
    if (!ctx) return json({ error: "Analyse publicitaire non connectée." }, 400);

    const adv = String(params?.advertiser_id ?? "").trim();
    const ids = (Array.isArray(params?.adgroup_ids) ? params.adgroup_ids : []).map(String).filter(Boolean);
    const op = String(params?.operation_status ?? "").trim();
    if (!adv || !ids.length) return json({ error: "advertiser_id / adgroup_ids manquants." }, 400);
    if (!["ENABLE", "DISABLE"].includes(op)) return json({ error: "operation_status : ENABLE ou DISABLE." }, 400);

    const r = await busReq(ctx.token, "POST", "/adgroup/status/update/", {}, { advertiser_id: adv, adgroup_ids: ids, operation_status: op });
    if (!r.ok) return json({ error: "Changement de statut refusé : " + r.message }, 502);
    await adminSb.from("tik_adgroups").update({
      operation_status: tikStateLabel(op), status: tikStateLabel(op), synced_at: new Date().toISOString(),
    }).eq("org_id", orgId).in("tik_adgroup_id", ids);
    return json({ ok: true, adgroup_ids: ids, operation_status: op });
  }

  // ---- 8) Lire les audiences custom ----
  else if (action === "ads_audiences_get") {
    const { ctx, error } = await marketingCtx(cfg, orgId, user.id, sb, adminSb);
    if (error) return json({ error }, 400);
    if (!ctx) return json({ error: "Analyse publicitaire non connectée." }, 400);

    let inserted = 0, updated = 0, errors: string[] = [];
    for (const adv of ctx.advertiserIds) {
      const r = await busReq(ctx.token, "GET", "/dmp/custom_audience/get/", { advertiser_id: adv, page: 1, page_size: 100 });
      if (!r.ok) { errors.push(`Publicité ${adv} : ${r.message}`); continue; }
      const list = Array.isArray(r.data?.list) ? r.data.list : [];
      for (const a of list) {
        const nom = String(a?.custom_audience_name ?? "").trim();
        const aid = String(a?.custom_audience_id ?? "").trim();
        if (!nom || !aid) continue;
        const row = {
          advertiser_id: adv,
          nom,
          calculate_type: String(a?.calculate_type ?? a?.audience_type ?? "") || "—",
          member_count: Number(a?.member_count ?? 0) || 0,
          status: String(a?.upload_status ?? a?.operation_status ?? "") || null,
          synced_at: new Date().toISOString(),
        };
        const { data: existing } = await adminSb.from("tik_audiences")
          .select("id").eq("org_id", orgId).eq("tik_audience_id", aid).maybeSingle();
        if (existing?.id) {
          const { error: ue } = await adminSb.from("tik_audiences").update(row).eq("id", existing.id);
          if (ue) errors.push(nom + " : " + ue.message); else updated++;
        } else {
          const { error: ie } = await adminSb.from("tik_audiences").insert({ org_id: orgId, tik_audience_id: aid, ...row });
          if (ie) errors.push(nom + " : " + ie.message); else inserted++;
        }
      }
    }
    const { data: auds, error: ae } = await adminSb.from("tik_audiences")
      .select("*").eq("org_id", orgId).order("created_at", { ascending: false });
    if (ae) return json({ error: ae.message }, 500);
    return json({ ok: true, inserted, updated, errors, audiences: auds ?? [],
      message: `${inserted} audience(s) ajoutée(s), ${updated} mise(s) à jour` + (errors.length ? ` — ${errors.length} erreur(s)` : "") });
  }

  // ---- 9) Créer une audience custom depuis des identifiants (SHA-256) ----
  else if (action === "ads_audience_create") {
    const { ctx, error } = await marketingCtx(cfg, orgId, user.id, sb, adminSb);
    if (error) return json({ error }, 400);
    if (!ctx) return json({ error: "Analyse publicitaire non connectée." }, 400);

    const adv = String(params?.advertiser_id ?? "").trim() || ctx.advertiserIds[0] || "";
    const nom = String(params?.nom ?? "").trim();
    const calcType = String(params?.calculate_type ?? "").trim();
    const raw = Array.isArray(params?.identifiers) ? params.identifiers.map(String) : [];
    const retention = Number(params?.retention_in_days ?? 365) || 365;
    if (!nom) return json({ error: "Nom d'audience manquant." }, 400);
    if (!["PHONE_SHA256", "EMAIL_SHA256"].includes(calcType)) return json({ error: "calculate_type : PHONE_SHA256 ou EMAIL_SHA256." }, 400);
    const identifiers = [...new Set(raw.map((v) => normalizeId(v, calcType)).filter(Boolean))];
    if (!identifiers.length) return json({ error: "Aucun identifiant valide fourni." }, 400);

    // 1) hash des identifiants → contenu CSV
    let csv = "";
    for (const id of identifiers) {
      try { csv += await sha256Hex(id) + "\n"; } catch { return json({ error: "Erreur de hachage des identifiants." }, 500); }
    }

    // 2) upload du fichier (multipart, MD5 obligatoire)
    const fileName = `mayela_${nom.replace(/[^a-z0-9]/gi, "_").slice(0, 40).toLowerCase()}_${Date.now()}.csv`;
    const fd = new FormData();
    fd.append("advertiser_id", adv);
    fd.append("calculate_type", calcType);
    fd.append("file_name", fileName);
    fd.append("file_signature", md5Hex(csv));
    fd.append("file", new File([csv], fileName, { type: "text/plain" }));
    let up: { ok: boolean; message: string; data?: any };
    try {
      const ur = await fetch(BUSINESS_API + "/dmp/custom_audience/file/upload/", {
        method: "POST",
        headers: { "Access-Token": ctx.token },
        body: fd,
      });
      const uj = await ur.json().catch(() => null);
      up = { ok: Number(uj?.code) === 0, message: String(uj?.message ?? "réponse invalide"), data: uj?.data };
    } catch (e) {
      return json({ error: "Impossible d'uploader le fichier d'audience : " + String(e) }, 502);
    }
    if (!up.ok) return json({ error: "Upload refusé : " + up.message }, 502);
    const filePath = String(up.data?.file_path ?? "");
    if (!filePath) return json({ error: "TikTok n'a pas renvoyé de chemin de fichier." }, 502);

    // 3) création de l'audience à partir du fichier
    const cr = await busReq(ctx.token, "POST", "/dmp/custom_audience/create/", {}, {
      advertiser_id: adv,
      custom_audience_name: nom,
      file_paths: [filePath],
      calculate_type: calcType,
      retention_in_days: retention,
    });
    if (!cr.ok) return json({ error: "Création d'audience refusée : " + cr.message }, 502);
    const aid = String(cr.data?.custom_audience_id ?? "");
    if (!aid) return json({ error: "TikTok n'a pas renvoyé d'identifiant d'audience." }, 502);

    const { error: ie } = await adminSb.from("tik_audiences").insert({
      org_id: orgId, advertiser_id: adv, tik_audience_id: aid, nom,
      calculate_type: calcType, member_count: identifiers.length, status: "TRAITEMENT",
    });
    if (ie) return json({ error: "Audience créée mais non enregistrée en local : " + ie.message }, 500);
    return json({ ok: true, audience_id: aid, nom, count: identifiers.length });
  }

  // ---- 10) Listes des Instant Forms (formulaires de leads) ----
  else if (action === "leads_forms") {
    const { ctx, error } = await marketingCtx(cfg, orgId, user.id, sb, adminSb);
    if (error) return json({ error }, 400);
    if (!ctx) return json({ error: "Analyse publicitaire non connectée." }, 400);

    const forms: { advertiser_id: string; page_id: string; page_name: string }[] = [];
    const seen = new Set<string>();
    const errors: string[] = [];
    for (const adv of ctx.advertiserIds) {
      const r = await busReq(ctx.token, "GET", "/page/get/", { advertiser_id: adv, business_type: "LEAD_GEN", page: 1, page_size: 100 }, undefined, "us");
      if (!r.ok) { errors.push(`Publicité ${adv} : ${r.message}`); continue; }
      const list = Array.isArray(r.data?.list) ? r.data.list : [];
      for (const p of list) {
        const pid = String(p?.page_id ?? "").trim();
        const pname = String(p?.page_name ?? "").trim();
        if (!pid || seen.has(pid)) continue;
        seen.add(pid);
        forms.push({ advertiser_id: adv, page_id: pid, page_name: pname || "Formulaire " + pid });
      }
    }
    return json({ ok: true, forms, errors });
  }

  // ---- 11) Importer les leads d'in Instant Form (→ clients + leads_tiktok) ----
  else if (action === "leads_get") {
    const { ctx, error } = await marketingCtx(cfg, orgId, user.id, sb, adminSb);
    if (error) return json({ error }, 400);
    if (!ctx) return json({ error: "Analyse publicitaire non connectée." }, 400);

    const adv = String(params?.advertiser_id ?? "").trim();
    const pid = String(params?.page_id ?? "").trim();
    const pname = String(params?.page_name ?? "").trim() || "Formulaire " + pid;
    const days = Number(params?.days ?? 30) || 30;
    if (!adv || !pid) return json({ error: "advertiser_id / page_id manquants." }, 400);

    const startTime = Date.now() - days * 86_400_000;
    const endTime = Date.now();
    const r = await busReq(ctx.token, "GET", "/lead/get/",
      { advertiser_id: adv, page_id: pid, start_time: startTime, end_time: endTime }, undefined, "us");
    if (!r.ok) return json({ error: "Récupération des leads refusée : " + r.message }, 502);
    const list = Array.isArray(r.data?.list) ? r.data.list : [];

    let imported = 0, skipped = 0, errors: string[] = [];
    for (const lead of list) {
      const answers = Array.isArray(lead?.answers) ? lead.answers : [];
      const values: Record<string, string> = {};
      for (const a of answers) {
        let key = "";
        if (Array.isArray(a?.field)) {
          const f0 = a.field[0];
          key = typeof f0 === "string" ? f0 : String(f0?.key ?? f0?.field ?? "");
        } else if (a?.field && typeof a.field === "object") {
          key = String(a.field.key ?? a.field.field ?? a.field.display_name ?? "");
        }
        const val = typeof a?.answer === "string" ? a.answer.trim() : "";
        if (key && val) values[key.toLowerCase()] = val;
      }
      // certains champs remontent directement sur l'objet lead
      for (const k of ["full_name", "phone_number", "email", "city"]) {
        if (!values[k] && lead[k] != null) values[k] = String(lead[k]).trim();
      }
      const name = values.full_name || values.name || "";
      const phone = (values.phone_number || values.phone || "").replace(/\D/g, "");
      const email = values.email || "";
      const createTime = String(lead?.create_time ?? lead?.lead_create_time ?? "");
      const leadKey = [pid, phone || email || name, createTime].filter(Boolean).join("|");
      if (!leadKey || (!name && !phone && !email)) { skipped++; continue; }

      const { data: existing } = await adminSb.from("leads_tiktok")
        .select("id").eq("org_id", orgId).eq("lead_key", leadKey).maybeSingle();
      if (existing?.id) { skipped++; continue; }

      // client lié (dédup par téléphone, sinon création)
      let clientId: string | null = null;
      if (phone) {
        const { data: found } = await adminSb.from("clients")
          .select("id").eq("org_id", orgId).eq("phone", phone)
          .order("created_at", { ascending: true }).limit(1).maybeSingle();
        if (found?.id) clientId = found.id;
      }
      if (!clientId && (name || phone || email)) {
        const { data: nc, error: ie } = await adminSb.from("clients").insert({
          org_id: orgId, name: name || "Client TikTok", phone: phone || null,
          email: email || null, source: "TikTok Ads", campagne_origine: pname,
          updated_at: new Date().toISOString(),
        }).select("id").single();
        if (ie) { errors.push((name || phone) + " : " + ie.message); skipped++; continue; }
        clientId = nc?.id;
        // interaction de suivi pour la fiche
        try {
          await adminSb.from("interactions").insert({
            client_id: clientId, user_id: user.id, type: "tiktok",
            note: "Lead importé TikTok — formulaire « " + pname + " »",
            statut_traitement: "en_attente",
          });
        } catch (_e) { /* non bloquant */ }
      }

      const { error: me } = await adminSb.from("leads_tiktok").insert({
        org_id: orgId, advertiser_id: adv, page_id: pid, page_name: pname,
        lead_key: leadKey, client_id: clientId, nom: name || null,
        phone: phone || null, email: email || null, raw_data: lead, imported_by: user.id,
      });
      if (me) { errors.push((name || phone) + " : " + me.message); skipped++; continue; }
      imported++;
    }

    const { data: stored, error: se } = await adminSb.from("leads_tiktok")
      .select("id, nom, phone, email, page_name, imported_at")
      .eq("org_id", orgId).eq("page_id", pid).order("imported_at", { ascending: false });
    if (se) return json({ error: se.message }, 500);
    return json({ ok: true, imported, skipped, errors, leads: stored ?? [],
      message: `${imported} lead(s) importé(s), ${skipped} déjà présent(s) / sans données` + (errors.length ? ` — ${errors.length} erreur(s)` : "") });
  }

  return json({ error: "action inconnue" }, 400);
});
