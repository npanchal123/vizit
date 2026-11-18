import { describe, expect, it } from 'vitest';
import { backupFilename, NotABackupError, parseBackup } from './backup';

describe('parseBackup', () => {
  const good = { app: 'vizit', version: 1, createdAt: '2026-11-18T10:00:00.000Z', settings: {}, database: { formatName: 'dexie' } };

  it('accepts a Viz it backup', () => {
    expect(parseBackup(JSON.stringify(good)).createdAt).toBe(good.createdAt);
  });

  it('rejects anything else', () => {
    expect(() => parseBackup('not json')).toThrow(NotABackupError);
    expect(() => parseBackup('null')).toThrow(NotABackupError);
    expect(() => parseBackup(JSON.stringify({ ...good, app: 'other' }))).toThrow(NotABackupError);
    expect(() => parseBackup(JSON.stringify({ ...good, version: 2 }))).toThrow(NotABackupError);
    expect(() => parseBackup(JSON.stringify({ ...good, database: undefined }))).toThrow(NotABackupError);
  });
});

it('names the file after the day it was made', () => {
  expect(backupFilename(new Date('2026-11-18T23:00:00.000Z'))).toBe('vizit-backup-2026-11-18.json');
});
