# Impact opérationnel

**Vérifié le 29 septembre 2026.** Code : catégorie `impact` de `reportRows` et `reportSummaryText`.

---

## En clair

Les statistiques de Facebook et TikTok ne donnent pas toujours une image complète de votre activité. Ce rapport comble ce vide avec ce que **vous** savez : vos publications, vos échanges, vos ventes.

C'est le rapport qui répond à « qu'est-ce que mon marketing a réellement produit ? », en s'appuyant uniquement sur vos données, sans dépendre d'une plateforme extérieure.

**Il a été déplacé des Réseaux sociaux vers les Rapports le 13 septembre 2026**, pour qu'il respecte la période choisie et puisse être exporté comme les autres rapports.

---

## Les cinq indicateurs

| Indicateur | Ce qu'il compte | Portée |
|---|---|---|
| **Offres publiées** | publications envoyées avec succès | période choisie |
| **En échec à retenter** | publications qui ont échoué | période choisie |
| **Échanges enregistrés** | toutes vos interactions | période choisie |
| **Achats (FCFA)** | total des ventes | période choisie |
| **Clients suivis** | taille totale de votre fichier | **toute la période** |

**Notez la dernière ligne** : « Clients suivis » compte tous vos clients, pas seulement ceux de la période. C'est cohérent avec l'idée d'un fichier, mais à garder en tête si vous comparez deux périodes.

---

## La répartition par canal

Le rapport détaille ensuite comment se répartissent vos échanges :

| Canal | Ce que cela recouvre |
|---|---|
| WhatsApp | conversations WhatsApp |
| TikTok | interactions TikTok |
| Facebook | interactions Facebook |
| Appel | appels téléphoniques |
| Visite | rendez-vous en personne |
| Autre | tout le reste |

Chaque ligne affiche le nombre d'échanges pour ce canal.

---

## Ce que ce rapport ne mesure pas

Soyons clairs sur ce que ce rapport ne prétend pas faire :

- Il ne mesure pas la **portée** de vos publications. Aucune donnée de portée n'est récupérée des plateformes.
- Il ne mesure pas l'**engagement** (likes, commentaires, partages).
- Il ne dit pas si une campagne **a fonctionné** : c'est le rôle des [rapports de campagnes](attribution-ca-et-roas.md).
- Il ne compte que les publications **réussies ou échouées** connues dans le CRM ; une publication faite manuellement sur la plateforme n'y apparaît pas.

En résumé : ce rapport mesure **votre activité réelle**, pas votre visibilité en ligne.

---

## Détail technique

### Origine des données

| Indicateur | Table | Condition |
|---|---|---|
| Offres publiées | `social_posts` | `status = 'sent'` |
| En échec | `social_posts` | `status = 'failed'` |
| Échanges | `interactions` | aucune, sur la période |
| Achats | achats filtrés sur la période | somme des montants |
| Clients suivis | `clients` | aucune |

### Le résumé automatique

Le rapport est précédé d'un résumé du type :
> X offre(s) publiée(s) dont Y en échec à retenter · Z échange(s) enregistré(s) · W client(s) suivi(s) · V FCFA d'achats sur la période.

**Réserve** : ce résumé mentionne que ces indicateurs « remplacent les statistiques réseaux non disponibles ». C'était exact à sa création, en septembre 2026, mais **les intégrations Facebook et TikTok sont désormais branchées** (voir [Intégrations sociales](integrations-sociales.md)). La formulation n'a pas été mise à jour : les statistiques réseau sont partiellement disponibles, pas totalement absentes.

### Export

Ce rapport s'exporte comme les autres, en Google Sheets et en PDF, avec le titre et la période dans le nom de la feuille.

### Libellés des canaux

Les libellés proviennent de la table de correspondance interne des types d'interaction. Toute interaction dont le type n'est pas reconnu est comptée dans la catégorie « Autre ».

---

## En un mot

Ce rapport est le plus simple de tous et le plus rapide à produire : il ne demande aucune connexion aux réseaux sociaux. C'est le bon point de départ pour mesurer une activité, avant de croiser avec les données publicitaires.
