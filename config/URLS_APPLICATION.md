# URLs MAYELA CRM (production : https://mayela-crm.vercel.app)

| Champ | URL |
|---|---|
| **Page d'accueil publique** (landing, Google OAuth/branding) | https://mayela-crm.vercel.app/ (`index.html`) |
| Terms of Service URL | https://mayela-crm.vercel.app/terms.html |
| Privacy Policy URL | https://mayela-crm.vercel.app/politique-confidentialite.html |
| Application (connexion) | https://mayela-crm.vercel.app/mayela-crm.html |
| Web / Desktop URL | https://mayela-crm.vercel.app/ |
| WebhooksCallback URL | (non requis — laisser vide) |
| Content Posting API | (produit à activer dans le portail TikTok — pas une URL) |
| Login Kit Redirect URI (Web) | https://mayela-crm.vercel.app/mayela-crm.html |

> `index.html` est désormais la page d'accueil publique (marque, fonctionnalités,
> transparence des données) ; l'application (connexion) reste sur `mayela-crm.html`.

## Écran de consentement OAuth Google (à renseigner)

- **Application home page** : https://mayela-crm.vercel.app/
- **Application privacy policy link** : https://mayela-crm.vercel.app/politique-confidentialite.html
- **Domaine vérifié** : `mayela-crm.vercel.app` — fichier de vérification Search Console
  déployé : `https://mayela-crm.vercel.app/google7e5d74ec11f8f0b7.html` (HTTP 200, contenu conforme).

> **État OAuth** : l'app est **« En production »** (publiée) mais **non vérifiée** → Google affiche
> l'écran « application non vérifiée » ; pour continuer : **Paramètres avancés → Accéder à
> mayela-crm (non sécurisé)**. Cette interstitielle disparaîtra après la **vérification du
> branding** (home page + politique + domaine) puis, pour le scope sensible `spreadsheets`,
> éventuellement une **vérification d'application** complète. Aucun utilisateur test requis
> (mode production) ; les jetons Google n'expirent plus à 7 jours.

## Compte — changer l'e-mail de connexion (self-service)

- **Réglages → Compte → « Changer l'e-mail de connexion »** : saisie du nouvel e-mail →
  `sb.auth.updateUser({ email })` envoie un lien de confirmation au nouvel e-mail
  (+ notification à l'ancien). Un bouton « Renvoyer le lien » relance via
  `sb.auth.resend({ type:'emailChange' })`.
- L'espace (`org_id`), les clients et les connexions OAuth (Google Sheets) sont conservés ;
  seul change l'e-mail de connexion (OTP).
- Aucune intervention admin nécessaire.
