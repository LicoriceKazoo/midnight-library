# midnight-library
In development: Cozy story reader and editor.

## Development

Requires Node.js 22.12 or newer. Netlify builds use Node.js 24 as configured in
`netlify.toml`.

```sh
npm install
npm run dev -- --host 0.0.0.0
```

Vite serves the app on port 5173.

The first application milestone includes a responsive story library, story and
chapter management, a continuous reading view, persisted reading preferences,
and local IndexedDB storage. The included stories are labeled sample content and
can be safely renamed or deleted.

The editing milestone adds rich-text chapter editing with formatting history and
text colors, automatic save status, story-level quick notes, and expanded reading
comfort controls. Older paragraph-based chapters are migrated automatically when
they are opened.

Story titles and multiline descriptions can be edited from the library or story
view. The navigation drawer also supports versioned JSON exports and validated,
replacement-only restores of the complete library and reading preferences.

The integrated audio milestone stores browser-playable audio in separate local
IndexedDB stores, with playlists and persistent playback controls. Audio files are
intentionally excluded from portable story JSON backups.

The mobile deployment milestone adds an installable, offline-capable Progressive
Web App with safe, user-confirmed updates. See [DEPLOYMENT.md](DEPLOYMENT.md) for
free Netlify and Vercel setup, Galaxy S24 installation, and device data guidance.

Optional public sharing creates an explicit, read-only snapshot containing only
the chapters selected by the owner. It uses authenticated Netlify Functions and
site-wide Netlify Blobs while keeping local writing, notes, and audio in IndexedDB.
See [docs/public-story-sharing-netlify.md](docs/public-story-sharing-netlify.md)
for the security model, Free-plan implications, and manual Identity setup.

```sh
npm run build  # Type-check and build for production
npm run lint   # Run Oxlint
npm test       # Run migration and IndexedDB persistence tests
npm run test:e2e  # Run the mobile browser journey with system Chromium
npm run typecheck  # Run TypeScript checks without emitting files
npm run preview -- --host 0.0.0.0  # Preview the production build
```

If the default npm cache is unavailable in the cloud environment, append
`--cache /tmp/midnight-library-npm-cache` to the install command.
