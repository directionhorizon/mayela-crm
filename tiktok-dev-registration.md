# Demande d'inscription Développeur TikTok — Description d'usage

**Société éditeur :** Mayela CRM
**Site web :** https://mayela-crm.vercel.app/
**Profil :** Software Developer / Éditeur de logiciel SaaS

Nous développons MAYELA CRM, un CRM léger en SaaS destiné aux PME (pharmacies, commerces, e-commerce et agences travaillant avec des créateurs de contenu). Notre objectif est d'aider nos clients à piloter leur relation client, leur contenu TikTok et leurs campagnes publicitaires en centralisant toutes leurs données dans un tableau de bord unique. Mayela CRM est l'unique développeur : nos clients (dont les pharmacies) nous donnent simplement l'accès à leurs comptes via les flux d'autorisation officiels.

## Cas d'usage principal

### 1. Publication de contenu organique (Content Posting API + Login Kit)
Nos clients (ex. une pharmacie) utilisent le module réseaux sociaux de Mayela CRM pour publier leurs offres et contenus commerciaux directement sur leur compte TikTok, depuis une interface unique. Nous utilisons **Login Kit** pour connecter le compte (scopes `user.info.basic` et `video.publish`) et le **Content Posting API** pour publier une photo et un texte. Un contenu n'est publié qu'après un clic explicite de l'utilisateur, et uniquement sur le compte qu'il a autorisé.

### 2. Analyse publicitaire (TikTok Marketing API / Business API)
Nous prévoyons d'utiliser la **TikTok Marketing API (Business API)** pour lire les statistiques publicitaires des comptes de nos clients (dépenses, impressions, clics, portée) et les afficher dans le module Campagnes du CRM, aux côtés des statistiques organiques déjà disponibles. La connexion se fait avec l'autorisation explicite du propriétaire du compte publicitaire (flux OAuth distinct du Login Kit). **Aucune modification de campagne n'est effectuée automatiquement** : lecture seule des métriques. Endpoints ciblés (v2.0) : `/oauth2/advertiser/get/`, `/bc/account/get/`, `/report/integrated/get/` (reporting de campagnes), et, lorsque nécessaire, `/bc/pixel/get/` pour le suivi des conversions.

### 3. Lecture de données publiques de vidéos (Research API)
Pour les clients qui le souhaitent, nous prévoyons d'utiliser la **Research API** afin de récupérer les métriques publiques de vidéos (vues, likes, partages, commentaires, durée de visionnage) et analyser la performance des contenus et les tendances par secteur. Ces données alimentent nos modules d'analyse et de reporting.

### 4. Suivi des conversions
Nous envoyons des événements de conversion (leads, devis, ventes, RDV) via la **TikTok Events API** (server-side), avec les données utilisateur hashées (SHA-256) et une déduplication par identifiant d'événement, conformément aux exigences de TikTok.

## Respect des règles

- Nous ne collectons que les données **publiques ou explicitement autorisées** par l'utilisateur final via les mécanismes d'authentification officiels (OAuth).
- Les mots de passe ne sont jamais vus ni stockés ; les jetons d'accès sont stockés chiffrés côté serveur et révocables à tout moment.
- Aucune modification de compte n'est faite sans action explicite de l'utilisateur ; l'analyse publicitaire est en lecture seule.
- Nous ne revendons jamais les données brutes à des tiers ; elles servent uniquement au reporting agrégé pour nos propres clients.
- Nous respectons le taux d'appel (rate limits), les conditions d'utilisation de TikTok et les mentions de droit d'auteur.
- Nous conservons les données uniquement pour la durée nécessaire à l'analyse et permettons la suppression des comptes connectés à tout moment.
- Notre produit est destiné à des usages professionnels légitimes (marketing, commerce, santé) et nous ne prévoyons aucune utilisation à des fins de publicité ciblée non conforme ou de scraping non autorisé.