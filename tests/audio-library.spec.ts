import { expect, test } from '@playwright/test'

function createPlayableWav(frequency: number) {
  const sampleRate = 8_000
  const sampleCount = sampleRate * 4
  const buffer = Buffer.alloc(44 + sampleCount * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(buffer.length - 8, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(sampleCount * 2, 40)
  for (let sample = 0; sample < sampleCount; sample += 1) {
    buffer.writeInt16LE(Math.round(Math.sin(2 * Math.PI * frequency * sample / sampleRate) * 4_000), 44 + sample * 2)
  }
  return buffer
}

async function openAudioLibrary(page: import('@playwright/test').Page) {
  const menu = page.getByRole('button', { name: 'Open navigation menu' })
  if (await menu.isVisible()) await menu.click()
  else await page.getByRole('button', { name: 'Open reading settings' }).click()
  await page.getByRole('button', { name: 'Audio Library' }).click()
}

async function swipePlayer(page: import('@playwright/test').Page, distance: number) {
  const handle = page.locator('.player-swipe-handle')
  const box = await handle.boundingBox()
  if (!box) throw new Error('Audio player handle is not visible.')
  const client = await page.context().newCDPSession(page)
  const x = box.x + box.width / 2
  const startY = box.y + box.height / 2
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY }] })
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: startY + distance }] })
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
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
    { name: 'rain-one.wav', mimeType: 'audio/wav', buffer: createPlayableWav(220) },
    { name: 'harbor-two.wav', mimeType: 'audio/wav', buffer: createPlayableWav(330) },
  ])
  await expect(page.locator('.audio-track-card')).toHaveCount(2)

  await page.locator('.audio-track-card').first().getByRole('button', { name: /Edit/ }).click()
  await page.getByLabel('Display title').fill('Rain at Midnight')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('.audio-track-card').first()).toContainText('Rain at Midnight')

  await page.getByRole('button', { name: /New playlist/ }).click()
  await page.getByLabel('Playlist name').fill('Harbor Reading')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByRole('button', { name: 'Play Harbor Reading' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Play Harbor Reading' })).toHaveAttribute('title', 'Add tracks before playing')
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

  const player = page.locator('.compact-audio-player')
  await page.locator('.audio-track-card').first().getByRole('button', { name: /Play/ }).click()
  await expect.poll(() => page.locator('audio').evaluate((element: HTMLAudioElement) => element.paused)).toBe(false)
  await player.getByRole('button', { name: 'Pause' }).click()
  await expect.poll(() => page.locator('audio').evaluate((element: HTMLAudioElement) => element.paused)).toBe(true)
  const pausedAt = await page.locator('audio').evaluate((element: HTMLAudioElement) => element.currentTime)

  await page.getByRole('button', { name: 'Play Storm Reading' }).click()
  await expect(player).toContainText('Rain at Midnight')
  await expect.poll(() => page.locator('audio').evaluate((element: HTMLAudioElement) => element.paused)).toBe(false)
  await expect.poll(() => page.locator('audio').evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(pausedAt + 0.05)

  await page.evaluate(() => {
    const badge = document.createElement('div')
    badge.id = 'provider-badge-test'
    Object.assign(badge.style, { position: 'fixed', zIndex: '999', right: '0', bottom: '0', left: '0', height: '72px' })
    document.body.append(badge)
  })
  await swipePlayer(page, -70)
  await expect(player).toHaveClass(/expanded/)
  await expect(player.getByLabel('Track position')).toBeVisible()
  await expect(player.getByLabel('Volume')).toBeVisible()
  await expect.poll(() => page.evaluate(() => {
    const controlsBottom = document.querySelector('.player-options')?.getBoundingClientRect().bottom ?? Infinity
    const badgeTop = document.querySelector('#provider-badge-test')?.getBoundingClientRect().top ?? 0
    return badgeTop - controlsBottom
  })).toBeGreaterThanOrEqual(0)
  await swipePlayer(page, 70)
  await expect(player).not.toHaveClass(/expanded/)
  await page.waitForTimeout(350)
  await swipePlayer(page, 70)
  await expect(player).toBeHidden()
  await expect.poll(() => page.locator('audio').evaluate((element: HTMLAudioElement) => element.paused)).toBe(true)
  await page.locator('.audio-track-card').first().getByRole('button', { name: /Play/ }).click()
  await expect(player).toBeVisible()
  await expect(player.getByRole('button', { name: 'Hide audio player' })).toBeVisible()
  await expect.poll(() => page.locator('audio').evaluate((element: HTMLAudioElement) => element.paused)).toBe(false)
  await player.locator('.player-swipe-handle').click()
  await expect(player).toHaveClass(/expanded/)
  await page.goBack()
  await expect(player).not.toHaveClass(/expanded/)
  await player.locator('.player-swipe-handle').click()
  await expect(player).toHaveClass(/expanded/)
  await player.getByRole('button', { name: 'Collapse audio player', exact: true }).click()
  await expect(player).not.toHaveClass(/expanded/)
  await page.evaluate(() => document.querySelector('#provider-badge-test')?.remove())
  await player.locator('.player-swipe-handle').click()
  await expect(player).toHaveClass(/expanded/)
  await player.getByRole('button', { name: 'Next track' }).click()
  await expect(player).toContainText('harbor two')
  await expect.poll(() => page.locator('audio').evaluate((element: HTMLAudioElement) => element.paused)).toBe(false)
  await page.locator('.audio-track-card').first().getByRole('button', { name: /Play/ }).click()
  await expect(player).toContainText('Rain at Midnight')
  await page.getByRole('button', { name: 'Play Storm Reading' }).click()
  await expect(player).toContainText('harbor two')
  await expect.poll(() => page.locator('audio').evaluate((element: HTMLAudioElement) => element.paused)).toBe(false)
  await player.getByRole('button', { name: 'Previous track' }).click()
  await expect(player).toContainText('Rain at Midnight')
  await player.getByRole('button', { name: 'Repeat: off' }).click()
  await player.getByRole('button', { name: 'Repeat: one' }).click()
  await expect(player.getByRole('button', { name: 'Repeat: playlist' })).toBeVisible()
  await player.getByRole('button', { name: 'Shuffle' }).click()
  await player.getByLabel('Volume').fill('0.55')
  await player.getByRole('button', { name: 'Mute' }).click()
  await player.getByRole('button', { name: 'Collapse audio player', exact: true }).click()

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
  await player.getByRole('button', { name: 'Expand audio player', exact: true }).click()
  await expect(player.getByRole('button', { name: 'Repeat: playlist' })).toBeVisible()
  await expect(player.getByRole('button', { name: 'Shuffle' })).toHaveClass(/active/)
  await expect(player.getByLabel('Volume')).toHaveValue('0.55')
  await expect(player.getByRole('button', { name: 'Unmute' })).toBeVisible()
  await player.getByRole('button', { name: 'Collapse audio player', exact: true }).click()

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
