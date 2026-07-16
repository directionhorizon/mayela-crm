# MAYELA CRM — Guide de démonstration
**Présentation du 25 juillet 2026**

---

## Objectif de la démo

Montrer que MAYELA CRM résout un problème concret : les PME de Pointe-Noire perdent le fil de leurs clients (relances oubliées, pas d'historique, pas de visibilité sur le pipeline). En 8-10 minutes, montrer le parcours complet : connexion → vue d'ensemble → fiche client → action.

---

## Avant de démarrer (checklist technique)

- [ ] URL Vercel ouverte et testée (pas de `file://`, pas de local en direct)
- [ ] Compte de démo déjà connecté (évite d'attendre l'e-mail OTP en live)
- [ ] PIN déjà configuré et mémorisé
- [ ] Connexion internet stable testée sur le lieu de la présentation
- [ ] Un client de secours pré-créé avec des données réalistes (nom local, quartier réel de Pointe-Noire)
- [ ] Zoom navigateur réglé pour lisibilité (Cmd/Ctrl + si besoin)

**Recommandation** : connecte-toi et déverrouille l'app 5 minutes avant de monter sur scène. Ne fais pas la démo OTP en direct — trop dépendant de la latence e-mail.

---

## Trame de démo (8-10 min)

### 1. Ouverture (30 sec)
"MAYELA CRM, c'est l'outil qui garde le fil de chaque client — pour les PME qui n'ont ni le temps ni le budget d'un CRM lourd."

### 2. Dashboard (1 min)
- Montre les KPIs : clients actifs, tâches en retard, devis du mois, chiffre d'affaires
- Montre la section "À relancer" : "L'app identifie elle-même les clients qu'on est en train de perdre de vue"

### 3. Liste clients (1-2 min)
- Filtre par étape (Prospect → Fidèle)
- Recherche par nom ou quartier
- "1000+ clients, zéro ralentissement"

### 4. Fiche client (3 min) — **le cœur de la démo**
- Ouvre un client existant avec historique
- Montre les 4 onglets : Interactions, Achats, Tâches, Devis
- **Live** : ajoute une interaction ("Appel — a confirmé le rendez-vous")
- **Live** : ajoute une tâche avec échéance
- Bouton WhatsApp / Appeler direct depuis la fiche

### 5. Créer un client (1-2 min)
- Montre le formulaire simple (nom, quartier, téléphone, étape)
- Insiste sur la rapidité : moins de 15 secondes pour ajouter un client sur le terrain

### 6. Conseils (1 min)
- Montre l'écran "Conseils" : détection automatique des clients à risque de décrochage
- Sois honnête : "V1 s'appuie sur vos données internes uniquement — pas de données externes encore, pour rester fiable"

### 7. Clôture (30 sec)
"Le tout tourne sur une infrastructure qui scale automatiquement, sécurisée, pensée pour le terrain congolais — connexions mobiles, usage rapide."

---

## Questions probables et réponses préparées

| Question | Réponse |
|---|---|
| Combien ça coûte ? | Actuellement Free tier Supabase, montée en charge prévue ~$25/mois pour la structure serveur — prix final à définir selon le nombre d'utilisateurs |
| C'est sécurisé ? | Connexion sans mot de passe (code à usage unique par e-mail) + verrouillage PIN local + isolation stricte des données par entreprise |
| Ça marche hors ligne ? | Pas en V1 — nécessite une connexion. Le mode hors-ligne est une piste V2 |
| Intégration WhatsApp Business / téléphonie ? | Prévu en V2 — la fiche client a déjà les boutons d'appel/WhatsApp direct en V1 |
| Combien de temps pour déployer chez un client ? | Quelques jours — le plus long, c'est la reprise des données existantes (Excel, carnets) |
| Qui a accès aux données ? | Uniquement les membres invités dans l'organisation — isolation totale entre entreprises clientes |

---

## Plan B (si le réseau lâche pendant la démo)

1. Avoir des captures d'écran des écrans clés en backup (dashboard, fiche client, conseils)
2. Enregistrer une vidéo de 2 min du parcours complet en amont, à lancer si besoin
3. Rester posé — dire simplement "connexion capricieuse, je continue sur les captures" et enchaîner

---

## Après la démo

- Recueillir les retours à froid (pas en pleine présentation)
- Noter les questions sans réponse immédiate pour préparer un suivi écrit
- Ne pas sur-promettre sur les délais de fonctionnalités V2
