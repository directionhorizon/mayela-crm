// Edge Function "social-facebook" — MAYELA CRM
// Complète le flux OAuth Meta (Facebook Login) initié par le navigateur.
// Appel : POST /functions/v1/social-facebook (Authorization: Bearer <access_token>)
// Body  : { action: "exchange", code: string, redirect_uri: string }
//       | { action: "refresh" }
//       | { action: "ads_connect" }                                (V11 — Meta Ads)
//       | { action: "ads_campaigns_get" }
//       | { action: "ads_campaign_status", campaign_ids, operation_status }
//       | { action: "ads_campaign_update", campaign_id, budget, budget_mode, currency }
//       | { action: "ads_adgroups_get", campaign_id? }
//       | { action: "ads_adgroup_status", adgroup_ids, operation_status }
//       | { action: "ads_adgroup_update", adgroup_id, budget?, bid?, currency }
// Retour: { ok: true, display_name, page_id } ou { error: string }
//
// L'App ID / App Secret Meta sont stockés dans social_accounts.config
// (platform = "facebook"). Après échange du code, la ligne reçoit un Page Access
// Token (longue durée, stocké dans access_token pour social-publish / social-health /
// social-insights), le user token longue durée, l'id/nom de la Page et la liste des
// Pages gérées par le compte.
//
// Gestion Meta Ads (V11) : le user token sert aussi de token Marketing API
// (marketing_access_token) pour lire/gérer les campagnes et ensembles de pubs via
// le Graph API (le même user token suffit, aucune autorisation séparée).

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

// ---------------------------------------------------------------------------
// Marketing API (Meta Ads) — Graph API (V11)
// ---------------------------------------------------------------------------

// Devises sans centimes : Meta exprime les budgets/enchères en "minor units".
// Pour ces devises, 1 unité = 1 minor unit ; sinon budget ÷ 100.
const FB_ZERO_DEC = new Set([
  "JPY", "KRW", "VND", "TWD", "CLP", "ISK", "HUF",
  "XOF", "XAF", "GNF", "RWF", "UGX", "KMF", "DJF", "BIF", "PYG", "XPF",
]);
function fbMinor(v: number, cur: string): number {
  return Math.round((Number(v) || 0) * (FB_ZERO_DEC.has((cur || "").toUpperCase()) ? 1 : 100));
}
function fbMajor(v: number, cur: string): number {
  return (Number(v) || 0) / (FB_ZERO_DEC.has((cur || "").toUpperCase()) ? 1 : 100);
}

// Requête GET Graph API avec le token injecté.
async function fbGraph(path: string, token: string) {
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`${GRAPH}${path}${sep}access_token=${encodeURIComponent(token)}`);
  return r.json().catch(() => null);
}

