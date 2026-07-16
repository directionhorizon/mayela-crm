# MAYELA CRM — Checklist de test E2E (5 scénarios)
**Pour validation avant présentation du 25 juillet**

---

## Contexte
- **Dataset de test** : 1006 clients (dont 1000 fictifs), 205 prospects (Maps)
- **Orga de démo** : "Nzila Test SARL" (code `TEST-NZILA-01`)
- **Comptes testables** :
  - `sagessenlcd.determinee@gmail.com` (déjà dans Nzila Test SARL)
  - `direction.horizon.cg@gmail.com` (HORIZON staff, devra créer/rejoindre orga)
  - Tout autre e-mail (nouveau compte Supabase)

---

## ✅ Scénario 1 : Onboarding complet (Créer org + PIN)

**Durée estimée** : 4 min  
**Compte** : Un e-mail nouveau (ex: `test-new-@gmail.com`)

| Étape | Action | ✓ Résultat attendu |
|---|---|---|
| 1 | Ouvre l'app (localhost:8080 ou Vercel) | Écran "Connexion à MAYELA CRM" |
| 2 | Tape l'e-mail | Champ rempli, bouton actif |
| 3 | Clique "Recevoir le code" | Pas d'erreur "Failed to fetch" |
| 4 | Vérifie l'e-mail entrant | Code 6 chiffres visible |
| 5 | Reviens dans l'app, tape le code | Écran "Créez votre code PIN" |
| 6 | Tape 4 chiffres au clavier circulaire | Les 4 points se remplissent |
| 7 | Après la 4e digit, écran lock apparaît | Le PIN est sauvegardé |
| 8 | Tape le PIN qu'on vient de créer | Écran "Votre espace de travail" |
| 9 | Crée une orga (nom unique, ex: "Test Orga 123") | Orga créée, dashboard apparaît |
| 10 | Vérifies les KPIs | Affichent `Clients: 0`, `Overdue: 0`, etc. |

**Conditions de passage** ✓
- [ ] Pas d'erreur "Failed to fetch"
- [ ] E-mail reçu < 30 sec
- [ ] PIN créé et réutilisable (recharge, tap PIN → accès)
- [ ] Dashboard chargé sans erreur

---

## ✅ Scénario 2 : Rejoindre une organisation existante (via code)

**Durée estimée** : 3 min  
**Compte** : Nouvel e-mail  
**Code d'orga** : `TEST-NZILA-01`

| Étape | Action | ✓ Résultat attendu |
|---|---|---|
| 1 | Logs in avec nouvel e-mail | Écran "Votre espace de travail" |
| 2 | Création du PIN (4 chiffres) | PIN accepté, lock screen |
| 3 | Re-tape le PIN | Dashboard |
| 4 | Regarde les KPIs | Affichent `Clients: 1006` (du dataset) |
| 5 | Cherche un client (ex: "test", "pnr") | La recherche filtre |
| 6 | Clique sur un client | Fiche s'ouvre, affiche interactions/achats/devis/tasks |

**Conditions de passage** ✓
- [ ] Code `TEST-NZILA-01` accepté
- [ ] 1006 clients chargés (KPI correct)
- [ ] Recherche fonctionnelle
- [ ] Fiche client détaillée affichée

---

## ✅ Scénario 3 : Créer un client + ajouter interactions/achat/devis/tâche

**Durée estimée** : 5 min  
**Compte** : N'importe lequel (ou réutilise Scénario 2)  
**Données** : Inventer un client test

| Étape | Action | ✓ Résultat attendu |
|---|---|---|
| 1 | Dashboard visible | |
| 2 | Clique le FAB "+" en bas droite → "Clients" | |
| 3 | Ouvre l'onglet "Clients" | Lit 1006 clients |
| 4 | Clique le bouton "+" (FAB) | Écran "Nouveau client" |
| 5 | Remplis : nom "Claude Test", zone "Bacongo", tel "243 999 123" | Tous les champs remplis |
| 6 | Sélectionne "Négociation" | Dropdown affiche les 5 stages |
| 7 | Clique "Enregistrer" | Toast "Client enregistré" |
| 8 | Reviens dans Clients → ouvre le client qu'on vient de créer | Fiche "Claude Test" ouverte |
| 9 | Onglet "Interactions" actif | Affiche "Aucune interaction" |
| 10 | Type "appel" dans select, "note de test" dans champ | Champs remplis |
| 11 | Clique "+" | Toast confirme, interaction ajoutée |
| 12 | Onglet "Achats" | Affiche "Aucun achat" |
| 13 | Entre "50000" (FCFA) | Champ rempli |
| 14 | Clique "+" | Achat ajouté, date = aujourd'hui |
| 15 | Onglet "Devis" | Affiche "Aucun devis" |
| 16 | Entre "200000" | Champ rempli |
| 17 | Clique "+" | Devis ajouté |
| 18 | Onglet "Tâches" | Affiche "Aucune tâche" |
| 19 | Sélectionne une date future (ex: +7 jours) | Calendrier valide |
| 20 | Clique "+" | Tâche créée, statut = "a_faire" |
| 21 | Clique "Marquer fait" | Statut bascule à "Fait ✓" (texte barré) |

**Conditions de passage** ✓
- [ ] Client créé apparaît dans la liste (count = +1)
- [ ] Interaction, achat, devis, tâche créés sans erreur
- [ ] Chaque élément affiche une date/montant correct
- [ ] Tâche peut passer de "a_faire" à "fait"

