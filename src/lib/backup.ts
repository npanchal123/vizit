import { db } from './db';
import { downloadBlob } from './export';

/**
 * One file with everything Viz it keeps on this device: the database (recordings included) and the settings in
 * localStorage. It moves a person's things to another phone or browser, or to a new web address, since a browser
 * keeps each site's data apart.
 */
export interface Backup {
  app: 'vizit';
  version: 1;
  createdAt: string;
  settings: Record<string, string>;
  database: unknown;
}

const SETTINGS_PREFIX = 'moodcanvas.';
/** Belongs to one device's link with an account, so it isn't carried over. */
const DEVICE_ONLY_META = new Set(['lastSyncAt', 'pulledThrough', 'syncedUserId']);

export class NotABackupError extends Error {}

function readSettings(): Record<string, string> {
  const settings: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(SETTINGS_PREFIX)) settings[key] = localStorage.getItem(key) ?? '';
    }
  } catch {
    // Storage blocked: the backup still has the database.
  }
  return settings;
}

export async function createBackup(): Promise<Backup> {
  // Loaded only when needed: it's only for backups, and it expects a browser.
  const { exportDB } = await import('dexie-export-import');
  const blob = await exportDB(db, {
    filter: (table, value) =>
      table !== 'deletions' && !(table === 'meta' && DEVICE_ONLY_META.has((value as { key: string }).key)),
  });
  return {
    app: 'vizit',
    version: 1,
    createdAt: new Date().toISOString(),
    settings: readSettings(),
    database: JSON.parse(await blob.text()) as unknown,
  };
}

export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new NotABackupError();
  }
  const b = data as Partial<Backup> | null;
  if (b?.app !== 'vizit' || b.version !== 1 || typeof b.settings !== 'object' || b.settings == null || b.database == null) {
    throw new NotABackupError();
  }
  return b as Backup;
}

/** Replaces everything on this device with the backup. The caller reloads the page afterwards. */
export async function restoreBackup(backup: Backup): Promise<void> {
  const { importInto } = await import('dexie-export-import');
  const blob = new Blob([JSON.stringify(backup.database)], { type: 'application/json' });
  await importInto(db, blob, { clearTablesBeforeImport: true, acceptVersionDiff: true, acceptMissingTables: true });
  try {
    for (const key of Object.keys(readSettings())) localStorage.removeItem(key);
    for (const [key, value] of Object.entries(backup.settings)) {
      if (key.startsWith(SETTINGS_PREFIX) && typeof value === 'string') localStorage.setItem(key, value);
    }
  } catch {
    // Storage blocked: the database is back, the settings start fresh.
  }
}

export function backupFilename(date = new Date()): string {
  return `vizit-backup-${date.toISOString().slice(0, 10)}.json`;
}

/** Phones get the share sheet (on an iPhone, "Save to Files"); computers get a normal download. */
export async function saveBackup(backup: Backup): Promise<void> {
  const name = backupFilename();
  const file = new File([JSON.stringify(backup)], name, { type: 'application/json' });
  const touch = navigator.maxTouchPoints > 0;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      // Closing the share sheet isn't a failure; anything else falls back to a download.
      if ((err as Error).name === 'AbortError') return;
    }
  }
  downloadBlob(file, name);
}
