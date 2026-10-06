# Relances & file d'attente

**Vérifié le 29 septembre 2026.** Code : `renderCentreAction`.

---

## En clair

L'écran d'accueil vous présente deux listes de choses à faire, toutes deux conçues pour vous faire gagner du temps sans jamais envoyer de message à votre place.

**La file « À traiter »** regroupe les demandes en attente : un client a posé une question, demandé un prix, rendu visite. Vous les traitez une par une, et vous cochez ✓ quand c'est fait.

**La liste de relances** vous propose les 6 clients inactifs les plus anciens, avec un bouton qui ouvre WhatsApp avec un message déjà rédigé.

**Dans les deux cas, vous cliquez, vous envoyez vous-même.** L'application prépare et classe ; elle n'envoie jamais rien à votre place.

---

## La file « À traiter »

Ce sont les **interactions** marquées « en attente ».

**Ce qui s'affiche pour chaque demande** : le nom du client, un badge « EN ATTENTE », le type d'interaction (appel, WhatsApp, visite, TikTok, Facebook, autre), la note que vous avez écrite, et depuis combien de jours elle attend.

**Le tri va du plus ancien au plus récent** (`occurred_at` croissant). C'est intentionnel : une demande qui attend depuis trois jours passe avant une arrivée de ce matin.

**Deux actions possibles** :

| Action | Effet |
|---|---|
| 💬 | ouvre WhatsApp avec le client, sans message pré-rempli |
| ✓ | marque la demande comme traitée, puis rafraîchit l'écran |

Si le client n'a pas de numéro, le bouton 💬 n'apparaît pas. Si le client a été supprimé, l'écran affiche « Client supprimé » — la demande reste visible mais n'est plus actionnable.

**Quand la liste est vide**, l'écran affiche « Aucune demande en attente. »

---

## La liste de relances

C'est une sélection automatique parmi les clients **inactifs** (voir [Segmentation des clients](segments-clients.md)).

**La sélection** :
- au maximum **6 clients** ;
- triés par dernière activité, **du plus ancien au plus récent** — ceux qui n'ont pas donné signe de vie depuis le plus longtemps passent en premier ;
- si le client n'a jamais acheté, on se base sur sa date de création.

**Le bouton « Relancer »** n'apparaît que si le client a un téléphone **et** qu'il n'a pas refusé le consentement. S'il n'y a pas de bouton, la fiche affiche « sans consentement » en rouge.

**Le message pré-rempli** est court et direct :
> Bonjour {prénom} 👋 Ici Mayela. Un petit message pour prendre de vos nouvelles…

Chaque fiche affiche aussi le nombre d'achats du client et son dernier achat (ou sa date de création s'il n'a jamais acheté).

**Si la liste est vide**, l'écran affiche « Rien à relancer pour le moment — bon travail. »

---

## Le consentement, en pratique

Le champ `consentement` peut être vide, ce qui est différent de « non » :

| Valeur | Relance proposée ? |
|---|---|
| vide | ✅ oui |
| `true` | ✅ oui |
| `false` | ❌ non, et la fiche est signalée en rouge |

**À noter** : l'application n'envoie jamais de message automatiquement. Le consentement sert donc à vous **empêcher de lancer une relance manuelle** vers quelqu'un qui a refusé — c'est une aide à la vigilance, pas un contrôle juridique.

---

## Ce que cet écran ne fait pas

- **Aucune planification** : il n'existe pas de système qui vous prédit « relancer ce client dans 7 jours ».
- **Aucun envoi automatique** : WhatsApp s'ouvre, vous écrivez ou envoyez vous-même.
- **Aucune création de tâche** : traiter une relance ne génère pas de tâche à faire.

Ces trois limites sont assumées dans l'état actuel du produit.

---

## Détail technique

### Requête des demandes en attente

```
interactions
  .eq('statut_traitement', 'en_attente')
  .order('occurred_at', { ascending: true })
```

Les colonnes lues sont `id`, `client_id`, `type`, `note`, `occurred_at`. Le lien WhatsApp est construit à partir du numéro du client trouvé dans le cache local ; le contrôle de consentement **n'est pas appliqué ici** — seule l'existence du numéro compte pour la file « À traiter », contrairement à la liste de relances.

### Marquer comme traité

Le clic sur ✓ exécute une mise à jour de l'interaction vers `statut_traitement = 'traite'`, puis relance `renderCentreAction()`. Si la mise à jour échoue, un message d'erreur s'affiche et rien n'est rechargé.

### Le tri des deux listes

| Liste | Champ de tri | Sens |
|---|---|---|
| À traiter | `interactions.occurred_at` | croissant (plus ancien d'abord) |
| Relances | dernière activité du client, sinon `created_at` | croissant (plus ancien d'abord) |

Les deux listes privilégient donc ce qui est le plus ancien — c'est cohérent avec l'intention de ne rien laisser traîner.

### Calcul du nombre de jours

Le nombre de jours affichés est calculé à partir de `daysAgo(...)`, avec un minimum de 1 pour éviter d'afficher « il y a 0 j ». Pour un client sans aucun historique d'achat ni date exploitable, la valeur est forcée à 999, affichée comme « créé il y a 999 j » — un cas limite qui ne devrait pas se produire en pratique.
