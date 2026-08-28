// Edge Function "adjust-events" — MAYELA CRM
// Envoie un événement de conversion via Adjust S2S (server-to-server) API.
// Appel : POST /functions/v1/adjust-events (Authorization: Bearer <access_token>)
// Body  : {
//           event: "install" | "purchase" | "reengagement" | "<custom_event_token>",
//           email?, phone?, external_id?,
//           properties?: { value?, currency?, content_id?, adid?, idfa?, gps_adid? }
//         }
// Retour: { ok: true } ou { error: string }
//
// ⚠️ COQUILLE PRÊTE À BRANCHER — non active tant que le compte pro Branch/Adjust
//    n'est pas activé (voir config/SUIVI_TIKTOK_INTEGRATIONS.md → Phase 3).
//    L'App Token et le S2S Token sont stockés dans social_accounts.config
//    (platform = "tiktok", clés adjust_app_token / adjust_s2s_token) côté UI,
//    mais Adjust attend un endpoint dédié (s2s.adjust.com) avec son app_token.
//
// Référence S2S : https://help.adjust.com/en/article/server-to-server-events
//  - GET https://s2s.adjust.com/event?app_token={app_token}&event_token={event_token}&...
//  - ou POST https://s2s.adjust.com/event (urlencoded)

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

const S2S_URL = "https://s2s.adjust.com/event";

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

  let event = "";
  let email = "";
  let phone = "";
  let externalId = "";
  let properties: Record<string, unknown> = {};
  try {
    const body = await req.json();
    event = String(body.event ?? "");
    email = String(body.email ?? "");
    phone = String(body.phone ?? "");
    externalId = String(body.external_id ?? "");
    properties = body.properties && typeof body.properties === "object" ? body.properties : {};
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  if (!event) return json({ error: "event manquant" }, 400);

  // Ligne social_accounts de l'org courante (isolation par RLS) — on lit le futur app_token
  const { data: acc } = await sb.from("social_accounts")
    .select("id, config")
    .eq("platform", "tiktok")
    .maybeSingle();

  const cfg = (acc?.config ?? {}) as Record<string, unknown>;
  const appToken = cfg?.adjust_app_token as string | undefined;

  // ── Actif une fois le compte pro activé : décommentez le bloc suivant et
  //    renseignez app_token/event_token via la section Configuration Tracking ──
  if (!appToken) {
    return json({
      error:
        "Adjust/Branch (MMP) pas encore activé : en attente de l'activation du compte pro " +
        "(voir config/SUIVI_TIKTOK_INTEGRATIONS.md, Phase 3).",
    }, 400);
  }

  // Journale l'envoi avant l'appel (audit trail)
  const logId = [
    "mayela_adjust",
    event,
    externalId || email || phone,
    properties?.content_id ?? "",
  ].join("_");
  const logOk = async () => {
    try {
      await sb.from("social_events_log").insert({
        org_id: cfg?.org_id,
        platform: "adjust",
        event,
        event_id: logId,
        external_id: externalId || null,
        status: "sent",
        payload: properties,
        sent_by: user.id,
      });
    } catch (_e) { /* le journal ne bloque jamais l'envoi */ }
  };

  const params = new URLSearchParams({
    app_token: appToken,
    event_token: event,
    ...(externalId ? { external_id: externalId } : {}),
    ...(email ? { email: email } : {}),
    ...(phone ? { phone: phone } : {}),
    ...(properties?.adid ? { adid: String(properties.adid) } : {}),
    ...(properties?.idfa ? { idfa: String(properties.idfa) } : {}),
    ...(properties?.gps_adid ? { gps_adid: String(properties.gps_adid) } : {}),
  });
  if (properties?.value != null) params.set("revenue", String(properties.value));
  if (properties?.currency) params.set("currency", String(properties.currency));

  try {
    const r = await fetch(`${S2S_URL}?${params.toString()}`, { method: "GET" });
    if (!r.ok && r.status !== 404) {
      return json({ error: `Adjust S2S : HTTP ${r.status}` }, 502);
    }
    await logOk();
    return json({ ok: true, event_id: logId });
  } catch (_e) {
    return json({ error: "Adjust S2S injoignable." }, 502);
  }
});
