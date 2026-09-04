// Edge Function "google-sheets" — MAYELA CRM
// Connecte Google Sheets par espace (OAuth) et exporte des données vers une feuille.
// Appel : POST /functions/v1/google-sheets (Authorization: Bearer <access_token>)
// Body  :
//   { action: "exchange", code: string, redirect_uri: string }     // après OAuth Google
//   { action: "refresh" }                                          // rafraîchir le token
//   { action: "status" }                                           // état de la connexion
//   { action: "export", sheets: { id, columns }[], fileName?: string } // écrire dans la feuille
// Retour: { ok: true, ... } ou { error: string }
//
// Le Client ID / Secret de l'app Google (OAuth console) sont lus depuis
// integrations_oauth.config (provider = "google_sheets"). Les tokens Google
// sont stockés dans integrations_oauth.config côté serveur, jamais au navigateur.
//
// NB : cette table integrations_oauth n'existe pas encore (migration V2 bloquée).
// Un fallback 100% côté navigateur est fourni dans l'UI tant que la table manque.

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

const OAUTH_TOKEN = "https://oauth2.googleapis.com/token";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

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
  let rows: string[][] = [];
  let fileName = "";
  let clientIdInput = "";
  let clientSecretInput = "";
  try {
    const body = await req.json();
    action = String(body.action ?? "");
    code = String(body.code ?? "");
    redirectUri = String(body.redirect_uri ?? "");
    rows = Array.isArray(body.rows) ? body.rows : [];
    fileName = String(body.fileName ?? "");
    clientIdInput = String(body.client_id ?? "");
    clientSecretInput = String(body.client_secret ?? "");
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  // ---- Lecture de la connexion google_sheets de l'org courante (isolation RLS) ----
  const { data: acc } = await sb.from("integrations_oauth")
    .select("id, config, display_name")
    .eq("provider", "google_sheets")
    .maybeSingle();

  const cfg = (acc?.config ?? {}) as Record<string, unknown>;
  const clientId = cfg?.client_id as string | undefined;
  const clientSecret = cfg?.client_secret as string | undefined;

  // ---- ACTION: status ----
  if (action === "status") {
    if (!acc) return json({ connected: false, missing: ["client_id", "client_secret"] });
    const missing: string[] = [];
    if (!clientId) missing.push("client_id");
    if (!clientSecret) missing.push("client_secret");
    const hasToken = Boolean(cfg?.access_token);
    if (hasToken && missing.length === 0) {
      const exp = Number(cfg?.expires_at ?? 0);
      return json({ connected: true, display_name: acc.display_name, expires_at: exp });
    }
    if (!hasToken) missing.push("access_token");
    return json({ connected: false, missing });
  }

  // ---- ACTION: register (enregistrer Client ID + Secret côté serveur) ----
  if (action === "register") {
    if (!clientIdInput || !clientSecretInput) {
      return json({ error: "Renseignez le Client ID et le Client Secret de l'app Google." }, 400);
    }
    const { data: prof } = await sb.from("profiles").select("org_id").eq("id", user.id).single();
    if (!prof?.org_id) return json({ error: "Impossible de déterminer l'espace." }, 400);
    const newConfig = { ...cfg, client_id: clientIdInput, client_secret: clientSecretInput };
    if (acc) {
      const { error } = await sb.from("integrations_oauth").update({ config: newConfig }).eq("id", acc.id);
      if (error) return json({ error: error.message }, 500);
    } else {
      const { error } = await sb.from("integrations_oauth").insert({
        org_id: prof.org_id,
        provider: "google_sheets",
        display_name: "Google Sheets",
        config: newConfig,
        connected_by: user.id,
      });
      if (error) return json({ error: error.message }, 500);
    }
    return json({ ok: true, missing: [] });
  }

  // ---- ACTION: exchange (code OAuth Google) ----
  if (action === "exchange") {
    if (!clientId || !clientSecret) {
      return json({ error: "App Google non configurée : entrez le Client ID et le Client Secret." }, 400);
    }
    if (!code || !redirectUri) return json({ error: "code/redirect_uri manquants" }, 400);

    const tr = await fetch(OAUTH_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tok = await tr.json().catch(() => null);
    if (!tok?.access_token) {
      return json({ error: "Google a refusé le code : " + (tok?.error_description || tok?.error || "réponse invalide") }, 502);
    }

    const newConfig = {
      ...cfg,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      scope: tok.scope ?? "",
      expires_at: Date.now() + Number(tok.expires_in ?? 3600) * 1000 - 60_000,
    };

    let displayName = "Google Sheets";
    try {
      // nom de comptes Google associé au token, pour l'afficher
      const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tok.access_token}` },
      });
      const u = await r.json().catch(() => null);
      if (u?.name) displayName = String(u.name);
    } catch (_e) { /* non bloquant */ }

    const { data: prof } = await sb.from("profiles").select("org_id").eq("id", user.id).single();
    if (acc) {
      const { error } = await sb.from("integrations_oauth").update({
        config: newConfig,
        display_name: displayName,
        connected_by: user.id,
      }).eq("id", acc.id);
      if (error) return json({ error: error.message }, 500);
    } else {
      const { error } = await sb.from("integrations_oauth").insert({
        org_id: prof?.org_id,
        provider: "google_sheets",
        display_name: displayName,
        config: newConfig,
        connected_by: user.id,
      });
      if (error) return json({ error: error.message }, 500);
    }
    return json({ ok: true, display_name: displayName });
  }

  // ---- ACTION: refresh ----
  if (action === "refresh") {
    const refreshToken = cfg?.refresh_token as string | undefined;
    if (!clientId || !clientSecret || !refreshToken || !acc) {
      return json({ error: "Pas de session Google : reconnectez le compte." }, 400);
    }
    const tr = await fetch(OAUTH_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const tok = await tr.json().catch(() => null);
    if (!tok?.access_token) {
      return json({ error: "Session Google expirée : reconnectez le compte." }, 401);
    }
    await sb.from("integrations_oauth").update({
      config: {
        ...cfg,
        access_token: tok.access_token,
        expires_at: Date.now() + Number(tok.expires_in ?? 3600) * 1000 - 60_000,
      },
    }).eq("id", acc.id);
    return json({ ok: true });
  }

  // ---- ACTION: export (écrire des lignes dans la feuille) ----
  if (action === "export") {
    if (!clientId || !clientSecret || !acc) {
      return json({ error: "Google Sheets non connecté par votre espace." }, 400);
    }
    let accessToken = cfg?.access_token as string | undefined;
    const refreshToken = cfg?.refresh_token as string | undefined;
    if (!accessToken || !refreshToken) {
      return json({ error: "Google Sheets non connecté : reconnectez le compte." }, 401);
    }
    if (Number(cfg?.expires_at ?? 0) < Date.now()) {
      const tr = await fetch(OAUTH_TOKEN, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });
      const tok = await tr.json().catch(() => null);
      if (!tok?.access_token) return json({ error: "Session Google expirée : reconnectez le compte." }, 401);
      accessToken = tok.access_token;
      await sb.from("integrations_oauth").update({
        config: { ...cfg, access_token: accessToken, expires_at: Date.now() + Number(tok.expires_in ?? 3600) * 1000 - 60_000 },
      }).eq("id", acc.id);
    }
    if (!rows.length) return json({ error: "empty_rows" }, 400);

    // 1) On crée une nouvelle feuille de calcul dédiée à l'export
    const createRes = await fetch(`${SHEETS_API}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: { title: fileName || "Export MAYELA CRM" },
      }),
    });
    const sheet = await createRes.json().catch(() => null);
    const spreadsheetId = sheet?.spreadsheetId;
    const sheetId = sheet?.sheets?.[0]?.properties?.sheetId;
    if (!createRes.ok || !spreadsheetId) {
      return json({ error: "Impossible de créer la feuille : " + (sheet?.error?.message || "réponse invalide") }, 502);
    }
    const range = sheet?.sheets?.[0]?.properties?.title || "Feuille1";

    // 2) On y écrit les lignes (entêtes + données)
    const upd = await fetch(`${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range + "!A1")}:append`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: rows, majorDimension: "ROWS" }),
    });

    // 3) Mise en gras / largeur automatique (optionnel, non bloquant)
    try {
      await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            updateSheetProperties: { properties: { sheetId, gridProperties: { columnCount: Math.max(rows[0]?.length ?? 1, 1) } }, fields: "gridProperties.columnCount" },
          }],
        }),
      });
    } catch (_e) { /* non bloquant */ }

    if (!upd.ok) {
      return json({ error: "Écriture dans la feuille en échec." }, 502);
    }
    return json({ ok: true, spreadsheet_id: spreadsheetId, url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}` });
  }

  return json({ error: "action inconnue" }, 400);
});
