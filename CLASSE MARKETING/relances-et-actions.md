# Relances & file d'attente (actions)

**Fichier source** : `mayela-crm.html`, `renderCentreAction()` (l.2697-2780).

---

## File « À traiter » (demandes en attente)

**Requête** : interactions où `statut_traitement = 'en_attente'` (l.2701).

| Paramètre | Valeur |
|---|---|
| Source | `interactions` (id, client_id, type, note, occurred_at) |
| Condition | `statut_traitement = 'en_attente'` |
| Tri | Par date décroissante (ordre de sélection du SDK) |
| Affichage | Carte relance : nom client + badge EN ATTENTE · type d'interaction · note · « il y a X j » |

**Actions par carte** :
- 💬 : lien `wa.me/{phone}` (uniquement si le client a un téléphone)
- ✓ : marque l'interaction traitée (`statut_traitement → 'traite'`) puis recharge (l.2777-2780)

**États vides** : « Aucune demande en attente. »

---

## Relance WhatsApp (prioritaire, top 6)

| Paramètre | Valeur |
|---|---|
| Pool | Segment **inactifs** (voir `segments-clients.md`) |
| Tri | Date de dernière activité (ou création) **croissante** → plus ancien d'abord |
| Limite | 6 clients |
| Condition | Client avec `phone` **ET** `consentement !== false` |
| Lien | `https://wa.me/{phone}?text=Bonjour {name} 👋 Ici Mayela. Un petit message pour prendre de vos nouvelles…` |

**Message par défaut** (l.2766) :
```
Bonjour {name} 👋 Ici Mayela. Un petit message pour prendre de vos nouvelles…
```

**Résumé par client** :
- S'il a acheté : `N achats · dernier il y a X j`
- Sinon : `aucun achat · créé il y a X j` (X ≥ 1)
- Suffixe `sans consentement` si `consentement === false`

---

## Consentement

- Règle de relance : `consentement !== false` (les `null` et `true` sont donc autorisés).
- Affichage du décompte : `X / Y consentent → relance WhatsApp` dans la carte Inactifs.

---

## Divers

- **Aucun envoi automatique** : les relances sont des **liens ouvrant WhatsApp** ; l'envoi reste manuel.
- **Aucune planification** : pas de rappel ou de tâche de relance automatiquement créé.
- **Rechargement** : après chaque action, `renderCentreAction()` est relancé → recalcul complet des segments.

---

*Fichier figé au 13/09/2026*