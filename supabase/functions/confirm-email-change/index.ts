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
//    d'un autre compte (un membre ne peut cibler que son propre user_id, la
//    policy "ecr_insert_self" force user_id = auth.uid()).
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
  //    utilisateur pourrait finaliser un changement pour une autre adresse.
  if ((caller.email ?? "").toLowerCase() !== newEmail) {
    return json({ error: "session non conforme au nouvel e-mail" }, 403);
  }

  // Client admin (service_role) pour les opérations sensibles
  const adminSb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 3. Lire la demande de changement enregistrée par l'utilisateur original.
  //    On prend la plus récente pour cet e-mail. Aucune demande = refus :
  //    un client ne peut PAS créer de demande ciblant un autre compte
  //    (policy RLS "ecr_insert_self" : user_id = auth.uid()).
  const { data: reqRows, error: reqErr } = await adminSb.from("email_change_requests")
    .select("user_id, new_email, created_at")
    .eq("new_email", newEmail)
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

  // Fraîcheur de la demande : < 15 min (fenêtre OTP), sinon la demande est
  // rejetée et le compte réel n'est jamais touché.
  const requestAgo = Date.now() - requestedAt
Bien sur, j'applique les corrections. Plus tard dans la mission, je créerai le fichier qui va avec, mais maintenant, parlons-en en premier.</think>Interrompu au milieu d'une ligne — je relis le fichier pour le réécrire proprement et complètement.

<｜DSML｜tool_calls>
<｜DSML｜invoke name="write">
<｜DSML｜parameter name="content" string="true">// Edge Function "confirm-email-change" — MAYELA CRM
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
  //    utilisateur pourrait finaliser un changement pour une autre adresse.
  if ((caller.email ?? "").toLowerCase() !== newEmail) {
    return json({ error: "session non conforme au nouvel e-mail" }, 403);
  }

  // Client admin (service_role) pour les opérations sensibles
  const adminSb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 3. Lire la demande de changement enregistrée côté serveur par l'utilisateur
  //    original. Aucune demande = refus : un client ne peut PAS créer de demande
  //    ciblant un autre compte (policy RLS "ecr_insert_self" : user_id = auth.uid()).
  const { data: reqRows, error: reqErr } = await adminSb.from("email_change_requests")
    .select("user_id, new_email, created_at")
    .eq("new_email", newEmail)
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

  // Fraîcheur de la demande : < 15 min (fenêtre OTP). Une demande plus ancienne
  // est rejetée : le compte réel n'est jamais touché par une demande expirée.
  const requestAgo = Date.now() - requestedAt;
  if (Number.isNaN(requestedAt) || requestAgo < 0 || requestAgo > FIFTEEN_MIN) {
    return json({ error: "demande de changement expirée" }, 409);
  }

  // 4. Trouver le user temporaire créé par verifyOtp avec le nouvel e-mail
  const { data: { users: matchingUsers } } = await adminSb.auth.admin.listUsers({
    filter: newEmail,
  });

  const tempUser = matchingUsers?.find(
    (u) => u.email?.toLowerCase() === newEmail && u.id !== requestUserId
  );

  if (tempUser) {
    // Sécurité : ne supprime JAMAIS un compte existant. Le user temporaire
    // doit avoir été créé il y a moins de 15 minutes (fenêtre OTP) ET après
    // la demande (l'OTP est envoyé seulement après l'enregistrement de la
    // demande). Sinon, un compte réel coexistant pourrait être supprimé.
    const createdAgo = Date.now() - new Date(tempUser.created_at ?? 0).getTime();
    if (createdAgo < 0 || createdAgo > FIFTEEN_MIN) {
      return json(
        { error: "cette adresse e-mail est déjà utilisée par un compte existant" },
        409
      );
    }
    if (new Date(tempUser.created_at ?? 0).getTime() < requestedAt) {
      return json(
        { error: "compte incompatible : réessayez depuis votre ancien e-mail" },
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

  // 5. Mettre à jour l'e-mail de l'utilisateur original (issu de la demande, jamais
  //    du corps de requête : empêche le détournement d'un compte tiers)
  const { error: updateErr } = await adminSb.auth.admin.updateUserById(
    requestUserId,
    { email: newEmail }
  );

  if (updateErr) {
    return json({ error: `Erreur lors de la mise à jour: ${updateErr.message}` }, 500);
  }

  // 6. Purger la demande consommée
  await adminSb.from("email_change_requests").delete()
    .eq("user_id", requestUserId)
    .eq("new_email", newEmail);

  return json({ ok: true });
});