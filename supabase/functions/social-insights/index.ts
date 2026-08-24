// Edge Function "social-insights" — MAYELA CRM
// Analyse d'audience de la Page Facebook connectée (Graph API Insights).
// Appel : GET /functions/v1/social-insights (Authorization: Bearer <access_token>)
// Retour : abonnés, portée/impressions/engagements 28 j, villes, âge+genre.
//
// Le token Page est lu depuis social_accounts.config côté serveur :
// il ne transite JAMAIS vers le navigateur. Aucun changement de schéma requis :
// la permission pages_read_engagement est déjà demandée à la connexion de la Page.

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

async function graph(path: string, token: string): Promise<Record<string, unknown>> {
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`${GRAPH}/${path}${sep}access_token=${encodeURIComponent(token)}`);
  const out = await r.json();
  if (!r.ok) throw new Error(out?.error?.message ?? "graph_error");
  return out;
}

function pickMetric(data: unknown, name: string): number | null {
  const arr = Array.isArray(data) ? data : [];
  const m = arr.find((x: Record<string, unknown>) => x.name === name);
  const v = m?.values?.[0]?.value;
  return typeof v === "number" ? v : null;
}

function normCities(raw: unknown): { name: string; count: number }[] {
  let list: { name: string; count: number }[] = [];
  if (Array.isArray(raw)) {
    list = raw
      .map((x: Record<string, unknown>) => ({ name: String(x.name ?? ""), count: Number(x.count ?? 0) }))
      .filter((x) => x.name);
  } else if (raw && typeof raw === "object") {
    list = Object.entries(raw as Record<string, unknown>).map(([name, count]) => ({
      name,
      count: Number(count) || 0,
    }));
  }
  return list.sort((a, b) => b.count - a.count).slice(0, 6);
}

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

  // Compte Facebook de l'org courante (isolation par RLS, comme social-publish)
  const { data: acc, error: accErr } = await sb.from("social_accounts")
    .select("config")
    .eq("platform", "facebook")
    .maybeSingle();

  if (accErr || !acc) return json({ error: "compte non connecté" }, 404);

  const cfg = acc.config as Record<string, unknown>;
  const pageId = cfg?.page_id as string | undefined;
  const pageToken = cfg?.access_token as string | undefined;

  if (!pageId || !pageToken) return json({ error: "page_id/access_token manquants" }, 400);

  const warnings: string[] = [];

  let pageName = "";
  let followers: number | null = null;
  try {
    const p = await graph(`${pageId}?fields=name,fan_count,followers_count`, pageToken);
    pageName = String(p.name ?? "");
    followers = (p.fan_count as number) ?? (p.followers_count as number) ?? null;
  } catch (e) {
    warnings.push(`Abonnés indisponibles : ${e.message}`);
  }

  let impressions_28d: number | null = null;
  let reach_28d: number | null = null;
  let engagements_28d: number | null = null;
  try {
    const ins = await graph(
      `${pageId}/insights?metric=page_impressions,page_impressions_unique,page_post_engagements&period=days_28`,
      pageToken
    );
    impressions_28d = pickMetric(ins.data, "page_impressions");
    reach_28d = pickMetric(ins.data, "page_impressions_unique");
    engagements_28d = pickMetric(ins.data, "page_post_engagements");
  } catch (e) {
    warnings.push(`Statistiques 28 jours indisponibles : ${e.message}`);
  }

  let cities: { name: string; count: number }[] = [];
  try {
    const ci = await graph(`${pageId}/insights?metric=page_fans_city&period=lifetime`, pageToken);
    cities = normCities(ci.data?.[0]?.values?.[0]?.value);
  } catch (e) {
    warnings.push(`Répartition par ville indisponible : ${e.message}`);
  }

  let age_gender: Record<string, number> = {};
  try {
    const ag = await graph(`${pageId}/insights?metric=page_fans_gender_age&period=lifetime`, pageToken);
    const raw = ag.data?.[0]?.values?.[0]?.value;
    if (raw && typeof raw === "object") {
      age_gender = Object.fromEntries(
        Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, Number(v) || 0])
      );
    }
  } catch (e) {
    warnings.push(`Tranches d'âge indisponibles : ${e.message}`);
  }

  const allFailed =
    followers === null && impressions_28d === null && cities.length === 0 && Object.keys(age_gender).length === 0;
  if (allFailed) return json({ error: warnings[0] ?? "graph_unreachable" }, 502);

  return json({
    page_name: pageName,
    followers,
    impressions_28d,
    reach_28d,
    engagements_28d,
    cities,
    age_gender,
    warnings,
  });
});
