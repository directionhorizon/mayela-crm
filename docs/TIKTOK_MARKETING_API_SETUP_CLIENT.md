# Créer l'app TikTok Developer (App ID / Client Secret) — Guide client

**À lire par** : la pharmacie (propriétaire du compte TikTok for Business).

**Objectif** : créer l'application développeur TikTok qui permettra au CRM d'afficher
les statistiques publicitaires TikTok (dépenses, impressions, etc.) en plus des
statistiques organiques déjà disponibles.

**Prérequis** : le compte publicitaire **TikTok for Business** doit déjà exister.

---

## Étape 1 — Devenir développeur

1. Ouvrir `https://developers.tiktok.com`.
2. Cliquer sur **« Become a Developer »** (en haut à droite).
3. Se connecter avec les identifiants du compte **TikTok for Business**.
4. Choisir « **Direct Advertiser** » dans « What best describes you or your company ».
5. Valider la vérification (code reçu par e-mail et par téléphone).

## Étape 2 — Créer l'application

1. Aller dans **« Manage apps »** (gérer les applications).
2. Cliquer sur **« Connect a new app »** (connecter une nouvelle application).
3. Renseigner les champs :
   - **App name** : proposé — `Mayela CRM — Pharmacie`
   - **Description** : expliquer en 1-2 phrases ce que fait l'application (voir suggestion ci-dessous).
   - **Website URL** : l'adresse du site de la pharmacie (obligatoire).
   - **Privacy Policy URL** : une page de politique de confidentialité (obligatoire,
     peut pointer vers la page légale de la pharmacie).
   - **Redirect URI** : l'adresse affichée dans le CRM, écran **Réseaux sociaux → Connexion TikTok**.
     (À copier exactement depuis l'app : champ « Redirect URI ».)
4. Dans les produits demandés, cocher **Marketing API**.
5. Soumettre la création.

## Étape 3 — Récupérer les identifiants

1. Depuis **« My apps »**, cliquer sur le nom de l'application créée.
2. Relever :
   - **App ID** (aussi appelé **Client key**)
   - **Client secret** (cliquez sur « Copy » pour le copier)
3. Transmettre ces **deux valeurs** à l'équipe qui configure le CRM
   (champs *Client Key* et *Client Secret* dans Réglages TikTok).

## Étape 4 — Soumettre l'application à la revue

À faire impérativement pour que le CRM puisse lire les statistiques publicitaires :

1. Onglet **« App review »**.
2. Expliquer en détail comment chaque permission est utilisée.
3. Uploader **au moins 1 vidéo de démonstration** (2 max 5 Mo) montrant le flux complet.
4. Cliquer sur **« Submit for review »**.

**Délai** : en général 1 à 2 semaines pour un dossier complet et clair.

---

## Suggestion de description (à adapter)

> MAYELA CRM est un logiciel de gestion de la relation client utilisé par la pharmacie.
> L'application se connecte au compte publicitaire TikTok pour lire les statistiques de
> campagnes (dépenses, impressions, portée, clics) et les afficher dans son tableau de bord.
> Aucune modification de campagne n'est faite automatiquement ; les connexions se font
> avec l'autorisation explicite du propriétaire du compte.

## Après la revue

- Le CRM pourra récupérer les métriques de campagne via la TikTok Marketing API.
- Si la revue est refusée, corriger la description / la vidéo et soumettre à nouveau.
- Les identifiants reçus à l'étape 3 restent les mêmes : seul le statut de l'application change.

## Étape 5 — Autoriser l'accès dans le CRM

Une fois la revue acceptée (ou en attente si l'app est en sandbox) :

1. Dans le CRM, **Réseaux sociaux → Connexion TikTok**, connecter le compte (Login Kit) si ce n'est
   pas déjà fait, puis cliquer sur **« Se connecter à l'analyse publicitaire »**.
2. La page TikTok for Business demande l'autorisation : **Approuver** avec le compte administrateur.
3. Retour automatique au CRM : la carte affiche **« Analyse publicitaire connectée »** ainsi que
   le ou les advertiser IDs autorisés.
4. Cliquer sur **« Relever les campagnes (30 j) »** pour importer les dernières campagnes
   (dépense, impressions, clics, portée) dans le module Campagnes du CRM.
5. Le relevé se relance à volonté pour rafraîchir les chiffres sur les 30 derniers jours.

> **Si le compte publicitaire n'est pas encore autorisé** : se connecter au portail
> **TikTok for Business** → **Autorisations** → **Amis commerciaux** → **Partager un
> compte publicitaire** et y inviter l'application (ou son développeur), puis réessayer.

---

*Document client — créé le 14/09/2026, mis à jour le 15/09/2026.*