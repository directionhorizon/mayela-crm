# Suivi des événements (Pixel TikTok)

**Vérifié le 29 septembre 2026.** Code : `tiktokPixelId`, `bootTikTokPixel`, `sendServerTikTokEvent`, `trackTikTokPurchase`. Edge Function `tiktok-events`.

---

## En clair

Pour que TikTok puisse mesurer si vos pubs rapportent, il faut lui dire ce qui se passe réellement : une vente, une demande de devis, un rendez-vous pris.

C'est le rôle du **Pixel TikTok**. Chaque fois que vous enregistrez une vente dans le CRM, l'application prévient automatiquement TikTok : « ce client a acheté pour ce montant, ce produit ». TikTok peut alors reconnaître vos clients et attribuer les ventes à vos campagnes.

**Le point essentiel** : tout se passe **automatiquement et en arrière-plan**. Vous n'avez rien à faire. Et surtout — **si l'envoi échoue, la vente est enregistrée quand même**. Le suivi ne peut jamais bloquer votre travail.

---

## Les deux canaux d'envoi

Les événements partent par **deux chemins complémentaires** :

| Canal | Rôle | Pourquoi |
|---|---|---|
| **Pixel navigateur** | mesure l'activité sur le site | rapide, mais perturbé si le visiteur bloque les cookies |
| **Événements serveur** | mesure ce qui se passe dans le CRM | fiable, car envoyé depuis nos serveurs |

---

## Ce qui est envoyé

| Moment | Événement |
|---|---|
| Publication d'une offre avec événement choisi | l'événement de votre choix |
| Enregistrement d'une vente | `Purchase` |

L'événement de publication est **facultatif** : vous choisissez dans le formulaire de publication. L'événement `Purchase`, lui, est **automatique** à chaque vente enregistrée.

**Les deux canaux sont utilisés** : le pixel navigateur mesure l'activité sur le site, les événements serveur mesurent ce qui se passe dans le CRM. L'événement de vente, le plus important, passe par le canal serveur.

**Quand un événement est envoyé, il l'est après l'action** : la vente est d'abord enregistrée, ensuite l'événement part.

---

## Le cas de la vente

L'événement `Purchase` porte les informations suivantes :

| Information | Valeur |
|---|---|
| Identifiant client | permet à TikTok de reconnaître le client |
| Téléphone | permet le rapprochement direct |
| Produit vendu | identifiant, nom, description |
| Prix | prix du catalogue, ou le montant de la vente |
| Quantité | minimum 1 |
| Montant total | le montant réel de la vente |
| Devise | **XAF** (franc CFA) |

**Si la vente est à 0**, aucun événement n'est envoyé : il n'y a rien à mesurer.

---

## Le Pixel

**Chaque espace a son propre Pixel.** L'identifiant utilisé est celui du compte TikTok connecté dans l'espace actif. Deux espaces ne partagent pas leur Pixel, donc leurs mesures ne se mélangent pas.

**Un Pixel par défaut est fourni** (`DAGRTSRC77UC8FLJV020`), utilisé si aucun compte TikTok n'est connecté. Ce Pixel par défaut permet de démarrer sans configuration, mais les données ne sont rattachées à aucun compte précis.

---

## ⚠️ Ce que le suivi ne fait pas

**Il ne suit que les événements déclenchés dans le CRM.** Si un client achète par un autre canal — en boutique, par téléphone, ou directement sur TikTok — cet achat n'est pas transmis. Le Pixel ne voit que ce que vous saisissez dans l'application.

**Il ne mesure pas la page Facebook.** Tout ce suivi est propre à TikTok. Facebook dispose de son propre système, non implémenté dans le CRM.

**Il ne bloque jamais rien.** Tous les envois sont lancés en tâche de fond, et un échec passe inaperçu. C'est un choix : une panne de TikTok ne doit pas empêcher de vendre.

**Le rapprochement client repose sur le téléphone.** Sans numéro de téléphone renseigné sur la fiche client, TikTok ne pourra pas relier la vente à une audience. C'est le champ le plus important à remplir.

---

## Détail technique

### La condition d'envoi

Un événement n'est envoyé que si **les trois conditions** sont réunies :
1. un compte TikTok est connecté **avec un Pixel configuré** ;
2. la session utilisateur est valide ;
3. le montant de la vente est supérieur à zéro.

### La construction de l'événement d'achat

L'application recherche le produit dans le cache local, puis en base si nécessaire. Le prix envoyé est le prix du catalogue s'il existe, sinon le montant de la vente. La quantité est forcée à un minimum de 1.

L'identifiant et le téléphone du client sont envoyés pour permettre le rapprochement. **Les deux sont hachés en SHA-256 côté serveur** avant transmission, comme l'exige TikTok : les données personnelles ne quittent jamais nos serveurs en clair.

### Le risque

Aucun risque de blocage : l'appel est entouré d'une gestion d'erreur, et son résultat est ignoré. Une vente enregistrée reste enregistrée quoi qu'il arrive au suivi.

### L'identifiant du Pixel

Il est lu depuis la configuration du compte TikTok connecté dans l'espace actif. Le code du Pixel ne fait jamais partie des données renvoyées au navigateur de façon exploitable.

---

## En pratique

**Renseignez le téléphone de vos clients.** C'est le geste qui a le plus d'impact sur la qualité de vos analyses : sans lui, TikTok ne peut pas faire le lien entre une vente et une personne touchée par une publicité.

**Ne vous inquiétez pas des erreurs d'envoi.** Elles sont silencieuses et sans conséquence sur votre activité. Si le suivi semble ne rien produire, vérifiez d'abord que votre compte TikTok est bien connecté et qu'un Pixel y est configuré.
