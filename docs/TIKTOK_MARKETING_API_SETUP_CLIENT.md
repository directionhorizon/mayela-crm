# Créer l'application TikTok Developer (Marketing API) — Guide pas à pas

**À lire par** : la pharmacie (propriétaire du compte **TikTok for Business**).

**Objectif** : créer l'application développeur TikTok qui permet au CRM de lire les
statistiques **publicitaires** (dépenses, impressions, clics) en plus des statistiques
**organiques** déjà disponibles (abonnés, vues, engagement).

**Préalable** : le compte **TikTok for Business** doit déjà exister.

**Équivalent Facebook** : ce guide est le pendant de
[`FACEBOOK_META_SETUP_CLIENT.md`](FACEBOOK_META_SETUP_CLIENT.md). Les deux se font dans le
même ordre : créer l'app → relevé des identifiants → Redirect URI → branchement dans le CRM.

---

> ## ⚠️ État au 29 septembre 2026 — ne pas commencer la procédure
>
> L'application a été **rejetée à la revue TikTok**, puis **mise en pause volontairement**.
> Deux motifs, dont un bloquant :
>
> 1. **La validation du numéro par code est bloquée** côté TikTok depuis le 24/09. C'est le motif
>    principal : tant qu'elle ne passe pas, la resoumission est inutile.
> 2. **Le dossier de revue est incomplet** : description, cas d'usage, captures d'écran et URL
>    légales doivent être repris. Le texte anglais déposé pour la première soumission ne couvre que
>    la publication de vidéos, pas l'analyse publicitaire.
>
> **En attendant, tout le reste de l'application fonctionne** : publication sur TikTok, pixel,
> suivi des événements, rapports, multi-espaces. Seule la **lecture automatique des campagnes
> payantes** est indisponible.
>
> Suivi détaillé : `docs/suivi/EN_ATTENTE.md` §1. Quand la validation du numéro repassera, ce guide
> sera repris et complété.

---

## Règle d'or à retenir avant de commencer

> **Deux applications, deux rédactions.** L'app Meta et l'app TikTok sont indépendantes.
> L'une ne débloque pas l'autre, et une revue approuvée chez l'une n'aide pas l'autre.
> Le même Client Key / Client TikTok sert à la publication **et** à l'analyse publicitaire :
> ce sont deux autorisations distinctes, mais un seul jeu d'identifiants.

---

## Étape 1 — Devenir développeur

1. Ouvrir `https://developers.tiktok.com`.
2. Cliquer sur **« Become a Developer »** (en haut à droite).
3. Se connecter avec les identifiants du compte **TikTok for Business**.
4. Choisir « **Direct Advertiser** » dans « What best describes you or your company ».
   > C'est le bon choix : le CRM lit les campagnes d'un compte publicitaire que la
   > pharmacie possède elle-même. Les autres rôles (Agency, Partner) sont réservés aux
   > régies qui gèrent les comptes d'autrui.
5. Valider la vérification (code reçu par e-mail **et** par téléphone).

## Étape 2 — Créer l'application

1. Aller dans **« Manage apps »** (gérer les applications).
2. Cliquer sur **« Connect a new app »** (connecter une nouvelle application).
3. Renseigner les champs :
   - **App name** : proposé — `Mayela CRM — Pharmacie`
   - **Description** : expliquer en 1-2 phrases ce que fait l'application (voir suggestion en bas).
   - **Website URL** : l'adresse du site de la pharmacie (obligatoire).
   - **Privacy Policy URL** : page de politique de confidentialité (obligatoire).
4. **Ajouter le produit Login Kit** : menu de gauche **Products → Add products → Login Kit**.
5. **Ajouter le produit Marketing API** : **Products → Add products → Marketing API**.
   > Les deux produits sont nécessaires : Login Kit pour publier les offres, Marketing API pour
   > lire la publicité. Le second est celui qui demande la revue.
6. Soumettre la création.

## Étape 3 — Activer la plateforme Web

**Étape la plus souvent oubliée.** Sans elle, aucun champ Redirect URI n'apparaît.

1. Ouvrir l'application → onglet **App details** → **Platforms**.
2. Cocher **Web**. Enregistrer.
3. Revenir dans **Products → Login Kit**. La section **Web** apparaît enfin.
4. Y coller le Redirect URI (étape 4) puis **+ Add a URI** → **Save**.

## Étape 4 — Enregistrer l'URI de redirection

L'URI à coller est affichée par le CRM lui-même, ce qui garantit qu'elle est exacte.

1. Dans MAYELA CRM : **Réseaux sociaux** → carte **TikTok Business** → **Connecter**.
2. Déplier **« Préparation dans TikTok (une fois pour toutes) »**.
3. Cliquer **📋 Copier le Redirect URI**. La valeur attendue est :
   ```
   https://mayela-crm.vercel.app/mayela-crm.html
   ```
4. La coller dans **Products → Login Kit → Web → Redirect URI** (étape 3.4).
5. **Save**.

