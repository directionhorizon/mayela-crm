// Edge Function "social-facebook" — MAYELA CRM
// Complète le flux OAuth Meta (Facebook Login) initié par le navigateur.
// Appel : POST /functions/v1/social-facebook (Authorization: Bearer <access_token>)
// Body  : { action: "exchange", code: string, redirect_uri: string }
//       | { action: "pages_list" }
//       | { action: "select_page", page_id: string }
//       | { action: "refresh" }
//       | { action: "ads_connect" }                                (V11 — Meta Ads)
//       | { action: "ads_campaigns_get" }
//       | { action: "ads_campaign_status", campaign_ids, operation_status }
//       | { action: "ads_campaign_update", campaign_id, budget, budget_mode, currency }
//       | { action: "ads_adgroups_get", campaign_id? }
//       | { action: "ads_adgroup_status", adgroup_ids, operation_status }
//       | { action: "ads_adgroup_update", adgroup_id, budget?, bid?, currency }
// Retour: { ok: true, display_name, page_id } ou { error: string }
// Si le compte connecté gère plusieurs Pages, "exchange" répond
// { ok: true, needs_selection: true, pages: [...] } sans connecter de Page : l'appelant
// choisit avec "select_page". Choisir automatiquement la première réponse de /me/accounts
// reviendrait à publier sur une Page arbitraire.
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

// Normalise /me/accounts. On ne conserve que ce qui est utile et on écarte les entrées
// sans id ou sans jeton, pour ne jamais proposer une Page inexploitable.
type FbPage = { id: string; name: string; category: string; token: string; ig: string | null };

function slimPages(raw: unknown): FbPage[] {
  const list = Array.isArray((raw as any)?.data) ? ((raw as any).data as any[]) : [];
  return list
    .map((p) => ({
      id: String(p?.id ?? ""),
      name: String(p?.name ?? "Page Facebook"),
      category: String(p?.category ?? ""),
      token: String(p?.access_token ?? ""),
      ig: p?.instagram_business_account?.id ? String(p.instagram_business_account.id) : null,
    }))
    .filter((p) => p.id && p.token);
}

// Les deux familles de permissions Meta sont demandées séparément : les permissions
// Page fonctionnent en mode Développement, les permissions Ads exigent un App Review.
// Mélanger les deux fait échouer la fenêtre d'autorisation entière.
const FB_PAGE_SCOPES = "pages_show_list,pages_manage_posts,pages_read_engagement,read_insights";
const FB_ADS_SCOPES = "ads_read,ads_management,business_management";

// Permissions Ads accordées par Meta sur le token courant (pour détecter un refus).
async function grantedAdsScopes(userToken: string): Promise<string[]> {
  const r = await fetch(`${GRAPH}/debug_token?input_token=${encodeURIComponent(userToken)}&access_token=${encodeURIComponent(userToken)}`);
  const out = await r.json().catch(() => null);
  const scopes = out?.data?.scopes;
  return Array.isArray(scopes) ? scopes.map(String) : [];
}

// Comptes publicitaires accessibles avec ce user token : /me/adaccounts, puis les
// Business Managers en repli (comptes possédés via business_management).
async function listAdAccounts(userToken: string): Promise<{ list: { id: string; name: string; currency: string }[]; error: string }> {
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
    return { list, error: "Impossible de lister les comptes publicitaires : " + fbErr(r1) +
      " — l'app n'a pas les permissions ads accordées. Demandez « App Review » pour ads_management et ads_read, puis réautorisez." };
  }
  addAccounts(r1);
  if (!list.length) {
    const r2 = await fbGraph("/me/businesses?fields=id,name&limit=100", userToken);
    for (const b of (Array.isArray(r2?.data) ? r2.data : [])) {
      const r3 = await fbGraph(`/${b.id}/owned_ad_accounts?fields=id,name,currency&limit=100`, userToken);
      addAccounts(r3);
    }
  }
  return { list, error: "" };
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

