import { KnezConnectionProfile } from "../domain/DataContracts";
import { knezClient } from "./KnezClient";

const KEY = "knez_connection_profiles";

function safeParse(raw: string | null): KnezConnectionProfile[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as KnezConnectionProfile[]) : [];
  } catch {
    return [];
  }
}

export function listProfiles(): KnezConnectionProfile[] {
  const current = knezClient.getProfile();
  const saved = safeParse(localStorage.getItem(KEY));
  const byId = new Map(saved.map((p) => [p.id, p]));
  byId.set(current.id, current);
  return Array.from(byId.values());
}

export function saveProfile(profile: KnezConnectionProfile): void {
  const saved = safeParse(localStorage.getItem(KEY));
  const byId = new Map(saved.map((p) => [p.id, p]));
  byId.set(profile.id, profile);
  localStorage.setItem(KEY, JSON.stringify(Array.from(byId.values())));
}

export function deleteProfile(id: string): void {
  const saved = safeParse(localStorage.getItem(KEY));
  const next = saved.filter((p) => p.id !== id);
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function setActiveProfile(id: string): void {
  const profiles = listProfiles();
  const found = profiles.find((p) => p.id === id);
  if (found) knezClient.setProfile(found);
}

