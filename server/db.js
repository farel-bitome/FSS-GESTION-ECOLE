const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Determine un dossier de donnees inscriptible :
// - Dans l'app Electron packagee : dossier userData (ex: %APPDATA%/ecole-gestion)
// - En dehors d'Electron (npm run server) : dossier ../data a cote du code
let dataDir;
try {
  const { app } = require('electron');
  dataDir = path.join(app.getPath('userData'), 'data');
} catch (e) {
  dataDir = path.join(__dirname, '..', 'data');
}

fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'ecole.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
-- =====================
-- MIGRATIONS (suivi des operations ponctuelles executees une seule fois)
-- =====================
CREATE TABLE IF NOT EXISTS migrations_appliquees (
  nom TEXT PRIMARY KEY,
  date_application TEXT DEFAULT (datetime('now'))
);

-- =====================
-- UTILISATEURS & ROLES
-- =====================
CREATE TABLE IF NOT EXISTS utilisateurs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom_utilisateur TEXT UNIQUE NOT NULL,
  nom_complet TEXT NOT NULL,
  mot_de_passe_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  actif INTEGER DEFAULT 1,
  proteger INTEGER DEFAULT 0, -- 1 pour le super admin BITOME, non supprimable
  date_creation TEXT DEFAULT (datetime('now'))
);

-- Roles personnalisables (crees et geres par l'utilisateur depuis l'application)
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT UNIQUE NOT NULL,
  description TEXT,
  systeme INTEGER DEFAULT 0 -- 1 = role reserve (super_admin), non supprimable
);

-- =====================
-- ANNEES SCOLAIRES
-- =====================
CREATE TABLE IF NOT EXISTS annees_scolaires (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  libelle TEXT NOT NULL,          -- ex: "2026-2027"
  date_debut TEXT,
  date_fin TEXT,
  active INTEGER DEFAULT 0
);

-- =====================
-- CLASSES / NIVEAUX
-- =====================
CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,              -- ex: "6eme A"
  niveau TEXT NOT NULL,           -- ex: "6eme"
  annee_scolaire_id INTEGER NOT NULL,
  enseignant_principal_id INTEGER,
  FOREIGN KEY (annee_scolaire_id) REFERENCES annees_scolaires(id),
  FOREIGN KEY (enseignant_principal_id) REFERENCES enseignants(id)
);

-- =====================
-- PARENTS / TUTEURS
-- =====================
CREATE TABLE IF NOT EXISTS parents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom_complet TEXT NOT NULL,
  lien TEXT,                      -- pere, mere, tuteur
  telephone TEXT,
  email TEXT,
  adresse TEXT,
  profession TEXT
);

-- =====================
-- ELEVES
-- =====================
CREATE TABLE IF NOT EXISTS eleves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  matricule TEXT UNIQUE NOT NULL,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  date_naissance TEXT,
  lieu_naissance TEXT,
  sexe TEXT CHECK(sexe IN ('M','F')),
  adresse TEXT,
  photo_path TEXT,
  parent1_id INTEGER,
  parent2_id INTEGER,
  date_creation TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (parent1_id) REFERENCES parents(id),
  FOREIGN KEY (parent2_id) REFERENCES parents(id)
);

-- =====================
-- INSCRIPTIONS (lien eleve <-> classe <-> annee)
-- =====================
CREATE TABLE IF NOT EXISTS inscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eleve_id INTEGER NOT NULL,
  classe_id INTEGER NOT NULL,
  annee_scolaire_id INTEGER NOT NULL,
  type TEXT DEFAULT 'nouvelle' CHECK(type IN ('nouvelle','reinscription')),
  statut TEXT DEFAULT 'active' CHECK(statut IN ('active','annulee','transferee')),
  date_inscription TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (eleve_id) REFERENCES eleves(id),
  FOREIGN KEY (classe_id) REFERENCES classes(id),
  FOREIGN KEY (annee_scolaire_id) REFERENCES annees_scolaires(id)
);

-- =====================
-- DOCUMENTS FOURNIS
-- =====================
CREATE TABLE IF NOT EXISTS documents_eleve (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eleve_id INTEGER NOT NULL,
  type_document TEXT NOT NULL,   -- acte_naissance, bulletin_precedent, certificat_medical...
  fourni INTEGER DEFAULT 0,
  fichier_path TEXT,
  FOREIGN KEY (eleve_id) REFERENCES eleves(id)
);

-- =====================
-- MATIERES
-- =====================
CREATE TABLE IF NOT EXISTS matieres (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  coefficient_defaut REAL DEFAULT 1
);

-- =====================
-- ENSEIGNANTS
-- =====================
CREATE TABLE IF NOT EXISTS enseignants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom_complet TEXT NOT NULL,
  telephone TEXT,
  email TEXT,
  utilisateur_id INTEGER,
  FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
);

-- Affectation enseignant / matiere / classe
CREATE TABLE IF NOT EXISTS affectations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enseignant_id INTEGER NOT NULL,
  matiere_id INTEGER NOT NULL,
  classe_id INTEGER NOT NULL,
  coefficient REAL DEFAULT 1,
  FOREIGN KEY (enseignant_id) REFERENCES enseignants(id),
  FOREIGN KEY (matiere_id) REFERENCES matieres(id),
  FOREIGN KEY (classe_id) REFERENCES classes(id)
);

-- =====================
-- PERIODES (trimestres/semestres)
-- =====================
CREATE TABLE IF NOT EXISTS periodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  libelle TEXT NOT NULL,          -- "Trimestre 1"
  annee_scolaire_id INTEGER NOT NULL,
  ordre INTEGER,
  FOREIGN KEY (annee_scolaire_id) REFERENCES annees_scolaires(id)
);

