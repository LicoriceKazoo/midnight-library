# Public story sharing on Netlify

This milestone keeps local writing private while adding optional, owner-initiated public snapshots on the existing Netlify site.

## Architecture

- Stories, notes, audio, backups, and preferences continue to live in the browser's IndexedDB.
- Choosing **Share** does not upload anything. The owner selects chapters, previews the snapshot, and confirms publication before a request is sent.
- The browser sends only the selected story title, description, and selected chapter IDs, titles, and rich-text HTML.
- A Netlify Function validates the owner's verified Identity token and exact configured user ID before every create, update, or delete.
- Sanitized snapshots are stored in the site-wide `midnight-library-published-stories` Netlify Blobs store with strong consistency. Site-wide storage survives deploy replacement and branch changes.
- Readers request one unpredictable UUID at `/share/<publication-id>`. There is no public listing endpoint.
- Public reads require no account. Mutation requests require a bearer token from Netlify Identity.

The deployed app and Function never receive private notes, audio files, other stories, or unchecked chapters. Publication is a snapshot. Later local edits stay local until the owner explicitly chooses **Republish edits**.

JSON backups retain the local publication ID and chapter-selection metadata so the owner can continue managing the same snapshot after a restore. Importing a backup does not publish, republish, unpublish, or otherwise contact the service. A published story must be unpublished before its local copy can be deleted, which prevents an unreachable remote snapshot from being left behind accidentally.

## Platform limitations

Netlify Identity must be available for the existing site and enabled manually. This branch does not enable Identity, create a user, create environment variables, provision a Blob, change production deployment settings, or publish a real story.

If Netlify no longer offers Identity to the account or site, do not remove the Function's authorization check or place an administrative token in browser code. Leave publishing disabled until a supported identity provider is selected. An external provider such as Auth0 or Clerk would add another service and is therefore outside this preferred single-provider implementation.

The Function uses a small in-memory request throttle in addition to Netlify's platform protections. It limits ordinary accidental or low-volume abuse per warm Function instance, but it is not a globally coordinated rate-limit database. All mutations still require the exact configured publisher identity, payloads are size-limited, public records use unguessable identifiers, and no listing operation exists.

Netlify Blobs are site-wide and strongly consistent in this implementation, so an unpublish is reflected by normal Function reads immediately. Readers may still retain screenshots, browser history, or copies they downloaded before unpublishing; those copies cannot be revoked.

Site-wide also means production and preview deploys for the same Netlify site address the same Blob store. Configure the publisher ID only in deploy contexts where real snapshot mutations are intended, and use a separate Netlify test site if isolated end-to-end publication testing is required.

## Netlify Free plan implications

This design uses the existing static site plus Functions, Blobs, and one Identity user. These services do not require a continuously running server and do not need manual restarts after inactivity. They consume the site's current Free-plan usage allowance or credits.

Netlify can change allowances and pricing. Before enabling the feature, review the site's **Usage & billing** page and the current official pages for [Functions](https://docs.netlify.com/functions/overview/), [Blobs](https://docs.netlify.com/blobs/overview/), [Identity](https://docs.netlify.com/security/secure-access-to-sites/identity/overview/), and [Netlify pricing](https://www.netlify.com/pricing/). For small personal stories and occasional reads, requests and storage should be modest, but the app cannot guarantee that a particular traffic level will always remain within a changing Free plan.

Uploaded audio remains excluded from published snapshots and therefore does not consume Blob storage through this feature.

## One-time Identity and publisher setup

Perform these steps only after reviewing and approving this branch:

1. Merge the approved branch through the normal review process. Keep the existing Netlify site and HTTPS address.
2. In the existing site's Netlify dashboard, open **Identity** and choose **Enable Identity**.
3. Under **Registration preferences**, choose **Invite only**. Do not enable open registration. External login providers are unnecessary for a single publisher.
4. Invite the owner's email address. Open the newest invitation link on the deployed site and use the automatically opened **Complete your signup** dialog to choose a strong, unique password.
5. Open the new Identity user's details and copy the stable user ID/UID, not merely the email address.
6. Open **Site configuration → Environment variables** and add `MIDNIGHT_LIBRARY_PUBLISHER_ID` with that user ID. Scope it to Functions and to every deploy context where publishing should be allowed. The value is a server-side authorization setting; do not prefix it with `VITE_` or put it in source control.
7. Deploy the approved commit. Confirm that Netlify detects `netlify/functions/published-story.ts` and that the deployment's Node version is 24 as configured in `netlify.toml`.
8. Open the deployed application, choose **Share** on a story, and select **Publisher sign in**. Sign in with the invited Identity account.
9. Select chapters, preview the snapshot, choose **Publish story**, review the warning, and confirm. The first successful publication creates the site-wide Blob store automatically.
10. Open the generated link in a private browser window. It should load without authentication and contain only the selected public content.

Even if registration is accidentally opened later, a newly registered user cannot publish because the Function also requires the exact `MIDNIGHT_LIBRARY_PUBLISHER_ID` subject.

Invitation and password-recovery email links land on the application with a short-lived token in the URL fragment. The app initializes Netlify Identity only for a recognized callback, and the widget removes the fragment as it opens the password dialog. The application does not log or persist these tokens. If the dialog reports an expired or invalid link, request a new invitation or password-reset email and use only the newest message.

## Security and privacy behavior

- Server-side authorization uses Netlify's verified Function `clientContext.user.sub` value.
- Administrative Netlify tokens are not required and are never sent to the browser.
- HTML is allowlist-sanitized on the server and sanitized again before browser rendering.
- Story and chapter lengths, chapter count, total rich-text size, and request body size are bounded.
- Public responses use `Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow, noarchive`.
- `/share/*` HTML also receives a site header that tells search engines not to index it.
- Unpublishing deletes the site-wide Blob. A subsequent normal read receives a not-found response.
- Storage failures return a generic service error without exposing internal details.
- The public reader contains no edit, notes, backup, audio, or local-library controls.

## Local development

The Vite development server can preview the public reader when its API request is mocked by tests. End-to-end testing of Identity, Functions, and Blobs requires Netlify's local development environment or a non-production Netlify deploy context configured with a separate invited test identity and publisher ID.

Do not reuse a production administrative secret in local `.env` files. `MIDNIGHT_LIBRARY_PUBLISHER_ID` is an identifier rather than a credential, but it should still be configured through Netlify for deployed contexts.
