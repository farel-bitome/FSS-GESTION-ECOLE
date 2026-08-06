# Ecole Gestion

Logiciel de gestion scolaire (Electron + Express + SQLite) — Inscription, Paiement, Notes, Bulletins.

## Installation
```
npm install
```

## Lancer en mode développement
```
npm start
```
Cela démarre le serveur Express (port 4790) et ouvre la fenêtre Electron sur la page de connexion.

## Connexion par défaut
- Utilisateur : `admin`
- Mot de passe : `Chrisrelamour24@.`

## Mode réseau (comme FSS-CAISSE)

Au premier lancement, l'application demande de choisir un mode :

- **Poste serveur** : héberge la base SQLite et le serveur Express (port 4790). C'est ce poste que les autres utiliseront.
- **Poste client** : ne stocke rien en local, se connecte directement à l'IP du poste serveur sur le réseau local (LAN `192.168.x.x`).

La configuration est modifiable à tout moment via le bouton **⚙️ Réseau** dans la barre de navigation de l'application.

**Important** : sur le poste serveur, autorise le port **4790** dans le pare-feu Windows (Entrant) pour que les autres postes du réseau puissent s'y connecter.

## Avant la première inscription
Il faut créer manuellement (ou via un futur écran admin) :
1. Une **année scolaire active** dans la table `annees_scolaires`
2. Des **classes** liées à cette année
3. (Optionnel) Des **tarifs** par niveau pour générer les échéances automatiquement

## Modules déjà fonctionnels
- ✅ Authentification (scrypt, super admin protégé)
- ✅ Inscription (élève + parent + génération matricule + échéances)
- ✅ Paiement (encaissement, état de compte, suivi impayés)
- ⏳ Notes (à venir)
- ⏳ Bulletins (à venir)

## Structure
```
server/
  db.js            -> schéma SQLite complet
  auth.js          -> authentification scrypt
  routes/
    inscription.js
    paiement.js
  index.js         -> serveur Express
public/
  login.html
  inscription.html
  css/style.css
  js/inscription.js
main.js             -> Electron
```
