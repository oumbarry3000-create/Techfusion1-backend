import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { logAction } from "./journal";

const CLE_DERNIER_MOIS_ARCHIVE = "techno_dernier_mois_archive";

function moisPrecedentCle() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function moisCourantCle() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Vérifie si le mois précédent a déjà été archivé ; sinon, calcule et enregistre.
 * À appeler au montage de l'app admin (throttlé via localStorage).
 */
export async function archiverMoisPrecedentSiNecessaire() {
  const dejaFait = localStorage.getItem(CLE_DERNIER_MOIS_ARCHIVE);
  const cible = moisPrecedentCle();
  if (dejaFait === cible) return;

  const existeDeja = await getDoc(doc(db, "history", cible));
  if (existeDeja.exists()) {
    localStorage.setItem(CLE_DERNIER_MOIS_ARCHIVE, cible);
    return;
  }

  await genererEtEnregistrerBilan(cible, true);
  localStorage.setItem(CLE_DERNIER_MOIS_ARCHIVE, cible);
}

/** Archivage manuel du mois courant, déclenché par un bouton admin */
export async function archiverMoisCourant() {
  const cible = moisCourantCle();
  await genererEtEnregistrerBilan(cible, false);
  return cible;
}

async function genererEtEnregistrerBilan(cleMois, automatique) {
  const subsSnap = await getDocs(collection(db, "subscribers"));
  const depSnap = await getDocs(collection(db, "depenses"));
  const transSnap = await getDocs(collection(db, "transactions"));

  const abonnes = subsSnap.docs.map((d) => d.data());
  const actifs = abonnes.filter((a) => a.statut === "Actif").length;
  const inactifs = abonnes.filter((a) => a.statut === "Inactif").length;
  const enAttente = abonnes.filter((a) => a.statut === "En attente").length;

  const depenses = depSnap.docs
    .map((d) => d.data())
    .reduce((sum, d) => sum + Number(d.montant || 0), 0);

  const revenus = transSnap.docs
    .map((d) => d.data())
    .reduce((sum, t) => sum + Number(t.montant || 0), 0);

  const renouvellements = transSnap.docs.filter(
    (d) => d.data().type === "renouvellement"
  ).length;
  const nouveaux = transSnap.docs.filter(
    (d) => d.data().type === "inscription"
  ).length;

  await setDoc(doc(db, "history", cleMois), {
    mois: cleMois,
    abonnes: abonnes.length,
    actifs,
    inactifs,
    enAttente,
    nouveaux,
    renouvellements,
    depenses,
    revenus,
    capitalNet: revenus - depenses,
    genereAuto: automatique,
    dateArchivage: new Date(),
  });

  await logAction(
    `Bilan ${cleMois} archivé (${automatique ? "auto" : "manuel"}) — Net: ${
      revenus - depenses
    }`
  );
}

export async function getHistorique() {
  const snap = await getDocs(collection(db, "history"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
