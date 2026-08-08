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

// ---------- ROLES ----------
async function chargerRoles() {
  const res = await fetch('/api/roles');
  const roles = await res.json();

  const tbody = document.getElementById('rolesTable');
  tbody.innerHTML = '';
  roles.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.nom}</td>
      <td>${r.description || '-'}</td>
      <td>${r.systeme ? '<span class="badge partielle">Système</span>' : '<span class="badge payee">Personnalisé</span>'}</td>
      <td>${r.systeme ? '' : `<button class="btn-secondary-sm" onclick="supprimerRole(${r.id})">Supprimer</button>`}</td>
    `;
    tbody.appendChild(tr);
  });

  // Remplit aussi le select du formulaire utilisateur (hors super_admin, reserve au systeme)
  const select = document.getElementById('u_role');
  const valeurActuelle = select.value;
  select.innerHTML = '';
  roles.filter(r => r.nom !== 'super_admin').forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.nom;
    opt.textContent = r.description ? `${r.nom} (${r.description})` : r.nom;
    select.appendChild(opt);
  });
  if (valeurActuelle) select.value = valeurActuelle;
}

async function supprimerRole(id) {
  const res = await fetch(`/api/roles/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) { alert(data.error); return; }
  chargerRoles();
}

document.getElementById('roleForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('roleMsg');
  msg.textContent = '';
  const payload = {
    nom: document.getElementById('r_nom').value.trim(),
    description: document.getElementById('r_description').value.trim()
  };
  const res = await fetch('/api/roles', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) { msg.textContent = data.error; return; }
  document.getElementById('roleForm').reset();
  chargerRoles();
});

chargerRoles();

// ---------- UTILISATEURS ----------
async function chargerUtilisateurs() {
  const res = await fetch('/api/utilisateurs');
  const utilisateurs = await res.json();
  const tbody = document.getElementById('utilisateursTable');
  tbody.innerHTML = '';
  utilisateurs.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.nom_utilisateur}</td>
      <td>${u.nom_complet}</td>
      <td>${u.role}</td>
      <td>${u.proteger ? '<span class="badge partielle">Protégé</span>' : (u.actif ? '<span class="badge payee">Actif</span>' : '<span class="badge impayee">Désactivé</span>')}</td>
      <td>
        ${u.proteger ? '' : `
          <button class="btn-secondary-sm" onclick="toggleActif(${u.id})">${u.actif ? 'Désactiver' : 'Activer'}</button>
          <button class="btn-secondary-sm" onclick="supprimerUtilisateur(${u.id})">Supprimer</button>
        `}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function toggleActif(id) {
  const res = await fetch(`/api/utilisateurs/${id}/toggle-actif`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) { alert(data.error); return; }
  chargerUtilisateurs();
}

async function supprimerUtilisateur(id) {
  if (!confirm('Supprimer ce compte ?')) return;
  const res = await fetch(`/api/utilisateurs/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) { alert(data.error); return; }
  chargerUtilisateurs();
}

document.getElementById('utilisateurForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('utilisateurMsg');
  msg.textContent = '';
  const payload = {
    nom_utilisateur: document.getElementById('u_login').value,
    nom_complet: document.getElementById('u_nom').value,
    mot_de_passe: document.getElementById('u_password').value,
    role: document.getElementById('u_role').value
  };
  const res = await fetch('/api/utilisateurs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) { msg.textContent = data.error; return; }
  document.getElementById('utilisateurForm').reset();
  chargerUtilisateurs();
});

chargerUtilisateurs();
