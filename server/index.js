const express = require('express');
const path = require('path');
const cookieSession = require('cookie-session');
const db = require('./db');
const { ensureSuperAdmin, login, requireAuth } = require('./auth');

const inscriptionRoutes = require('./routes/inscription');
const paiementRoutes = require('./routes/paiement');

const app = express();
const PORT = process.env.PORT || 4790;

ensureSuperAdmin();

app.use(express.json());

// CORS minimal : necessaire pour que l'ecran "connexion au serveur" (charge en local
// sur les postes clients) puisse verifier /api/moi avant de rediriger vers le serveur.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

app.use(cookieSession({
  name: 'ecole_session',
  keys: ['change-this-secret-key-fss'], // A generer aleatoirement en production
  maxAge: 12 * 60 * 60 * 1000 // 12h
}));

// ---- SANTE (route publique, sert a tester la connexion depuis un poste client) ----
app.get('/api/health', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.json({ status: 'ok', app: 'ecole-gestion' });
});

// ---- AUTH ----
app.post('/api/login', (req, res) => {
  const { nom_utilisateur, mot_de_passe } = req.body;
  const user = login(nom_utilisateur, mot_de_passe);
  if (!user) return res.status(401).json({ error: 'Identifiants invalides' });

  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.nomComplet = user.nom_complet;

  res.json({ success: true, user });
});

app.post('/api/logout', (req, res) => {
  req.session = null;
  res.json({ success: true });
});

app.get('/api/moi', (req, res) => {
  if (!req.session || !req.session.userId) return res.status(401).json({ error: 'Non connecte' });
  res.json({ id: req.session.userId, role: req.session.role, nomComplet: req.session.nomComplet });
});

// ---- MODULES (proteges par authentification) ----
app.use('/api/inscription', requireAuth, inscriptionRoutes);
app.use('/api/paiement', requireAuth, paiementRoutes);

// ---- FICHIERS STATIQUES (frontend) ----
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`[serveur] Ecole Gestion demarre sur http://localhost:${PORT}`);
});
