# Segmentation des clients (Centre d'action)

**Fichier source** : `mayela-crm.html`, fonction `renderCentreAction()` (~l.2697-2780).

---

## Fenêtres temporelles

| Paramètre | Valeur | Origine code |
|---|---|---|
| `since30` | date du jour – **30 jours** | `new Date(Date.now() - 30*86400000)` → `localDateStr()` |
| `since45` | date du jour – **45 jours** | `new Date(Date.now() - 45*86400000)` → `localDateStr()` |

**Mode de calcul** : les deux seuils sont comparés aux **chaînes de date locales** (`YYYY-MM-DD`). Les seuils sont fixes ; il n'existe pas d'interface utilisateur pour les modifier.

---

## Règles de classification

### 🆕 Nouveaux (`novos`)
```
created_at >= since30
```
Règle : le client a été créé dans les 30 derniers jours.

### 🔁 Réguliers (`regs`)
```
nb >= 2  ET  dernier achat >= since45
```
Règle : au moins 2 achats enregistrés **et** dernier achat dans les 45 derniers jours.

### ⏳ Inactifs (`inacts`)
```
(a déjà acheté  ET  dernier achat < since45)
OU
(n'a jamais acheté  ET  n'est pas nouveau)
```
Règle : a eu un historique d'achat mais plus actif, ou ancien sans activité.

### 🏷️ Intérêt catégorie
Règle : la catégorie de produit avec le **plus grand nombre d'acheteurs distincts** est affichée comme indicateur de centre d'intérêt (« Campagne sur une catégorie »). Un seul segment affiché (le top 1).

---

## Données précalculées par client

Chaque client est enrichi d'un objet `byClient[id]` :

| Clé | Contenu |
|---|---|
| `nb` | Nombre total d'achats |
| `first` | Date du premier achat (plus ancien) |
| `last` | Date du dernier achat (plus récent) |
| `cats` | Objet `{ catégorie: nombre_achats }` (décompte par catégorie) |

Calculé dans la boucle `achats.forEach(a => ...)` (l.2726-2736).

---

## Consentement

```
consentCount = clients.filter(c => c.consentement !== false).length
```
Le champ `consentement` est un booléen **nullable** :
- `null` ou `true` → consentent
- `false` → ne consent pas

Seuls les clients **non « false »** (null ou true) sont autorisés à recevoir une relance WhatsApp.

**Affichage** : `X / Y consentent` dans la carte « Inactifs » (l.2752).

---

## Relances prioritaires (top 6)

| Paramètre | Valeur | Réf. |
|---|---|---|
| Pool | Clients **inactifs** uniquement | l.2752 |
| Tri | Par **date de dernière activité** (ou date de création) croissante (plus ancien d'abord) | l.2759-2760 |
| Limite | **6 clients** maximum | `.slice(0,6)` (l.2761) |
| Lien WhatsApp | `wa.me/{phone}?text=Bonjour {name} 👋 Ici Mayela...` | l.2766 |

**Condition d'affichage** : le lien WhatsApp n'est généré que si :
1. Le client possède un `phone` (non vide)
2. Le client consent (`consentement !== false`)

**Affichage par client** : nombre d'achats · dernier achat il y a X j (ou créé il y a X j) · « sans consentement » (en rouge) si non consentant.

**Marquer traité** : cliquer sur ✓ met à jour l'interaction associée (`statut_traitement → 'traite'`) puis recharge le centre d'action (l.2777-2780).

---

## Comportement

- **Non persistant** : la segmentation est recalculée à chaque appel de `renderCentreAction()`, déclenché par l'ouverture de l'écran Accueil.
- **Pas d'automatisation** : aucune tâche, aucun rappel n'est automatiquement créé à partir des segments.
- **Pas de recherche SQL** : tout est calculé côté client (cache mémoire `clientsCache` + `getAchatsAll()`).

---

*Fichier figé au 13/09/2026*