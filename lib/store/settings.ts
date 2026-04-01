import { getData, saveData } from "../db";
import type { AppSettings } from "../types";

export async function getSettings(): Promise<AppSettings> {
  const data = await getData();
  return data.settings;
}

export async function updateSettings(settings: Partial<AppSettings>): Promise<void> {
  const data = await getData();
  data.settings = { ...data.settings, ...settings };
  await saveData(data);
}
