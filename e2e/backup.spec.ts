import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { calm, FEELING_LABEL, skipOnboarding } from './helpers';

test.beforeEach(async ({ page }) => {
  await calm(page);
});

test('back up everything, lose it, and restore it from the file', async ({ page }) => {
  await skipOnboarding(page);
  await page.getByLabel(FEELING_LABEL).fill('Walking calmly into my exam, feeling ready');
  await page.getByRole('button', { name: 'Create my visualization' }).click();
  await page.getByRole('button', { name: 'Save to My visualizations' }).click();
  await expect(page.getByText('Saved to My visualizations.')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  const saved = page.getByRole('region', { name: 'My visualizations' });
  await expect(saved).toContainText('about the exam');

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('radio', { name: 'Dark', exact: true }).check();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save a backup file' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^vizit-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const file = await download.path();
  expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({ app: 'vizit', version: 1 });

  // Lose everything: what a new web address or a new phone looks like.
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('moodcanvas');
      req.onsuccess = req.onerror = req.onblocked = resolve;
    });
  });
  await skipOnboarding(page);
  await expect(page.getByRole('region', { name: 'My visualizations' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  // A file that isn't a backup changes nothing.
  await page.getByLabel('Restore from a backup…').setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1}') });
  await expect(page.getByText('That file isn’t a Viz it backup.')).toBeVisible();

  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByLabel('Restore from a backup…').setInputFiles(file);
  // The page reloads with everything back, settings included.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Visualize', exact: true }).click();
  await expect(page.getByRole('region', { name: 'My visualizations' })).toContainText('about the exam');
});
