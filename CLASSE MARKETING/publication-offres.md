# Publication d'offres (contenu marketing)

**Fichier source** : `mayela-crm.html`, écran Réseaux sociaux (l.660-693).

---

## Formulaire « Publier une offre »

| Champ | Type | Description |
|---|---|---|
| `offerText` | textarea | Texte de l'offre (promo, nouveauté…) |
| `offerProduit` | select | Produit du catalogue associé |
| `offerTrackEvent` | select | Événement TikTok envoyé (optionnel) |
| image | upload | Visuel de l'offre (aperçu) |
| `publishOfferBtn` | bouton | Publier l'offre |

---

## Événements TikTok proposés (option 'Événement TikTok envoyé')

| Valeur | Libellé dans l'UI | Usage marketing |
|---|---|---|
| `SubmitForm` | Nouveau lead (SubmitForm) | Captation de leads |
| `CompleteRegistration` | Inscription (CompleteRegistration) | Comptes créés |
| `Contact` | Demande de devis (Contact) | Demandes de devis |
| `Purchase` | Vente (Purchase) | Ventes |
| `Schedule` | RDV pris (Schedule) | Prises de rendez-vous |

---

## Repli manuel (sans connexion réseaux)

Contenu prêt à poster manuellement :
- 📋 **Copier le texte** : copie le texte de l'offre dans le presse-papiers.
- 🖼️ **Télécharger l'image** : génère et télécharge l'image de l'offre (`canvas`).

---

## Gestion des publications (`social_posts`)

| Statut | Signification | Où s'affiche |
|---|---|---|
| `sent` | Publiée (via `social-publish`) | Comptée « Offres publiées » |
| `failed` | Échec de publication | Signalée « à retenter » dans le rapport Impact opérationnel (Rapports) |

---

## Configuration TikTok (Login Kit)

| Paramètre | Valeur |
|---|---|
| Redirect URI | Calculée dynamiquement (l.1841-1861) |
| Client Key | Saisie dans `ttClientKey` (Réglages TikTok) |
| Client Secret | Saisie dans `ttClientSecret` |
| Scope OAuth | `user.info.basic,video.publish` |
| Endpoint auth | `https://www.tiktok.com/v2/auth/authorize/` |

**Publication** : déléguée à l'Edge Function `social-publish` (côté serveur ; les secrets ne sont **jamais** envoyés au navigateur, `sanitizeSocialAccount` l.1445).

---

## Sécurité / secrets

- Listé dans `SOCIAL_SECRET_KEYS` (l.1444) : `client_secret`, `access_token`, `refresh_token`, `open_id`, `page_id`, `pixel_access_token`, `adjust_app_token`, `adjust_s2s_token`.
- Ces clés sont retirées de tout objet renvoyé au client.

---

*Fichier figé au 13/09/2026*