# Deploying The Midnight Library

The Midnight Library is a static Vite application. It can be hosted on a free Netlify or Vercel account, and both services provide the secure HTTPS address required to install a Progressive Web App.

For milestone testing, deploy the `feature/editor-comfort-and-themes` branch. After this branch is reviewed and merged, change the production branch to `main` so future releases follow the main branch.

## Before deployment

1. Sign in to [GitHub](https://github.com/) and confirm the `midnight-library` repository contains the `feature/editor-comfort-and-themes` branch.
2. You do not need to upload `node_modules` or `dist`. The hosting service creates `dist` for you.
3. No database, server, environment variables, or paid add-ons are required.

## Netlify: recommended beginner setup

1. Open [Netlify](https://www.netlify.com/) and create a free account with **Sign up with GitHub**.
2. From the dashboard, choose **Add new project**, then **Import an existing project**.
3. Choose **GitHub** and approve access to the `midnight-library` repository. You can grant access to only this repository.
4. Select the repository and enter these deployment settings:

   | Setting | Value |
   | --- | --- |
   | Branch to deploy | `feature/editor-comfort-and-themes` |
   | Base directory | Leave blank |
   | Build command | `npm run build` |
   | Publish directory | `dist` |

5. Choose **Deploy**. The included `netlify.toml` contains the same build settings and safe service-worker headers.
6. When the deployment finishes, select **Open production deploy**. Netlify supplies an address similar to `https://your-site-name.netlify.app`. HTTPS is automatic and free.
7. You may use **Domain management** to choose a clearer free `netlify.app` site name. Purchasing a custom domain is optional.

Every push to the selected branch creates a new deployment. The installed app shows **Update ready** when a new version is available; finish typing, then choose **Save & update**.

After merging the milestone, open **Site configuration → Build & deploy → Continuous deployment**, change the production branch to `main`, and save.

## Vercel alternative

1. Open [Vercel](https://vercel.com/) and create a free Hobby account with GitHub.
2. Choose **Add New → Project**, import `midnight-library`, and allow repository access.
3. Vercel should detect **Vite**. Confirm these settings:

   | Setting | Value |
   | --- | --- |
   | Framework preset | Vite |
   | Build command | `npm run build` |
   | Output directory | `dist` |
   | Install command | `npm install` |

4. Choose **Deploy**. Vercel creates a free HTTPS `vercel.app` URL.
5. In **Project Settings → Git**, set the production branch to `feature/editor-comfort-and-themes` while testing this milestone. Change it to `main` after the branch is merged. Other pushed branches receive HTTPS preview URLs automatically.

The included `vercel.json` prevents stale service-worker files while leaving the versioned offline cache intact.

## Safely deploy this editor comfort update

If the Netlify site is already connected to GitHub, open **Site configuration → Build & deploy → Continuous deployment** and change **Production branch** to `feature/editor-comfort-and-themes`. Netlify automatically builds the new commit with `npm run build` and publishes `dist` at the existing HTTPS address. Keep the same Netlify site; changing its production branch does not change its `netlify.app` HTTPS address.

On the phone, finish the current edit and wait for **Saved locally** before opening the deployed site while online. When **Update ready** appears, choose **Save & update**. This saves the current story state before activating the new service worker. Do not uninstall the PWA, clear site data, or delete browser storage during deployment; none of those actions are needed for an update.

After the app reopens, confirm the latest story is present, choose each color theme, and test the player’s expanded, minimized, and hidden states. Existing IndexedDB content stays attached to the same HTTPS site origin. Keep a recent JSON export as an additional local backup.

## Install on a Samsung Galaxy S24

The phone must open the deployed HTTPS site online once so Chrome or Samsung Internet can install the offline application files.

### Chrome

1. Open the Netlify or Vercel HTTPS URL in Chrome.
2. Wait for the library to load. The brief **Ready offline** message confirms the app shell was cached.
3. Open Chrome's three-dot menu.
4. Choose **Install app** or **Add to Home screen**, then confirm **Install**.
5. Launch **The Midnight Library** from the new home-screen icon. It opens without normal browser controls.

### Samsung Internet

1. Open the same HTTPS URL in Samsung Internet and allow the first load to finish.
2. Open the browser menu, choose **Add page to**, and then **Home screen**. Some versions show **Install web app** directly.
3. Confirm the installation and launch the app from the home screen.

If the install option is missing, reload once, verify the address starts with `https://`, and wait a few seconds for the service worker to finish installing.

## Move a library between desktop and phone

Stories, chapters, rich-text formatting, notes, and reading preferences remain in IndexedDB in the browser where they were created. They do not automatically synchronize between devices.

1. On the desktop, open the navigation drawer and choose **Export** under **Backup & restore**.
2. Send the downloaded JSON file to the phone using a method you trust, such as a USB cable or your normal file-sharing service.
3. On the phone, open the installed app, open the navigation drawer, choose **Import**, select the JSON file, review the replacement warning, and confirm.

Import replaces the story library instead of duplicating records. The backup format is identical on desktop and mobile.

Uploaded audio is deliberately excluded from story backups because the files can be large. Import audio files separately into the Audio Library on each device, then recreate the desired playlists there.

Keep recent JSON backups outside the browser. Clearing site data, resetting the browser, or removing an installed PWA can remove that device's local IndexedDB library. Service-worker updates only replace application files in the cache; they do not clear or rewrite IndexedDB.

## Test a production build locally

From Git Bash in the repository:

```bash
npm install
npm run build
npm run preview
```

Open the displayed local URL. Installation testing should use the deployed HTTPS URL because browser PWA rules are stricter away from `localhost`.
