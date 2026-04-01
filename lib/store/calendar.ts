import { getData, saveData } from "../db";
import type { ScheduledEvent } from "../types";

export async function getScheduledEvents(): Promise<ScheduledEvent[]> {
  const data = await getData();
  return data.scheduledEvents;
}

export async function addScheduledEvent(event: ScheduledEvent): Promise<void> {
  const data = await getData();
  data.scheduledEvents.push(event);
  await saveData(data);
}

export async function updateScheduledEvent(
  id: string,
  updates: Partial<ScheduledEvent>
): Promise<boolean> {
  const data = await getData();
  const idx = data.scheduledEvents.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  data.scheduledEvents[idx] = { ...data.scheduledEvents[idx], ...updates, updatedAt: new Date().toISOString() };
  await saveData(data);
  return true;
}

export async function deleteScheduledEvent(id: string): Promise<boolean> {
  const data = await getData();
  const len = data.scheduledEvents.length;
  data.scheduledEvents = data.scheduledEvents.filter((e) => e.id !== id);
  if (data.scheduledEvents.length === len) return false;
  await saveData(data);
  return true;
}
