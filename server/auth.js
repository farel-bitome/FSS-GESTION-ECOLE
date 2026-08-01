const crypto = require('crypto');
const db = require('./db');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const hashBuffer = Buffer.from(hash, 'hex');
  const testHash = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(hashBuffer, testHash);
}

// Cree le super admin protege BITOME s'il n'existe pas encore
function ensureSuperAdmin() {
  const existing = db.prepare(`SELECT * FROM utilisateurs WHERE nom_utilisateur = ?`).get('BITOME');
  if (!existing) {
    const hash = hashPassword('ChangeMoi_2026!'); // A changer au premier lancement
    db.prepare(`
      INSERT INTO utilisateurs (nom_utilisateur, nom_complet, mot_de_passe_hash, role, actif, proteger)
      VALUES (?, ?, ?, 'super_admin', 1, 1)
    `).run('BITOME', 'Farel Bitome (Super Admin)', hash);
    console.log('[auth] Super admin BITOME cree. Mot de passe par defaut : ChangeMoi_2026! (a changer)');
  }
}

function login(nomUtilisateur, motDePasse) {
  const user = db.prepare(`SELECT * FROM utilisateurs WHERE nom_utilisateur = ? AND actif = 1`).get(nomUtilisateur);
  if (!user) return null;
  if (!verifyPassword(motDePasse, user.mot_de_passe_hash)) return null;
  const { mot_de_passe_hash, ...safeUser } = user;
  return safeUser;
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Non authentifie' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !roles.includes(req.session.role)) {
      return res.status(403).json({ error: 'Acces refuse' });
    }
    next();
  };
}

module.exports = { hashPassword, verifyPassword, ensureSuperAdmin, login, requireAuth, requireRole };
