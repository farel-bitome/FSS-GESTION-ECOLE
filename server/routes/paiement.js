const express = require('express');
const router = express.Router();
const db = require('../db');

function genererNumeroRecu() {
  const now = new Date();
  const stamp = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
  const count = db.prepare(`SELECT COUNT(*) as n FROM paiements WHERE numero_recu LIKE ?`).get(`REC-${stamp}-%`);
  return `REC-${stamp}-${String(count.n + 1).padStart(4, '0')}`;
}

// Etat de compte d'un eleve (echeances + paiements)
router.get('/etat-compte/:inscriptionId', (req, res) => {
  const echeances = db.prepare(`
    SELECT * FROM echeances WHERE inscription_id = ? ORDER BY id
  `).all(req.params.inscriptionId);

  const paiements = db.prepare(`
    SELECT p.*, u.nom_complet as encaisse_par
    FROM paiements p
    LEFT JOIN utilisateurs u ON u.id = p.utilisateur_id
    WHERE p.inscription_id = ?
    ORDER BY p.date_paiement DESC
  `).all(req.params.inscriptionId);

  const totalDu = echeances.reduce((s, e) => s + e.montant_du, 0);
  const totalPaye = paiements.reduce((s, p) => s + p.montant, 0);

  res.json({ echeances, paiements, totalDu, totalPaye, solde: totalDu - totalPaye });
});

// Enregistrer un paiement (surtout: especes, airtel_money, moov_money)
router.post('/encaisser', (req, res) => {
  const { echeance_id, inscription_id, montant, mode_paiement, reference_transaction, utilisateur_id } = req.body;

  if (!inscription_id || !montant || !mode_paiement) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }

  const transaction = db.transaction(() => {
    const numeroRecu = genererNumeroRecu();

    const result = db.prepare(`
      INSERT INTO paiements (echeance_id, inscription_id, montant, mode_paiement, reference_transaction, numero_recu, utilisateur_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(echeance_id || null, inscription_id, montant, mode_paiement, reference_transaction || null, numeroRecu, utilisateur_id || null);

    // Met a jour le statut de l'echeance concernee si fournie
    if (echeance_id) {
      const echeance = db.prepare(`SELECT * FROM echeances WHERE id = ?`).get(echeance_id);
      const totalPayeEcheance = db.prepare(`
        SELECT COALESCE(SUM(montant),0) as total FROM paiements WHERE echeance_id = ?
      `).get(echeance_id).total;

      let statut = 'partielle';
      if (totalPayeEcheance >= echeance.montant_du) statut = 'payee';
      if (totalPayeEcheance <= 0) statut = 'impayee';

      db.prepare(`UPDATE echeances SET statut = ? WHERE id = ?`).run(statut, echeance_id);
    }

    return { paiementId: result.lastInsertRowid, numeroRecu };
  });

  try {
    const result = transaction();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement du paiement', details: err.message });
  }
});

// Liste des impayes (pour relances)
router.get('/impayes', (req, res) => {
  const impayes = db.prepare(`
    SELECT e.libelle as echeance_libelle, e.montant_du, e.statut,
           el.nom, el.prenom, el.matricule,
           c.nom as classe_nom,
           p.nom_complet as parent_nom, p.telephone as parent_telephone
    FROM echeances e
    JOIN inscriptions i ON i.id = e.inscription_id
    JOIN eleves el ON el.id = i.eleve_id
    JOIN classes c ON c.id = i.classe_id
    LEFT JOIN parents p ON p.id = el.parent1_id
    WHERE e.statut != 'payee'
    ORDER BY c.nom, el.nom
  `).all();
  res.json(impayes);
});

module.exports = router;
