# Suivi intégrations TikTok — MAYELA CRM

Dernière mise à jour : 2026-08-26

---

## Décisions validées

| Décision | Statut |
|---|---|
| Conserver le mode Sandbox (fallback SELF_ONLY) | ✅ Validé |
| Ajouter TikTok Events API (server-side) | ✅ Validé |
| Ajouter MMP : Branch (deep linking > Adjust) | ✅ Validé, en attente email pro |
| Sélecteur d'événements TikTok par offre dans l'UI | ✅ Validé |
| Config tracking dans l'onglet Réseaux | ✅ Validé |
| L'app sera déployée comme app mobile (pas SPA) | ✅ Noté |

---

## Phase 1 — Sandbox cleanup

| Tâche | Fichier | Statut |
|---|---|---|
| Corriger bug `OPEN` → `OPEN_API` | `social-publish/index.ts` | ✅ Fait (2026-08-27) |
| Supprimer fallback sandbox | — | ❌ Annulé (on conserve) |
| Mettre à jour docs DEPLOY_BACKEND | `config/DEPLOY_BACKEND.md` | ✅ Fait (2026-08-27) |

---

## Phase 2 — TikTok Events API

| Tâche | Fichier | Statut |
|---|---|---|
| Créer Edge Function `tiktok-events` | `supabase/functions/tiktok-events/index.ts` | ✅ Fait (2026-08-27) |
| Endpoint : POST `https://business-api.tiktok.com/open_api/v1.3/event/track/` | — | — |
| Auth : Access-Token header | — | — |
| Événements : SubmitForm, CompleteRegistration, Contact, Purchase, Schedule | — | — |
| User data : SHA-256 hash email/phone/external_id | — | — |
| Dedup : event_id unique par conversion | — | — |
| Ajouter champs Pixel ID + Events API token dans config UI | `mayela-crm.html` | ⏳ À faire |

---

## Phase 3 — Adjust/Branch MMP

| Tâche | Fichier | Statut |
|---|---|---|
| Créer Edge Function `adjust-events` (vide, prêt à brancher) | `supabase/functions/adjust-events/index.ts` | ✅ Fait (2026-08-27), coquille inactive |
| Endpoint : POST `https://s2s.adjust.com/event` | — | — |
| Inscription Adjust/Branch : en attente email pro | — | 🔒 Bloqué |
| SDK mobile : à intégrer lors du build app mobile | — | ⏳ Futur |
| Postbacks TikTok : à configurer dans dashboard Adjust/Branch | — | ⏳ Futur |

---

## Phase 4 — UI

| Tâche | Fichier | Statut |
|---|---|---|
| Section "Configuration Tracking" dans onglet Réseaux | `mayela-crm.html` | ✅ Fait (2026-08-27) |
| Champs : Pixel ID, Events API Token | — | ✅ Fait |
| Champs : Adjust App Token, S2S Token (placeholder) | — | ✅ Fait |
| Sélecteur d'événement TikTok dans formulaire Offre | `mayela-crm.html` | ✅ Fait |
| Options : Aucun, SubmitForm, Purchase, Contact, Schedule | — | ✅ Fait |
| Envoyer événement lors de la publication | — | ✅ Fait |

---

## Phase 5 — Migration + docs

| Tâche | Fichier | Statut |
|---|---|---|
| Table `social_events_log` (audit trail) | `config/MIGRATION_V1_1.sql` | ✅ Fait (2026-08-27) |
| Policies RLS pour `social_events_log` | — | ✅ Fait |
| Mettre à jour DEPLOY_BACKEND.md (setup Events API TikTok) | `config/DEPLOY_BACKEND.md` | ✅ Fait |

---

## Bloqueurs

| Bloqueur | Impact | Résolution |
|---|---|---|
| Email pro non disponible | Inscription Adjust/Branch impossible | Attendre email pro |
| App mobile non encore buildée | SDK MMP non intégrable | Préparer le code, intégrer plus tard |

---

## Notes techniques

### TikTok Events API
- Endpoint : `POST https://business-api.tiktok.com/open_api/v1.3/event/track/`
- Auth : `Access-Token: {pixel_access_token}`
- Payload : `{ event_source: "web", event_source_id: "{pixel_id}", data: [...] }`
- Batch : max 1000 événements/request
- Dedup : même event_id = même event (fenêtre 48h)
- Coût : gratuit

### Branch MMP (vs Adjust)
- Meilleur deep linking web-to-app
- Meilleur pour B2B CRM (email/SMS → app → bonne fiche)
- Free tier : 10K MAU
- SDK : ~2.5MB
- S2S API disponible pour événements backend

### Événements TikTok standard applicables

| Événement CRM | TikTok Event | Déclencheur |
|---|---|---|
| Nouveau lead | SubmitForm | Ajout client |
| Inscription | CompleteRegistration | Création compte |
| Demande de devis | Contact | Interaction social |
| Vente | Purchase | Offre vendue |
| RDV pris | Schedule | Interaction appel/visite |
