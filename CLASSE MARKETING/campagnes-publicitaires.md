# Campagnes publicitaires

**Vérifié le 29 septembre 2026.** Code : `loadCampaigns`, `renderCampaigns`, `fbCampaignBudget`, `fbCampaignStatus`, `tikCampaignBudget`, `tikCampaignStatus`, `syncMarketingCampaigns`, `syncFbMarketingCampaigns`, `campaignAttribution`, et les Edge Functions `social-facebook` et `social-tiktok` (synchronisation).

**Les campagnes ne se saisissent pas dans le CRM.** Elles sont **lues** depuis les plateformes, puis
modifiées depuis le CRM (budget, pause, reprise). La seule création de campagne présente dans le code
est côté TikTok (`tikCreateCampaign` et l'action `ads_campaign_create`) : elle **n'est pas reliée à un
bouton** de l'interface, donc inaccessible en l'état.

---

## En clair

Une campagne représente un ensemble de dépenses de publicité. Dans MAYELA CRM, une campagne existe de deux façons :

- **Saisie à la main** : vous entrez vous-même le nom, la plateforme, le budget et la dépense. Utile pour une campagne lancée hors plateforme, ou pour corriger un import.
- **Importée automatiquement** : depuis Facebook Ads Manager ou TikTok Ads Manager, après avoir connecté un compte publicitaire. L'application récupère alors les campagnes réelles et les met à jour à chaque synchronisation.

Une campagne est toujours rattachée à un espace. Deux espaces ne voient jamais les mêmes campagnes.

Une campagne peut être **active** ou **en pause** — mais ce statut vient de la plateforme publicitaire, pas de MAYELA CRM. Le CRM lit, il ne pilote pas la diffusion des pubs.

---

## Les deux origines d'une campagne

Le champ `source` indique d'où vient la campagne :

| Valeur | Origine | Ce que ça change |
|---|---|---|
| `manuel` | saisie à la main | Vous êtes responsable de la dépense déclarée. |
| `meta` | importée de Facebook Ads Manager | La dépense est réécrite à chaque synchronisation. |
| `tik` | importée de TikTok Ads Manager | Idem côté TikTok. |

**Conséquence importante sur la saisie manuelle.** Si vous saisissez une dépense à la main sur une campagne importée, la prochaine synchronisation l'écrasera. Pour éviter une perte silencieuse, l'application mémorise d'où vient la dernière valeur dans `depense_source` (`manuelle`, `api` ou `mixte`). Cet écart est tracé en base mais **pas encore affiché dans l'interface** — c'est un point connu, non résolu.

---

## Détail technique

### Table `campaigns`

**Champs de saisie (V8)**

| Champ | Type | Description |
|---|---|---|
| `id` | uuid | Identifiant unique |
| `org_id` | uuid | Espace propriétaire |
| `nom` | text | **Obligatoire.** Ex. `META_SOINS_VISAGE_OCT_2026` |
| `plateforme` | text | `facebook`, `instagram` ou `tiktok` |
| `type` | text | `visibilite`, `messages`, `leads`, `promotion_produit` |
| `categorie_promue` | text | Catégorie produit visée (texte libre) |
| `date_debut` / `date_fin` | date | Période de la campagne |
| `budget_prevu` | numeric | Budget prévu |
| `depense_reelle` | numeric | Dépense, **cumul** — voir l'avertissement ci-dessous |
| `portee` | integer | Personnes atteintes |
| `impressions` | integer | Impressions |
| `clics` | integer | Clics ou messages reçus |
| `created_by` / `created_at` | uuid / timestamptz | Auteur et horodatage |

**Champs ajoutés par les importations**

| Champ | Migration | Rôle |
|---|---|---|
| `source` | V10.1 / V11 | `manuel`, `tik` ou `meta` |
| `meta_ad_account_id`, `meta_campaign_id` | V11 | Identifiants natifs Meta |
| `meta_currency`, `meta_status`, `meta_objective` | V11 | Devise, statut, objectif |
| `meta_budget_mode`, `meta_budget`, `meta_synced_at` | V11 | Budget et date de synchronisation |
| `depense_source`, `depense_devise` | V15 | Origine de la dépense, devise |
| `depense_periode_debut`, `depense_periode_fin` | V15 | Période réellement couverte par la dépense |

**Avertissement sur `depense_reelle`.** Ce champ est un **cumul**, pas une valeur de période. Avant la migration V15, il était réécrit à chaque synchronisation sur une fenêtre glissante de 30 jours. Le calcul de rentabilité ne doit donc **pas** s'appuyer dessus pour une période donnée — c'est précisément ce que V15 corrige. Voir [Attribution du CA et ROAS](attribution-ca-et-roas.md).

### Historique quotidien (V15)

La table `campaign_spend_daily` enregistre **une ligne par campagne et par jour** :

| Champ | Rôle |
|---|---|
| `campaign_id`, `jour` | La clé : une campagne, un jour |
| `depense` | Dépense du jour |
| `impressions`, `clics` | Valeurs du jour |
| `portee` | Toujours 0 : Meta ne fournit pas la portée journalière |
| `devise` | Devise du compte publicitaire |
| `source` | `api` ou `manuelle` |

Une contrainte d'unicité sur `(campaign_id, jour)` rend la synchronisation rejouable sans créer de doublons.

La vue `v_campaign_spend` agrège cet historique par campagne et donne le montant, la période couverte et le nombre de jours.

### Plateformes et types

| Plateforme | Libellé affiché | Gestion réelle |
|---|---|---|
| `facebook` | Page Facebook | Publication d'offres gérée |
| `instagram` | affiché tel quel | Pas de gestion dédiée |
| `tiktok` | TikTok Business | Publication via Login Kit gérée |

Types de campagne : `visibilite` (défaut), `messages`, `leads`, `promotion_produit`.

Valeurs par défaut à la création manuelle : plateforme `facebook`, type `visibilite`, dépense et métriques à 0.

### Suppression

Supprimer une campagne laisse intactes les données qui y sont rattachées :
- les prospects qui l'ont pour origine (`clients.campagne_origine`) ;
- les ventes qui lui sont associées (`achats.campagne_id`).

Seul l'intitulé disparaît. Les ventes ne perdent donc pas leur historique, mais elles se retrouvent orphelines d'une campagne supprimée.

---

## Points de vigilance

- **Le statut actif/pause est en lecture seule.** Le CRM ne permet pas de démarrer ou mettre en pause une pub depuis l'application.
- **La portée n'est pas historisée.** Elle reste à 0 dans l'historique quotidien, car les APIs ne la fournissent pas au jour le jour.
- **Aucune conversion de devise automatique.** `depense_devise` enregistre la devise du compte publicitaire ; le calcul de rentabilité suppose des montants comparables. Une campagne en dollars mélangée à des ventes en FCFA produit un ROAS faux. C'est un point connu, non résolu.
- **La synchronisation écrase la saisie manuelle** sur les campagnes importées (voir `depense_source`).
