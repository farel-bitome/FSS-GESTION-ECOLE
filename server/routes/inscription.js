const express = require('express');
const router = express.Router();
const db = require('../db');

// Genere un matricule automatique: ANNEE-XXXX
function genererMatricule() {
  const annee = new Date().getFullYear();
  const count = db.prepare(`SELECT COUNT(*) as n FROM eleves WHERE matricule LIKE ?`).get(`${annee}-%`);
  const numero = String(count.n + 1).padStart(4, '0');
  return `${annee}-${numero}`;
}

// Liste des classes actives (pour formulaire d'inscription)
router.get('/classes', (req, res) => {
  const classes = db.prepare(`
    SELECT c.*, a.libelle as annee_libelle
    FROM classes c
    JOIN annees_scolaires a ON a.id = c.annee_scolaire_id
    WHERE a.active = 1
    ORDER BY c.niveau, c.nom
  `).all();
  res.json(classes);
});

// Creer un eleve + parent(s) + inscription en une transaction
router.post('/nouvelle', (req, res) => {
  const { eleve, parent1, parent2, classe_id, type } = req.body;

  if (!eleve || !eleve.nom || !eleve.prenom || !classe_id) {
    return res.status(400).json({ error: 'Champs obligatoires manquants (nom, prenom, classe)' });
  }

  const anneeActive = db.prepare(`SELECT * FROM annees_scolaires WHERE active = 1`).get();
  if (!anneeActive) {
    return res.status(400).json({ error: 'Aucune annee scolaire active. Configurez-la avant inscription.' });
  }

  const transaction = db.transaction(() => {
    let parent1Id = null;
    let parent2Id = null;

    if (parent1 && parent1.nom_complet) {
      const r = db.prepare(`
        INSERT INTO parents (nom_complet, lien, telephone, email, adresse, profession)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(parent1.nom_complet, parent1.lien, parent1.telephone, parent1.email, parent1.adresse, parent1.profession);
      parent1Id = r.lastInsertRowid;
    }

    if (parent2 && parent2.nom_complet) {
      const r = db.prepare(`
        INSERT INTO parents (nom_complet, lien, telephone, email, adresse, profession)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(parent2.nom_complet, parent2.lien, parent2.telephone, parent2.email, parent2.adresse, parent2.profession);
      parent2Id = r.lastInsertRowid;
    }

    const matricule = genererMatricule();

    const eleveResult = db.prepare(`
      INSERT INTO eleves (matricule, nom, prenom, date_naissance, lieu_naissance, sexe, adresse, parent1_id, parent2_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      matricule, eleve.nom, eleve.prenom, eleve.date_naissance || null,
      eleve.lieu_naissance || null, eleve.sexe || null, eleve.adresse || null,
      parent1Id, parent2Id
    );

    const eleveId = eleveResult.lastInsertRowid;

    const inscriptionResult = db.prepare(`
      INSERT INTO inscriptions (eleve_id, classe_id, annee_scolaire_id, type)
      VALUES (?, ?, ?, ?)
    `).run(eleveId, classe_id, anneeActive.id, type || 'nouvelle');

    // Genere les echeances automatiquement si un tarif existe pour ce niveau
    const classe = db.prepare(`SELECT * FROM classes WHERE id = ?`).get(classe_id);
    const tarif = db.prepare(`
      SELECT * FROM tarifs WHERE niveau = ? AND annee_scolaire_id = ?
    `).get(classe.niveau, anneeActive.id);

    if (tarif) {
      const insEcheance = db.prepare(`
        INSERT INTO echeances (inscription_id, libelle, montant_du, date_echeance)
        VALUES (?, ?, ?, ?)
      `);
      if (tarif.frais_inscription > 0) {
        insEcheance.run(inscriptionResult.lastInsertRowid, 'Frais d\'inscription', tarif.frais_inscription, null);
      }
      const montantParTranche = tarif.frais_scolarite_total / tarif.nombre_tranches;
      for (let i = 1; i <= tarif.nombre_tranches; i++) {
        insEcheance.run(inscriptionResult.lastInsertRowid, `Tranche ${i}`, montantParTranche, null);
      }
    }

    return { eleveId, matricule, inscriptionId: inscriptionResult.lastInsertRowid };
  });

  try {
    const result = transaction();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l\'inscription', details: err.message });
  }
});

// Liste des eleves inscrits (avec filtre classe optionnel)
router.get('/liste', (req, res) => {
  const { classe_id } = req.query;
  let query = `
    SELECT e.*, i.id as inscription_id, i.type, i.date_inscription, i.statut,
           c.nom as classe_nom, c.niveau
    FROM eleves e
    JOIN inscriptions i ON i.eleve_id = e.id
    JOIN classes c ON c.id = i.classe_id
    JOIN annees_scolaires a ON a.id = i.annee_scolaire_id
    WHERE a.active = 1
  `;
  const params = [];
  if (classe_id) {
    query += ` AND c.id = ?`;
    params.push(classe_id);
  }
  query += ` ORDER BY e.nom, e.prenom`;
  res.json(db.prepare(query).all(...params));
});

// Fiche detaillee d'un eleve
router.get('/eleve/:id', (req, res) => {
  const eleve = db.prepare(`SELECT * FROM eleves WHERE id = ?`).get(req.params.id);
  if (!eleve) return res.status(404).json({ error: 'Eleve introuvable' });

  eleve.parent1 = eleve.parent1_id ? db.prepare(`SELECT * FROM parents WHERE id = ?`).get(eleve.parent1_id) : null;
  eleve.parent2 = eleve.parent2_id ? db.prepare(`SELECT * FROM parents WHERE id = ?`).get(eleve.parent2_id) : null;
  eleve.inscriptions = db.prepare(`
    SELECT i.*, c.nom as classe_nom, a.libelle as annee_libelle
    FROM inscriptions i
    JOIN classes c ON c.id = i.classe_id
    JOIN annees_scolaires a ON a.id = i.annee_scolaire_id
    WHERE i.eleve_id = ?
    ORDER BY i.date_inscription DESC
  `).all(req.params.id);

  res.json(eleve);
});

module.exports = router;
