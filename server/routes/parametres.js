const express = require('express');
const router = express.Router();
const db = require('../db');

// ===================
// ANNEES SCOLAIRES
// ===================
router.get('/annees', (req, res) => {
  const annees = db.prepare(`SELECT * FROM annees_scolaires ORDER BY id DESC`).all();
  res.json(annees);
});

router.post('/annees', (req, res) => {
  const { libelle, date_debut, date_fin, activer } = req.body;
  if (!libelle) return res.status(400).json({ error: 'Le libellé est obligatoire (ex: 2026-2027)' });

  const transaction = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO annees_scolaires (libelle, date_debut, date_fin, active)
      VALUES (?, ?, ?, 0)
    `).run(libelle, date_debut || null, date_fin || null);

    if (activer) {
      db.prepare(`UPDATE annees_scolaires SET active = 0`).run();
      db.prepare(`UPDATE annees_scolaires SET active = 1 WHERE id = ?`).run(result.lastInsertRowid);
    }
    return result.lastInsertRowid;
  });

  try {
    const id = transaction();
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la création', details: err.message });
  }
});

router.post('/annees/:id/activer', (req, res) => {
  const transaction = db.transaction(() => {
    db.prepare(`UPDATE annees_scolaires SET active = 0`).run();
    db.prepare(`UPDATE annees_scolaires SET active = 1 WHERE id = ?`).run(req.params.id);
  });
  try {
    transaction();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur', details: err.message });
  }
});

router.delete('/annees/:id', (req, res) => {
  const classesLiees = db.prepare(`SELECT COUNT(*) as n FROM classes WHERE annee_scolaire_id = ?`).get(req.params.id);
  if (classesLiees.n > 0) {
    return res.status(400).json({ error: 'Impossible de supprimer : des classes sont liées à cette année.' });
  }
  db.prepare(`DELETE FROM annees_scolaires WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

// ===================
// CLASSES
// ===================
router.get('/classes', (req, res) => {
  const { annee_id } = req.query;
  let anneeId = annee_id;
  if (!anneeId) {
    const active = db.prepare(`SELECT id FROM annees_scolaires WHERE active = 1`).get();
    anneeId = active ? active.id : null;
  }
  if (!anneeId) return res.json([]);

  const classes = db.prepare(`
    SELECT c.*, a.libelle as annee_libelle
    FROM classes c
    JOIN annees_scolaires a ON a.id = c.annee_scolaire_id
    WHERE c.annee_scolaire_id = ?
    ORDER BY c.niveau, c.nom
  `).all(anneeId);
  res.json(classes);
});

router.post('/classes', (req, res) => {
  const { nom, niveau, annee_scolaire_id } = req.body;
  if (!nom || !niveau || !annee_scolaire_id) {
    return res.status(400).json({ error: 'Nom, niveau et année scolaire sont obligatoires' });
  }
  try {
    const result = db.prepare(`
      INSERT INTO classes (nom, niveau, annee_scolaire_id) VALUES (?, ?, ?)
    `).run(nom, niveau, annee_scolaire_id);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la création', details: err.message });
  }
});

router.delete('/classes/:id', (req, res) => {
  const inscritsLies = db.prepare(`SELECT COUNT(*) as n FROM inscriptions WHERE classe_id = ?`).get(req.params.id);
  if (inscritsLies.n > 0) {
    return res.status(400).json({ error: 'Impossible de supprimer : des élèves sont inscrits dans cette classe.' });
  }
  db.prepare(`DELETE FROM classes WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

// ===================
// TARIFS
// ===================
router.get('/tarifs', (req, res) => {
  const { annee_id } = req.query;
  let anneeId = annee_id;
  if (!anneeId) {
    const active = db.prepare(`SELECT id FROM annees_scolaires WHERE active = 1`).get();
    anneeId = active ? active.id : null;
  }
  if (!anneeId) return res.json([]);

  const tarifs = db.prepare(`
    SELECT t.*, a.libelle as annee_libelle
    FROM tarifs t
    JOIN annees_scolaires a ON a.id = t.annee_scolaire_id
    WHERE t.annee_scolaire_id = ?
    ORDER BY t.niveau
  `).all(anneeId);
  res.json(tarifs);
});

router.post('/tarifs', (req, res) => {
  const { niveau, annee_scolaire_id, frais_inscription, frais_scolarite_total, nombre_tranches } = req.body;
  if (!niveau || !annee_scolaire_id || frais_scolarite_total == null) {
    return res.status(400).json({ error: 'Niveau, année scolaire et frais de scolarité sont obligatoires' });
  }
  try {
    const result = db.prepare(`
      INSERT INTO tarifs (niveau, annee_scolaire_id, frais_inscription, frais_scolarite_total, nombre_tranches)
      VALUES (?, ?, ?, ?, ?)
    `).run(niveau, annee_scolaire_id, frais_inscription || 0, frais_scolarite_total, nombre_tranches || 3);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la création', details: err.message });
  }
});

router.delete('/tarifs/:id', (req, res) => {
  db.prepare(`DELETE FROM tarifs WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
