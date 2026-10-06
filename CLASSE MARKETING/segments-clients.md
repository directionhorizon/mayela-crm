# Segmentation des clients

**Vérifié le 29 septembre 2026.** Code : `renderCentreAction`.

---

## En clair

Quand vous ouvrez l'écran d'accueil, MAYELA CRM classe automatiquement vos clients en trois groupes, sans que vous ayez à trier une liste :

- **🆕 Nouveaux** — créés il y a moins de 30 jours. À traiter avec un remerciement et la présentation d'une offre.
- **🔁 Réguliers** — au moins deux achats, dont le dernier il y a moins de 45 jours. À traiter avec une offre de fidélité.
- **⏳ Inactifs** — soit ils ont déjà acheté mais pas depuis plus de 45 jours, soit ils n'ont jamais acheté et ne sont pas nouveaux. Ce sont vos clients prioritaires à relancer.

Un quatrième indicateur indique votre **catégorie d'intérêt dominante** : la catégorie de produit achetée par le plus grand nombre de clients distincts. Il sert à orienter la prochaine campagne.

---

## Trois choses à savoir

**Les seuils sont fixes.** 30 jours et 45 jours ne sont pas réglables. Ils sont écrits dans le code.

**Un client peut être dans deux groupes.** Par exemple, un client créé il y a 20 jours qui a déjà acheté deux fois est à la fois « nouveau » et « régulier ». Ce n'est pas un bug, c'est le fonctionnement actuel.

**La segmentation est recalculée à chaque affichage.** Elle n'est pas enregistrée : si vous corrigez une date de vente, le classement change immédiatement. En revanche, les segments ne créent aucune tâche ni aucun envoi automatique.

---

## Détail technique

### Les fenêtres

| Seuil | Calcul | Usage |
|---|---|---|
| `since30` | aujourd'hui − 30 jours | détermine si un client est « nouveau » |
| `since45` | aujourd'hui − 45 jours | détermine si un client est « régulier » ou « inactif » |

Les deux sont calculés en millisecondes (`Date.now() - N*86400000`) puis convertis en chaînes locales `AAAA-MM-JJ`. Toutes les comparaisons se font sur ces chaînes, donc une date de vente est incluse si elle est **égale** au seuil.

### Les règles

| Segment | Règle exacte |
|---|---|
| Nouveaux | `created_at >= since30` |
| Réguliers | au moins 2 achats **et** dernier achat `>= since45` |
| Inactifs | (a déjà acheté **et** dernier achat `< since45`) **ou** (n'a jamais acheté **et** n'est pas nouveau) |

**Cas limite à connaître** : un client créé il y a 50 jours, qui n'a jamais acheté, n'est **ni nouveau ni régulier**, mais il est **inactif**. C'est la deuxième branche de la règle qui le récupère.

### Le calcul par client

Avant de classer, l'application construit un résumé par client à partir de tous les achats :

| Information | Contenu |
|---|---|
| Nombre d'achats | Total sur l'historique |
| Premier achat | Date la plus ancienne |
| Dernier achat | Date la plus récente |
| Catégories | Décompte par catégorie de produit |

Le décompte par catégorie sert au calcul de l'intérêt dominant : la catégorie qui cumule le plus de **clients distincts** l'emporte, pas celle qui cumule le plus d'achats. Un client qui achète dix fois la même catégorie ne pèse donc qu'une fois.

### Le consentement

Le champ `consentement` est un booléen qui peut être vide :

| Valeur | Interprétation |
|---|---|
| vide ou `true` | le client accepte d'être relancé |
| `false` | le client refuse |

L'écran affiche « X / Y consentent » sur la carte des inactifs. **Seuls les clients dont le consentement n'est pas `false`** reçoivent un lien de relance WhatsApp.

### Les relances prioritaires

L'application prépare une liste de **6 clients inactifs au maximum** :

1. tri par date de dernière activité (ou de création si le client n'a jamais acheté), **du plus ancien au plus récent** ;
2. le bouton de relance n'apparaît que si le client a un téléphone **et** qu'il n'a pas refusé le consentement.

Le message est pré-rempli : « Bonjour {prénom} 👋 Ici Mayela. Un petit message pour prendre de vos nouvelles… »

**Le clic ouvre WhatsApp ; il n'envoie rien.** L'envoi reste entièrement manuel.

### Performance

Tout est calculé côté navigateur, à partir d'un cache en mémoire des clients et des achats. Aucune requête SQL dédiée à la segmentation n'est envoyée. C'est rapide, mais cela suppose de charger les données en mémoire à chaque affichage.
