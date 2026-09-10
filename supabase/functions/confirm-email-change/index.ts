// Edge Function "confirm-email-change" — MAYELA CRM
// Finalise le changement d'e-mail après vérification OTP.
// Appel : POST /functions/v1/confirm-email-change (Authorization: Bearer <access_token>)
// Body  : { original_user_id: string, new_email: string }
// Retour: { ok: true } ou { error: string }
//
// Étapes :
// 1. Vérifie que la session appelante correspond bien au nouvel e-mail
//    (le user temporaire créé par verifyOtp porte cet e-mail)
// 2. Trouve et supprime le user temporaire (créé il y a moins de 15 min)
// 3. Supprime son éventuel profil orphelin
// 4. Met à jour l'e-mail de l'utilisateur original via Admin API

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  // 1. La session appelante doit exister
  const { data: { user: caller } } = await sb.auth.getUser();
  if (!caller) return json({ error: "unauthorized" }, 401);

  let originalUserId = "";
  let newEmail = "";
  try {
    const body = await req.json();
    originalUserId = String(body.original_user_id ?? "").trim();
    newEmail = String(body.new_email ?? "").trim().toLowerCase();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  if (!originalUserId || !newEmail || !newEmail.includes("@")) {
    return json({ error: "paramètres invalides" }, 400);
  }

  // 2. Vérification d'authenticité : la session courante (user temporaire créé
  //    par verifyOtp) doit porter exactement l'e-mail cible. Sans cela, un
  //    utilisateur pourrait changer l'e-mail d'un autre compte.
  if ((caller.email ?? "").toLowerCase() !== newEmail) {
    return json({ error: "session non conforme au nouvel e-mail" }, 403);
  }

  // Client admin (service_role) pour les opérations sensibles
  const adminSb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 3. Trouver le user temporaire créé par verifyOtp avec le nouvel e-mail
  const { data: { users: matchingUsers } } = await adminSb.auth.admin.listUsers({
    filter: newEmail,
  });

  const tempUser = matchingUsers?.find(
    (u) => u.email?.toLowerCase() === newEmail && u.id !== originalUserId
  );

  if (tempUser) {
    // Sécurité : ne supprime JAMAIS un compte existant. Le user temporaire
    // doit avoir été créé il y a moins de 15 minutes (fenêtre OTP).
    const createdAgo = Date.now() - new Date(tempUser.created_at ?? 0).getTime();
    if (createdAgo < 0 || createdAgo > 15 * 60 * 1000) {
      return json(
        { error: "cette adresse e-mail est déjà utilisée par un compte existant" },
        409
      );
    }

    // Supprimer le profil orphelin éventuel (trigger on_auth_user_created)
    const { error: profErr } = await adminSb.from("profiles").delete().eq("id", tempUser.id);
    if (profErr) console.error("Erreur suppression profil temporaire:", profErr);

    // Supprimer le user temporaire
    const { error: delErr } = await adminSb.auth.admin.deleteUser(tempUser.id);
    if (delErr) {
      console.error("Erreur suppression user temporaire:", delErr);
      return json({ error: "user temporaire non supprimé" }, 500);
    }
  }

  // 4. Mettre à jour l'e-mail de l'utilisateur original
  const { error: updateErr } = await adminSb.auth.admin.updateUserById(
    originalUserId,
    { email: newEmail }
  );

  if (updateErr) {
    return json({ error: `Erreur lors de la mise à jour: ${updateErr.message}` }, 500);
  }

  return json({ ok: true });
});