import { getData, saveData } from "../db";
import type { ConversationMemory, LongTermMemory } from "../types";

// Conversation memories

export async function getConversationMemories(): Promise<ConversationMemory[]> {
  const data = await getData();
  return data.conversationMemories;
}

export async function addConversationMemory(memory: ConversationMemory): Promise<void> {
  const data = await getData();
  data.conversationMemories.push(memory);
  await saveData(data);
}

export async function updateConversationMemory(
  id: string,
  updates: Partial<ConversationMemory>
): Promise<boolean> {
  const data = await getData();
  const idx = data.conversationMemories.findIndex((m) => m.id === id);
  if (idx === -1) return false;
  data.conversationMemories[idx] = { ...data.conversationMemories[idx], ...updates, updatedAt: new Date().toISOString() };
  await saveData(data);
  return true;
}

export async function deleteConversationMemory(id: string): Promise<boolean> {
  const data = await getData();
  const len = data.conversationMemories.length;
  data.conversationMemories = data.conversationMemories.filter((m) => m.id !== id);
  if (data.conversationMemories.length === len) return false;
  await saveData(data);
  return true;
}

// Long-term memories

export async function getLongTermMemories(): Promise<LongTermMemory[]> {
  const data = await getData();
  return data.longTermMemories;
}

export async function addLongTermMemory(memory: LongTermMemory): Promise<void> {
  const data = await getData();
  data.longTermMemories.push(memory);
  await saveData(data);
}

export async function updateLongTermMemory(
  id: string,
  updates: Partial<LongTermMemory>
): Promise<boolean> {
  const data = await getData();
  const idx = data.longTermMemories.findIndex((m) => m.id === id);
  if (idx === -1) return false;
  data.longTermMemories[idx] = { ...data.longTermMemories[idx], ...updates, updatedAt: new Date().toISOString() };
  await saveData(data);
  return true;
}

export async function deleteLongTermMemory(id: string): Promise<boolean> {
  const data = await getData();
  const len = data.longTermMemories.length;
  data.longTermMemories = data.longTermMemories.filter((m) => m.id !== id);
  if (data.longTermMemories.length === len) return false;
  await saveData(data);
  return true;
}
