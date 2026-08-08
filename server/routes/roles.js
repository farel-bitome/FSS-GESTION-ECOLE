const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  const roles = db.prepare(`SELECT * FROM roles ORDER BY systeme DESC, nom`).all();
  res.json(roles);
});

router.post('/', (req, res) => {
  const { nom, description } = req.body;
  if (!nom) return res.status(400).json({ error: 'Le nom du rôle est obligatoire' });

  const existant = db.prepare(`SELECT id FROM roles WHERE nom = ?`).get(nom);
  if (existant) return res.status(400).json({ error: 'Ce rôle existe déjà' });

  try {
    const result = db.prepare(`INSERT INTO roles (nom, description, systeme) VALUES (?, ?, 0)`).run(nom, description || null);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la création', details: err.message });
  }
});

router.delete('/:id', (req, res) => {
  const role = db.prepare(`SELECT * FROM roles WHERE id = ?`).get(req.params.id);
  if (!role) return res.status(404).json({ error: 'Rôle introuvable' });
  if (role.systeme) return res.status(400).json({ error: 'Ce rôle est réservé au système et ne peut pas être supprimé' });

  const utilisateursLies = db.prepare(`SELECT COUNT(*) as n FROM utilisateurs WHERE role = ?`).get(role.nom);
  if (utilisateursLies.n > 0) {
    return res.status(400).json({ error: 'Impossible de supprimer : des utilisateurs ont ce rôle.' });
  }

  db.prepare(`DELETE FROM roles WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