// Requête POST Graph API (form-url-encoded) sur un nœud (campagne, ad set…).
async function fbPost(nodeId: string, body: Record<string, unknown>, token: string) {
  const r = await fetch(`${GRAPH}/${nodeId}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(Object.assign({ access_token: token }, body) as Record<string, string>),
  });
  return r.json().catch(() => null);
}

// Message d'erreur lisible depuis la réponse Graph API.
function fbErr(out: any, fallback = "réponse invalide"): string {
  const e = out?.error;
  if (!e) return fallback;
  return String(e?.message ?? fallback) + (e?.code ? ` (code ${e.code})` : "");
}

// Format "YYYY-MM-DD" du jour / il y a N jours.
function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

// Contexte Ads : token Marketing (= user token) + ids des comptes publicitaires.
type AdsCtx = {
  token: string;
  adAccountIds: string[];
  orgId: string;
  userId: string;
  sb: any;
  admin: any;
  cfg: Record<string, unknown>;
};
async function adsCtx(
  cfg: Record<string, unknown>, orgId: string, userId: string, sb: any, admin: any,
): Promise<{ ctx?: AdsCtx; error?: string }> {
  const mkToken = cfg?.marketing_access_token as string | undefined;
  const mkIds = (Array.isArray(cfg?.marketing_ad_account_ids) ? cfg.marketing_ad_account_ids : []).map(String);
  if (!mkToken) return { error: "Analyse publicitaire non connectée : cliquez d'abord sur « Se connecter à l'analyse publicitaire »." };
  if (!mkIds.length) return { error: "Aucun compte publicitaire autorisé." };
  return { ctx: { token: mkToken, adAccountIds: mkIds, orgId, userId, sb, admin, cfg } };
}

// Devise d'un compte publicitaire (valeurs stockées, sinon Graph API).
async function adAccountCurrency(ctx: AdsCtx, accId: string): Promise<string> {
  const currencies = (Array.isArray(ctx.cfg?.marketing_ad_account_currencies) ? ctx.cfg.marketing_ad_account_currencies : []) as string[];
  const idx = ctx.adAccountIds.indexOf(accId);
  if (idx >= 0 && currencies[idx]) return currencies[idx];
  try {
    const act = await fbGraph(`/${accId}?fields=currency`, ctx.token);
    return String(act?.currency ?? "");
  } catch { return ""; }
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
  let params: Record<string, any> = {};
  try {
    const body = await req.json();
    params = (body ?? {}) as Record<string, any>;
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
      scopes: "pages_show_list,pages_manage_posts,pages_read_engagement,read_insights,ads_management,ads_read,business_management",
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

  // ---------------------------------------------------------------------------
  // GESTION META ADS (V11) — Ads Manager via Graph API
  // ---------------------------------------------------------------------------

  // ---- 1) Connecter l'analyse publicitaire : lister les comptes publicitaires ----
  if (action === "ads_connect") {
    if (!acc) return json({ error: "compte non connecté" }, 404);
    const userToken = cfg?.user_access_token as string | undefined;
    if (!userToken) return json({ error: "Aucun user token : reconnectez la Page (bouton Autoriser)." }, 400);
    if (cfg?.user_access_token_expires_at && Date.now() > Number(cfg.user_access_token_expires_at)) {
      return json({ error: "Session Meta expirée : reconnectez le compte (bouton Autoriser) avec les permissions ads." }, 401);
    }

    const list: { id: string; name: string; currency: string }[] = [];
    const seen = new Set<string>();
    const addAccounts = (out: any) => {
      for (const a of (Array.isArray(out?.data) ? out.data : [])) {
        const id = String(a?.id ?? "");
        if (!id || seen.has(id)) continue;
        seen.add(id);
        list.push({ id, name: String(a?.name ?? "Compte " + id), currency: String(a?.currency ?? "") });
      }
    };

    const r1 = await fbGraph("/me/adaccounts?fields=id,name,currency&limit=100", userToken);
    if (r1?.error) {
      return json({ error: "Impossible de lister les comptes publicitaires : " + fbErr(r1) +
        " — vérifiez que l'app a les permissions ads (ads_management / business_management), puis réautorisez (bouton « Autoriser »)." }, 502);
    }
    addAccounts(r1);
    // Repli : comptes publicitaires possédés via les Business Managers (business_management).
    if (!list.length) {
      const r2 = await fbGraph("/me/businesses?fields=id,name&limit=100", userToken);
      for (const b of (Array.isArray(r2?.data) ? r2.data : [])) {
        const r3 = await fbGraph(`/${b.id}/owned_ad_accounts?fields=id,name,currency&limit=100`, userToken);
        addAccounts(r3);
      }
    }
    if (!list.length) {
      return json({ error: "Aucun compte publicitaire accessible avec ce compte. Utilisez un profil ayant un rôle dans Meta Ads Manager, puis réautorisez l'app (permissions ads)." }, 400);
    }

    const { error } = await adminSb.from("social_accounts").update({
      config: {
        ...cfg,
        marketing_access_token: userToken,
        marketing_ad_account_ids: list.map((a) => a.id),
        marketing_ad_account_names: list.map((a) => a.name),
        marketing_ad_account_currencies: list.map((a) => a.currency),
        marketing_connected_at: Date.now(),
      },
    }).eq("id", acc.id);
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, ad_accounts: list, display_name: list[0]?.name || "Meta Ads" });
  }

  // ---- 2) Synchroniser campagnes + ad sets + métriques sur 30 jours ----
  else if (action === "ads_campaigns_get") {
    const { ctx, error } = await adsCtx(cfg, orgId, user.id, sb, adminSb);
    if (error) return json({ error }, 400);
    if (!ctx) return json({ error: "Analyse publicitaire non connectée." }, 400);

    let inserted = 0, updated = 0, errors: string[] = [];
    for (const accId of ctx.adAccountIds) {
      const currency = await adAccountCurrency(ctx, accId);

      const cm = await fbGraph(`/${accId}/campaigns?fields=id,name,objective,status,effective_status,daily_budget,lifetime_budget&limit=250`, ctx.token);
      if (cm?.error) { errors.push(`Compte ${accId} : ${fbErr(cm)}`); continue; }

      const ins = await fbGraph(`/${accId}/insights?fields=campaign_id,campaign_name,spend,impressions,clicks,reach&level=campaign&date_preset=last_30d&limit=500`, ctx.token);
      if (ins?.error) errors.push(`Insights compte ${accId} : ${fbErr(ins)}`);
      const metricByCid: Record<string, any> = {};
      for (const row of (Array.isArray(ins?.data) ? ins.data : [])) metricByCid[String(row?.campaign_id)] = row;

      for (const c of (Array.isArray(cm?.data) ? cm.data : [])) {
        const cid = String(c?.id ?? "");
        const nom = String(c?.name ?? "").trim();
        if (!cid || !nom) continue;
        const m = metricByCid[cid] || {};
        const isLifetime = c?.daily_budget == null && c?.lifetime_budget != null;
        const budget = c?.daily_budget != null ? Number(c.daily_budget) : (c?.lifetime_budget != null ? Number(c.lifetime_budget) : null);
        const sync = {
          source: "meta",
          meta_campaign_id: cid,
          meta_ad_account_id: accId,
          meta_currency: currency || null,
          meta_status: String(c?.effective_status ?? c?.status ?? "") || null,
          meta_objective: String(c?.objective ?? "") || null,
          meta_budget_mode: budget != null && isLifetime ? "lifetime_budget" : budget != null ? "daily_budget" : null,
          meta_budget: budget != null ? fbMajor(budget, currency) : null,
          meta_synced_at: new Date().toISOString(),
          depense_reelle: Number(m?.spend ?? 0),
          impressions: Number(m?.impressions ?? 0),
          clics: Number(m?.clicks ?? 0),
          portee: Number(m?.reach ?? 0),
          date_debut: isoDaysAgo(30),
          date_fin: isoDaysAgo(0),
        };
        const { data: existing } = await adminSb.from("campaigns")
          .select("id").eq("org_id", orgId).eq("source", "meta").eq("meta_campaign_id", cid).maybeSingle();
        if (existing?.id) {
          const { error: ue } = await adminSb.from("campaigns").update({ ...sync, nom }).eq("id", existing.id);
          if (ue) errors.push(nom + " : " + ue.message); else updated++;
        } else {
          // rattrapage : une ligne déjà créée par marketing_sync (par nom) → on l'enrichit.
          const { data: byName } = await adminSb.from("campaigns")
            .select("id").eq("org_id", orgId).eq("source", "meta").eq("nom", nom).maybeSingle();
          if (byName?.id) {
            const { error: ue } = await adminSb.from("campaigns").update(sync).eq("id", byName.id);
            if (ue) errors.push(nom + " : " + ue.message); else updated++;
          } else {
            const { error: ie } = await adminSb.from("campaigns").insert({
              org_id: orgId, nom, plateforme: "facebook", created_by: user.id, ...sync,
            });
            if (ie) errors.push(nom + " : " + ie.message); else inserted++;
          }
        }
      }

      // Ad sets (ensembles de pubs) — équivalents Meta des ad groups TikTok.
      const as = await fbGraph(`/${accId}/adsets?fields=id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,optimization_goal,bid_strategy,bid_amount&limit=250`, ctx.token);
      if (as?.error) errors.push(`Ad sets compte ${accId} : ${fbErr(as)}`);
      for (const g of (Array.isArray(as?.data) ? as.data : [])) {
        const gid = String(g?.id ?? "");
        const gnom = String(g?.name ?? "").trim();
        if (!gid || !gnom) continue;
        const gIsLifetime = g?.daily_budget == null && g?.lifetime_budget != null;
        const gbudget = g?.daily_budget != null ? Number(g.daily_budget) : (g?.lifetime_budget != null ? Number(g.lifetime_budget) : null);
        const row = {
          meta_ad_account_id: accId,
          meta_campaign_id: String(g?.campaign_id ?? "") || null,
          nom: gnom,
          budget_mode: gbudget != null && gIsLifetime ? "lifetime_budget" : gbudget != null ? "daily_budget" : null,
          budget: gbudget != null ? fbMajor(gbudget, currency) : null,
          bid: g?.bid_amount != null ? fbMajor(Number(g.bid_amount), currency) : null,
          bid_strategy: String(g?.bid_strategy ?? "") || null,
          status: String(g?.effective_status ?? g?.status ?? "") || null,
          currency: currency || null,
          optimization_goal: String(g?.optimization_goal ?? "") || null,
          synced_at: new Date().toISOString(),
        };
        const { data: gx } = await adminSb.from("meta_adsets")
          .select("id").eq("org_id", orgId).eq("meta_adset_id", gid).maybeSingle();
        if (gx?.id) {
          const { error: ue } = await adminSb.from("meta_adsets").update(row).eq("id", gx.id);
          if (ue) errors.push(gnom + " : " + ue.message);
        } else {
          const { error: ie } = await adminSb.from("meta_adsets").insert({ org_id: orgId, meta_adset_id: gid, ...row });
          if (ie) errors.push(gnom + " : " + ie.message);
        }
      }
    }

    const { data: list, error: le } = await adminSb.from("campaigns")
      .select("id, nom, meta_campaign_id, meta_ad_account_id, meta_budget_mode, meta_budget, meta_currency, meta_status, meta_objective, meta_synced_at, depense_reelle, impressions, clics, portee, date_debut, date_fin")
      .eq("org_id", orgId).eq("source", "meta").order("meta_synced_at", { ascending: false });
    if (le) return json({ error: le.message }, 500);
    const { data: ags, error: agse } = await adminSb.from("meta_adsets")
      .select("*").eq("org_id", orgId).order("created_at", { ascending: true });
    if (agse) return json({ error: agse.message }, 500);
    return json({ ok: true, inserted, updated, errors, campaigns: list ?? [], adsets: ags ?? [],
      message: `${inserted} campagne(s) ajoutée(s), ${updated} mise(s) à jour` + (errors.length ? ` — ${errors.length} erreur(s)` : "") });
  }

  // ---- 3) Activer / mettre en pause des campagnes ----
  else if (action === "ads_campaign_status") {
    const { ctx, error } = await adsCtx(cfg, orgId, user.id, sb, adminSb);
    if (error) return json({ error }, 400);
    if (!ctx) return json({ error: "Analyse publicitaire non connectée." }, 400);

    const ids = (Array.isArray(params?.campaign_ids) ? params.campaign_ids : []).map(String).filter(Boolean);
    const op = String(params?.operation_status ?? "").trim();
    if (!ids.length) return json({ error: "campaign_ids manquants." }, 400);
    if (!["ENABLE", "DISABLE"].includes(op)) return json({ error: "operation_status : ENABLE ou DISABLE." }, 400);
    const status = op === "ENABLE" ? "ACTIVE" : "PAUSED";

    const failures: string[] = [];
    for (const id of ids) {
      const r = await fbPost(id, { status }, ctx.token);
      if (r?.error) failures.push(id + " : " + fbErr(r));
    }
    if (failures.length) return json({ error: "Changement de statut refusé : " + failures.join(" ; ") }, 502);
    await adminSb.from("campaigns").update({
      meta_status: status, meta_synced_at: new Date().toISOString(),
    }).eq("org_id", orgId).eq("source", "meta").in("meta_campaign_id", ids);
    return json({ ok: true, campaign_ids: ids, operation_status: op });
  }

  // ---- 4) Modifier le budget d'une campagne ----
  else if (action === "ads_campaign_update") {
    const { ctx, error } = await adsCtx(cfg, orgId, user.id, sb, adminSb);
    if (error) return json({ error }, 400);
    if (!ctx) return json({ error: "Analyse publicitaire non connectée." }, 400);

    const cid = String(params?.campaign_id ?? "").trim();
    const accId = String(params?.ad_account_id ?? "").trim();
    const budget = Number(params?.budget);
    if (!cid) return json({ error: "campaign_id manquant." }, 400);
    if (!(budget > 0)) return json({ error: "Budget invalide." }, 400);

    const currency = String(params?.currency ?? "") || await adAccountCurrency(ctx, accId);
    const mode = String(params?.budget_mode ?? "daily_budget").trim();
    if (!["daily_budget", "lifetime_budget"].includes(mode)) return json({ error: "budget_mode : daily_budget ou lifetime_budget." }, 400);

    const r = await fbPost(cid, { [mode]: fbMinor(budget, currency) }, ctx.token);
    if (r?.error) return json({ error: "Échec de la mise à jour du budget : " + fbErr(r) }, 502);

    const { error: ue } = await adminSb.from("campaigns").update({
      meta_budget: budget, meta_budget_mode: mode, meta_currency: currency || null, meta_synced_at: new Date().toISOString(),
    }).eq("org_id", orgId).eq("source", "meta").eq("meta_campaign_id", cid);
    if (ue) return json({ error: "Budget à jour sur Meta mais pas en local : " + ue.message }, 500);
    return json({ ok: true, campaign_id: cid, budget, budget_mode: mode, currency });
  }

  // ---- 5) Lire les ad sets (ensembles de pubs d'une campagne) ----
  else if (action === "ads_adgroups_get") {
    const { ctx, error } = await adsCtx(cfg, orgId, user.id, sb, adminSb);
    if (error) return json({ error }, 400);
    if (!ctx) return json({ error: "Analyse publicitaire non connectée." }, 400);

    const reqCampaign = String(params?.campaign_id ?? "").trim();
    const errors: string[] = [];
    for (const accId of ctx.adAccountIds) {
      const currency = await adAccountCurrency(ctx, accId);
      let path = `/${accId}/adsets?fields=id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,optimization_goal,bid_strategy,bid_amount&limit=250`;
      if (reqCampaign) {
        path += `&filtering=${encodeURIComponent(JSON.stringify([{ field: "campaign_id", operator: "EQUAL", value: reqCampaign }]))}`;
      }
      const as = await fbGraph(path, ctx.token);
      if (as?.error) { errors.push(`Compte ${accId} : ${fbErr(as)}`); continue; }
      for (const g of (Array.isArray(as?.data) ? as.data : [])) {
        const gid = String(g?.id ?? "");
        const gnom = String(g?.name ?? "").trim();
        if (!gid || !gnom) continue;
        const gIsLifetime = g?.daily_budget == null && g?.lifetime_budget != null;
        const gbudget = g?.daily_budget != null ? Number(g.daily_budget) : (g?.lifetime_budget != null ? Number(g.lifetime_budget) : null);
        const row = {
          meta_ad_account_id: accId,
          meta_campaign_id: String(g?.campaign_id ?? "") || null,
          nom: gnom,
          budget_mode: gbudget != null && gIsLifetime ? "lifetime_budget" : gbudget != null ? "daily_budget" : null,
          budget: gbudget != null ? fbMajor(gbudget, currency) : null,
          bid: g?.bid_amount != null ? fbMajor(Number(g.bid_amount), currency) : null,
          bid_strategy: String(g?.bid_strategy ?? "") || null,
          status: String(g?.effective_status ?? g?.status ?? "") || null,
          currency: currency || null,
          optimization_goal: String(g?.optimization_goal ?? "") || null,
          synced_at: new Date().toISOString(),
        };
        const { data: gx } = await adminSb.from("meta_adsets")
          .select("id").eq("org_id", orgId).eq("meta_adset_id", gid).maybeSingle();
        if (gx?.id) {
          const { error: ue } = await adminSb.from("meta_adsets").update(row).eq("id", gx.id);
          if (ue) errors.push(gnom + " : " + ue.message);
        } else {
          const { error: ie } = await adminSb.from("meta_adsets").insert({ org_id: orgId, meta_adset_id: gid, ...row });
          if (ie) errors.push(gnom + " : " + ie.message);
        }
      }
    }
    const { data: ags, error: ae } = await adminSb.from("meta_adsets")
      .select("*").eq("org_id", orgId).order("created_at", { ascending: true });
    if (ae) return json({ error: ae.message }, 500);
    return json({ ok: true, errors, adgroups: ags ?? [] });
  }

  // ---- 6) Mettre à jour un ad set (budget / enchère) ----
  else if (action === "ads_adgroup_update") {
    const { ctx, error } = await adsCtx(cfg, orgId, user.id, sb, adminSb);
    if (error) return json({ error }, 400);
    if (!ctx) return json({ error: "Analyse publicitaire non connectée." }, 400);

    const gid = String(params?.adgroup_id ?? "").trim();
    const accId = String(params?.ad_account_id ?? "").trim();
    if (!gid) return json({ error: "adgroup_id manquant." }, 400);

    const currency = String(params?.currency ?? "") || await adAccountCurrency(ctx, accId);
    const payload: Record<string, unknown> = {};
    const patch: Record<string, unknown> = {};
    if (params?.budget != null && params.budget !== "") {
      const b = Number(params.budget);
      if (!(b > 0)) return json({ error: "Budget invalide." }, 400);
      const mode = String(params?.budget_mode ?? "daily_budget").trim();
      if (!["daily_budget", "lifetime_budget"].includes(mode)) return json({ error: "budget_mode : daily_budget ou lifetime_budget." }, 400);
      payload[mode] = fbMinor(b, currency); patch.budget = b; patch.budget_mode = mode;
    }
    if (params?.bid != null && params.bid !== "") {
      const bid = Number(params.bid);
      if (!(bid > 0)) return json({ error: "Enchère invalide." }, 400);
      payload.bid_amount = fbMinor(bid, currency); patch.bid = bid;
    }
    if (!Object.keys(patch).length) return json({ error: "Rien à modifier." }, 400);

    const r = await fbPost(gid, payload, ctx.token);
    if (r?.error) return json({ error: "Mise à jour refusée : " + fbErr(r) }, 502);
    const { error: ue } = await adminSb.from("meta_adsets").update({ ...patch, currency: currency || null, synced_at: new Date().toISOString() })
      .eq("org_id", orgId).eq("meta_adset_id", gid);
    if (ue) return json({ error: "Mis à jour sur Meta mais pas en local : " + ue.message }, 500);
    return json({ ok: true, adgroup_id: gid, ...patch });
  }

  // ---- 7) Activer / mettre en pause des ad sets ----
  else if (action === "ads_adgroup_status") {
    const { ctx, error } = await adsCtx(cfg, orgId, user.id, sb, adminSb);
    if (error) return json({ error }, 400);
    if (!ctx) return json({ error: "Analyse publicitaire non connectée." }, 400);

    const ids = (Array.isArray(params?.adgroup_ids) ? params.adgroup_ids : []).map(String).filter(Boolean);
    const op = String(params?.operation_status ?? "").trim();
    if (!ids.length) return json({ error: "adgroup_ids manquants." }, 400);
    if (!["ENABLE", "DISABLE"].includes(op)) return json({ error: "operation_status : ENABLE ou DISABLE." }, 400);
    const status = op === "ENABLE" ? "ACTIVE" : "PAUSED";

    const failures: string[] = [];
    for (const id of ids) {
      const r = await fbPost(id, { status }, ctx.token);
      if (r?.error) failures.push(id + " : " + fbErr(r));
    }
    if (failures.length) return json({ error: "Changement de statut refusé : " + failures.join(" ; ") }, 502);
    await adminSb.from("meta_adsets").update({ status, synced_at: new Date().toISOString() })
      .eq("org_id", orgId).in("meta_adset_id", ids);
    return json({ ok: true, adgroup_ids: ids, operation_status: op });
  }

  return json({ error: "action inconnue" }, 400);
});