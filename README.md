# Techno — App d'abonnements digitaux partagés

App indépendante en deux volets :
- **/admin** — toi : crée les services, ajoute les emails (comptes payés), gère rappels, dépenses, bilan.
- **/app** — le client : télécharge, crée son profil, s'abonne à un service (compte auto-attribué), reçoit ses notifs, discute avec l'assistant IA.

Stack : React + Vite + Firebase (Auth + Firestore) + Cloudinary (images) — **pas de Cloud Functions**, toute la logique planifiée (expiration, rappels, bilan mensuel) tourne côté client au chargement de l'app, avec un throttle en `localStorage` pour ne pas la relancer à chaque rendu.

---

## 1. Installation

```bash
npm install
cp .env.example .env
```

Remplis `.env` avec :
- tes identifiants **Firebase** (Console Firebase > Paramètres du projet)
- ton **Cloudinary** (`Cloud Name` + un `Upload Preset` en mode **Unsigned**, à créer dans Cloudinary > Settings > Upload)
- ta clé **Anthropic** (console.anthropic.com) pour l'assistant IA — voir l'avertissement sécurité plus bas

Pour activer les paiements, configure aussi le serveur séparément :

```bash
cd server
npm install
cp .env.example .env
```

Renseigne dans `server/.env` le compte de service Firebase, les clés CinetPay et `BASE_URL`.

```bash
npm run dev
```

---

## 2. Configuration Firebase (une seule fois)

