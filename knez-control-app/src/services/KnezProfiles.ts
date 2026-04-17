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
  let saved: KnezConnectionProfile[] = [];
  try {
    saved = safeParse(localStorage.getItem(KEY));
  } catch (e) {
    // localStorage not available
  }
  const byId = new Map(saved.map((p) => [p.id, p]));
  byId.set(current.id, current);
  return Array.from(byId.values());
}

export function saveProfile(profile: KnezConnectionProfile): void {
  try {
    const saved = safeParse(localStorage.getItem(KEY));
    const byId = new Map(saved.map((p) => [p.id, p]));
    byId.set(profile.id, profile);
    localStorage.setItem(KEY, JSON.stringify(Array.from(byId.values())));
  } catch (e) {
    // localStorage not available - profile won't persist
  }
}

export function deleteProfile(id: string): void {
  try {
    const saved = safeParse(localStorage.getItem(KEY));
    const next = saved.filter((p) => p.id !== id);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (e) {
    // localStorage not available - profile won't be deleted
  }
}

export function setActiveProfile(id: string): void {
  const profiles = listProfiles();
  const found = profiles.find((p) => p.id === id);
  if (found) knezClient.setProfile(found);
}

