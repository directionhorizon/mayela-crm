// Edge Function "confirm-email-change" — MAYELA CRM
// Finalise le changement d'e-mail après vérification OTP.
// Appel : POST /functions/v1/confirm-email-change (Authorization: Bearer <access_token>)
// Body  : { new_email: string }
// Retour: { ok: true } ou { error: string }
//
// Étapes :
// 1. Vérifie que la session appelante correspond bien au nouvel e-mail
//    (le user temporaire créé par verifyOtp porte cet e-mail)
// 2. Lit la demande de changement enregistrée côté serveur (table
//    email_change_requests) : c'est ELLE qui désigne le compte original.
//    Le client ne fournit plus d'UUID arbitraire → plus de prise de contrôle
//    d'un autre compte (la policy "ecr_insert_self" force user_id = auth.uid()).
// 3. Trouve et supprime le user temporaire (créé il y a moins de 15 min),
//    uniquement si la demande est plus ancienne que ce user temporaire.
// 4. Supprime son éventuel profil orphelin
// 5. Met à jour l'e-mail de l'utilisateur original (issu de la demande)
// 6. Purge les demandes consommées

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

const FIFTEEN_MIN = 15 * 60 * 1000;

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

  let newEmail = "";
  try {
    const body = await req.json();
    newEmail = String(body.new_email ?? "").trim().toLowerCase();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  if (!newEmail || !newEmail.includes("@")) {
    return json({ error: "paramètres invalides" }, 400);
  }

  // 2. Vérification d'authenticité : la session courante (user temporaire créé
  //    par verifyOtp) doit porter exactement l'e-mail cible. Sans cela, un
  //    utilisateur pourrait changer l'e-mail d'un autre compte.
  if ((caller.email ?? "").toLowerCase() !== newEmail) {
    return json({ error: "session non conforme au nouvel e-mail" }, 403);
  }

  // Client admin (service_role) pour les opérations sensibles.
  // Échappe aux policies RLS (seules les lectures de simples membres sont masquées).
  const adminSb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 3. Lire la demande côté serveur : le compte original est désigné par la
  //    table email_change_requests (insérée avec RLS user_id = auth.uid()),
  //    jamais par un UUID fourni par le client.
  const { data: reqRows, error: reqErr } = await adminSb.from("email_change_requests")
    .select("id, user_id, new_email, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (reqErr) return json({ error: reqErr.message }, 500);

  const request = (reqRows ?? []).find(
    (r) => (r.new_email ?? "").toLowerCase() === newEmail && r.user_id !== caller.id
  );

  if (!request) {
    return json({ error: "aucune demande de changement pour cette adresse" }, 409);
  }

  const requestUserId = String(request.user_id);
  const requestedAt = new Date(request.created_at ?? 0).getTime();

  // 4. Fraîcheur de la demande : < 15 min (fenêtre OTP), sinon la demande est
  //    rejetée et le compte réel n'est jamais touché.
  const requestAgo = Date.now() - requestedAt;
  if (requestAgo < 0 || requestAgo > FIFTEEN_MIN) {
    return json({ error: "demande de changement expirée" }, 409);
  }

  // 5. Le user temporaire (caller) doit avoir été créé il y a < 15 min ET
  //    APRÈS la demande (ordre du flux : enregistrement de la demande → verifyOtp).
  //    Un compte réel (ancien) ou une session antérieure à la demande est refusé.
  const tempCreatedAt = new Date(caller.created_at ?? 0).getTime();
  const tempAge = Date.now() - tempCreatedAt;
  if (tempAge < 0 || tempAge > FIFTEEN_MIN || requestedAt >= tempCreatedAt) {
    return json(
      { error: "session invalide pour cette demande (compte existant ou ordre incohérent)" },
      409
    );
  }

  // 6. Supprimer le profil orphelin éventuel (trigger on_auth_user_created)
  const { error: profErr } = await adminSb.from("profiles").delete().eq("id", caller.id);
  if (profErr) console.error("Erreur suppression profil temporaire:", profErr);

  // 7. Supprimer le user temporaire
  const { error: delErr } = await adminSb.auth.admin.deleteUser(caller.id);
  if (delErr) {
    console.error("Erreur suppression user temporaire:", delErr);
    return json({ error: "user temporaire non supprimé" }, 500);
  }

  // 8. Mettre à jour l'e-mail de l'utilisateur original (issu de la demande)
  const { error: updateErr } = await adminSb.auth.admin.updateUserById(
    requestUserId,
    { email: newEmail }
  );

  if (updateErr) {
    return json({ error: `Erreur lors de la mise à jour: ${updateErr.message}` }, 500);
  }

  // 9. Purger les demandes consommées pour cet e-mail
  await adminSb.from("email_change_requests").delete().eq("new_email", newEmail);

  return json({ ok: true });
});