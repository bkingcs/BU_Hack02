# Publishing your app with GitHub Pages

GitHub Pages turns a GitHub repository into a real website, for free. Your app
needs a real website because phones only allow GPS, offline mode and
"Add to Home Screen" on **secure (https) pages**. Your laptop's
`http://192.168…` address doesn't count, so publish early and test on your phone
at the Pages address.

## 1. Make a public repository

1. On github.com, click **+** (top right), then **New repository**.
2. Pick a name. **Use all lowercase**, like `hidden-gems`. The name becomes part of
   your web address, and that part is case-sensitive: `/BU_Hack02/` works but
   `/bu_hack02/` is "404 Not Found".
3. Choose **Public**. On a free account, Pages only works from public repos.
   **Everything in the repo is public**, so never put passwords or secrets in it.
4. If your code is already on your computer in a git repo, leave **Add README**,
   **.gitignore** and **license** turned off. Then push your code with the commands
   GitHub shows you under "…or push an existing repository".

## 2. Turn on Pages

1. In your repo: **Settings → Pages** (left sidebar).
2. **Source:** "Deploy from a branch". Your app is plain HTML, CSS and JavaScript,
   so there's nothing to build. The other choice, "GitHub Actions", is for
   projects that need a build step.
3. **Branch:** `main`, folder `/ (root)`, then click **Save**.

## 3. Wait for the deploy, then visit

- Open the **Actions** tab. A run called **pages build and deployment** appears.
  A yellow dot means it's running; a green check means your site is live. Ours
  took about 30 seconds; GitHub says it can take up to 10 minutes. A red X means
  the deploy failed: click it to see why, fix the problem, and push again.
- Your address is **`https://<your-username>.github.io/<repo-name>/`**.
  It's also shown under Settings → Pages, as "Deployments: github-pages" on the
  repo's front page, and (if you tick the box) in the repo's **About** box.
- HTTPS is automatic and always on for `github.io` addresses.

## 4. Every update after that

Commit, push, wait for the green check, then reload on your phone.

**Changes not showing up?** GitHub tells browsers they can reuse each file for
up to 10 minutes. Check the **version number in the app's footer**:

- If it hasn't changed, tap **Refresh app** in the footer, or wait a few minutes.
- Remember to raise `APP_VERSION` in `js/config.js` each time you publish, so you
  can tell versions apart.

## Common mistakes

| Symptom | Cause and fix |
|---|---|
| Site shows "404" | Pages is still off (Branch says "None"), the deploy hasn't finished, or the address has the wrong upper/lowercase letters. |
| Push rejected: "fetch first" / non-fast-forward | You created the repo with a README on GitHub. Run `git pull --rebase origin main` once, then push. |
| Page loads, but styles or scripts are missing | A path starts with `/`, like `/css/style.css`. That points at `github.io`, not your repo. Write paths without the leading slash: `css/style.css`. |
| Blank page when you double-click `index.html` | Browsers won't load JavaScript modules from a file on disk. Run `python3 -m http.server 8000` in the project folder and open `http://localhost:8000`. |
| GPS or backup answers don't work on your phone | You opened your laptop's address (`http://192.168…`). That page isn't secure. Use your `github.io` address. |
| Phone shows the old version | Caching. See "Changes not showing up?" above. |
