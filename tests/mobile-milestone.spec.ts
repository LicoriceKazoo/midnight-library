import { expect, test } from '@playwright/test'

async function swipeQuickNotesDown(page: import('@playwright/test').Page) {
  const handle = page.locator('.notes-drag-zone')
  const box = await handle.boundingBox()
  if (!box) throw new Error('Quick Notes drag handle is not visible.')
  const client = await page.context().newCDPSession(page)
  const x = box.x + box.width / 2
  const startY = box.y + box.height / 2
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY }] })
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: startY + 100 }] })
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

async function openSampleChapter(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /The Lantern Keeper/ }).click()
  await page.locator('.chapter-open').filter({ hasText: 'The Light Beyond the Breakwater' }).click()
}

test('persists reading preferences, formatted editing, and quick notes on mobile', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('midnight-library')
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  })
  await page.reload()

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)

  await page.getByRole('button', { name: 'Open reading settings' }).click()
  const fontSize = page.getByLabel('Font size')
  await expect(fontSize).toHaveAttribute('min', '11')
  await expect(fontSize).toHaveAttribute('max', '30')
  await fontSize.fill('30')
  await page.getByRole('button', { name: 'Increase line spacing' }).click()
  await expect(page.locator('.line-control output')).toHaveText('1.85')
  await page.getByRole('button', { name: 'Close menu' }).click()

  await openSampleChapter(page)
  await page.getByRole('button', { name: /Edit chapter/ }).click()
  const editor = page.locator('.chapter-editor-content')
  await expect(editor).toBeVisible()
  await editor.fill('A golden sentence waits beside the midnight window.')
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(editor).not.toContainText('A golden sentence')
  await page.getByRole('button', { name: 'Redo' }).click()
  await expect(editor).toContainText('A golden sentence')
  await editor.press('Control+A')
  await page.getByRole('button', { name: 'Bold' }).click()
  await page.getByRole('button', { name: 'Heading' }).click()
  await page.getByRole('button', { name: 'Set text color #e4c57d' }).click()
  await expect(page.locator('.editor-status-bar')).toContainText('Saved locally')
  await page.getByRole('button', { name: /Reading mode/ }).click()
  await expect(page.locator('.rich-reading-content h2 strong')).toContainText('A golden sentence')

  await page.getByRole('button', { name: 'Open quick notes' }).click()
  await page.getByRole('button', { name: /New note/ }).click()
  await page.locator('.note-card textarea').fill('Remember the blue lantern at the harbor gate.')
  await expect(page.locator('.notes-footer')).toContainText('Saved locally')
  await swipeQuickNotesDown(page)
  await expect(page.locator('.notes-sheet')).not.toHaveClass(/is-open/)

  await page.reload()
  await page.getByRole('button', { name: 'Open reading settings' }).click()
  await expect(page.getByLabel('Font size')).toHaveValue('30')
  await expect(page.locator('.line-control output')).toHaveText('1.85')
  await page.getByRole('button', { name: 'Close menu' }).click()

  await openSampleChapter(page)
  await expect(page.locator('.rich-reading-content h2 strong')).toContainText('A golden sentence')
  await page.getByRole('button', { name: 'Open quick notes' }).click()
  await expect(page.locator('.note-card textarea')).toHaveValue('Remember the blue lantern at the harbor gate.')
  await page.locator('.notes-header').getByRole('button', { name: 'Close quick notes' }).click()

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})
