const express = require('express');
const router = express.Router();
const db = require('../db');

function genererMatricule(prefixeAnnee) {
  const count = db.prepare(`SELECT COUNT(*) as n FROM eleves WHERE matricule LIKE ?`).get(`${prefixeAnnee}-%`);
  return `${prefixeAnnee}-${String(count.n + 1).padStart(4, '0')}`;
}

function genererNumeroRecu(index) {
  const now = new Date();
  const stamp = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
  const count = db.prepare(`SELECT COUNT(*) as n FROM paiements WHERE numero_recu LIKE ?`).get(`REC-${stamp}-%`);
  return `REC-${stamp}-${String(count.n + 1 + index).padStart(4, '0')}`;
}

// Genere une annee scolaire de demo, des classes, des tarifs et des eleves
// avec des statuts de paiement varies (impaye / partiel / solde en totalite),
// pour demontrer le suivi complet jusqu'au paiement annuel.
router.post('/generer', (req, res) => {
  const transaction = db.transaction(() => {
    // 1) Annee scolaire de demo (activee)
    const libelleAnnee = 'DEMO 2026-2027';
    let annee = db.prepare(`SELECT * FROM annees_scolaires WHERE libelle = ?`).get(libelleAnnee);
    if (!annee) {
      const r = db.prepare(`
        INSERT INTO annees_scolaires (libelle, date_debut, date_fin, active)
        VALUES (?, '2026-09-01', '2027-06-30', 0)
      `).run(libelleAnnee);
      annee = { id: r.lastInsertRowid };
    }
    db.prepare(`UPDATE annees_scolaires SET active = 0`).run();
    db.prepare(`UPDATE annees_scolaires SET active = 1 WHERE id = ?`).run(annee.id);

    // 2) Classes de demo
    const classesDefinies = [
      { nom: 'CP1 A (Démo)', niveau: 'CP1' },
      { nom: 'CM2 A (Démo)', niveau: 'CM2' },
      { nom: '6ème A (Démo)', niveau: '6eme' }
    ];
    const classeIds = {};
    for (const c of classesDefinies) {
      let classe = db.prepare(`SELECT * FROM classes WHERE nom = ? AND annee_scolaire_id = ?`).get(c.nom, annee.id);
      if (!classe) {
        const r = db.prepare(`INSERT INTO classes (nom, niveau, annee_scolaire_id) VALUES (?, ?, ?)`).run(c.nom, c.niveau, annee.id);
        classe = { id: r.lastInsertRowid };
      }
      classeIds[c.niveau] = classe.id;
    }

    // 3) Tarifs par niveau
    const tarifsDefinis = [
      { niveau: 'CP1', frais_inscription: 40000, frais_scolarite_total: 480000, nombre_tranches: 3 },
      { niveau: 'CM2', frais_inscription: 45000, frais_scolarite_total: 540000, nombre_tranches: 3 },
      { niveau: '6eme', frais_inscription: 50000, frais_scolarite_total: 600000, nombre_tranches: 3 }
    ];
    for (const t of tarifsDefinis) {
      const existant = db.prepare(`SELECT id FROM tarifs WHERE niveau = ? AND annee_scolaire_id = ?`).get(t.niveau, annee.id);
      if (!existant) {
        db.prepare(`
          INSERT INTO tarifs (niveau, annee_scolaire_id, frais_inscription, frais_scolarite_total, nombre_tranches)
          VALUES (?, ?, ?, ?, ?)
        `).run(t.niveau, annee.id, t.frais_inscription, t.frais_scolarite_total, t.nombre_tranches);
      }
    }

    // 4) Eleves de demo : 2 par classe, avec 3 profils de paiement differents
    //    - Profil "solde" : toutes les echeances payees (suivi complet jusqu'au paiement annuel)
    //    - Profil "partiel" : inscription + 1ere tranche payees seulement
    //    - Profil "impaye" : aucune echeance payee
    const elevesDefinis = [
      { nom: 'MOUSSAVOU', prenom: 'Junior', niveau: 'CP1', profil: 'solde' },
      { nom: 'NGUEMA', prenom: 'Divine', niveau: 'CP1', profil: 'partiel' },
      { nom: 'OBAME', prenom: 'Rovanie', niveau: 'CM2', profil: 'solde' },
      { nom: 'MBOUMBA', prenom: 'Christevie', niveau: 'CM2', profil: 'impaye' },
      { nom: 'BOUKAKA', prenom: 'Israel', niveau: '6eme', profil: 'partiel' },
      { nom: 'IVALA', prenom: 'Grace', niveau: '6eme', profil: 'solde' }
    ];

    const anneeCourante = new Date().getFullYear();
    let numeroRecuIndex = 0;
    const resultatEleves = [];

    for (const e of elevesDefinis) {
      // Parent de demo
      const parentResult = db.prepare(`
        INSERT INTO parents (nom_complet, lien, telephone, email, adresse, profession)
        VALUES (?, 'Père', '074000000', 'demo@example.com', 'Libreville', 'Fonctionnaire')
      `).run(`${e.nom} Parent`);
      const parentId = parentResult.lastInsertRowid;

      // Eleve
      const matricule = genererMatricule(String(anneeCourante));
      const eleveResult = db.prepare(`
        INSERT INTO eleves (matricule, nom, prenom, date_naissance, lieu_naissance, sexe, adresse, parent1_id)
        VALUES (?, ?, ?, '2015-03-10', 'Libreville', 'M', 'Libreville', ?)
      `).run(matricule, e.nom, e.prenom, parentId);
      const eleveId = eleveResult.lastInsertRowid;

      // Inscription
      const inscriptionResult = db.prepare(`
        INSERT INTO inscriptions (eleve_id, classe_id, annee_scolaire_id, type)
        VALUES (?, ?, ?, 'nouvelle')
      `).run(eleveId, classeIds[e.niveau], annee.id);
      const inscriptionId = inscriptionResult.lastInsertRowid;

      // Echeances (a partir du tarif du niveau)
      const tarif = db.prepare(`SELECT * FROM tarifs WHERE niveau = ? AND annee_scolaire_id = ?`).get(e.niveau, annee.id);
      const echeancesCreees = [];

      const rInscriptionEcheance = db.prepare(`
        INSERT INTO echeances (inscription_id, libelle, montant_du) VALUES (?, ?, ?)
      `).run(inscriptionId, "Frais d'inscription", tarif.frais_inscription);
      echeancesCreees.push({ id: rInscriptionEcheance.lastInsertRowid, montant: tarif.frais_inscription });

      const montantParTranche = tarif.frais_scolarite_total / tarif.nombre_tranches;
      for (let i = 1; i <= tarif.nombre_tranches; i++) {
        const r = db.prepare(`
          INSERT INTO echeances (inscription_id, libelle, montant_du) VALUES (?, ?, ?)
        `).run(inscriptionId, `Tranche ${i}`, montantParTranche);
        echeancesCreees.push({ id: r.lastInsertRowid, montant: montantParTranche });
      }

      // Paiements selon le profil
      let echeancesAPayer = [];
      if (e.profil === 'solde') echeancesAPayer = echeancesCreees;
      else if (e.profil === 'partiel') echeancesAPayer = echeancesCreees.slice(0, 2); // inscription + tranche 1
      // 'impaye' : aucune

      for (const ech of echeancesAPayer) {
        const numeroRecu = genererNumeroRecu(numeroRecuIndex++);
        db.prepare(`
          INSERT INTO paiements (echeance_id, inscription_id, montant, mode_paiement, numero_recu)
          VALUES (?, ?, ?, 'especes', ?)
        `).run(ech.id, inscriptionId, ech.montant, numeroRecu);
        db.prepare(`UPDATE echeances SET statut = 'payee' WHERE id = ?`).run(ech.id);
      }

      resultatEleves.push({ eleveId, matricule, nom: e.nom, prenom: e.prenom, profil: e.profil });
    }

    return { anneeId: annee.id, eleves: resultatEleves };
  });

  try {
    const result = transaction();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la génération de la démo', details: err.message });
  }
});

module.exports = router;
