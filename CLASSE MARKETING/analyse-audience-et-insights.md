# Analyse d'audience et meilleurs clients

**Vérifié le 29 septembre 2026.** Code : `loadSocialInsights`, `renderInsights`, `loadSocialTopClients`, `renderTopClientsByValue`, `loadSocialHealth`, `renderSocialHealth`, `topClientsLimit`. Edge Function `social-insights`.

---

## En clair

Cet écran répond à deux questions très différentes :

1. **Qui voit mon contenu ?** → l'analyse d'audience
2. **Qui me rapporte le plus ?** → le classement des meilleurs clients

Ces deux blocs mesurent des choses opposées, et c'est volontaire. Voir [L'erreur classique](#l-erreur-classique-à-ne-pas-commettre).

---

# 1. L'analyse d'audience

Ce bloc interroge **Facebook et TikTok en direct** pour décrire votre communauté. Il n'est disponible que si au moins un compte est connecté.

**Ce que vous voyez pour Facebook :**

| Indicateur | Ce qu'il compte |
|---|---|
| Abonnés | nombre total d'abonnés de la page |
| Portée 28 j | personnes touchées sur les 28 derniers jours |
| Impressions 28 j | nombre d'affichages sur 28 jours |
| Engagements 28 j | likes, commentaires, partages sur 28 jours |

**Pour TikTok :** abonnés, j'aime cumulés, nombre de publications.

**Puis deux reproductions de votre audience :**
- **Où se trouve votre audience** : les principales villes, en barres proportionnelles ;
- **Âge et genre des abonnés** : répartition par tranche, hommes et femmes.

**Ces deux informations sont directement actionnables** : elles vous disent où concentrer vos relances WhatsApp et quel profil cibler dans vos publications.

## ⚠️ Une limite importante : tout est figé sur 28 jours

Les chiffres d'audience portent **toujours sur les 28 derniers jours**. Il n'y a **aucun sélecteur de période** pour ce bloc.

Si vous consultants l'application après un mois difficile, une forte baisse de portée s'affichera quand même : elle sera comparée à une période qui incluait peut-être vos meilleurs jours.

**Les chiffres d'abonnés sont eux un instantané**, pas une moyenne sur 28 jours.

---

# 2. Les meilleurs clients

## Les deux modes de classement

| Mode | Classe par | Ce qu'il mesure |
|---|---|---|
| **💰 Par valeur** *(par défaut)* | le chiffre d'affaires généré | qui vous rapporte de l'argent |
| **💬 Par activité** | le nombre d'échanges | qui vous écrit le plus |

## La période

Un sélecteur propose **7, 15, 30, 90 jours ou tout l'historique**. La période par défaut est **30 jours**.

**Attention, la période ne filtre pas la même chose selon le mode :**

| Mode | Ce que la période filtre |
|---|---|
| Par valeur | la **date des achats** |
| Par activité | la **date des échanges** |

Ce choix est fait pour que le chiffre d'affaires affiché et les échanges comptés portent bien sur la même fenêtre. Il a une conséquence : **en mode « par valeur », un client qui a vendu il y a 40 jours mais beaucoup écrit hier n'apparaît pas**, et inversement.

## Le filtre par réseau

En mode **par activité**, un second sélecteur permet de classer par réseau : **tous, WhatsApp, Facebook ou TikTok**. Chaque fiche indique la répartition des échanges par réseau.

**Ce sélecteur disparaît en mode « par valeur »** : le chiffre d'affaires n'est pas rattaché à un réseau, donc le filtre n'aurait aucun sens. C'est un comportement voulu, pas un bug.

## Ce que contient chaque fiche

**En mode « par valeur »**, chaque client est décrit par :

| Information |
|---|
| Son rang dans le classement |
| Son chiffre d'affaires sur la période |
| Son nombre de ventes |
| Son panier moyen |
| La campagne d'où il vient, si elle est connue |
| Son dernier achat |
| Son étape commerciale, si elle est forcée |
| Un bouton de relance WhatsApp |

**En mode « par activité »** : le nombre total d'échanges, la répartition par réseau, l'étape commerciale, et le bouton de relance.

**Seuls les clients ayant généré un chiffre d'affaires positif apparaissent en mode « par valeur ».** Un client très actif mais qui n'a jamais acheté est volontairement absent de ce classement.

En bas du classement, un résumé indique le nombre de clients affichés et le CA correspondant. **Si ce CA est inférieur au CA total de la période, le total est également rappelé** — vous savez alors que le classement est tronqué et qu'il reste des clients derrière.

## Le nombre de clients affichés

Un réglage vous permet de choisir combien de clients sont listés, **entre 3 et 50**. La valeur appliquée par défaut est **20** — le libellé du réglage indique « 15 », ce qui est une incohérence d'affichage sans effet sur le fonctionnement (voir les [écarts connus du README](README.md)).

Ce réglage est **enregistré sur votre profil**, pas seulement sur votre appareil : il vous suit sur téléphone et sur ordinateur, **et il s'applique à tous vos espaces**.

Si la valeur saisie est hors limites, l'enregistrement est refusé avec le message « Entrez un nombre entre 3 et 50. » Si l'enregistrement en base échoue, un message le signale, et le réglage reste appliqué localement.

---

## L'erreur classique à ne pas commettre

**Un client qui écrit beaucoup n'est pas forcément un bon client.**

Le mode « par activité » mesure la quantité d'échanges. Un client très bavard, qui négocie longtemps sans jamais acheter, y occupera une place de premier plan.

Le mode « par valeur » mesure le chiffre d'affaires réel. C'est **la seule mesure comparable aux chiffres de vos plateformes publicitaires** : vos ROAS et vos coûts d'acquisition se calculent sur de l'argent réellement dépensé et gagné, pas sur des conversations.

**C'est pour cela que le mode « par valeur » est le mode par défaut.** Utilisez le mode « par activité » pour décider **qui relancer**, et le mode « par valeur » pour décider **à qui accorder votre budget publicitaire**.

---

## Détail technique

### L'analyse d'audience

`loadSocialInsights` appelle l'Edge Function `social-insights` avec le jeton de session. Si ni Facebook ni TikTok n'est connecté, un message invite à connecter un compte et aucun appel n'est effectué.

`renderInsights` affiche les indicateurs, puis les villes (barres proportionnelles à la plus forte) et la répartition âge/genre (triée par ordre numérique). Si la fonction renvoie des avertissements, ils sont affichés ; sinon un conseil de ciblage est proposé.

Le résultat est mis en cache dans `insightsData` et réutilisé tant qu'un rafraîchissement manuel n'est pas demandé via le bouton dédié.

### Cache cloisonné par espace

Le cache est associé à l'espace d'origine via `insightsOrg`, sur le modèle exact du diagnostic social (`healthCacheOrg`).

Le cache n'est réutilisé que si `insightsOrg` correspond à l'espace actif. Après un changement d'espace, l'analyse est donc rechargée depuis la base au lieu d'afficher les chiffres de l'espace précédent. Les deux points de lecture sont protégés : l'entrée dans `loadSocialInsights` et le rendu en fin de `loadSocial`.

Le cache est vidé — données **et** espace d'origine — après une connexion, une déconnexion et un changement de réseau.

**Corrigé le 29 septembre 2026.** Avant, `insightsData` était réutilisé sans vérifier l'espace : le défaut est détaillé dans les [écarts corrigés du README](README.md).

### Le classement par valeur

`renderTopClientsByValue` agrège tous les achats par client. Le filtre de période compare la date d'achat à la date de début de la fenêtre, ce qui garantit que le CA et la période affichée coïncident.

Seuls les clients présents dans le cache des clients et dont le CA est strictement positif sont retenus. Le total de la période (`totCa`) est comparé au total affiché pour signaler une liste tronquée.

### Le classement par activité

`loadSocialTopClients` lit les interactions de type `whatsapp`, `facebook` et `tiktok` (constante `ONLINE_NETS`), filtre sur `occurred_at`, puis compte par client et par réseau.

Le sélecteur de réseau est masqué lorsque le mode valeur est actif : le chiffre d'affaires n'étant rattaché à aucun réseau, le filtre n'aurait aucun sens. Le sélecteur de mode reste visible en permanence.

### Le réglage du nombre de clients

`topClientsLimit` lit `profiles.top_clients_limit`, avec le cache local en repli. Toute valeur absente, non numérique, ou hors de l'intervalle 3–50 est remplacée par la valeur par défaut (20).

L'enregistrement est double : le cache local est mis à jour d'abord pour un affichage immédiat, puis la base. Si l'écriture en base échoue, un message le signale explicitement à l'utilisateur et le réglage reste appliqué sur l'appareil.

### 📌 Divergence de valeur par défaut

Trois valeurs coexistent, et elles ne concordent pas :

| Source | Valeur |
|---|---|
| Libellé de l'interface (« défaut : 15 ») | 15 |
| Migration V12 (valeur par défaut de la colonne) | 15 |
| **Constante `TOP_CLIENTS_DEFAULT` réellement appliquée** | **20** |

Concrètement : le libellé annonce 15, mais un profil sans valeur enregistrée se verra appliquer 20. C'est une incohérence d'affichage, pas un risque de mauvais fonctionnement.

Cette divergence est sans conséquence pratique sur une base existante : les profils déjà créés conservent la valeur qu'ils ont (20 sur les 5 profils existants), et une saisie explicite écrase la valeur par défaut.

**Divergence déjà signalée dans `docs/suivi/EN_ATTENTE.md`, non tranchée à ce jour.**

---

## En pratique

**Regardez d'abord la valeur.** Elle correspond à votre réalité financière.

**Utilisez la période 30 jours** pour un suivi régulier, et « tout l'historique » pour vérifier qu'un bon client n'est pas absent de votre classement depuis des mois.

**Si la liste semble trop courte**, augmentez le nombre de clients affichés : le résumé en bas vous dira si le CA affiché laisse une part importante de côté.
