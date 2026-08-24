// Edge Function "social-publish" — MAYELA CRM
// Publie une offre sur une Page Facebook connectée via la Graph API.
// Appel : POST /functions/v1/social-publish (Authorization: Bearer <access_token>)
// Body  : { platform: "facebook", text: string, image_url?: string }
// Retour: { external_post_id: string } ou { error: string }
//
// Le token Page est lu depuis social_accounts.config côté serveur :
// il ne transite JAMAIS vers le navigateur.

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

  let platform = "";
  let text = "";
  let imageUrl: string | null = null;
  try {
    const body = await req.json();
    platform = String(body.platform ?? "");
    text = String(body.text ?? "").slice(0, 5000);
    imageUrl = body.image_url ? String(body.image_url) : null;
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  if (!text.trim()) return json({ error: "empty_text" }, 400);

  // Compte social de l'org courante pour cette plateforme
  const { data: acc, error: accErr } = await sb.from("social_accounts")
    .select("id, config")
    .eq("platform", platform)
    .maybeSingle();

  if (accErr || !acc) return json({ error: "compte non connecté" }, 404);

  const cfg = acc.config as Record<string, unknown>;
  const pageId = cfg?.page_id as string | undefined;
  const pageToken = cfg?.access_token as string | undefined;

  if (platform === "facebook") {
    if (!pageId || !pageToken) return json({ error: "page_id/access_token manquants" }, 400);

    try {
      let postId = "";
      if (imageUrl) {
        const r = await fetch(`${GRAPH}/${pageId}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ url: imageUrl, caption: text, access_token: pageToken }),
        });
        const out = await r.json();
        if (!r.ok) return json({ error: out?.error?.message ?? "graph_error" }, 502);
        postId = out.post_id ?? out.id ?? "";
      } else {
        const r = await fetch(`${GRAPH}/${pageId}/feed`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ message: text, access_token: pageToken }),
        });
        const out = await r.json();
        if (!r.ok) return json({ error: out?.error?.message ?? "graph_error" }, 502);
        postId = out.id ?? "";
      }
      return json({ external_post_id: postId });
    } catch {
      return json({ error: "graph_unreachable" }, 502);
    }
  }

  if (platform === "whatsapp") {
    return json({
      error:
        "Publication WhatsApp non disponible. Utilisez les boutons WhatsApp de chaque client, ou configurez la Cloud API.",
    }, 400);
  }

  if (platform === "tiktok") {
    return json({
      error:
        "La publication TikTok nécessite l'approbation TikTok Content Posting API (revue d'app). Connectez le compte d'abord.",
    }, 400);
  }

  return json({ error: "plateforme inconnue" }, 400);
});