-- =====================
-- TARIFS (grille scolarite)
-- =====================
CREATE TABLE IF NOT EXISTS tarifs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  niveau TEXT NOT NULL,
  annee_scolaire_id INTEGER NOT NULL,
  frais_inscription REAL DEFAULT 0,
  frais_scolarite_total REAL DEFAULT 0,
  nombre_tranches INTEGER DEFAULT 3,
  FOREIGN KEY (annee_scolaire_id) REFERENCES annees_scolaires(id)
);

-- =====================
-- ECHEANCIER PAR ELEVE
-- =====================
CREATE TABLE IF NOT EXISTS echeances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inscription_id INTEGER NOT NULL,
  libelle TEXT,                   -- "Tranche 1", "Inscription"
  montant_du REAL NOT NULL,
  date_echeance TEXT,
  statut TEXT DEFAULT 'impayee' CHECK(statut IN ('impayee','partielle','payee')),
  FOREIGN KEY (inscription_id) REFERENCES inscriptions(id)
);

-- =====================
-- PAIEMENTS
-- =====================
CREATE TABLE IF NOT EXISTS paiements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  echeance_id INTEGER,
  inscription_id INTEGER NOT NULL,
  montant REAL NOT NULL,
  mode_paiement TEXT CHECK(mode_paiement IN ('especes','airtel_money','moov_money','virement','cheque')),
  reference_transaction TEXT,
  numero_recu TEXT UNIQUE,
  utilisateur_id INTEGER,
  date_paiement TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (echeance_id) REFERENCES echeances(id),
  FOREIGN KEY (inscription_id) REFERENCES inscriptions(id),
  FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
);

-- =====================
-- EVALUATIONS & NOTES
-- =====================
CREATE TABLE IF NOT EXISTS evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  libelle TEXT NOT NULL,          -- "Devoir 1", "Composition"
  matiere_id INTEGER NOT NULL,
  classe_id INTEGER NOT NULL,
  periode_id INTEGER NOT NULL,
  ponderation REAL DEFAULT 1,     -- poids dans la moyenne de la matiere
  date_evaluation TEXT,
  FOREIGN KEY (matiere_id) REFERENCES matieres(id),
  FOREIGN KEY (classe_id) REFERENCES classes(id),
  FOREIGN KEY (periode_id) REFERENCES periodes(id)
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evaluation_id INTEGER NOT NULL,
  eleve_id INTEGER NOT NULL,
  note REAL,
  note_sur REAL DEFAULT 20,
  absent INTEGER DEFAULT 0,
  FOREIGN KEY (evaluation_id) REFERENCES evaluations(id),
  FOREIGN KEY (eleve_id) REFERENCES eleves(id),
  UNIQUE(evaluation_id, eleve_id)
);

-- =====================
-- BULLETINS (snapshot calcule + genere)
-- =====================
CREATE TABLE IF NOT EXISTS bulletins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eleve_id INTEGER NOT NULL,
  classe_id INTEGER NOT NULL,
  periode_id INTEGER NOT NULL,
  moyenne_generale REAL,
  rang INTEGER,
  appreciation_generale TEXT,
  fichier_pdf_path TEXT,
  date_generation TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (eleve_id) REFERENCES eleves(id),
  FOREIGN KEY (classe_id) REFERENCES classes(id),
  FOREIGN KEY (periode_id) REFERENCES periodes(id)
);

-- =====================
-- PERMISSIONS PAR SECTION (granulaire)
-- =====================
CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  utilisateur_id INTEGER NOT NULL,
  section TEXT NOT NULL,          -- 'inscription','paiement','notes','bulletins','admin'
  peut_voir INTEGER DEFAULT 0,
  peut_modifier INTEGER DEFAULT 0,
  FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
);
`);

// ---------------------------------------------------------
// MIGRATION : retire l'ancienne contrainte CHECK figee sur
// utilisateurs.role pour permettre des roles personnalises,
// tout en preservant les comptes/donnees existants.
// ---------------------------------------------------------
try {
  const tableInfo = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='utilisateurs'`).get();
  if (tableInfo && tableInfo.sql.includes('CHECK(role IN')) {
    db.exec(`
      ALTER TABLE utilisateurs RENAME TO utilisateurs_old;
      CREATE TABLE utilisateurs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom_utilisateur TEXT UNIQUE NOT NULL,
        nom_complet TEXT NOT NULL,
        mot_de_passe_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        actif INTEGER DEFAULT 1,
        proteger INTEGER DEFAULT 0,
        date_creation TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO utilisateurs (id, nom_utilisateur, nom_complet, mot_de_passe_hash, role, actif, proteger, date_creation)
        SELECT id, nom_utilisateur, nom_complet, mot_de_passe_hash, role, actif, proteger, date_creation FROM utilisateurs_old;
      DROP TABLE utilisateurs_old;
    `);
    console.log('[db] Migration : contrainte de role figee retiree (roles desormais libres).');
  }
} catch (err) {
  console.error('[db] Echec migration roles libres :', err.message);
}

// Seed des roles de depart (modifiables/supprimables sauf super_admin)
const rolesDefaut = [
  { nom: 'super_admin', description: 'Super administrateur (protege)', systeme: 1 },
  { nom: 'admin', description: 'Administrateur', systeme: 0 },
  { nom: 'secretariat', description: 'Secrétariat', systeme: 0 },
  { nom: 'comptable', description: 'Comptable', systeme: 0 },
  { nom: 'enseignant', description: 'Enseignant', systeme: 0 }
];
const insererRole = db.prepare(`INSERT OR IGNORE INTO roles (nom, description, systeme) VALUES (?, ?, ?)`);
for (const r of rolesDefaut) insererRole.run(r.nom, r.description, r.systeme);


module.exports = db;