> Le Marketing API utilise la **même** URI : rien à enregistrer de plus.

## Étape 5 — Relever les identifiants

1. Toujours dans l'application → **App details → Credentials**.
2. Relever :
   - **Client key** (aussi appelé **App ID**, format `awdio…`)
   - **Client secret**
3. Les saisir dans le CRM : **Réseaux sociaux → carte TikTok Business → Connecter**,
   champs **Client Key** et **Client Secret**.
   > Ce ne sont **pas** des réglages de l'écran *Réglages* : ils se saisissent dans le
   > panneau de connexion TikTok, sur l'écran *Réseaux sociaux*.

## Étape 6 — Brancher l'application dans le CRM (autorisation 1)

1. **📘 Se connecter à TikTok** (bouton du panneau).
2. Fenêtre TikTok : autoriser avec le compte propriétaire de la chaîne.
3. Retour dans le CRM : la carte affiche **« Connecté »**.
4. **Publier une offre de test** → elle doit apparaître sur le profil TikTok.

## Étape 7 — Brancher l'analyse publicitaire (autorisation 2)

1. Dans le même panneau, bloc **« Analyse publicitaire (TikTok Marketing API) »** — visible
   directement, sans déplier quoi que ce soit.
2. Cliquer **📊 Se connecter à l'analyse publicitaire**.
3. TikTok for Business s'ouvre : autoriser avec le **compte administrateur du compte
   publicitaire**. Valider.
4. Retour dans le CRM : le statut affiche **« Analyse publicitaire connectée »** et la liste
   des **Advertiser ID** autorisés.
   > **Vérifier cette liste.** Le CRM récupère *tous* les comptes publicitaires autorisés
   > pour ce compte. Pour une pharmacie à un seul compte, un seul identifiant doit s'afficher.
5. **🔄 Relever les campagnes (30 j)** → les campagnes arrivent dans l'écran **Campagnes**.

## Étape 8 — Soumettre l'application à la revue

Nécessaire pour lire les données publicitaires en conditions réelles.

1. Onglet **« App review »** de l'application.
2. Expliquer en détail comment chaque permission est utilisée.
3. Uploader **au moins 1 vidéo de démonstration** (2 max 5 Mo) montrant le flux complet :
   connexion → relevé des campagnes → affichage dans le CRM.
4. **Submit for review**.

**Délai** : en général 1 à 2 semaines pour un dossier complet et clair.

> En attendant la revue, l'app peut être testée en **sandbox** : les chiffres de test ne
> touchent pas la comptabilité réelle.

---

## Erreurs fréquentes → cause

| Symptôme | Cause | Correction |
|---|---|---|
| Aucun champ **Redirect URI** dans Login Kit | plateforme **Web** non cochée dans *App details → Platforms* | étape 3 |
| `redirect_uri mismatch` | URI enregistrée ≠ celle du CRM | réutiliser celle copiée depuis le CRM, à l'identique |
| Le bouton « Se connecter à l'analyse publicitaire » ne rend rien | aucun Client Key enregistré | étape 5, puis relancer |
| Aucun **Advertiser ID** après autorisation | le compte publicitaire n'est pas partagé avec l'application | portail TikTok for Business → **Autorisations → Amis commerciaux** → inviter l'application |
| Données publicitaires vides | revue refusée, ou app encore en sandbox | étape 8 |
| Les campagnes ne se mettent pas à jour | le relevé est manuel, **30 jours glissants** | relancer **🔄 Relever les campagnes** |
| Une campagne aparece sans dépense | la campagne a démarré après le début de la fenêtre de 30 jours | sans incidence sur le calcul du ROAS |

---

## Différences avec Meta (à garder en tête)

| | TikTok | Meta |
|---|---|---|
| Autorisation publication | Login Kit | Facebook Login |
| Autorisation publicité | Marketing API (`ads.tiktok.com`) | fenêtre Meta (permissions `ads_*`) |
| Revue | onglet **App review**, avec vidéo | **App Review → Permissions and Features** |
| Résultat | l'analyse publicitaire **échoue proprement** si la revue n'est pas passée | idem depuis le correctif du 29/09/2026 |
| Portefeuille requis | non | oui (Business Portfolio) |

## Suggestion de description (à adapter)

> MAYELA CRM est un logiciel de gestion de la relation client utilisé par la pharmacie.
> L'application se connecte au compte publicitaire TikTok pour lire les statistiques de
> campagnes (dépenses, impressions, portée, clics) et les afficher dans son tableau de bord.
> Aucune modification de campagne n'est faite automatiquement ; les connexions se font
> avec l'autorisation explicite du propriétaire du compte.

---

*Document client — créé le 14/09/2026, réécrit le 29/09/2026 : chemins CRM corrigés
(le panneau TikTok est sur l'écran *Réseaux sociaux*, pas dans *Réglages*), séparation
expliquée des deux autorisations, ajout des étapes Web/Redirect URI et d'un tableau d'erreurs.
Équivalent Meta : `FACEBOOK_META_SETUP_CLIENT.md`.*
