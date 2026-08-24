// Edge Function "social-publish" — MAYELA CRM
// Publie une offre : Page Facebook (Graph API) ou compte TikTok (Content Posting API, carrousel photo).
// Appel : POST /functions/v1/social-publish (Authorization: Bearer <access_token>)
// Body  : { platform: "facebook" | "tiktok", text: string, image_url?: string }
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
    const clientKey = cfg?.client_key as string | undefined;
    const clientSecret = cfg?.client_secret as string | undefined;
    const openId = cfg?.open_id as string | undefined;
    let accessToken = cfg?.access_token as string | undefined;

    if (!clientKey || !clientSecret || !accessToken || !openId) {
      return json({ error: "Compte TikTok incomplet : reconnectez-le depuis l'onglet Réseaux." }, 400);
    }

    // Token expiré → rafraîchissement silencieux via refresh_token
    if (cfg?.expires_at && Date.now() > Number(cfg.expires_at)) {
      const tr = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          grant_type: "refresh_token",
          refresh_token: String(cfg.refresh_token ?? ""),
        }),
      });
      const tout = await tr.json().catch(() => null);
      if (!tout?.access_token) {
        return json({ error: "Session TikTok expirée : reconnectez le compte (bouton Connecter)." }, 401);
      }
      accessToken = tout.access_token;
      await sb.from("social_accounts").update({
        config: {
          ...cfg,
          access_token: accessToken,
          refresh_token: tout.refresh_token,
          expires_at: Date.now() + Number(tout.expires_in ?? 86400) * 1000 - 60_000,
        },
      }).eq("id", acc.id);
    }

    // Niveau de confidentialité : on respecte les options autorisées par le créateur
    let privacyOptions: string[] = [];
    try {
      const ci = await fetch(`${OPEN}/post/publish/creator_info/query/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const cij = await ci.json().catch(() => null);
      privacyOptions = Array.isArray(cij?.data?.privacy_level_options) ? cij.data.privacy_level_options : [];
    } catch (_e) { /* non bloquant */ }
    const privacy = privacyOptions.includes("PUBLIC_TO_EVERYONE")
      ? "PUBLIC_TO_EVERYONE"
      : (privacyOptions[0] ?? "SELF_ONLY");

    // Publication photo : titre = première ligne (90 max), description = texte complet (4000 max)
    const title = text.split("\n")[0].trim().slice(0, 90) || "Nouvelle offre";
    const description = text.slice(0, 4000);

    const postOnce = async (level: string) =>
      fetch(`${OPEN}/post/publish/content/init/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({
          post_info: {
            title,
            description,
            privacy_level: level,
            auto_add_music: true,
            brand_organic_toggle: true,
          },
          source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: [imageUrl] },
          post_mode: "DIRECT_POST",
          media_type: "PHOTO",
        }),
      });

    try {
      let r = await postOnce(privacy);
      let out = await r.json().catch(() => null);

      // App non auditée : TikTok n'autorise que les publications privées → on retente en SELF_ONLY
      if (out?.error?.code === "unaudited_client_can_only_post_to_private_accounts" && privacy !== "SELF_ONLY") {
        r = await postOnce("SELF_ONLY");
        out = await r.json().catch(() => null);
      }

      const errCode = out?.error?.code;
      if (errCode && errCode !== "ok") {
        const MESSAGES: Record<string, string> = {
          url_ownership_unverified:
            "TikTok exige que le domaine des images soit vérifié dans votre app développeur. Vérifiez votre domaine dans le portail TikTok (Content Posting API), ou passez la revue de l'app.",
          unaudited_client_can_only_post_to_private_accounts:
            "App TikTok non auditée : le compte doit être privé pour publier via l'API, ou terminez l'audit de l'app pour publier publiquement.",
          spam_risk_too_many_posts: "Limite quotidienne de publications TikTok atteinte pour ce compte.",
          reached_active_user_cap: "Quota quotidien d'utilisateurs publieurs atteint pour votre app TikTok.",
          access_token_invalid: "Session TikTok invalide : reconnectez le compte.",
          scope_not_authorized: "Le scope video.publish n'est pas accordé : refaites « Autoriser » sur la carte TikTok.",
        };
        return json({ error: MESSAGES[errCode] ?? `TikTok : ${out.error.message || errCode}` }, 502);
      }

      const publishId = out?.data?.publish_id ?? "";
      if (!publishId) return json({ error: "Réponse TikTok inattendue." }, 502);
      return json({ external_post_id: publishId });
    } catch (_e) {
      return json({ error: "TikTok injoignable." }, 502);
    }
  }

  return json({ error: "plateforme inconnue" }, 400);
});
