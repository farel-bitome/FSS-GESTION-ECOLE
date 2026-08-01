async function verifierConnexion() {
  const res = await fetch('/api/moi');
  if (!res.ok) window.location.href = 'login.html';
}

async function chargerClasses() {
  const res = await fetch('/api/inscription/classes');
  const classes = await res.json();
  const select = document.getElementById('classe_id');
  select.innerHTML = '<option value="">-- Choisir une classe --</option>';
  classes.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.nom} (${c.niveau})`;
    select.appendChild(opt);
  });
}

async function chargerListe() {
  const res = await fetch('/api/inscription/liste');
  const eleves = await res.json();
  const tbody = document.querySelector('#listeTable tbody');
  tbody.innerHTML = '';
  eleves.forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${e.matricule}</td>
      <td>${e.nom}</td>
      <td>${e.prenom}</td>
      <td>${e.classe_nom}</td>
      <td>${new Date(e.date_inscription).toLocaleDateString('fr-FR')}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById('inscriptionForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const successMsg = document.getElementById('successMsg');
  const errorMsg = document.getElementById('errorMsg');
  successMsg.textContent = '';
  errorMsg.textContent = '';

  const payload = {
    eleve: {
      nom: document.getElementById('nom').value,
      prenom: document.getElementById('prenom').value,
      date_naissance: document.getElementById('date_naissance').value,
      lieu_naissance: document.getElementById('lieu_naissance').value,
      sexe: document.getElementById('sexe').value,
      adresse: document.getElementById('adresse').value
    },
    parent1: {
      nom_complet: document.getElementById('p1_nom').value,
      lien: document.getElementById('p1_lien').value,
      telephone: document.getElementById('p1_telephone').value,
      email: document.getElementById('p1_email').value,
      profession: document.getElementById('p1_profession').value,
      adresse: document.getElementById('p1_adresse').value
    },
    classe_id: document.getElementById('classe_id').value
  };

  try {
    const res = await fetch('/api/inscription/nouvelle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      errorMsg.textContent = data.error || 'Erreur lors de l\'inscription';
      return;
    }
    successMsg.textContent = `Inscription réussie. Matricule : ${data.matricule}`;
    document.getElementById('inscriptionForm').reset();
    chargerListe();
  } catch (err) {
    errorMsg.textContent = 'Impossible de contacter le serveur';
  }
});

verifierConnexion();
chargerClasses();
chargerListe();
