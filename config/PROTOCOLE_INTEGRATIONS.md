# Protocole des intégrations Facebook & TikTok — par espace

MAYELA CRM est **multi-espace** : chaque organisme (espace de travail) a ses propres données,
totalement isolées des autres. Cela vaut aussi pour les **intégrations sociales** (Facebook/TikTok) :
**chaque espace configure sa propre Page Facebook et son propre compte TikTok**, indépendamment
des autres espaces.

Ce document décrit le protocole complet : modèle de données, partage, étapes manuelles, réglages
UI, et le comportement attendu.

---

## 1. Modèle : une intégration PAR ESPACE

- Table `social_accounts` : `org_id` + `platform` + `config` (JSON avec les secrets/clés).
- Contrainte `unique (org_id, platform)` → **au plus 1 compte Facebook et 1 compte TikTok par espace**.
- Isolation par RLS via `current_org_id()` : un membre d'un espace ne voit/utilise **que** les
  intégrations de **son** espace.

```
Espaces (organizations)
├── Espace A ("Pharmacie Ngoyo")  → Page FB "Pharmacie Ngoyo" + TikTok "pharma_ngoyo"
└── Espace B ("Boutique Horizon") → Page FB "Horizon Boutique" + TikTok "boutique_horizon"
```

Chaque espace peut correspondre à un **email/contact différent** ; cela n'a aucun impact sur le
modèle — chaque espace a ses propres identifiants d'intégration.

## 2. Partage au sein d'un espace

- La connexion est stockée **au niveau de l'espace** (pas de l'utilisateur).
- **Tous les membres de l'espace** utilisent la même intégration (une seule personne la configure,
  toute l'équipe en profite).
- Les secrets (Access Token Facebook, Client Key/Secret TikTok) vivent dans `social_accounts.config`
  **côté serveur** : jamais renvoyés au navigateur des autres membres (fonctions `social-publish`,
  `social-insights`, `social-tiktok` les lisent côté serveur).

## 3. Étapes manuelles par espace

Pour **chaque** espace, répéter l'intégration souhaitée avec le compte/personne qui administre la
Page ou le compte TikTok de CET espace.

### 3.1 Facebook (par espace)
1. **App Meta** (developers.facebook.com) : Business App avec produit **Facebook Login**.
   - Possibilité de réutiliser une app commune pour plusieurs Pages, MAIS chaque espace connecte sa
     propre **Page** avec son propre **Page Access Token**.
2. **Valid OAuth Redirect URIs** : `https://mayela-crm.vercel.app/mayela-crm.html`.
3. **Permissions** : `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`,
   `read_insights`, `ads_management`, `ads_read`, `business_management`
   (les trois dernières pour la **gestion Meta Ads** : relève + pause/reprise + budget).
4. Dans l'espace MAYELA concerné → **Réseaux** → carte **Page Facebook** → **Connecter** :
   saisir **App ID** + **App Secret** → autoriser la Page (flux OAuth, comme TikTok).
   Voir le guide `docs/FACEBOOK_META_SETUP_CLIENT.md`.
5. **(Meta Ads)** → **Réseaux** → *Analyse publicitaire (Meta Ads Manager)* →
   **Se connecter à l'analyse publicitaire** puis **Relever les campagnes (30 j)**.
   Le compte autorisé doit être **gestionnaire du compte Ads Manager** (admin ou
   Analyst/Advertiser). Budgets/dépenses en **devise du compte publicitaire**.
   Gestion dans l'écran **🛠️ Gérer mes campagnes Meta Ads** (pause/reprise, budget).

### 3.2 TikTok (par espace)
1. **App TikTok** (developers.tiktok.com) : platform **Web**, produits **Login Kit** + **Content Posting API**.
2. **Redirect URI** : `https://mayela-crm.vercel.app/mayela-crm.html`.
3. **Client ID** / **Client Secret** dans l'espace MAYELA → **Réseaux** → carte **TikTok Business**.
4. Flux OAuth → tokens stockés côté serveur pour cet espace.

> Un espace peut très bien n'avoir **que** Facebook, **que** TikTok, ou les deux. Chaque intégration
> est indépendante.

## 4. Réglages UI (par espace)

- **Onglet Réseaux** : cards « Page Facebook » et « TikTok Business » pour connecter/déconnecter.
- **Publication d'offre** : choisir la cible (Facebook et/ou TikTok) — n'envoie que vers les
  espaces/plateformes connectées de **l'espace courant**.
- **Configuration Tracking** : Pixel ID + Events API Token TikTok, stockés par espace.
- **Analyse d'audience** : lit les comptes connectés de l'espace courant.

## 5. Comportement attendu (résumé)

| Question | Réponse |
|---|---|
| Chaque espace a-t-il sa propre Page FB ? | Oui |
| Chaque espace a-t-il son propre compte TikTok ? | Oui |
| Membre d'un espace voit-il les intégrations d'un autre espace ? | Non (RLS par org) |
| Une connexion sert-elle tout l'espace ? | Oui (partagée par les membres) |
| Les secrets sont-ils exposés aux autres membres ? | Non (côté serveur) |
| Peut-on n'avoir que FB ou que TikTok ? | Oui (indépendant) |

## 6. Si un espace doit "refaire" l'intégration

- **Facebook** : déconnecter puis reconnecter avec un token régénéré (exp. 60 j).
- **TikTok** : déconnecter puis reconnecter ; révoquer l'accès côté TikTok si souhaité.
- Rien à reconfigurer pour les autres espaces (isolation totale).

---

## 7. Automatisations opérationnelles (en attendant les réseaux)

Même sans Facebook/TikTok connectés, l'onglet **Réseaux** offre un travail manuel assisté
et un suivi d'impact interne. Fonctionnement **identique pour chaque espace** (données de
l'espace courant uniquement).

### 7.1 Contenu prêt à poster (texte)
- Onglet Réseaux → **Publier une offre** → bouton **📋 Copier le texte**.
- Génère : texte saisi + produit + prix + coordonnées de l'espace + hashtags, prêt à
  coller sur TikTok/Facebook/WhatsApp.
- Pas d'API requise : simple copier-coller manuel.

### 7.2 Image de l'offre (visuel prêt à poster)
- Bouton **🖼️ Télécharger l'image** → génère un PNG 1080×1080 (format carré réseaux)
  avec : nom de l'espace, image du produit (si renseignée), prix, texte, mention
  « Commandez vite — stock limité ».
- Téléchargé localement, prêt à être publié manuellement.

### 7.3 Suivi opérationnel interne (remplace l'analyse d'audience)
- Rapport **Impact opérationnel (interne)**, catégorie `impact` de l'écran **Rapports** (déplacé de Réseaux le 13/09/2026 — donnée interne, au format rapport : période + export).
- KPIs dérivés des données internes de l'espace, calculés sur la **période sélectionnée** (sauf « clients suivis », total du fichier) :
  - offres publiées (et échecs à retenter)
  - échanges clients enregistrés, répartis par canal (WhatsApp, TikTok, Facebook, appels, visites)
  - clients suivis
  - achats (FCFA, sur la période)
- Export Google Sheets / PDF, comme les autres catégories de rapports.
- Fournit un indicateur d'impact réel sans dépendre des APIs réseaux.

> Ces automatisations remplissent temporairement les manques opérationnels tant que les
> intégrations Facebook/TikTok ne sont pas branchées. Elles cohabitent avec le diagnostic
> d'état automatisé (`social-health`) et les publications API dès qu'une intégration est complète.

---

*Fichier lié : voir aussi `config/DEPLOY_BACKEND.md` pour les détails pas-à-pas de chaque plateforme.*
