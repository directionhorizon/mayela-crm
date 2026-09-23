# Évolutions majeures — documentation

Ce dossier documente les **grandes évolutions** de MAYELA CRM, avant et après leur mise en œuvre.

Chaque évolution fait l'objet d'un fichier `EVO-<identifiant>.md` qui sert d'**étude** (contexte, décision, impact) puis de **mémoire** (mise en œuvre, vérification, statut).

## Règle

- Toute évolution structurante (schéma de base, multi-comptes, intégrations, sécurité, déploiement) doit être documentée ici **avant** son développement.
- Le fichier reste ouvert pendant le développement et est mis à jour à la livraison.
- Les évolutions abouties sont marquées `✅ Livrée` ; les études non retenues, `❌ Abandonnée` (pour ne pas perdre la réflexion).

## Modèle de fichier

```markdown
# EVO-<id> — <Titre>

- Statut : 📝 Étude | 🚧 En cours | ✅ Livrée | ❌ Abandonnée
- Date : <AAAA-MM-JJ>
- Décision : <option choisie>

## Contexte / Besoin
## Options envisagées
## Décision
## Impact (base, app, sécurité, données existantes)
## Plan de mise en œuvre
## Vérification
```

## Références croisées

- Schéma de la base : `config/SCHEMA_SUPABASE.md`
- Migrations : `config/MIGRATION_*.sql`
- Déploiement / intégrations : `config/DEPLOY_BACKEND.md`, `config/PROTOCOLE_INTEGRATIONS.md`
- Suivis fonctionnels : `config/SUIVI_PRIORITES.md`, `config/SUIVI_TIKTOK_INTEGRATIONS.md`

## Table des évolutions

| Id | Titre | Statut | Date |
|----|-------|--------|------|
| EVO-001 | Multi-espaces : un login pour plusieurs business | 🚧 En cours | 2026-09-09 |