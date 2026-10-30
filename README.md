# midnight-library
In development: Cozy story reader and editor.

## Development

Requires Node.js 22.12+ (or 20.19+).

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
