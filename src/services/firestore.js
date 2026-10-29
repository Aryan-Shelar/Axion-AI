
import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
serverTimestamp,
addDoc,
} from "firebase/firestore";

import { db } from "../firebase";

const SCANS_COLLECTION = "scans";

// Save or update one scan
export async function saveScan(scan) {
  if (!scan.uid) {
    throw new Error("User UID is required to save a scan.");
  }

  const scanId = String(scan.id);

  await setDoc(
    doc(db, SCANS_COLLECTION, scanId),
    {
      ...scan,
      id: scanId,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}


export async function loadScans(uid) {
  if (!uid) {
    throw new Error("User UID is required to load scans.");
  }

  const scansRef = collection(db, SCANS_COLLECTION);

  const scansQuery = query(
    scansRef,
    where("uid", "==", uid)
  );

  const snapshot = await getDocs(scansQuery);

  const scans = snapshot.docs.map((item) => ({
    ...item.data(),
    id: item.data().id || item.id,
  }));

  console.log("Firestore scans loaded:", scans);

  return scans.sort(
    (a, b) =>
      new Date(b.updatedAt || 0).getTime() -
      new Date(a.updatedAt || 0).getTime()
  );
}
const AUDIT_COLLECTION = "auditLogs";

export async function saveAuditLog(entry, uid) {
  if (!uid) {
    throw new Error("User UID is required to save audit history.");
  }

  await addDoc(collection(db, AUDIT_COLLECTION), {
    ...entry,
    uid,
    createdAt: serverTimestamp(),
  });
}

export async function loadAuditLogs(uid) {
  if (!uid) {
    throw new Error("User UID is required to load audit history.");
  }

  const logsQuery = query(
    collection(db, AUDIT_COLLECTION),
    where("uid", "==", uid)
  );

  const snapshot = await getDocs(logsQuery);

  return snapshot.docs
    .map((item) => ({
      id: item.id,
      ...item.data(),
    }))
    .sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() ?? 0;
      const timeB = b.createdAt?.toMillis?.() ?? 0;
      return timeB - timeA;
    });
}

const COMPANY_PROFILES_COLLECTION = "companyProfiles";

// Save company profile and brand guidelines
export async function saveCompanyProfile(uid, profile) {
  if (!uid) {
    throw new Error("User UID is required to save company profile.");
  }

  await setDoc(
    doc(db, COMPANY_PROFILES_COLLECTION, uid),
    {
      ...profile,
      uid,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

// Load saved company profile
export async function loadCompanyProfile(uid) {
  if (!uid) {
    throw new Error("User UID is required to load company profile.");
  }

  const profileRef = doc(db, COMPANY_PROFILES_COLLECTION, uid);
  const snapshot = await getDocs(
    query(
      collection(db, COMPANY_PROFILES_COLLECTION),
      where("uid", "==", uid)
    )
  );

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0].data();
}


  

