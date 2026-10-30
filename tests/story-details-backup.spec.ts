import { expect, test } from '@playwright/test'

test('edits story details and restores a downloaded backup without duplication', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('midnight-library')
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  })
  await page.reload()

  const firstCard = page.locator('.story-card').first()
  await firstCard.getByRole('button', { name: /Details/ }).click()
  await page.getByLabel('Story title').fill('The Lantern Keeper — Revised')
  await page.getByLabel(/Description/).fill('A harbor mystery after midnight.\nWarm lights guide the way home.')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(firstCard).toContainText('The Lantern Keeper — Revised')
  await expect(firstCard.locator('.story-description')).toContainText('Warm lights guide the way home.')

  await page.getByRole('button', { name: 'Open reading settings' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Export/ }).click()
  const download = await downloadPromise
  const backupPath = testInfo.outputPath('library-backup.json')
  await download.saveAs(backupPath)
  await expect(page.getByText('Backup downloaded.')).toBeVisible()
  await page.getByRole('button', { name: 'Close menu' }).click()

  await firstCard.getByRole('button', { name: /Details/ }).click()
  await page.getByLabel('Story title').fill('Temporary title')
  await page.getByLabel(/Description/).fill('')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(firstCard).toContainText('Temporary title')

  await page.getByRole('button', { name: 'Open reading settings' }).click()
  await page.getByLabel('Choose a Midnight Library backup').setInputFiles(backupPath)
  await expect(page.getByRole('heading', { name: 'Replace this library?' })).toBeVisible()
  await expect(page.getByText(/Importing does not merge or duplicate libraries/)).toBeVisible()
  await page.getByRole('button', { name: 'Replace & restore' }).click()

  await expect(page.getByText(/Backup restored/)).toBeVisible()
  await expect(firstCard).toContainText('The Lantern Keeper — Revised')
  await expect(firstCard.locator('.story-description')).toContainText('Warm lights guide the way home.')
  await expect(page.locator('.story-card')).toHaveCount(2)

  await page.reload()
  await expect(page.locator('.story-card').first()).toContainText('The Lantern Keeper — Revised')
  await expect(page.locator('.story-card')).toHaveCount(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})
