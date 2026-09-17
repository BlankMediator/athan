# GitHub Pages

The browser application is a static site: the build contains its calculations, city catalogue, readings, default recordings and service worker. No running Node server is required on GitHub Pages. Each browser keeps its own settings and audio cache.

## Deployment

Repository: `BlankMediator/athan`. In **Settings → Pages**, choose **GitHub Actions** as the source. Pushing `main` runs `.github/workflows/pages.yml`, builds with Node 24, checks the output, and publishes only `browser-ui`. The normal address is `https://blankmediator.github.io/athan/`.

The build uses relative URLs and a service worker scoped to its installation directory. It works at `/athan/`, at a custom-domain root, or in a directory such as `/apps/athan/`. Keep the trailing slash on directory URLs. Default recordings are included in the first offline download and also stored as audio blobs in IndexedDB. Existing sound choices are preserved.

Local TLS certificates and private keys never belong in this repository or Pages build. GitHub provides the public site's HTTPS certificate. `.athan`, browser profiles, temporary files, logs and locally imported recordings are excluded from source publishing.

## Use athan.abdullahhussain.com.au

1. Keep the working GitHub URL while DNS is being prepared.
2. In this repository's **Settings → Pages → Custom domain**, enter `athan.abdullahhussain.com.au`.
3. At your DNS provider add `CNAME`, name `athan`, target `blankmediator.github.io` (no protocol or `/athan/` path). Preserve your main domain's records.
4. When GitHub's DNS check and certificate provisioning complete, enable **Enforce HTTPS**.

An Actions deployment uses the Pages setting for the domain; a CNAME file in the artifact is not required. GitHub may take time to provision HTTPS. [GitHub custom-domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

## Use a page on the main website

DNS cannot route an individual URL path. To serve `https://abdullahhussain.com.au/athan/` directly, have the main site's build copy **the contents** of `browser-ui` into its published `athan` directory, or configure a reverse proxy at your main-site host. Its worker will then control only `/athan/`. A simple link or redirect from the main site to the separate app also works and avoids combining deployments.

The main website currently publishes from `BlankMediator/abdullahhussain.com.au-build`. This app's deployment does not modify that repository. Changing the origin/address creates a separate browser profile; saved settings do not automatically transfer from localhost to the public site or a new subdomain.

Reference: [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
