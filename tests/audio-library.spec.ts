import { expect, test } from '@playwright/test'

async function openAudioLibrary(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Open navigation menu' }).click()
  await page.getByRole('button', { name: 'Audio Library' }).click()
}

test('stores tracks and playlists and preserves the player across app navigation', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('midnight-library')
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  })
  await page.reload()
  await openAudioLibrary(page)

  await page.getByLabel('Choose audio files').setInputFiles({
    name: 'not-a-track.txt', mimeType: 'text/plain', buffer: Buffer.from('not audio'),
  })
  await expect(page.getByText(/not a browser-playable audio file/)).toBeVisible()

  await page.getByLabel('Choose audio files').setInputFiles([
    { name: 'rain-one.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('first-audio') },
    { name: 'harbor-two.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('second-audio') },
  ])
  await expect(page.locator('.audio-track-card')).toHaveCount(2)

  await page.locator('.audio-track-card').first().getByRole('button', { name: /Edit/ }).click()
  await page.getByLabel('Display title').fill('Rain at Midnight')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('.audio-track-card').first()).toContainText('Rain at Midnight')

  await page.getByRole('button', { name: /New playlist/ }).click()
  await page.getByLabel('Playlist name').fill('Harbor Reading')
  await page.getByRole('button', { name: 'Create' }).click()
  await page.getByRole('button', { name: 'Tracks' }).click()
  const trackChoices = page.locator('.playlist-track-picker input')
  await trackChoices.nth(0).check()
  await trackChoices.nth(1).check()
  await page.getByRole('button', { name: 'Save tracks' }).click()
  await expect(page.locator('.playlist-card')).toContainText('2 tracks')

  await page.getByRole('button', { name: 'Rename' }).click()
  await page.getByLabel('Playlist name').fill('Storm Reading')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('.playlist-card')).toContainText('Storm Reading')

  await page.getByRole('button', { name: 'Play Storm Reading' }).click()
  const player = page.locator('.compact-audio-player')
  await expect(player).toContainText('Rain at Midnight')
  await player.getByRole('button', { name: 'Expand audio player' }).click()
  await player.getByRole('button', { name: 'Next track' }).click()
  await expect(player).toContainText('harbor two')
  await player.getByRole('button', { name: 'Previous track' }).click()
  await expect(player).toContainText('Rain at Midnight')
  await player.getByRole('button', { name: 'Repeat: off' }).click()
  await player.getByRole('button', { name: 'Repeat: one' }).click()
  await expect(player.getByRole('button', { name: 'Repeat: playlist' })).toBeVisible()
  await player.getByRole('button', { name: 'Shuffle' }).click()
  await player.getByLabel('Volume').fill('0.55')
  await player.getByRole('button', { name: 'Mute' }).click()
  await player.getByRole('button', { name: 'Collapse audio player' }).click()

  await page.getByRole('button', { name: 'Go back' }).click()
  await page.getByRole('button', { name: /The Lantern Keeper/ }).click()
  await page.locator('.chapter-open').first().click()
  await expect(player).toContainText('Rain at Midnight')
  await page.getByRole('button', { name: /Edit chapter/ }).click()
  await expect(page.locator('.chapter-editor-content')).toBeVisible()
  await expect(player).toContainText('Rain at Midnight')
  await page.getByRole('button', { name: /Reading mode/ }).click()
  await page.getByRole('button', { name: 'Open quick notes' }).click()
  await page.locator('.notes-header').getByRole('button', { name: 'Close quick notes' }).click()
  await expect(player).toContainText('Rain at Midnight')

  await page.waitForTimeout(600)
  await page.reload()
  await openAudioLibrary(page)
  await expect(page.locator('.audio-track-card')).toHaveCount(2)
  await expect(page.locator('.playlist-card')).toContainText('Storm Reading')
  await expect(page.locator('.playlist-card')).toContainText('2 tracks')
  await expect(player).toContainText('Rain at Midnight')
  await player.getByRole('button', { name: 'Expand audio player' }).click()
  await expect(player.getByRole('button', { name: 'Repeat: playlist' })).toBeVisible()
  await expect(player.getByRole('button', { name: 'Shuffle' })).toHaveClass(/active/)
  await expect(player.getByLabel('Volume')).toHaveValue('0.55')
  await expect(player.getByRole('button', { name: 'Unmute' })).toBeVisible()
  await player.getByRole('button', { name: 'Collapse audio player' }).click()

  await page.getByRole('button', { name: 'Tracks' }).click()
  await page.locator('.playlist-track-picker input').nth(1).uncheck()
  await page.getByRole('button', { name: 'Save tracks' }).click()
  await expect(page.locator('.playlist-card')).toContainText('1 track')
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
  await expect(page.locator('.playlist-card')).toHaveCount(0)
  await expect(page.locator('.audio-track-card')).toHaveCount(2)

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})
