# Suivi des priorités — MAYELA CRM

## État au 01/09/2026

### En attente
- **Test des Rapports (manuel, navigateur)** : vérifier catégories, « Autre » + IA,
  PDF, aperçu. Nécessite connexion OTP de l'utilisateur. Rappel avant de s'égarer.

### En cours
- **Config Google Sheets** : récupérer Client ID + Secret (console.cloud.google.com,
  type « Application de bureau »), les coller dans l'app (onglet Réseaux → Google
  Sheets), connecter, tester l'export depuis l'onglet Rapports.

### Fait
- Base Supabase débloquée (migration V2 appliquée, tables en 200, fonction
  temporaire supprimée).
- Fonction `google-sheets` déployée + protégée JWT.
- Docs mises à jour (`SCHEMA_SUPABASE.md`, `DEPLOY_BACKEND.md`), poussées.
- Rapports étendus (clients, ventes, devis, créances, interactions, tâches,
  produits, réseaux) + sélecteur avec option « Autre » + rapport IA + aperçu
  éditable.
- Export : seuls PDF et Google Sheets (CSV/Excel retirés).
- Affichage amélioré : Configuration Tracking, Google Sheets, État des
  intégrations.
- Barres de défilement rendues visibles (épaisses, dorées).
- Déploiement GitHub + Vercel + Supabase (8 fonctions) synchronisés.
