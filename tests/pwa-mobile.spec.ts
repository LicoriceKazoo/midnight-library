import { expect, test } from '@playwright/test'

async function openSampleChapter(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /The Lantern Keeper/ }).click()
  await page.locator('.chapter-open').filter({ hasText: 'The Light Beyond the Breakwater' }).click()
}

test('is installable and preserves offline reading and writing on mobile', async ({ context, page }) => {
  await page.goto('/')

  const manifest = await page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    if (!link) throw new Error('Manifest link is missing.')
    const response = await fetch(link.href)
    return response.json() as Promise<{
      name: string
      display: string
      theme_color: string
      background_color: string
      icons: { src: string; sizes: string }[]
    }>
  })
  expect(manifest).toMatchObject({
    name: 'The Midnight Library',
    display: 'standalone',
    theme_color: '#080d19',
    background_color: '#080d19',
  })
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']))

  const iconSizes = await page.evaluate(async () => Promise.all(['/icons/icon-192.png', '/icons/icon-512.png'].map(async (src) => {
    const bitmap = await createImageBitmap(await (await fetch(src)).blob())
    const dimensions = [bitmap.width, bitmap.height]
    bitmap.close()
    return dimensions
  })))
  expect(iconSizes).toEqual([[192, 192], [512, 512]])

  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)

  await openSampleChapter(page)
  await expect(page.locator('.reading-pages')).toContainText('By the time Mara reached Bellweather Harbor')

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Stories to return to.' })).toBeVisible()
  await openSampleChapter(page)
  await page.getByRole('button', { name: /Edit chapter/ }).click()
  const editor = page.locator('.chapter-editor-content')
  await editor.fill('Written offline beneath a quiet constellation.')
  await expect(page.locator('.editor-status-bar')).toContainText('Saved locally')
  await page.getByRole('button', { name: /Reading mode/ }).click()
  await expect(page.locator('.reading-pages')).toContainText('Written offline beneath a quiet constellation.')

  await page.reload()
  await openSampleChapter(page)
  await expect(page.locator('.reading-pages')).toContainText('Written offline beneath a quiet constellation.')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})
