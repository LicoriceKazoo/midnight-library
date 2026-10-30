import { expect, test } from '@playwright/test'

test('Android Back dismisses overlays before moving through app views', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /The Lantern Keeper/ }).click()
  await expect(page.getByRole('heading', { name: 'The Lantern Keeper' })).toBeVisible()
  await page.locator('.chapter-open').filter({ hasText: 'The Light Beyond the Breakwater' }).click()
  await expect(page.getByRole('heading', { name: 'The Light Beyond the Breakwater' })).toBeVisible()

  await page.evaluate(() => window.scrollTo({ top: 420 }))
  const readingPosition = await page.evaluate(() => window.scrollY)
  await page.getByRole('button', { name: 'Open reading settings' }).click()
  await expect(page.locator('.navigation-drawer')).toHaveClass(/is-open/)
  await page.goBack()
  await expect(page.locator('.navigation-drawer')).not.toHaveClass(/is-open/)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(readingPosition)

  await page.getByRole('button', { name: 'Open quick notes' }).click()
  await expect(page.locator('.notes-sheet')).toHaveClass(/is-open/)
  await page.goBack()
  await expect(page.locator('.notes-sheet')).not.toHaveClass(/is-open/)
  await expect(page.getByRole('heading', { name: 'The Light Beyond the Breakwater' })).toBeVisible()

  await page.goBack()
  await expect(page.getByRole('heading', { name: 'The Lantern Keeper' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit details' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'The Lantern Keeper' })).toBeVisible()

  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Stories to return to.' })).toBeVisible()

  await page.goBack()
  await expect.poll(() => page.url()).toBe('about:blank')
})
