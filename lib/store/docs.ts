import { getData, saveData } from "../db";
import type { Doc } from "../types";

export async function getDocs(): Promise<Doc[]> {
  const data = await getData();
  return data.docs;
}

export async function addDoc(doc: Doc): Promise<void> {
  const data = await getData();
  data.docs.push(doc);
  await saveData(data);
}

export async function updateDoc(
  id: string,
  updates: Partial<Doc>
): Promise<boolean> {
  const data = await getData();
  const idx = data.docs.findIndex((d) => d.id === id);
  if (idx === -1) return false;
  data.docs[idx] = { ...data.docs[idx], ...updates, updatedAt: new Date().toISOString() };
  await saveData(data);
  return true;
}

export async function deleteDoc(id: string): Promise<boolean> {
  const data = await getData();
  const len = data.docs.length;
  data.docs = data.docs.filter((d) => d.id !== id);
  if (data.docs.length === len) return false;
  await saveData(data);
  return true;
}
