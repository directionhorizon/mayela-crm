# Publication d'offres

**Vérifié le 29 septembre 2026.** Code : formulaire de publication dans l'écran Réseaux sociaux, Edge Function `social-publish`.

---

## En clair

Depuis l'écran **Réseaux sociaux**, vous pouvez publier une offre directement sur votre page Facebook ou votre compte TikTok, sans quitter le CRM.

Trois éléments composent une publication :
- un **texte** (l'offre, la promotion, la nouveauté) ;
- une **image** (facultative, mais fortement recommandée) ;
- un **produit** du catalogue (facultatif, pour rattacher l'offre à un produit).

**Si vous n'avez pas de compte connecté**, le bouton de publication n'est pas disponible — mais deux solutions de secours restent accessibles : copier le texte et télécharger l'image, pour poster manuellement.

---

## Le formulaire

| Champ | Rôle |
|---|---|
| Texte de l'offre | le contenu à publier |
| Produit du catalogue | rattache l'offre à un produit existant |
| Événement TikTok envoyé | optionnel, pour mesurer l'impact |
| Image | visuel de l'offre |

**L'événement TikTok est une option avancée.** Si vous le renseignez, l'application envoie un signal à TikTok pour dire qu'une action a eu lieu (un nouveau client, une vente…). Cela sert à mesurer l'efficacité de vos publications, et n'a pas d'effet sur la publication elle-même.

Les événements proposés :

| Valeur | Quand l'utiliser |
|---|---|
| `SubmitForm` | quelqu'un a rempli un formulaire |
| `CompleteRegistration` | quelqu'un s'est inscrit |
| `Contact` | quelqu'un a demandé un devis |
| `Purchase` | une vente a été enregistrée |
| `Schedule` | un rendez-vous a été pris |

---

## Publier sans connexion : le repli manuel

Si aucun compte n'est connecté, deux boutons restent utilisables :

| Bouton | Ce qu'il fait |
|---|---|
| 📋 **Copier le texte** | met le texte dans le presse-papiers |
| 🖼️ **Télécharger l'image** | enregistre l'image sur votre appareil |

L'image est générée à la volée à partir de ce que vous avez saisi, puis téléchargée. C'est utile pour poster depuis l'application de votre téléphone plutôt que depuis le CRM.

---

## Comment savoir si la publication a marché

Chaque publication est enregistrée avec un statut :

| Statut | Signification |
|---|---|
| **envoyée** | la publication est partie |
| **échec** | la publication n'a pas abouti |

Le rapport [Impact opérationnel](impact-operationnel.md) compte ces deux cas, ce qui vous permet de repérer les publications à repasser.

**Attention** : si vous publiez directement sur la plateforme sans passer par le CRM, cette publication **n'apparaît pas** dans ces statistiques. Le rapport ne mesure que ce qui est passé par l'application.

---

## Ce que la publication ne fait pas

- **Elle ne programme rien.** Pas de publication différée : c'est immédiat ou pas rien.
- **Elle n'attend pas de validation.** Un clic publie. Il n'y a pas de étape de relecture dans le CRM.
- **Elle ne publie pas sur Instagram**, même si le champ « plateforme » de vos campagnes mentionne Instagram. Seuls Facebook et TikTok sont gérés.
- **Elle n'analyse pas le résultat.** Le suivi des performances est traité séparément : voir [Suivi de la publicité](suivi-publicite-meta-tiktok.md) et [Suivi des événements](tracking-pixel-tiktok.md).

---

## Détail technique

### La publication est faite côté serveur

La publication est déléguée à une Edge Function `social-publish`. **Les secrets ne quittent jamais le serveur** : une fonction de nettoyage retire systématiquement les clés sensibles de tout objet renvoyé au navigateur.

Les clés concernées sont `client_secret`, `access_token`, `refresh_token`, `open_id`, `page_id`, `pixel_access_token`, ainsi que les tokens de l'ajustement d'événements.

### La configuration TikTok

| Paramètre | Valeur |
|---|---|
| Portée d'autorisation | `user.info.basic`, `video.publish` |
| Point d'entrée d'autorisation | `https://www.tiktok.com/v2/auth/authorize/` |
| URI de redirection | affichée dans l'écran, à recopier dans le portail TikTok |

L'URI de redirection est calculée dynamiquement à partir de l'adresse courante et affichée dans l'interface, pour que vous puissiez la copier sans erreur. **Elle doit correspondre exactement** à celle déclarée dans le portail développeur.

### L'enregistrement des publications

Les publications sont stockées avec leur réseau, leur contenu, leur statut et leur date. Le rapport Impact opérationnel s'appuie sur ces enregistrements.

Le contenu est tronqué à 80 caractères dans les rapports, pour que le tableau reste lisible.

### La connexion et le cloisonnement

Les comptes connectés sont stockés par espace. Une publication utilise toujours le compte de l'espace actif. Il n'existe pas de publication « à la fois pour PHARMAZEN et pour un autre espace ».

---

## En pratique

Le meilleur usage est de **préparer dans le CRM, publier quand vous voulez**. Rédigez l'offre, choisissez le produit, téléchargez l'image, et publiez quand le moment est bon. Si la publication échoue, le rapport Impact opérationnel vous le signalera et vous pourrez repasser.
