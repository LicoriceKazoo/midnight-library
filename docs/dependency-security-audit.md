# Dependency security audit — October 30, 2026

## Decision

No dependency versions or overrides were changed. The four low-severity `npm audit` findings are four reports of one transitive advisory, [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), and there is no compatible patched release in the affected dependency chain.

Using `npm audit fix --force` would replace `vite-plugin-pwa` 2.0.0 with the unrelated, breaking 0.2.1 release. That is not a safe remediation and was not run.

## Affected dependency path

```text
vite-plugin-pwa@2.0.0 (development dependency)
└─ workbox-build@7.4.1
   └─ @rollup/plugin-node-resolve@16.0.3
      └─ deepmerge@4.3.1
```

The audit reports `vite-plugin-pwa`, `workbox-build`, `@rollup/plugin-node-resolve`, and `deepmerge` separately because npm propagates the same transitive finding through each parent. The underlying issue is `deepmerge` prototype poisoning of an object returned from `mergeObject()` when untrusted object keys reach the affected function.

## Reachability and practical risk

These packages run only during the Vite production build. `npm audit --omit=dev` reports zero vulnerabilities, and the Node build packages are not included in the browser bundles or service worker deployed to users.

The installed `@rollup/plugin-node-resolve` 16.0.3 code calls `deepmerge` once:

```js
const DEFAULTS = deepFreeze(deepMerge({}, defaults));
```

Both arguments are created inside the package. The `defaults` value is a fixed object literal. Workbox 7.4.1 then calls `nodeResolve()` without options while bundling its generated service worker. User stories, rich text, JSON backups, IndexedDB values, URLs, and network responses do not enter this merge.

The practical risk to the deployed PWA is therefore none from this path. The practical build risk is low: exploitation would require an attacker to change the build tool's source or its local inputs before the merge runs. An attacker with that level of repository or installed-package control could already execute code through the Node build pipeline.

## Upstream and override review

The npm registry was checked on October 30, 2026:

| Package | Installed | Latest | Result |
| --- | ---: | ---: | --- |
| `vite-plugin-pwa` | 2.0.0 | 2.0.0 | No update available |
| `workbox-build` | 7.4.1 | 7.4.1 | No update available |
| `@rollup/plugin-node-resolve` | 16.0.3 | 16.0.3 | No update available |
| `deepmerge` | 4.3.1 | 4.3.1 | Latest release remains in the advisory range; npm reports no fix |
| `glob` | 11.1.0 | 14.0.3 | Workbox declares `^11.0.1`; overriding to 14.x would be an unsupported major upgrade |

There is no published `deepmerge` version that can be selected by a safe npm override. Substituting a fork, an unrelated merge package, or a hand-written patch would add unverified build behavior for a code path that does not accept untrusted data here.

`glob` 11.1.0 prints a general deprecation notice for old major versions. It is the newest version allowed by Workbox's `^11.0.1` range and does not create an additional finding in the current npm audit. A `glob` 14 override was rejected because Workbox has not declared compatibility with that major version.

## Validation

The unchanged dependency graph and generated PWA were validated with:

| Check | Result |
| --- | --- |
| `npm test` | Passed: 5 files, 15 unit tests |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with no warnings |
| `npm run build` | Passed: 16 precache entries; generated `dist/sw.js` and the Workbox runtime |
| `npm run test:e2e` | Passed: 7 Playwright scenarios |
| Search generated `dist` for affected build packages | No `deepmerge`, resolver, Workbox builder, or Node `glob` code present |
| `npm audit` | 4 low-severity development findings from the single `deepmerge` advisory remain |
| `npm audit --omit=dev` | 0 vulnerabilities |

The Playwright suite covers installation readiness, offline reading and writing, service-worker update behavior, mobile editing, navigation, backups, notes, audio, and playlists.

## Follow-up

Keep the current versions until one of these upstream projects publishes a compatible release that removes or patches `deepmerge`. Recheck the dependency tree during routine dependency maintenance. When a supported update becomes available, apply it without an override and rerun the complete validation above.

The remaining four low-severity development findings are accepted temporarily because the vulnerable function receives only package-owned static data, the packages are absent from production dependencies, and no supported patched version exists.
