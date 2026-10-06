# Espaces et accès

**Vérifié le 29 septembre 2026.** Code : `activeOrgId`, migrations V13 (isolation) et V14 (enfants monos), politiques RLS associées.

---

## En clair

Un **espace** est un espace de travail indépendant. Chaque espace a **ses propres clients, ses propres ventes, ses propres comptes connectés**. Deux espaces ne se mélangent jamais.

**Concrètement**, si vous gérez deux marques ou deux clients finaux, vous créez un espace par entité. Vous pouvez ensuite basculer de l'un à l'autre depuis l'interface, et vous ne verrez jamais les données de l'autre.

**Qui voit quoi** dépend de votre rôle :

| Rôle | Peut |
|---|---|
| **Propriétaire** | tout voir, inviter des membres, supprimer des données |
| **Membre** | consulter et travailler sur les données de l'espace |
| **Mono** | ne voir qu'**une seule fiche client** |

Le rôle « mono » est une restriction volontaire : certains collaborateurs ne doivent voir qu'un client précis, pas tout le fichier.

---

## Changer d'espace

**L'espace actif est mémorisé.** Lorsque vous revenez dans l'application, vous retrouvez le dernier espace utilisé.

**Tout ce qui est affiché est rechargé** au changement d'espace : les filtres, les sélecteurs de période, les classements, les listes. Rien de l'espace précédent ne doit rester affiché.

C'est une exigence forte, et la plupart des écrans la respectent. **Une exception est documentée plus bas** : l'analyse d'audience.

---

## Ce qui est propre à chaque espace

| Élément | Partagé entre espaces ? |
|---|---|
| Clients et leurs interactions | ❌ propre à l'espace |
| Ventes, produits, devis | ❌ propre à l'espace |
| Campagnes et dépenses publicitaires | ❌ propre à l'espace |
| Tâches et rappels | ❌ propre à l'espace |
| Comptes Facebook / TikTok connectés | ❌ propre à l'espace |
| Identifiants de l'application (App ID, App Secret) | ❌ propres à l'espace |
| Nombre de clients affichés (réglage « top clients ») | ✅ **partagé** — voir ci-dessous |
| Pixel TikTok | ❌ propre à l'espace |
| Vos identifiants de connexion | ✅ commun |

**Le réglage « top clients » fait exception.** Il est stocké sur votre profil utilisateur, et non dans l'espace. **La même valeur s'applique donc à tous vos espaces** : si vous la changez, elle change partout. C'est ce qu'indique le libellé du réglage, et c'est le comportement réel.

**Point d'attention** : les identifiants de l'application Facebook (App ID et App Secret) sont propres à chaque espace. Si vous les avez saisis dans un espace, **reprenez-les depuis votre compte développeur** pour les saisir dans un autre espace.

---

## ⚠️ Ce que vous ne verrez pas dans un autre espace

**Les tâches ne se propagent pas.** Une tâche créée dans l'espace A n'apparaît pas dans l'espace B, même si elle concerne le même client. C'est le comportement attendu, mais c'est une cause fréquente de « la tâche a disparu ».

**Les comptes connectés ne se propagent pas.** Vous devez autoriser l'application **une fois par espace**. C'est aussi ce qui garantit qu'une publication ne part jamais sur le mauvais compte.

**Le pixel TikTok est propre à l'espace.** Les mesures de deux espaces ne se mélangent pas.

---

## Le rôle « mono »

Un collaborateur en rôle mono est restreint à **une seule fiche client**. Concrètement :

- les listes ne lui montrent que ce client ;
- les autres fiches ne lui sont pas accessibles ;
- ses tâches ne portent que sur ce client.

Ce rôle est attribué par le propriétaire de l'espace, au moment d'inviter un membre. Il n'est pas attribuable après coup par un simple changement de rôle : **il faut le définir à l'invitation**.

---

## Détail technique

### L'identification de l'espace

L'espace actif est porté par `activeOrgId`, stocké côté client. Toutes les requêtes de données sont exécutées avec ce contexte, et la sécurité est appliquée **en base** par les politiques RLS, pas uniquement dans l'interface.

C'est le point important : **le cloisonnement ne dépend pas du code de l'écran**. Même si l'interface affichait par erreur une liste d'un autre espace, la base refuserait de renvoyer les lignes.

### Les politiques d'isolation

La migration V13 met en place les politiques RLS d'isolation. Elles s'appuient sur l'appartenance de l'utilisateur à l'espace, vérifiée via la table des membres.

### Les enfants monos

La migration V14 restreint l'accès d'un membre mono à sa fiche client désignée. Elle complète V13 : V13 Cloisonne par espace, V14 restreint à l'intérieur de cet espace.

### Le cache et les espaces

Plusieurs écrans conservent un cache en mémoire pour éviter de recharger à chaque bascule. **Chaque cache doit être associé à un espace**, sinon il afficherait des données obsolètes.

C'est le mécanisme utilisé par trois caches, chacun avec sa propre variable d'espace :

| Cache | Écran | Variable d'espace |
|---|---|---|
| Achats (60 s) | Tableau de bord, centre d'action, rapports | `achatsCacheOrg` |
| Diagnostic des intégrations | État des réseaux | `healthCacheOrg` |
| Analyse d'audience | Réseaux → Analyse d'audience | `insightsOrg` |

**L'analyse d'audience ne respectait pas cette règle jusqu'au 29 septembre 2026.** Son cache était réutilisé après un changement d'espace sans vérifier sa provenance, ce qui pouvait afficher les chiffres de l'espace précédent. Le troisième cache a été corrigé sur le modèle des deux premiers ; les trois caches sont désormais cloisonnés. Détail dans [Analyse d'audience et meilleurs clients](analyse-audience-et-insights.md).

Les autres données en mémoire — clients, campagnes, produits, comptes sociaux — ne sont pas concernées : elles sont rechargées par `loadEverything()` ou par l'écran qui les consomme, donc après chaque bascule.

### Les données sensibles

Les jetons d'accès des plateformes sociales sont stockés par espace. Ils ne sont jamais renvoyés au navigateur en clair : la liste des clés sensibles est retirée côté serveur avant toute réponse.

---

## Pour aller plus loin

| Je veux… | Je lis |
|---|---|
| Comprendre le cloisonnement de l'analyse d'audience | [Analyse d'audience et meilleurs clients](analyse-audience-et-insights.md) |
| Connecter un compte dans plusieurs espaces | [Intégrations sociales](integrations-sociales.md) |
| Comprendre le fonctionnement des rapports | [Rapports et exports](rapports-exports.md) |
