# Community Asset Registry

A static, responsive registry website built with plain HTML, CSS, and JavaScript (ES modules). It deploys to GitHub Pages with no build step and no dependencies.

> **The entries in `public/data/registry.json` are fictional sample data.** Replace them with your own before launch (see "Customizing").

## Features

- Home page with summary counts and the most recently registered entries
- Searchable directory (name, ID, reference, keywords, contact) with category and status filters and four sort orders
- Filter state is kept in the URL, so filtered views can be bookmarked and shared
- Detail page for every entry, with a copyable link
- Submission form with inline validation, clear error and success messages
- Loading, empty, not-found, and load-failure states
- Responsive layout, keyboard navigation, skip link, visible focus, ARIA live announcements, light and dark color schemes

## Technologies

- HTML, CSS, vanilla JavaScript (ES modules), no framework and no build
- Hash-based routing (`#/directory`, `#/entry/REG-0001`), so deep links work on any GitHub Pages subpath
- Node's built-in test runner for the data-layer tests
- GitHub Actions for test and deploy

## Project layout

```
public/                 Everything published to GitHub Pages
  index.html
  css/styles.css
  data/registry.json    Published entries (static, read-only)
  js/registry.js        Pure logic: filter, sort, validate (unit tested)
  js/store.js           Data access: loads JSON, local-only submissions
  js/app.js             UI, routing, rendering
  js/config.js          Public, non-secret settings
tests/                  Unit tests
.github/workflows/deploy.yml
```

The UI (`app.js`) never reads data directly. It goes through `store.js`, so the data source can be swapped for an API later without touching the interface.

## Local development

Requires Node 20+ (for tests) and Python 3 (for the simple static server).

```bash
npm start        # serves public/ at http://localhost:8080
npm test         # runs the unit tests
```

Opening `index.html` by double-clicking will not work because browsers block `fetch` of local files. Use the server above.

To check the project-subpath behavior, serve the parent folder instead, for example:

```bash
mkdir -p /tmp/preview && ln -sfn "$PWD/public" /tmp/preview/YOUR-REPO
python3 -m http.server 8080 --directory /tmp/preview
# open http://localhost:8080/YOUR-REPO/
```

## Build

There is no build step. The `public/` directory is the deployable site.

## Deploying to GitHub Pages

1. Push this project to the `main` branch of your GitHub repository.
2. In the repository, go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **GitHub Actions**.
4. The **Deploy to GitHub Pages** workflow runs on every push to `main` (or run it manually from the **Actions** tab). It runs the tests, then publishes `public/`.
5. When the run succeeds, the site is live at:
   - Project site: `https://USERNAME.github.io/REPOSITORY/`
   - User/organization site (repository named `USERNAME.github.io`): `https://USERNAME.github.io/`

All asset and data URLs are relative, so no base-path setting is needed for either case.

## Configuration

No environment variables or secrets are required, and none should ever be put in this front-end code.

`public/js/config.js`:

| Setting | Purpose |
| --- | --- |
| `siteName` | Display name used in code that reads it |
| `repository` | `"owner/repo"`. When set, the submit page offers a "Propose via GitHub issue" link that opens a pre-filled issue for maintainers. Empty hides it. |

## Customizing

1. Edit `public/data/registry.json`. Set `meta.isSampleData` to `false` to hide the sample-data banner, and adjust `meta.categories` and `meta.statuses` as needed.
2. Update the name and text in `public/index.html` and `public/js/app.js`.
3. Adjust colors in the `:root` block of `public/css/styles.css`.

## Known limitations: data persistence

GitHub Pages serves static files only. It has no database and cannot process form submissions.

- **Published entries are read-only.** They come from `data/registry.json`, and changing them means committing a change to the repository.
- **Entries added through the form are saved only in the visitor's browser** (`localStorage`). They are not shared with other visitors, are not written to the repository, and disappear if the visitor clears site data or switches browser or device. The interface says so wherever a submission is made.
- To collect shared submissions, the included option is the GitHub issue link (set `repository` in `config.js`); maintainers then add reviewed entries to the JSON file.
- If you need true multi-user, instant registration, add an external backend (for example Supabase, Firebase, or a small serverless API) behind `store.js`. Use that service's row-level security or server-side rules, and never ship admin keys in front-end code. Only public, restricted-scope keys belong in `config.js`.
- Contact emails entered locally are not transmitted anywhere by this site.