---

## ✅ Scénario 4 : Filtrage, recherche, KPIs et conseils

**Durée estimée** : 3 min  
**Compte** : Scénario 2 (dans Nzila Test)

| Étape | Action | ✓ Résultat attendu |
|---|---|---|
| 1 | Dashboard → regarde "À relancer" | Liste des clients inactifs > 15j (si any) |
| 2 | Clique "Voir le conseiller →" | Écran "Conseils" |
| 3 | Parcours les cartes IA | Affichent risques/priorités + v2 disclaimer |
| 4 | Reviens à Dashboard | KPIs affichés : Clients, Overdue, Devis 30j, CA 30j |
| 5 | Clients → Recherche "test" | Filtre les clients contenant "test" (ou "zone") |
| 6 | Clients → Stage "Prospect" | Affiche seulement les prospects |
| 7 | Clients → Stage "Client" | Affiche seulement les clients |
| 8 | Reset à "Tous" | Tous les 1006 clients réapparaissent |

**Conditions de passage** ✓
- [ ] KPIs recalculés après ajout de données
- [ ] Recherche cas-insensitive
- [ ] Filtres par stage fonctionnels
- [ ] "À relancer" identifie bien les clients > 15j inactifs

---

## ✅ Scénario 5 : Paramètres, changement PIN, déconnexion

**Durée estimée** : 2 min  
**Compte** : N'importe lequel

| Étape | Action | ✓ Résultat attendu |
|---|---|---|
| 1 | Nav → "Réglages" | Écran avec Espace + Code d'invitation + Email |
| 2 | Regarde l'email connecté | Affiche l'e-mail utilisé pour login |
| 3 | Regarde le code d'invitation | Affiche le code pour inviter (si orga créée) |
| 4 | Clique "Changer le code PIN" | Écran "Créez votre code PIN" |
| 5 | Tape 4 nouveaux chiffres (ex: "2222") | Nouveau PIN accepté |
| 6 | Reviens à Réglages → "Se déconnecter" | Reviens à écran "Connexion à MAYELA CRM" |
| 7 | Re-tape l'e-mail, reçois le code, le rentre | Back au lock screen |
| 8 | Tape le NOUVEAU PIN ("2222") | Accès accordé |

**Conditions de passage** ✓
- [ ] PIN changeable sans créer nouveau compte
- [ ] Ancienne PIN ne marche plus après changement
- [ ] Logout efface la session Supabase
- [ ] Login après logout redemande email/code/PIN

---

## 🏁 Récapitulatif

| Scénario | Objectif | Status | Notes |
|---|---|---|---|
| 1 | Onboarding + créer org | ⬜ À tester | Vérifie OTP et PIN persistance |
| 2 | Rejoindre org existante | ⬜ À tester | Simule un nouvel employé |
| 3 | CRUD clients + interactions | ⬜ À tester | Le cœur métier — bien valider |
| 4 | Filtres + KPIs + IA | ⬜ À tester | Montre la valeur de l'app |
| 5 | Paramètres + PIN + logout | ⬜ À tester | Sécurité et UX de session |

---

## ⏰ Timeline suggérée (9 jours)

| Jour | Tâche | Priorité |
|---|---|---|
| **J0 (16 juil)** | Lancer en local, Vercel deploy | 🔴 CRITIQUE |
| **J1-2** | Scénario 1 (onboarding) | 🔴 CRITIQUE |
| **J3-4** | Scénario 2 (rejoindre orga) | 🟠 Haute |
| **J5-6** | Scénario 3 (CRUD) | 🔴 CRITIQUE |
| **J7-8** | Scénarios 4-5 + retouches | 🟠 Haute |
| **J9 (25 juil)** | Rehearsal complet + démo live | 🔴 CRITIQUE |

---

## 🐛 Checklist de blockers connus

Avant de démarrer les tests, vérifie que tu n'as PAS ces soucis :

| Problème | Diagnostic | Fix |
|---|---|---|
| "Failed to fetch" | Ouvre en `file://`, pas de serveur | `npx http-server` |
| Code OTP jamais arrive | E-mail blocke Supabase, ou spam | Ajoute `noreply@mail.supabase.io` aux contacts |
| KPIs affichent "–" | Pas de données ou requête bloquée par RLS | Vérifie que le client appartient à ton org |
| Recherche clients ne filtre pas | Bug JS ou données mal formées | Console (F12) → cherche erreurs JS |
| PIN ne se sauvegarde pas | Trigger set_pin non exécuté | Vérifie que profile.pin_hash est NULL avant création |

---

## 📋 Questions à poser en démo (prépare tes réponses)

1. **"Combien de clients ça supporte?"** → 1000+ sans souci, Supabase scale automatiquement
2. **"C'est sécurisé? Mes données?"** → OTP + PIN local, RLS Supabase, données chiffrées en transit
3. **"Combien ça coûte?"** → Supabase Free tier actuellement, upgrade à ~$25/mois si vraiment scale
4. **"Je peux l'utiliser en offline?"** → Non, nécessite connexion. V2 envisagé.
5. **"Ça se connecte à WhatsApp/Gmail/TikTok?"** → V1 : juste données saisies. V2 : intégrations Make.com planifiées

---

**Bon courage. T'as le code clé-en-main. Reporte tout bug en console (F12 → Console & Network).**
