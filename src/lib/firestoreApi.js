import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { blankAppState, hydrateEntry } from "./bracketState";

const SETTINGS_COLLECTION = "bracket_settings";
const SETTINGS_DOC_ID = "d2-2026";
const ENTRIES_COLLECTION = "bracket_entries";

export async function fetchRemoteState() {
  const settingsRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
  const settingsSnap = await getDoc(settingsRef);

  const entriesSnap = await getDocs(collection(db, ENTRIES_COLLECTION));

  const base = blankAppState();
  const stateJson = settingsSnap.exists() ? settingsSnap.data().state_json : base;

  const entries = entriesSnap.docs.map((snap) => {
    const data = snap.data();
    return {
      id: snap.id,
      name: data.name,
      createdAt: data.createdAt || null,
      bracket: hydrateEntry(data.bracket_json),
    };
  });

  return {
    ...base,
    ...stateJson,
    entries,
    results:
      stateJson && stateJson.results && stateJson.results.regions
        ? hydrateEntry(stateJson.results)
        : base.results,
  };
}

export async function saveRemoteSettings(state) {
  await setDoc(doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID), {
    state_json: {
      ...state,
      entries: [],
    },
  });
}

export async function createRemoteEntry(entry) {
  const docRef = await addDoc(collection(db, ENTRIES_COLLECTION), {
    pool_slug: "d2-2026",
    name: entry.name,
    bracket_json: entry.bracket,
    createdAt: serverTimestamp(),
  });

  return {
    ...entry,
    id: docRef.id,
  };
}

export async function updateRemoteEntry(entry) {
  await setDoc(
    doc(db, ENTRIES_COLLECTION, entry.id),
    {
      pool_slug: "d2-2026",
      name: entry.name,
      bracket_json: entry.bracket,
      createdAt: entry.createdAt || serverTimestamp(),
    },
    { merge: true }
  );

  return entry;
}

export async function deleteRemoteEntry(id) {
  await deleteDoc(doc(db, ENTRIES_COLLECTION, id));
}
