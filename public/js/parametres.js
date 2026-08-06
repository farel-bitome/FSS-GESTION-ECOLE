async function verifierConnexion() {
  const res = await fetch('/api/moi');
  if (!res.ok) window.location.href = 'login.html';
}

// ---------- ANNEES SCOLAIRES ----------
async function chargerAnnees() {
  const res = await fetch('/api/parametres/annees');
  const annees = await res.json();
  const tbody = document.getElementById('anneesTable');
  tbody.innerHTML = '';
  annees.forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${a.libelle}</td>
      <td>${a.date_debut ? new Date(a.date_debut).toLocaleDateString('fr-FR') : '-'}</td>
      <td>${a.date_fin ? new Date(a.date_fin).toLocaleDateString('fr-FR') : '-'}</td>
      <td>${a.active ? '<span class="badge payee">Active</span>' : '<span class="badge impayee">Inactive</span>'}</td>
      <td>${a.active ? '' : `<button class="btn-secondary-sm" onclick="activerAnnee(${a.id})">Activer</button>`}</td>
    `;
    tbody.appendChild(tr);
  });
  return annees;
}

async function activerAnnee(id) {
  await fetch(`/api/parametres/annees/${id}/activer`, { method: 'POST' });
  await chargerAnnees();
  await chargerClasses();
  await chargerTarifs();
}

document.getElementById('anneeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('anneeMsg');
  msg.textContent = '';
  const payload = {
    libelle: document.getElementById('a_libelle').value,
    date_debut: document.getElementById('a_debut').value,
    date_fin: document.getElementById('a_fin').value,
    activer: document.getElementById('a_activer').checked
  };
  const res = await fetch('/api/parametres/annees', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) { msg.textContent = data.error; return; }
  document.getElementById('anneeForm').reset();
  await chargerAnnees();
  await chargerClasses();
  await chargerTarifs();
});

// ---------- CLASSES ----------
async function chargerClasses() {
  const res = await fetch('/api/parametres/classes');
  const classes = await res.json();
  const tbody = document.getElementById('classesTable');
  tbody.innerHTML = '';
  classes.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.nom}</td>
      <td>${c.niveau}</td>
      <td>${c.annee_libelle}</td>
      <td><button class="btn-secondary-sm" onclick="supprimerClasse(${c.id})">Supprimer</button></td>
    `;
    tbody.appendChild(tr);
  });
}

async function supprimerClasse(id) {
  const res = await fetch(`/api/parametres/classes/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) { alert(data.error); return; }
  chargerClasses();
}

document.getElementById('classeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('classeMsg');
  msg.textContent = '';

  const annees = await (await fetch('/api/parametres/annees')).json();
  const anneeActive = annees.find(a => a.active);
  if (!anneeActive) { msg.textContent = 'Active d\'abord une année scolaire.'; return; }

  const payload = {
    nom: document.getElementById('c_nom').value,
    niveau: document.getElementById('c_niveau').value,
    annee_scolaire_id: anneeActive.id
  };
  const res = await fetch('/api/parametres/classes', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) { msg.textContent = data.error; return; }
  document.getElementById('classeForm').reset();
  chargerClasses();
});

// ---------- TARIFS ----------
async function chargerTarifs() {
  const res = await fetch('/api/parametres/tarifs');
  const tarifs = await res.json();
  const tbody = document.getElementById('tarifsTable');
  tbody.innerHTML = '';
  tarifs.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.niveau}</td>
      <td>${t.frais_inscription.toLocaleString('fr-FR')} FCFA</td>
      <td>${t.frais_scolarite_total.toLocaleString('fr-FR')} FCFA</td>
      <td>${t.nombre_tranches}</td>
      <td><button class="btn-secondary-sm" onclick="supprimerTarif(${t.id})">Supprimer</button></td>
    `;
    tbody.appendChild(tr);
  });
}

async function supprimerTarif(id) {
  await fetch(`/api/parametres/tarifs/${id}`, { method: 'DELETE' });
  chargerTarifs();
}

document.getElementById('tarifForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('tarifMsg');
  msg.textContent = '';

  const annees = await (await fetch('/api/parametres/annees')).json();
  const anneeActive = annees.find(a => a.active);
  if (!anneeActive) { msg.textContent = 'Active d\'abord une année scolaire.'; return; }

  const payload = {
    niveau: document.getElementById('t_niveau').value,
    annee_scolaire_id: anneeActive.id,
    frais_inscription: parseFloat(document.getElementById('t_inscription').value) || 0,
    frais_scolarite_total: parseFloat(document.getElementById('t_total').value),
    nombre_tranches: parseInt(document.getElementById('t_tranches').value) || 3
  };
  const res = await fetch('/api/parametres/tarifs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) { msg.textContent = data.error; return; }
  document.getElementById('tarifForm').reset();
  document.getElementById('t_tranches').value = 3;
  chargerTarifs();
});

verifierConnexion();
chargerAnnees();
chargerClasses();
chargerTarifs();