1. Crée un projet sur console.firebase.google.com
2. Active **Authentication > Email/Password**
3. Active **Firestore Database** (mode production)
4. Déploie les règles de sécurité fournies :
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init firestore   # choisis ton projet, garde firestore.rules
   firebase deploy --only firestore:rules
   ```
5. Crée ton premier compte admin :
   - Dans Firebase Auth, crée manuellement un utilisateur (email/mdp) **ou** inscris-toi via `/app` puis change son rôle
   - Dans Firestore, crée un document dans la collection `admins` avec pour ID le **UID** de cet utilisateur, contenant : `{ name: "Ton nom", role: "super_admin" }`

---

## 3. Diagnostic : "problème d'inscription service ou email non fonctionnel"

Les causes les plus fréquentes dans ce genre de flux :

1. **Règles Firestore trop strictes ou pas déployées** → `addDoc` échoue silencieusement en console (erreur `permission-denied`). Vérifie la console navigateur (F12).
2. **`serviceId` non disponible avant l'ajout de l'email** → dans ce code, `Services.jsx` attend que tu cliques sur un service déjà créé (`serviceOuvert`) avant d'autoriser l'ajout d'un email ; l'ID est donc garanti disponible.
3. **`onSnapshot` mal formé** → ici on écoute la collection en temps réel dès le montage du composant, donc toute création apparaît immédiatement sans besoin de rafraîchir.
4. **Utilisateur non authentifié au moment de l'écriture** → le code vérifie `auth.currentUser` avant chaque écriture et affiche un toast d'erreur clair si la session a expiré.

Si le problème persiste après avoir branché ce code, ouvre la console développeur (F12 > Console) pendant l'action et regarde le message d'erreur exact — il indique presque toujours "permission-denied" (→ règles) ou un message Firebase précis.

---

## 4. Slots (5 abonnés max par email)

Géré dans `src/lib/slotManager.js` :
- `trouverEmailDisponible(serviceId)` cherche un email du service avec `slotsOccupes < 5`
- `abonnerClient(...)` réserve le slot dans une **transaction Firestore** (évite que 2 clients prennent le même slot en même temps)
- `libererSlot(emailId)` décrémente le compteur à la suppression/remplacement d'un abonné

---

## 5. Automatisations (sans Cloud Functions)

Tout tourne dans `src/lib/expirationChecker.js` et `src/lib/monthlyReport.js`, déclenché au montage de `AdminLayout` et `ClientLayout`, throttlé à 1x/heure (`localStorage`) :

- Abonnés actifs expirés → passés `Inactif` + notif admin + notif client
- Rappels J-7 à J-0 → notif admin + notif client
- Inactifs depuis **plus de 7 jours** → notif admin "slot à libérer"
- Inactifs depuis **30 jours** → suppression automatique + libération du slot
- Bilan du mois précédent → archivé automatiquement dans `history` à la première ouverture admin du mois suivant

**Limite à connaître** : si personne n'ouvre l'app un jour donné, les vérifications de ce jour-là ne tournent pas — elles se rattrapent à la prochaine ouverture. Si tu veux une vraie exécution garantie chaque jour à heure fixe sans dépendre d'une ouverture d'app, la seule option fiable reste un déclencheur planifié externe (Cloud Scheduler + Cloud Function, ou cron-job.org + une petite route serverless) — actuellement volontairement exclu de ce projet.

---

## 6. Assistant IA (chat client)

Dans `src/lib/claudeChat.js`. ⚠️ **Avertissement sécurité** : l'appel à l'API Claude se fait directement depuis le navigateur (pas de backend), donc **ta clé API est visible** dans le code livré au client — n'importe qui peut l'extraire et l'utiliser à tes frais, sans limite. C'est acceptable pour tester, risqué pour du volume réel.

Solution recommandée avant mise en prod : déploie `server/chat-proxy.js` sur **Vercel** (gratuit, ce n'est pas une Cloud Function Firebase) pour cacher la clé — instructions en haut du fichier.

---

## 7. Paiement (mobile money / carte)

Le code actuel simule le paiement (`Catalogue.jsx`, bouton "Payer et activer" déclenche directement `abonnerClient`). Pour un vrai système :
- **CinetPay** ou **FedaPay** (les deux fonctionnent au Burkina Faso, cartes + mobile money — Stripe n'est pas disponible dans la zone)
- Flux correct : ouvrir leur widget → attendre le **callback/webhook de succès** → **seulement à ce moment** appeler `abonnerClient()`. Ne jamais activer avant confirmation du paiement, sinon tu perds le contrôle du slot.

---

## 8. ⚠️ Point d'attention business (pas technique)

Revendre l'accès à des comptes payés individuellement (Netflix, ChatGPT/Claude, CapCut...) via un seul email violé les conditions d'utilisation de la plupart de ces services. Ce n'est généralement pas un problème pénal, mais le risque opérationnel est réel : comptes suspendus sans préavis par le fournisseur, prestataires de paiement (CinetPay/FedaPay) qui peuvent bloquer un compte marchand si le pattern de transactions est détecté comme du partage de compte. Prévois une marge pour absorber les comptes perdus (remboursement, remplacement rapide) — le flux "Remplacer / Suppr." dans Rappels sert justement à ça.

---

## 9. Déploiement

```bash
npm run build
firebase deploy --only hosting   # après firebase init hosting, dossier "dist"
```

---

## 10. Arborescence

```
techno-app/
  src/
    firebase.js              # config Firebase
    context/AuthContext.jsx  # login/signup, détection rôle admin/client
    api/
      payment.js             # appels au serveur de paiement
    lib/
      slotManager.js         # attribution/libération des slots (5 max/email)
      expirationChecker.js   # expiration, rappels, retards, suppression 30j
      monthlyReport.js       # bilan mensuel auto + manuel
      notifications.js       # création/lecture des notifs
      claudeChat.js          # assistant IA
      cloudinary.js          # upload logos/images
      journal.js             # journal d'activité
    admin/                   # Dashboard, Services, Rappels, Paiements, Dépenses, Historique, Journal
    client/                  # AuthPage, Catalogue, Paiement, MonProfil, Notifications, Chat
  server/
    index.js                 # API Express de paiement
    chat-proxy.js            # proxy optionnel (Vercel) pour cacher la clé Claude
    package.json             # dépendances du serveur
    .env.example             # variables du serveur (sans secret)
  firestore.rules
```
