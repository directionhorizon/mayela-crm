# Analyse d'audience & insights (réseaux sociaux)

**Fichier source** : `mayela-crm.html` (`loadSocialInsights()` l.1725, `renderInsights()` l.1628, `loadSocialTopClients()` l.1759), Edge Function `supabase/functions/social-insights/index.ts`.

---

## Analyse d'audience (« Analyser mon audience »)

**Fonction** : `loadSocialInsights(force)` (l.1725)
**Bouton** : « 📊 Analyser mon audience » (`refreshInsightsBtn`)

### Conditions
- Nécessite au moins **un compte connecté** Facebook (Page) **ou** TikTok.
- Appel à l'Edge Function `social-insights` avec le jeton de session (Bearer).

### Données renvoyées (social-insights)

| Plateforme | Données |
|---|---|
| **Facebook (Page)** | Abonnés, portée/impressions 28 jours, villes, âge et genre (Graph API ; version utilisée : v21.0) |
| **TikTok** | Statistiques de base (comptoirs de vidéos) |

### Affichage
`renderInsights(out)` génère les cartes de l'écran Réseaux sociaux. En l'absence de comptes connectés : message « Connectez votre Page Facebook ou votre compte TikTok pour analyser votre audience. »

---

## Clients les plus actifs par réseau social

**Fonction** : `loadSocialTopClients()` (l.1759) ; limite pilotée par `topClientsLimit()` (l.1811, défaut 15).

| Paramètre | Valeur |
|---|---|
| **Période** | **Fenêtre glissante sur `occurred_at`, jamais de cache** : 7 / 30 (défaut) / 90 jours ou « Depuis le début » ; filtre SQL `gte('occurred_at', since)` recalculé à chaque affichage |
| Source | `interactions` avec `type IN ('whatsapp','facebook','tiktok')` |
| Comptage | Par client **et par réseau** (`perNet`) |
| Distinction réseau | Onglets **Tous / WhatsApp / Facebook / TikTok** (`topClientsNet`) — classement recalculé pour le réseau sélectionné |
| Tri | Décroissant (le plus actif en premier) |
| Limite | **Paramétrable — 15 par défaut (plage 3 à 50)** via Réglages → Marketing (persistée localement) |
| Détail par carte | Décompte global + répartition par canal (ex. « WhatsApp 3 · TikTok 1 ») + étape du client |
| Action | Bouton Relancer (`wa.me`) si le client a un téléphone |

---

## Limites

- **Données live** (appel API au moment du clic) — pas de cache persistant.
- Fenêtre d'analyse figée par l'API (ex. 28 jours Meta) : non ajustable par la période des Rapports.
- Analyse **associée à l'état des connexions**, non à une plage de dates immersive des rapports.

---

*Fichier figé au 13/09/2026*