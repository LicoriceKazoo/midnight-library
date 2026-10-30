import { expect, test } from '@playwright/test'

const publicationId = '123e4567-e89b-42d3-a456-426614174000'

test('previews only selected chapters and requires explicit publication confirmation', async ({ page }) => {
  await page.goto('/')
  await page.locator('.story-card').first().getByRole('button', { name: 'Share' }).click()
  const dialog = page.getByRole('dialog', { name: /Share “The Lantern Keeper”/ })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Notes, audio, other stories, and unchecked chapters stay on this device.')

  const chapters = dialog.locator('input[type="checkbox"]')
  await expect(chapters).toHaveCount(2)
  await chapters.nth(1).uncheck()
  await dialog.getByRole('button', { name: 'Preview published version' }).click()
  const preview = dialog.getByLabel('Published story preview')
  await expect(preview.getByRole('heading', { name: 'The Light Beyond the Breakwater' })).toBeVisible()
  await expect(preview.getByRole('heading', { name: 'A Map Made of Starlight' })).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Publish story' }).click()
  await expect(dialog).toContainText('Publish a snapshot containing 1 selected chapter?')
  await expect(dialog.getByRole('button', { name: 'Confirm publish' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test('reads a sanitized public story without authentication and preserves the private local library', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('midnight-library')
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  })
  await page.reload()

  await page.getByRole('button', { name: /The Lantern Keeper/ }).click()
  await page.locator('.chapter-open').first().click()
  await page.getByRole('button', { name: 'Open quick notes' }).click()
  await page.getByRole('button', { name: /New note/ }).click()
  await page.locator('.note-card textarea').fill('Private note that must never be published.')
  await expect(page.locator('.notes-footer')).toContainText('Saved locally')
  await page.locator('.notes-header').getByRole('button', { name: 'Close quick notes' }).click()

  let authorizationHeader: string | undefined
  await page.route('**/api/published-stories/**', async (route) => {
    authorizationHeader = route.request().headers().authorization
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        version: 1,
        id: publicationId,
        title: 'A Shared Lantern',
        description: 'A public snapshot for readers.',
        publishedAt: '2026-10-30T12:00:00.000Z',
        updatedAt: '2026-10-30T13:00:00.000Z',
        chapters: [
          { id: 'public-chapter', title: 'The Open Door', contentHtml: '<p data-indent="1"><strong>Public words</strong><script>window.unsafeShare = true</script></p>' },
        ],
      }),
    })
  })

  await page.goto(`/share/${publicationId}`)
  await expect(page.getByRole('heading', { name: 'A Shared Lantern' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'The Open Door' })).toBeVisible()
  await expect(page.getByText('Public words')).toBeVisible()
  await expect(page.getByText('Private note that must never be published.')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Edit chapter/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Open quick notes/ })).toHaveCount(0)
  expect(authorizationHeader).toBeUndefined()
  expect(await page.evaluate(() => 'unsafeShare' in window)).toBe(false)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)

  await page.getByText('Reading comfort').click()
  await page.getByLabel('Shared story font size').fill('24')
  await page.getByRole('button', { name: 'Increase shared story line spacing' }).click()
  await page.getByRole('button', { name: 'Use Amethyst Dusk theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'amethyst')
  await expect(page.locator('.public-chapters .rich-reading-content')).toHaveCSS('font-size', '24px')
  await expect(page).toHaveTitle('A Shared Lantern — The Midnight Library')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)

  await page.goto('/')
  await page.getByRole('button', { name: /The Lantern Keeper/ }).click()
  await page.locator('.chapter-open').first().click()
  await page.getByRole('button', { name: 'Open quick notes' }).click()
  await expect(page.locator('.note-card textarea')).toHaveValue('Private note that must never be published.')
})

test('shows a graceful missing-story state', async ({ page }) => {
  await page.route('**/api/published-stories/**', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Published story not found.' }) }))
  await page.goto(`/share/${publicationId}`)
  await expect(page.getByRole('heading', { name: 'This story is unavailable' })).toBeVisible()
})
