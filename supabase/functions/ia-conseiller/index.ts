// Edge Function "ia-conseiller" — MAYELA CRM
// Appel : POST /functions/v1/ia-conseiller  (Authorization: Bearer <access_token>)
// Body  : { message: string, fileText?: string }
// Retour: { reply: string }
//
// Secret requis : GEMINI_API_KEY (Dashboard → Edge Functions → Secrets)

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

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  let message = "";
  let fileText: string | null = null;
  let history: Array<{ role?: string; text?: string }> = [];
  try {
    const body = await req.json();
    message = String(body.message ?? "").slice(0, 4000);
    fileText = body.fileText ? String(body.fileText).slice(0, 12000) : null;
    if (Array.isArray(body.history)) history = body.history.slice(-12);
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  if (!message.trim()) return json({ error: "empty_message" }, 400);

  // ---------- Contexte CRM (scopé par RLS grâce au JWT utilisateur) ----------
  const ctx: Record<string, unknown> = {};
  try {
    const { data: prof } = await sb.from("profiles")
      .select("full_name, org_id").eq("id", user.id).single();
    ctx.utilisateur = prof?.full_name ?? null;

    if (prof?.org_id) {
      const { data: org } = await sb.from("organizations")
        .select("name").eq("id", prof.org_id).maybeSingle();
      ctx.entreprise = org?.name ?? null;
    }

    const today = new Date();
    const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const [clientsRes, intersRes, achatsRes, lateRes] = await Promise.all([
      sb.from("clients").select("id,name,stage_override,created_at").limit(300),
      sb.from("interactions").select("client_id,occurred_at").order("occurred_at", { ascending: false }).limit(800),
      sb.from("achats").select("client_id,montant,achat_date"),
      sb.from("tasks").select("due_date,client_id").eq("status", "a_faire").lt("due_date", localToday).limit(30),
    ]);

    const clients = clientsRes.data ?? [];
    const lastInter = new Map<string, string>();
    (intersRes.data ?? []).forEach((i) => {
      if (!lastInter.has(i.client_id)) lastInter.set(i.client_id, i.occurred_at);
    });
    const totals = new Map<string, number>();
    const totals30 = new Map<string, number>();
    const sinceTs = Date.now() - 30 * 86400000;
    let ca30 = 0;
    (achatsRes.data ?? []).forEach((a) => {
      const m = Number(a.montant || 0);
      totals.set(a.client_id, (totals.get(a.client_id) || 0) + m);
      if (new Date(a.achat_date).getTime() >= sinceTs) {
        totals30.set(a.client_id, (totals30.get(a.client_id) || 0) + m);
        ca30 += m;
      }
    });

    const counts: Record<string, number> = {};
    clients.forEach((c) => {
      const s = c.stage_override || "Prospect";
      counts[s] = (counts[s] || 0) + 1;
    });
    ctx.repartition_clients = counts;
    ctx.ca_30j_fcfa = Math.round(ca30);

    const nameOf = new Map(clients.map((c) => [c.id, c.name]));
    const daysSince = (iso?: string | null) =>
      iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null;

    ctx.clients_inactifs = clients
      .map((c) => ({ nom: c.name, jours_sans_contact: daysSince(lastInter.get(c.id) ?? c.created_at) }))
      .filter((x) => x.jours_sans_contact !== null && x.jours_sans_contact >= 15)
      .sort((a, b) => (b.jours_sans_contact ?? 0) - (a.jours_sans_contact ?? 0))
      .slice(0, 8);

    ctx.taches_en_retard = (lateRes.data ?? []).map((t) => ({
      client: nameOf.get(t.client_id) ?? "?",
      en_retard_depuis: t.due_date,
    }));

    ctx.top_clients = clients
      .map((c) => ({ nom: c.name, total_achats_fcfa: Math.round(totals.get(c.id) || 0) }))
      .filter((x) => x.total_achats_fcfa > 0)
      .sort((a, b) => b.total_achats_fcfa - a.total_achats_fcfa)
      .slice(0, 5);
  } catch {
    // contexte partiel indisponible : on continue quand même
  }

  // ---------- Appel Gemini ----------
  const systemPrompt =
    "Tu es le Conseiller MAYELA, assistant commercial d'une app CRM destinée aux petites entreprises de Pointe-Noire (Congo).\n\n" +
    "RÈGLES DE LOGIQUE STRICTES :\n" +
    "- Utilise UNIQUEMENT les chiffres des DONNÉES CRM ci-dessous et cite-les explicitement quand tu t'en sers.\n" +
    "- N'invente JAMAIS un nom, un montant ou une situation absents des données.\n" +
    "- Si l'information manque pour conseiller précisément, dis-le et pose UNE question ciblée.\n" +
    "- Un client avec un achat récent n'est PAS à relancer comme inactif.\n\n" +
    "FORMAT DE RÉPONSE :\n" +
    "1) Constat en 1-2 phrases avec chiffres.\n" +
    "2) 2 à 3 actions concrètes priorisées (la plus urgente d'abord).\n" +
    "Français simple, maximum ~150 mots.\n\n" +
    `DONNÉES CRM: ${JSON.stringify(ctx)}\n` +
    (fileText ? `PIÈCE JOINTE FOURNIE PAR L'UTILISATEUR:\n${fileText}\n` : "");

  const geminiKey =
    Deno.env.get("GEMINI_API_KEY") ??
    Deno.env.get("MAYELA_GEMINI_API_KEY") ??
    Deno.env.get("MAYELA Gemini API Key");
  if (!geminiKey) return json({ error: "GEMINI_API_KEY non configurée" }, 500);

  let reply = "";
  const attempts: string[] = [];
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [
      ...history.map((h) => ({
        role: h?.role === "assistant" ? "model" : "user",
        parts: [{ text: String(h?.text ?? "").slice(0, 2000) }],
      })),
      { role: "user", parts: [{ text: message }] },
    ],
    generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
  });
  for (const model of ["gemini-3.6-flash", "gemini-2.5-flash"]) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body }
      );
      const out = await r.json();
      const text =
        out?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
      if (text) { reply = text; break; }
      attempts.push(`${model} (${r.status}): ${out?.error?.message ?? JSON.stringify(out).slice(0, 200)}`);
    } catch {
      attempts.push(`${model}: réseau indisponible`);
    }
  }
  if (!reply) reply = "Erreur IA: " + (attempts.join(" | ") || "réponse vide");

  return json({ reply });
});
