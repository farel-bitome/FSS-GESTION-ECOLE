const express = require('express');
const router = express.Router();
const db = require('../db');
const { hashPassword } = require('../auth');

// Liste des utilisateurs (sans le hash du mot de passe)
router.get('/', (req, res) => {
  const utilisateurs = db.prepare(`
    SELECT id, nom_utilisateur, nom_complet, role, actif, proteger, date_creation
    FROM utilisateurs ORDER BY id
  `).all();
  res.json(utilisateurs);
});

// Creer un utilisateur
router.post('/', (req, res) => {
  const { nom_utilisateur, nom_complet, mot_de_passe, role } = req.body;
  const rolesValides = ['admin', 'secretariat', 'comptable', 'enseignant'];

  if (!nom_utilisateur || !nom_complet || !mot_de_passe || !role) {
    return res.status(400).json({ error: 'Tous les champs sont obligatoires' });
  }
  if (!rolesValides.includes(role)) {
    return res.status(400).json({ error: 'Rôle invalide' });
  }

  const existant = db.prepare(`SELECT id FROM utilisateurs WHERE nom_utilisateur = ?`).get(nom_utilisateur);
  if (existant) {
    return res.status(400).json({ error: 'Ce nom d\'utilisateur existe déjà' });
  }

  try {
    const hash = hashPassword(mot_de_passe);
    const result = db.prepare(`
      INSERT INTO utilisateurs (nom_utilisateur, nom_complet, mot_de_passe_hash, role, actif, proteger)
      VALUES (?, ?, ?, ?, 1, 0)
    `).run(nom_utilisateur, nom_complet, hash, role);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la création', details: err.message });
  }
});

// Activer / desactiver un compte
router.post('/:id/toggle-actif', (req, res) => {
  const user = db.prepare(`SELECT * FROM utilisateurs WHERE id = ?`).get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  if (user.proteger) return res.status(400).json({ error: 'Ce compte est protégé et ne peut pas être désactivé' });

  db.prepare(`UPDATE utilisateurs SET actif = ? WHERE id = ?`).run(user.actif ? 0 : 1, req.params.id);
  res.json({ success: true });
});

// Reinitialiser le mot de passe d'un utilisateur
router.post('/:id/reset-password', (req, res) => {
  const { mot_de_passe } = req.body;
  if (!mot_de_passe) return res.status(400).json({ error: 'Nouveau mot de passe requis' });

  const hash = hashPassword(mot_de_passe);
  db.prepare(`UPDATE utilisateurs SET mot_de_passe_hash = ? WHERE id = ?`).run(hash, req.params.id);
  res.json({ success: true });
});

// Supprimer un utilisateur (jamais un compte protege)
router.delete('/:id', (req, res) => {
  const user = db.prepare(`SELECT * FROM utilisateurs WHERE id = ?`).get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  if (user.proteger) return res.status(400).json({ error: 'Ce compte est protégé et ne peut pas être supprimé' });

  db.prepare(`DELETE FROM utilisateurs WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
