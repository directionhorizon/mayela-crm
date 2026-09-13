# Tracking des événements (Pixel TikTok & événements serveur)

**Fichier source** : `mayela-crm.html` — `tiktokPixelId()` l.1840, `bootTikTokPixel()` l.1845, `fireTikTokPixel()` l.1860, `sendServerTikTokEvent()` l.1870, `trackTikTokPurchase()` l.1886.

---

## Principe

- **Pixel client-side** (code TikTok officiel) chargé une seule fois par session/espace.
- **Événements serveur** : envoi depuis le serveur (`tiktok-events`) pour fiabiliser le tracking.
- **Opt-in par espace** : le pixel ID est celui configuré pour l'espace actif.

---

## Pixel ID

```
tiktokPixelId() = config.pixel_id du compte TikTok connecté  OU  défaut 'DAGRTSRC77UC8FLJV020'
```
(l.1840)

**Pixel par défaut** : `DAGRTSRC77UC8FLJV020` (utilisé si aucun compte TikTok configuré).

---

## Événements envoyés

| Déclencheur | Événement | Données |
|---|---|---|
| `fireTikTokPixel()` | `page` (ttq.page) | — |
| Nouveau lead (formulaire de l'offre) | `SubmitForm` | — |
| Inscription | `CompleteRegistration` | — |
| Demande de devis | `Contact` | — |
| Vente saisie | `Purchase` | voir ci-dessous |
| RDV pris | `Schedule` | — |

---

## Événement Purchase (trackTikTokPurchase, l.1886-1913)

Déclenché à l'enregistrement d'une vente.

| Propriété | Valeur |
|---|---|
| `external_id` | `client.id` |
| `phone` | téléphone du client (si présent) |
| `content_id` | `produit_id` de la vente |
| `content_type` | `'product'` |
| `content_name` | nom du produit |
| `description` | description du produit |
| `price` | `prix_defaut` du produit, sinon montant de la vente |
| `quantity` | quantité de la vente (min 1) |
| `value` | montant de la vente |
| `currency` | `XAF` |

**Envoi** : via `sendServerTikTokEvent('Purchase', props)` → Edge Function `tiktok-events` (l.1870). Le tracking ne bloque jamais la vente (échec silencieux).

---

## Conditions d'envoi serveur

- Un compte TikTok **connecté** avec `pixel_id` renseigné.
- Une session utilisateur valide.
- Montant de vente **> 0**.

---

## Sécurité

Les identifiants/app tokens sont gérés côté serveur (Edge Functions) ; le navigateur ne reçoit que `client_key`, `pixel_id` et un indicateur de connexion.

---

*Fichier figé au 13/09/2026*