// Historique quotidien de depense par campagne.
// date_preset=maximum + time_increment=1 renvoie une ligne par campagne et par
// jour depuis la creation du compte publicitaire. La pagination est
// indispensable : une seule reponse est plafonnee a 500 lignes, ce qui
// tronquerait silencieusement l'historique des campagnes anciennes.
async function dailyInsightsAll(accId: string, token: string, errors: string[], maxPages = 200) {
  const fields = "campaign_id,spend,impressions,clicks,reach,date_start";
  const out: any[] = [];
  let after: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const cursor = after ? `&after=${encodeURIComponent(after)}` : "";
    const url =
      `/${accId}/insights?fields=${fields}&level=campaign` +
      `&date_preset=maximum&time_increment=1&limit=500${cursor}`;
    const res = await fbGraph(url, token);
    if (res?.error) { errors.push(`Insights journalier compte ${accId} : ${fbErr(res)}`); break; }
    const rows = Array.isArray(res?.data) ? res.data : [];
    out.push(...rows);
    after = res?.paging?.cursors?.after ?? null;
    if (!after) break;
  }
  return out;
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

  // ---- Enregistrer l'App ID / App Secret (fusion : ne doit rien écraser) ----
  if (action === "save_app") {
    const newId = String(params?.client_id ?? "").trim();
    const newSecret = String(params?.client_secret ?? "").trim();
    if (!newId || !newSecret) {
      return json({ error: "Renseignez l'App ID et l'App Secret." }, 400);
    }
    if (acc) {
      const { error } = await adminSb.from("social_accounts").update({
        config: { ...cfg, client_id: newId, client_secret: newSecret },
      }).eq("id", acc.id);
      if (error) return json({ error: error.message }, 500);
    } else {
      const { error } = await adminSb.from("social_accounts").insert({
        org_id: orgId,
        platform: "facebook",
        display_name: "Page Facebook",
        config: { client_id: newId, client_secret: newSecret },
        connected_by: user.id,
      });
      if (error) return json({ error: error.message }, 500);
    }
    return json({ ok: true });
  }

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
    const pageList = slimPages(pages);
    if (!pageList.length) {
      return json({ error: "Aucune Page gérée par ce compte. Utilisez un compte qui a le contrôle total sur une Page Facebook." }, 400);
    }

    const baseConfig = {
      ...cfg,
      user_access_token: userToken,
      user_access_token_expires_at: userExpiresAt,
      pages: pageList.map((p) => ({ id: p.id, name: p.name, category: p.category })),
    };

    // Persiste le user token + la liste des Pages, sans jeton de Page tant que le choix
    // n'est pas fait. Permet aussi de re-choisir plus tard sans repasser par Meta.
    const persist = async (config: Record<string, unknown>, displayName: string) => {
      if (acc) {
        const { error } = await adminSb.from("social_accounts").update({ config, display_name: displayName }).eq("id", acc.id);
        if (error) return json({ error: error.message }, 500);
      } else {
        const { data: prof } = await sb.from("profiles").select("org_id, active_org_id").eq("id", user.id).single();
        const oid = prof?.active_org_id ?? prof?.org_id;
        const { error } = await sb.from("social_accounts").insert({
          org_id: oid,
          platform: "facebook",
          display_name: displayName,
          config,
          connected_by: user.id,
        });
        if (error) return json({ error: error.message }, 500);
      }
      return null;
    };

    // Plusieurs Pages gérées par ce compte : on ne choisit plus à l'aveugle. La première
    // réponse de /me/accounts n'est pas ordonnée de façon fiable, et publier sur la
    // mauvaise Page est irréversible. L'appelant doit trancher (action select_page).
    if (pageList.length > 1) {
      const err = await persist({ ...baseConfig, page_id: null, access_token: null }, "Page Facebook — à choisir");
      if (err) return err;
      return json({
        ok: true,
        needs_selection: true,
        pages: pageList.map((p) => ({ id: p.id, name: p.name, category: p.category })),
      });
    }

    const page = pageList[0];
    const newConfig = {
      ...baseConfig,
      page_id: page.id,
      access_token: page.token,
      page_name: page.name,
      instagram_business_account_id: page.ig,
      // Scopes réellement accordés pour la Page uniquement. Les permissions Ads
      // (ads_management, business_management) exigent un App Review : les demander ici
      // ferait rejeter toute la fenêtre d'autorisation et la Page ne se connecterait jamais.
      scopes: FB_PAGE_SCOPES,
      connected_at: Date.now(),
    };

    const err = await persist(newConfig, page.name);
    if (err) return err;
    return json({ ok: true, display_name: page.name, page_id: page.id });
  }

  // ---- Lister les Pages gérées par le compte connecté (choix ou changement) ----
  if (action === "pages_list") {
    if (!acc) return json({ error: "compte non connecté" }, 404);
    const userToken = cfg?.user_access_token as string | undefined;
    if (!userToken) return json({ error: "Aucun user token : reconnectez le compte." }, 400);
    if (cfg?.user_access_token_expires_at && Date.now() > Number(cfg.user_access_token_expires_at)) {
      return json({ error: "Session Meta expirée : reconnectez le compte." }, 401);
    }
    const pages = slimPages(await myPages(userToken));
    if (!pages.length) return json({ error: "Aucune Page gérée par ce compte." }, 400);
    return json({
      ok: true,
      current_page_id: String(cfg?.page_id ?? ""),
      pages: pages.map((p) => ({ id: p.id, name: p.name, category: p.category })),
    });
  }

  // ---- Choisir la Page à connecter ----
  if (action === "select_page") {
    if (!acc) return json({ error: "compte non connecté" }, 404);
    const wanted = String(params?.page_id ?? "").trim();
    if (!wanted) return json({ error: "Aucune Page sélectionnée." }, 400);
    const userToken = cfg?.user_access_token as string | undefined;
    if (!userToken) return json({ error: "Aucun user token : reconnectez le compte." }, 400);
    if (cfg?.user_access_token_expires_at && Date.now() > Number(cfg.user_access_token_expires_at)) {
      return json({ error: "Session Meta expirée : reconnectez le compte." }, 401);
    }
    // On relit /me/accounts plutôt que de faire confiance à un id envoyé par le client :
    // la Page doit réellement être gérée par ce compte, et son jeton vient de Meta.
    const pageList = slimPages(await myPages(userToken));
    const page = pageList.find((p) => p.id === wanted);
    if (!page) {
      return json({ error: "Cette Page n'est plus gérée par ce compte. Rechargez la liste." }, 400);
    }
    const { error } = await adminSb.from("social_accounts").update({
      config: {
        ...cfg,
        page_id: page.id,
        access_token: page.token,
        page_name: page.name,
        pages: pageList.map((p) => ({ id: p.id, name: p.name, category: p.category })),
        instagram_business_account_id: page.ig,
        scopes: FB_PAGE_SCOPES,
        connected_at: Date.now(),
      },
      display_name: page.name,
    }).eq("id", acc.id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, display_name: page.name, page_id: page.id });
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

    const pageList = slimPages(await myPages(userToken));
    const currentPageId = String(cfg?.page_id ?? "");
    // Jamais de repli sur « la première Page » : si aucune Page n'a été choisie et que le
    // compte en gère plusieurs, on exige un choix explicite.
    const page = currentPageId
      ? pageList.find((p) => p.id === currentPageId)
      : (pageList.length === 1 ? pageList[0] : null);
    if (!page) {
      return json({
        error: currentPageId
          ? "Cette Page n'est plus gérée par le compte : reconnectez la Page."
          : "Ce compte gère plusieurs Pages : choisissez laquelle connecter.",
      }, 400);
    }
    const pageToken = page.token;
    if (!pageToken) return json({ error: "Meta n'a pas renvoyé de Page Access Token." }, 502);

    const { error } = await adminSb.from("social_accounts").update({
      config: {
        ...cfg,
        page_id: page.id,
        access_token: pageToken,
        page_name: page.name || String(cfg.page_name ?? "Page Facebook"),
        pages: pageList.map((p) => ({ id: p.id, name: p.name, category: p.category })),
        connected_at: Date.now(),
      },
      display_name: page.name || String(cfg.page_name ?? "Page Facebook"),
    }).eq("id", acc.id);
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, display_name: page.name || String(cfg.page_name ?? "Page Facebook") });
  }

  // ---------------------------------------------------------------------------
  // GESTION META ADS (V11) — Ads Manager via Graph API
  // ---------------------------------------------------------------------------

  // ---- 1) Connecter l'analyse publicitaire : lister les comptes publicitaires ----
  if (action === "ads_connect") {
    if (!acc) return json({ error: "compte non connecté" }, 404);
    // Le token marketing est celui accordé par l'autorisation Ads séparée. On retombe sur
    // le token Page pour les comptes déjà connectés avant la séparation des scopes.
    const userToken = (cfg?.marketing_access_token as string | undefined)
      || (cfg?.user_access_token as string | undefined);
    if (!userToken) return json({ error: "Aucun token publicitaire : cliquez sur « Autoriser l'analyse publicitaire »." }, 400);
    const expiresAt = Number(cfg?.marketing_access_token_expires_at ?? cfg?.user_access_token_expires_at ?? 0);
    if (expiresAt && Date.now() > expiresAt) {
      return json({ error: "Session Meta expirée : réautorisez l'analyse publicitaire." }, 401);
    }

    const { list, error: listErr } = await listAdAccounts(userToken);
    if (listErr) return json({ error: listErr }, 502);
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

  // ---- 0bis) Échange du code OAuth Ads contre un token marketing (autorisation séparée) ----
  // Indépendant de la Page : si Meta refuse les permissions Ads, la Page reste connectée.
  if (action === "exchange_ads") {
    if (!acc) return json({ error: "Enregistrez d'abord l'App ID et l'App Secret." }, 404);
    if (!appId || !appSecret) {
      return json({ error: "App Meta non enregistrée : entrez d'abord l'App ID et l'App Secret." }, 400);
    }
    if (!code || !redirectUri) return json({ error: "code/redirect_uri manquants" }, 400);

    const short = await exchangeCode(appId, appSecret, code, redirectUri);
    if (!short?.access_token) {
      return json({ error: "Meta a refusé le code : " + (short?.error?.message || short?.error || "réponse invalide") }, 502);
    }
    const long = await longLived(appId, appSecret, String(short.access_token));
    const adsToken = String(long?.access_token ?? short.access_token ?? "");
    if (!adsToken) {
      return json({ error: "Meta a refusé l'échange du token ads : " + (long?.error?.message || "réponse invalide") }, 502);
    }

    // Meta peut accorder le token tout en refusant les permissions Ads : on le dit clairement.
    const granted = await grantedAdsScopes(adsToken);
    const hasAds = granted.includes("ads_management") || granted.includes("ads_read");
    if (!hasAds && !granted.length) {
      return json({ error: "Meta n'a accordé aucune permission publicitaire. L'app doit être en/App Review pour ads_management et ads_read. La Page reste utilisable." }, 403);
    }

    const { list, error: listErr } = await listAdAccounts(adsToken);
    if (listErr) return json({ error: listErr }, 502);
    if (!list.length) {
      return json({ error: "Aucun compte publicitaire accessible avec ce profil. Utilisez un profil ayant un rôle dans Meta Ads Manager." }, 400);
    }

    const adsExpiresAt = Date.now() + Number(long?.expires_in ?? 5184000) * 1000 - 60_000;
    const { error } = await adminSb.from("social_accounts").update({
      config: {
        ...cfg,
        marketing_access_token: adsToken,
        marketing_access_token_expires_at: adsExpiresAt,
        marketing_scopes: granted.join(",") || FB_ADS_SCOPES,
        marketing_ad_account_ids: list.map((a) => a.id),
        marketing_ad_account_names: list.map((a) => a.name),
        marketing_ad_account_currencies: list.map((a) => a.currency),
        marketing_connected_at: Date.now(),
      },
    }).eq("id", acc.id);
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, ad_accounts: list, granted_scopes: granted, display_name: list[0]?.name || "Meta Ads" });
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

      // Historique journalier : time_increment=1 sur la duree de vie de la
      // campagne. Alimente campaign_spend_daily pour que le ROAS se calcule sur
      // la meme fenetre que le CA, au lieu d'une fenetre glissante de 30 jours.
      const dailyByCid: Record<string, any[]> = {};
      for (const accDaily of await dailyInsightsAll(accId, ctx.token, errors)) {
        (dailyByCid[String(accDaily.campaign_id)] ||= []).push(accDaily);
      }

      for (const c of (Array.isArray(cm?.data) ? cm.data : [])) {
        const cid = String(c?.id ?? "");
        const nom = String(c?.name ?? "").trim();
        if (!cid || !nom) continue;
        const daily = dailyByCid[cid] || [];
        // Repli 30 jours quand l'historique journalier est vide (campagne lancee aujourd'hui,
        // campagne qui n'a pas encore ete relevee, etc.).
        const m = metricByCid[cid] || {};
        // L'historique remplace la fenetre glissante : depense_reelle devient
        // le cumul de l'historique, et la periode reellement couverte est
        // ecrite dans depense_periode_debut/fin pour que le calcul de ROAS
        // puisse l'utiliser au lieu de supposer 30 jours.
        const dailySpend = daily.reduce((s, d) => s + Number(d?.spend ?? 0), 0);
        const dailyImpr = daily.reduce((s, d) => s + Number(d?.impressions ?? 0), 0);
        const dailyClics = daily.reduce((s, d) => s + Number(d?.clicks ?? 0), 0);
        const dailyDates = daily.map((d) => String(d?.date_start ?? "")).filter(Boolean).sort();
        const histoOk = daily.length > 0;
        const spend = histoOk ? dailySpend : Number(m?.spend ?? 0);
        const impr = histoOk ? dailyImpr : Number(m?.impressions ?? 0);
        const clics = histoOk ? dailyClics : Number(m?.clicks ?? 0);
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
          depense_reelle: spend,
          impressions: impr,
          clics,
          portee: Number(m?.reach ?? 0),
          // spend arrive des Insights en unites majeures de la devise du compte
          // publicitaire (contrairement aux budgets, en centimes). On memorise la
          // devise au lieu de supposer FCFA.
          depense_devise: currency || null,
          depense_source: "api",
          depense_periode_debut: histoOk ? dailyDates[0] : null,
          depense_periode_fin: histoOk ? dailyDates[dailyDates.length - 1] : null,
          date_debut: histoOk ? dailyDates[0] : isoDaysAgo(30),
          date_fin: histoOk ? dailyDates[dailyDates.length - 1] : isoDaysAgo(0),
        };
        const { data: existing } = await adminSb.from("campaigns")
          .select("id").eq("org_id", orgId).eq("source", "meta").eq("meta_campaign_id", cid).maybeSingle();
        let campaignId = existing?.id ?? null;
        if (campaignId) {
          const { error: ue } = await adminSb.from("campaigns").update({ ...sync, nom }).eq("id", campaignId);
          if (ue) errors.push(nom + " : " + ue.message); else updated++;
        } else {
          // rattrapage : une ligne déjà créée par marketing_sync (par nom) → on l'enrichit.
          // Le filtre plateforme est indispensable : sans lui, une campagne Meta
          // portant le même nom qu'une campagne TikTok réécrit la ligne TikTok
          // et lui vole sa dépense. TikTok filtre déjà par plateforme.
          const { data: byName } = await adminSb.from("campaigns")
            .select("id").eq("org_id", orgId).eq("source", "meta").eq("plateforme", "facebook").eq("nom", nom).maybeSingle();
          if (byName?.id) {
            campaignId = byName.id;
            const { error: ue } = await adminSb.from("campaigns").update(sync).eq("id", campaignId);
            if (ue) errors.push(nom + " : " + ue.message); else updated++;
          } else {
            const { data: ins, error: ie } = await adminSb.from("campaigns").insert({
              org_id: orgId, nom, plateforme: "facebook", created_by: user.id, ...sync,
            }).select("id").maybeSingle();
            if (ie) errors.push(nom + " : " + ie.message); else { inserted++; campaignId = ins?.id ?? null; }
          }
        }

        // Historique journalier (source API). Upsert sur (campaign_id, jour) :
        // rejouer la synchronisation corrige un jour au lieu de le dupliquer.
        if (campaignId && daily.length) {
          const rows = daily
            .filter((d) => String(d?.date_start ?? ""))
            .map((d) => ({
              org_id: orgId,
              campaign_id: campaignId,
              jour: String(d.date_start),
              depense: Number(d?.spend ?? 0),
              impressions: Math.round(Number(d?.impressions ?? 0)),
              clics: Math.round(Number(d?.clicks ?? 0)),
              // reach n'est pas restitue au niveau journalier par Meta : on
              // laisse 0 plutot que d'ecrire un total 30 jours comme s'il etait
              // quotidien, ce qui rendrait la somme de la colonne sans sens.
              portee: 0,
              devise: currency || null,
              source: "api",
              synced_at: new Date().toISOString(),
            }));
          for (let i = 0; i < rows.length; i += 500) {
            const { error: de } = await adminSb.from("campaign_spend_daily")
              .upsert(rows.slice(i, i + 500), { onConflict: "campaign_id,jour" });
            if (de) errors.push(nom + " (historique) : " + de.message);
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