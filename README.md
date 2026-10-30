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

```sh
npm run build  # Type-check and build for production
npm run lint   # Run Oxlint
npm run typecheck  # Run TypeScript checks without emitting files
npm run preview -- --host 0.0.0.0  # Preview the production build
```

If the default npm cache is unavailable in the cloud environment, append
`--cache /tmp/midnight-library-npm-cache` to the install command.
