// Edge Function "tiktok-events" — MAYELA CRM
// Envoie des événements serveur via TikTok Events API (server-side).
// Appel : POST /functions/v1/tiktok-events (Authorization: Bearer <access_token>)
// Body  : {
//           event: "SubmitForm" | "CompleteRegistration" | "Contact" | "Purchase" | "Schedule",
//           email?: string, phone?: string, external_id?: string,
//           properties?: { value?, currency?, content_id?, ... }
//         }
// Retour: { event_id, received } ou { error: string }
//
// Le Pixel ID et l'Access Token Events API sont stockés dans social_accounts.config
// (platform = "tiktok") : ils ne transitent JAMAIS vers le navigateur.
// Les données utilisateur (email/phone) sont hashées SHA-256 avant envoi (exigence TikTok).

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

const TRACK_URL = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

const VALID_EVENTS = [
  "SubmitForm",
  "CompleteRegistration",
  "Contact",
  "Purchase",
  "Schedule",
] as const;

const sha256 = async (value: string) => {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

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

  if (!(VALID_EVENTS as readonly string[]).includes(event)) {
    return json({ error: "event inconnu" }, 400);
  }

  // Pixel ID + Access Token Events API de l'org courante (isolation par RLS)
  const { data: acc, error: accErr } = await sb.from("social_accounts")
    .select("id, config")
    .eq("platform", "tiktok")
    .maybeSingle();

  if (accErr) return json({ error: accErr.message }, 500);
  if (!acc) return json({ error: "compte TikTok non connecté" }, 404);

  const cfg = (acc.config ?? {}) as Record<string, unknown>;
  const pixelId = cfg?.pixel_id as string | undefined;
  const pixelAccessToken = cfg?.pixel_access_token as string | undefined;

  if (!pixelId || !pixelAccessToken) {
    return json({ error: "Pixel ID / Events API Token manquants dans l'onglet Réseaux." }, 400);
  }

  // user_data : hash SHA-256 de l'email / téléphone / external_id (au moins un requis)
  const user_data: Record<string, string[]> = {};
  if (email) user_data.email = [await sha256(email)];
  if (phone) user_data.phone_number = [await sha256(phone)];
  if (externalId) user_data.external_id = [await sha256(externalId)];
  if (Object.keys(user_data).length === 0) {
    return json({ error: "email, phone ou external_id requis" }, 400);
  }

  // event_id déterministe : déduplication sur 48h (même conversion = même id)
  const eventId = [
    "mayela",
    event,
    externalId || email || phone,
    properties?.content_id ?? "",
  ].join("_");

  const payload = {
    event_source: "web",
    event_source_id: pixelId,
    data: [
      {
        event,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        user: { ...user_data },
        page: { url: String(properties?.page_url ?? "") },
        properties,
      },
    ],
    test_event_code: cfg?.test_event_code as string | undefined,
  };

  const log = async (status: "sent" | "failed", error?: string) => {
    try {
      await sb.from("social_events_log").insert({
        org_id: cfg?.org_id ?? (await sb.from("profiles").select("org_id").eq("id", user.id).single()).data?.org_id,
        platform: "tiktok",
        event,
        pixel_id: pixelId,
        event_id: eventId,
        external_id: externalId || null,
        status,
        error: error ?? null,
        payload: properties,
        sent_by: user.id,
      });
    } catch (_e) { /* le journal ne bloque jamais l'envoi */ }
  };

  try {
    const r = await fetch(TRACK_URL, {
      method: "POST",
      headers: {
        "Access-Token": pixelAccessToken,
        "Content-Type": "application/json",
        "User-Agent": "MAYELA-CRM/1.0",
      },
      body: JSON.stringify(payload),
    });
    const out = await r.json().catch(() => null);

    const code = out?.data?.code ?? out?.code;
    if (!r.ok || (code !== 0 && code !== "OK")) {
      const msg = `TikTok Events : ${out?.message || `HTTP ${r.status}`}`;
      await log("failed", msg);
      return json({ error: msg }, 502);
    }
    await log("sent");
    return json({ ok: true, event_id: eventId });
  } catch (_e) {
    await log("failed", "TikTok Events injoignable.");
    return json({ error: "TikTok Events injoignable." }, 502);
  }
});
