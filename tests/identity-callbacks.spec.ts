import { expect, test, type Page } from '@playwright/test'

const accessToken = 'header.eyJleHAiOjQxMDI0NDQ4MDB9.signature'
const identityUser = {
  id: 'publisher-user-id',
  email: 'owner@example.com',
  app_metadata: { provider: 'email', roles: [] },
  user_metadata: {},
  created_at: '2026-10-30T12:00:00.000Z',
  updated_at: '2026-10-30T12:00:00.000Z',
}

async function mockIdentity(page: Page, options: { rejectRecovery?: boolean } = {}) {
  const requests: Array<{ method: string; path: string; body: unknown }> = []
  await page.addInitScript(() => localStorage.setItem('netlifySiteURL', window.location.origin))
  await page.route('**/.netlify/identity/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const body = request.postData() ? request.postDataJSON() as unknown : null
    requests.push({ method: request.method(), path, body })

    if (path.endsWith('/settings')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ autoconfirm: false, disable_signup: true, external: {} }),
      })
      return
    }
    if (path.endsWith('/verify') && options.rejectRecovery) {
      await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ msg: 'Recovery link has expired' }) })
      return
    }
    if (path.endsWith('/verify')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ access_token: accessToken, refresh_token: 'test-refresh-token', token_type: 'bearer', expires_in: 3600 }),
      })
      return
    }
    if (path.endsWith('/user')) {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(identityUser) })
      return
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
  })
  return requests
}

test('opens an invitation, activates the publisher, and exposes the signed-in sharing state', async ({ page }) => {
  const requests = await mockIdentity(page)
  await page.goto('/#invite_token=test-invitation-token')

  const widget = page.frameLocator('#netlify-identity-widget')
  await expect(widget.getByText('Complete your signup')).toBeVisible()
  await expect(page).not.toHaveURL(/invite_token/u)
  await widget.locator('input[name="password"]').fill('Test invitation password')
  await widget.getByRole('button', { name: 'Sign up' }).click()
  await expect(widget.getByText('Logged in as')).toBeVisible()
  await expect(widget.getByText('owner@example.com')).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Publisher account activated')

  const invitationRequest = requests.find((request) => request.path.endsWith('/verify'))
  expect(invitationRequest?.body).toEqual({ token: 'test-invitation-token', password: 'Test invitation password', type: 'signup' })
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('test-invitation-token')

  await widget.getByRole('button', { name: 'Close' }).click()
  await page.locator('.story-card').first().getByRole('button', { name: 'Share' }).click()
  await expect(page.getByRole('dialog', { name: /Share “The Lantern Keeper”/ })).toContainText('Publisher signed in')
})

test('opens password recovery and signs the publisher in after updating the password', async ({ page }) => {
  const requests = await mockIdentity(page)
  await page.goto('/#recovery_token=test-recovery-token')

  const widget = page.frameLocator('#netlify-identity-widget')
  await expect(widget.getByText('Recover password')).toBeVisible()
  await expect(page).not.toHaveURL(/recovery_token/u)
  await widget.locator('input[name="password"]').fill('Updated test password')
  await widget.getByRole('button', { name: 'Update password' }).click()
  await expect(widget.getByText('Logged in as')).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Password updated')

  expect(requests.some((request) => request.path.endsWith('/verify') && request.body && (request.body as { type?: string }).type === 'recovery')).toBe(true)
  expect(requests.some((request) => request.method === 'PUT' && request.path.endsWith('/user') && (request.body as { password?: string }).password === 'Updated test password')).toBe(true)
})

test('explains an expired password recovery link without retaining it in the URL', async ({ page }) => {
  const consoleMessages: string[] = []
  page.on('console', (message) => consoleMessages.push(message.text()))
  await mockIdentity(page, { rejectRecovery: true })
  await page.goto('/#recovery_token=expired-test-token')

  await expect(page.getByRole('alert')).toContainText('invalid or has expired')
  await expect(page).not.toHaveURL(/recovery_token/u)
  const widget = page.frameLocator('#netlify-identity-widget')
  await expect(widget.getByText('Recovery link has expired')).toBeVisible()
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('expired-test-token')
  expect(consoleMessages.join('\n')).not.toContain('expired-test-token')
})
