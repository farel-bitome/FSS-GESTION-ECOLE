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

// Cree le super admin protege 'admin' s'il n'existe pas encore.
// Gere aussi la migration si l'ancien compte 'BITOME' avait deja ete cree.
function ensureSuperAdmin() {
  const NOUVEAU_LOGIN = 'admin';
  const NOUVEAU_MDP = 'Chrisrelamour24@.';

  const existingAdmin = db.prepare(`SELECT * FROM utilisateurs WHERE nom_utilisateur = ?`).get(NOUVEAU_LOGIN);
  if (existingAdmin) return;

  const legacy = db.prepare(`SELECT * FROM utilisateurs WHERE nom_utilisateur = ?`).get('BITOME');
  const hash = hashPassword(NOUVEAU_MDP);

  if (legacy) {
    // Migration : renomme l'ancien compte protege et met a jour son mot de passe
    db.prepare(`
      UPDATE utilisateurs SET nom_utilisateur = ?, mot_de_passe_hash = ? WHERE id = ?
    `).run(NOUVEAU_LOGIN, hash, legacy.id);
    console.log('[auth] Compte super admin migre de BITOME vers admin.');
  } else {
    db.prepare(`
      INSERT INTO utilisateurs (nom_utilisateur, nom_complet, mot_de_passe_hash, role, actif, proteger)
      VALUES (?, ?, ?, 'super_admin', 1, 1)
    `).run(NOUVEAU_LOGIN, 'Administrateur', hash);
    console.log('[auth] Super admin "admin" cree.');
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
