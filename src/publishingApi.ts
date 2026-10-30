import type { PublishedStoryPayload, PublishedStory } from './publishing'

async function publicationRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(path, { ...options, cache: 'no-store' })
  if (response.status === 204) return null
  const body = await response.json().catch(() => ({ error: 'The publishing service returned an unreadable response.' })) as { error?: string }
  if (!response.ok) throw new Error(body.error || `Publishing failed with status ${response.status}.`)
  return body
}

export async function fetchPublishedStory(id: string): Promise<PublishedStory> {
  return publicationRequest(`/api/published-stories/${encodeURIComponent(id)}`) as Promise<PublishedStory>
}

export async function publishStory(payload: PublishedStoryPayload, token: string, publicationId?: string) {
  return publicationRequest(
    `/api/published-stories${publicationId ? `/${encodeURIComponent(publicationId)}` : ''}`,
    {
      method: publicationId ? 'PUT' : 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  ) as Promise<PublishedStory>
}

export async function unpublishStory(publicationId: string, token: string) {
  await publicationRequest(`/api/published-stories/${encodeURIComponent(publicationId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}
