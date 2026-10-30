# midnight-library
In development: Cozy story reader and editor.

## Development

Requires Node.js 22.12+ (or 20.19+).

```sh
npm install
npm run dev -- --host 0.0.0.0
```

Vite serves the app on port 5173.

```sh
npm run build  # Type-check and build for production
npm run lint   # Run Oxlint
npm run preview -- --host 0.0.0.0  # Preview the production build
```

If the default npm cache is unavailable in the cloud environment, append
`--cache /tmp/midnight-library-npm-cache` to the install command.
