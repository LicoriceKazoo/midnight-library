import { expect, test } from '@playwright/test'

async function resetLibrary(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('midnight-library')
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  })
  await page.reload()
}

async function openEditor(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /The Lantern Keeper/ }).click()
  await page.locator('.chapter-open').first().click()
  await page.getByRole('button', { name: /Edit chapter/ }).click()
  await expect(page.locator('.chapter-editor-content')).toBeVisible()
}

test('preserves selections, cleans pasted colors, and persists paragraph indentation', async ({ page }) => {
  await resetLibrary(page)
  await openEditor(page)

  const editor = page.locator('.chapter-editor-content')
  const palette = page.getByRole('button', { name: 'Text colors' })
  const gold = page.getByRole('button', { name: 'Set text color #e4c57d' })
  await editor.fill('A selected sentence keeps its color.')
  await editor.press('Control+A')
  await palette.click()
  await expect(gold).toBeVisible()
  await gold.click()
  await expect(editor.locator('span')).toHaveCSS('color', 'rgb(228, 197, 125)')
  await palette.click()
  await expect(gold).toBeHidden()

  await editor.press('Control+A')
  await editor.evaluate((element) => {
    const clipboard = new DataTransfer()
    clipboard.setData('text/html', [
      '<p style="color: rgb(4, 5, 7)"><strong>Readable dark paste</strong></p>',
      '<p><em>Second paragraph</em> and <span style="color: #e4c57d">gold words</span>.</p>',
      '<script>window.pasteWasUnsafe = true</script>',
    ].join(''))
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: clipboard }))
  })

  await expect(editor.locator('p')).toHaveCount(2)
  await expect(editor.locator('strong')).toHaveText('Readable dark paste')
  await expect(editor.locator('em')).toHaveText('Second paragraph')
  await expect(editor.locator('span')).toHaveCSS('color', 'rgb(228, 197, 125)')
  expect(await editor.locator('[style*="color"]').evaluateAll((elements) =>
    elements.every((element) => !getComputedStyle(element).color.match(/^rgb\((?:[0-4]?\d|5[0-2]),/u)),
  )).toBe(true)
  expect(await page.evaluate(() => 'pasteWasUnsafe' in window)).toBe(false)

  await editor.press('Control+A')
  await page.getByRole('button', { name: 'Indent paragraphs' }).click()
  await expect(editor.locator('p[data-indent="1"]')).toHaveCount(2)
  await page.getByRole('button', { name: 'Outdent paragraphs' }).click()
  await expect(editor.locator('p[data-indent]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Indent paragraphs' }).click()
  await page.getByRole('button', { name: 'Toggle first-line indent' }).click()
  await expect(editor.locator('p[data-indent="1"][data-first-line-indent="true"]')).toHaveCount(2)
  await expect(page.locator('.editor-status-bar')).toContainText('Saved locally')

  await page.getByRole('button', { name: /Reading mode/ }).click()
  await expect(page.locator('.rich-reading-content p[data-indent="1"][data-first-line-indent="true"]')).toHaveCount(2)
  await page.waitForTimeout(450)
  await page.reload()
  await expect(page.locator('.rich-reading-content p[data-indent="1"][data-first-line-indent="true"]')).toHaveCount(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test('switches and persists accessible cozy themes at Galaxy S24 dimensions', async ({ page }) => {
  await resetLibrary(page)
  await page.getByRole('button', { name: 'Open reading settings' }).click()
  await page.getByRole('button', { name: 'Use Amethyst Dusk theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'amethyst')
  await expect(page.getByRole('button', { name: 'Use Amethyst Dusk theme' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Close menu' }).click()

  await page.getByRole('button', { name: /The Lantern Keeper/ }).click()
  await page.locator('.chapter-open').first().click()
  const contrast = await page.locator('.reading-page').first().evaluate((element) => {
    const parse = (value: string) => value.match(/[\d.]+/gu)?.slice(0, 3).map(Number) ?? [0, 0, 0]
    const luminance = (value: string) => {
      const channels = parse(value).map((channel) => {
        const normalized = channel / 255
        return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4
      })
      return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2]
    }
    const style = getComputedStyle(element)
    const foreground = luminance(style.color)
    const background = luminance(style.backgroundColor)
    return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05)
  })
  expect(contrast).toBeGreaterThan(7)

  await page.waitForTimeout(450)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'amethyst')
  await page.getByRole('button', { name: 'Open reading settings' }).click()
  await page.getByRole('button', { name: 'Use Charcoal Hearth theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'charcoal')
  await page.getByRole('button', { name: 'Close menu' }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})
