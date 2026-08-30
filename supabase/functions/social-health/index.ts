// Edge Function "social-health" — MAYELA CRM
// Diagnostic de l'état des intégrations sociales de l'ESpace courant (RLS) :
// détecte les intégrations incomplètes (champs de config manquants) et teste
// l'accès réel au token (si les clés sont présentes) sans jamais bloquer.
//
// Appel : GET /functions/v1/social-health (Authorization: Bearer <access_token>)
// Retour : { platforms: [ { platform, state, missing, token_valid, expires_at, display_name, notes } ] }
//   - platform   : "facebook" | "tiktok"
//   - state      : "absent" | "incomplete" | "complete"
//   - missing    : champs de config requis manquants (si incomplete)
//   - token_valid: true/false/null (test réel uniquement si les clés sont présentes)
//   - expires_at : timestamp d'expiration du token (si connu)
//   - display_name: nom affiché sur la carte
//   - notes      : avertissements (rack, expiration, etc.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const GRAPH = "https://graph.facebook.com/v21.0";
const OPEN_API = "https://open.tiktokapis.com/v2";
const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";

// Champs de config "requis" par plateforme (ceux qui rendent l'intégration utilisable)
const REQUIRED: Record<string, string[]> = {
  facebook: ["page_id", "access_token"],
  tiktok: ["client_key", "client_secret", "access_token", "open_id"],
};

// Champs de tracking TikTok, facultatifs pour la publication mais signalés s'ils manquent
const TRACKING_REQUIRED: Record<string, string[]> = {
  tiktok: ["pixel_id", "pixel_access_token"],
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  // Tous les comptes sociaux de l'org courante (isolation par RLS)
  const { data: accounts, error: accErr } = await sb.from("social_accounts")
    .select("platform, display_name, config");

  if (accErr) return json({ error: accErr.message }, 500);

  const byPlatform: Record<string, any> = {};
  for (const a of accounts ?? []) byPlatform[a.platform] = a;

  const platforms: any[] = [];

  for (const platform of ["facebook", "tiktok"]) {
    const acc = byPlatform[platform];
    if (!acc) {
      platforms.push({ platform, state: "absent", missing: REQUIRED[platform] ?? [], token_valid: null, expires_at: null, display_name: null, notes: [] });
      continue;
    }

    const cfg = (acc.config ?? {}) as Record<string, unknown>;
    const required = REQUIRED[platform] ?? [];
    const missing = required.filter((k) => !cfg[k]);
    const notes: string[] = [];

    const display = String(acc.display_name ?? "");
    const expiresAt = typeof cfg.expires_at === "number" ? cfg.expires_at : null;

    // Expiration imminente
    if (typeof expiresAt === "number") {
      const daysLeft = Math.floor((expiresAt - Date.now()) / 86_400_000);
      if (daysLeft < 0) notes.push("Token expiré : reconnectez l'intégration.");
      else if (daysLeft <= 7) notes.push(`Token expirera dans ~${daysLeft} j.`);
    }

    // Champs de tracking TikTok manquants (signalés mais ne bloquent pas la publication)
    if (platform === "tiktok") {
      const trMissing = (TRACKING_REQUIRED[platform] ?? []).filter((k) => !cfg[k]);
      if (trMissing.length) notes.push(`Tracking pixel incomplet (${trMissing.join(", ")}).`);
    }

    const state = missing.length ? "incomplete" : "complete";

    // Test d'accès réel — UNIQUEMENT si les champs de base sont présents (non bloquant)
    let tokenValid: boolean | null = null;
    if (state === "complete") {
      if (platform === "facebook") {
        const pageId = String(cfg.page_id);
        const token = String(cfg.access_token);
        try {
          const r = await fetch(`${GRAPH}/${pageId}?fields=id,name&access_token=${encodeURIComponent(token)}`);
          const out = await r.json();
          tokenValid = r.ok ? true : false;
          if (!r.ok) notes.push(out?.error?.message ?? "Token Graph invalide.");
        } catch (_e) {
          notes.push("Facebook injoignable (test d'accès non concluant).");
        }
      } else {
        const token = String(cfg.access_token);
        try {
          const r = await fetch(`${OPEN_API}/user/info/?fields=display_name`,
            { headers: { Authorization: `Bearer ${token}` } });
          const out = await r.json();
          if (out?.data?.user?.display_name) tokenValid = true;
          else if (out?.error?.code === "access_token_invalid") { tokenValid = false; notes.push("Session TikTok invalide : reconnectez le compte."); }
          else { tokenValid = null; notes.push("Réponse TikTok inattendue."); }
        } catch (_e) {
          notes.push("TikTok injoignable (test d'accès non concluant).");
        }
      }
    }

    platforms.push({
      platform,
      state,
      missing,
      token_valid: tokenValid,
      expires_at: expiresAt,
      display_name: display || null,
      notes,
    });
  }

  return json({ platforms });
});
