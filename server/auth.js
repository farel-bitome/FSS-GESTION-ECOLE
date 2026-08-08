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

// Cree (ou migre) le compte super admin protege : BITOME / Chrisrelamour24@.
// - Si BITOME existe deja : ne touche a rien.
// - Si un ancien super admin existe sous un autre nom (ex: 'admin' cree par une
//   version precedente) : le renomme en BITOME et applique le nouveau mot de passe.
// - Sinon : cree le compte BITOME.
function ensureSuperAdmin() {
  const LOGIN = 'BITOME';
  const MDP = 'Chrisrelamour24@.';

  const existant = db.prepare(`SELECT * FROM utilisateurs WHERE nom_utilisateur = ?`).get(LOGIN);
  if (existant) return;

  const ancienSuperAdmin = db.prepare(`SELECT * FROM utilisateurs WHERE role = 'super_admin' AND proteger = 1`).get();
  const hash = hashPassword(MDP);

  if (ancienSuperAdmin) {
    db.prepare(`UPDATE utilisateurs SET nom_utilisateur = ?, mot_de_passe_hash = ? WHERE id = ?`)
      .run(LOGIN, hash, ancienSuperAdmin.id);
    console.log(`[auth] Compte super admin migre vers "${LOGIN}".`);
  } else {
    db.prepare(`
      INSERT INTO utilisateurs (nom_utilisateur, nom_complet, mot_de_passe_hash, role, actif, proteger)
      VALUES (?, ?, ?, 'super_admin', 1, 1)
    `).run(LOGIN, 'Farel Bitome (Super Admin)', hash);
    console.log(`[auth] Super admin "${LOGIN}" cree.`);
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

// Cree un compte admin simple (non protege) : admin / admin.
// Sert de compte de depart en plus du super admin BITOME.
function ensureAdminAccount() {
  const LOGIN = 'admin';
  const existant = db.prepare(`SELECT id FROM utilisateurs WHERE nom_utilisateur = ?`).get(LOGIN);
  if (existant) return;

  const hash = hashPassword('admin');
  db.prepare(`
    INSERT INTO utilisateurs (nom_utilisateur, nom_complet, mot_de_passe_hash, role, actif, proteger)
    VALUES (?, ?, ?, 'admin', 1, 0)
  `).run(LOGIN, 'Administrateur', hash);
  console.log('[auth] Compte "admin" (role admin, mot de passe "admin") cree.');
}

module.exports = { hashPassword, verifyPassword, ensureSuperAdmin, ensureAdminAccount, login, requireAuth, requireRole };
