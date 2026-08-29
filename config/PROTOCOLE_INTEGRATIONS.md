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
1. **App Facebook** (développeur) : créer une app de type **Business** (ou réutiliser).
   - Possible de réutiliser une app commune pour plusieurs Pages, MAIS chaque espace connecte sa
     propre **Page** avec son propre **Page Access Token**.
2. **Permissions** : `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`.
3. **ID de la Page** et **Access Token longue durée (60 j)** — via Graph API Explorer (v21.0).
4. Dans l'espace MAYELA concerné → **Réseaux** → carte **Page Facebook** → **Connecter** :
   coller ID Page + token.

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

*Fichier lié : voir aussi `config/DEPLOY_BACKEND.md` pour les détails pas-à-pas de chaque plateforme.*
