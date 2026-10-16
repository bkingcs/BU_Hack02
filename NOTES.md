# NOTES (organizer-facing)

What we verified, what we assumed, what's still open. Student-facing docs are
`README.md` and `PUBLISHING.md`; the original brief is `SPEC.md`.

## Decisions made after the spec (2026-10-16)

| Topic | Decision |
|---|---|
| Repo | `bkingcs/BU_Hack02`, published with GitHub Pages |
| Model | DINOv2-small only for now. Compare other models (MobileCLIP2-S0, a MobileNet baseline) after the brief is out, for staff tips. Generative models such as Gemma are the wrong tool: they describe photos in text rather than matching a specific spot, and they're gigabytes in size. |
| Students | Lean toward an "ingredients list" (suggested model, pinned library, browser APIs, measured numbers, gotchas) plus this repo as a readable reference. Whether to also ship a starter template is still undecided. |
| Branding | Colors only, no Bucknell wordmark (see Verified). Custom gem icon in `icons/gem.svg`. |
| Backup answers | `backupAnswerHashes` is an array, so a gem can accept several answers. |
| Attempts | Every failed photo check counts toward `MAX_ATTEMPTS`. A photo that can't be read doesn't count. |
| Album photo | The newest photo at each gem is kept, pass or fail, so gems solved by the backup question still show a picture. |
| Hunt changes | `gems.json` has a `huntId`. If it changes, players' old progress and photos are cleared. |
| Model precision | **q8 on every device**, set explicitly. See "Transformers.js" below for the measurements behind this. |
| Model hosting | Model files are self-hosted in `models/` (same origin, no Hugging Face dependency during the hunt). The library comes from jsDelivr, pinned to `4.3.1`. |
| Embedding | The CLS token (row 0 of `last_hidden_state`), L2-normalized; compared by cosine similarity, best of a gem's references. |
| Check log | Every photo check and backup answer is logged on the phone (IndexedDB `checkLog`). "Start over" keeps the log; the debug panel's "Clear log" erases it. |
| Answer normalization | NFKD with accents removed, lowercase, `&` becomes "and", apostrophes removed, thousands commas removed, other punctuation becomes a space, spaces collapsed, a leading "the/a/an" dropped. |

Defaults still open to override:
- Threshold: one global value plus an optional per-gem override.
- Gem thumbnails: organizer-only.
- GPS permission denied: fall back to an image-only check and log it.

## Verified

- **Bucknell colors.** bucknell.edu's own CSS uses blue `rgb(0,56,101)` = `#003865` and orange `rgb(232,117,30)` = `#E8751E`. The site was inspected 2026-10-16.
- **Bucknell wordmark policy.** [Brand Guidelines & Policies](https://www.bucknell.edu/azdirectory/marketing-communications/brand-guidelines-policies):
  - The wordmark isn't permitted in the created works of extension groups (student-, alumni- or faculty-run).
  - Student projects need case-by-case approval.
  - Brand assets require a login.
  - Contact for logo use: Barbara Wise.
  - Because of this, we use the colors only.
- **Text contrast.** Orange `#E8751E` on white is about 3:1, which fails WCAG AA for normal text. Orange is used only for borders and the demo banner (with dark text); orange text uses `#A84F0C` (about 5.5:1).

### Secure contexts (verified 2026-10-16)

- **What counts as secure.** [MDN: Secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts): HTTPS, `localhost` / `*.localhost`, `127.0.0.0/8`, `::1`, or `file:`.
  - A LAN address over HTTP (for example `http://192.168.1.20:8000`) isn't in that list, so it isn't secure.
- **What requires it.** [MDN: Features restricted to secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts/features_restricted_to_secure_contexts) lists Geolocation, Service Workers, the Storage API, WebGPU, the Web Crypto API, and `getUserMedia`.
  - `<input type="file" capture>` is **not** listed.
- **What this means for the spec's reasoning.** It needed a correction: the camera input works over plain HTTP. What forces HTTPS is GPS, offline use and install (service worker), persistent storage, WebGPU, and `crypto.subtle` (the backup-answer hash). The conclusion stands: test phones on the Pages URL.
- **Quick check.** `window.isSecureContext` tells you whether the current page is secure.

### GitHub Pages (verified 2026-10-16)

- **Free plan needs a public repo.** [Creating a GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site):
  - "If the account that owns the repository uses GitHub Free … the repository must be public."
  - On plans that allow private-repo Pages, "GitHub Pages sites are publicly available on the internet, even if the repository for the site is private."
  - "It can take up to 10 minutes for changes to your site to publish."
- **Publishing source.** [Configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site):
  - The UI path is Settings → Pages → Build and deployment → Source: "Deploy from a branch" → branch + folder (`/` root or `/docs`) → Save.
  - The "GitHub Actions" source is for custom build processes.
  - "Your GitHub Pages site will always be deployed with a GitHub Actions workflow run," including branch deploys. Failures show up in the repo's workflow runs.
- **Project site URL.** [About GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages): a project site lives at `<owner>.github.io/<repositoryname>`.
- **HTTPS.** [Securing with HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https): "sites created after June 15, 2016, and using `github.io` domains are served over HTTPS automatically."
  - Observed: `http://` requests get a 301 to `https://`.
- **Jekyll and `.nojekyll`.** [About GitHub Pages and Jekyll](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/about-github-pages-and-jekyll): Jekyll skips files and folders starting with `_`, `.` or `#`, or ending with `~`.
  - The creating-a-site page says an empty `.nojekyll` at the root of the publishing source disables Jekyll.
- **Limits.** [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits):
  - Published site up to 1 GB; repo recommended under 1 GB.
  - 10-minute deploy timeout.
  - Soft limits of 10 builds per hour and 100 GB per month of bandwidth.
  - No sites that handle passwords or payments.
- **Caching (observed with `curl -I` on live github.io sites).** Responses carry `Cache-Control: max-age=600`, an `ETag`, and `Access-Control-Allow-Origin: *`.
  - A phone may keep showing an old file for up to 10 minutes after a deploy unless something forces a revalidation.

### Transformers.js and DINOv2 (verified 2026-10-16)

Sources:
- the npm registry for `@huggingface/transformers`;
- the [pipelines API docs](https://huggingface.co/docs/transformers.js/main/en/api/pipelines);
- the 4.3.1 source itself (`dist/transformers.web.js`), because the docs don't state the details below;
- the [Xenova/dinov2-small](https://huggingface.co/Xenova/dinov2-small) file listing and configs.

**Version and build file**
- **Version.** Latest is **4.3.1** (2026-10-06); 4.x began 2026-03-30. We pin `4.3.1`.
- **Build file.** Use `dist/transformers.min.js`, the self-contained browser build (it's the package's `jsdelivr` entry).
  - `dist/transformers.web.min.js` contains a bare `import "onnxruntime-web/webgpu"` and only works with a bundler.
- **Lazy loading.** We load the library with a dynamic `import()` inside `loadModel()`. If the CDN fails, only the photo check breaks: clues, album and backup questions keep working.

**Pipeline and model**
- **The `image-feature-extraction` pipeline.** It takes one option, `pool`.
  - `pool: true` returns `outputs.pooler_output` and throws if the model has none.
  - Otherwise it returns `last_hidden_state`.
- **What this model returns.** The ONNX export has **only `last_hidden_state`**, with dims **`[1, 257, 384]`** (1 CLS token + 16×16 patches), so `pool: true` throws.
  - In DINOv2, `pooler_output` is just the layer-normalized CLS token, so taking row 0 is equivalent.
- **Preprocessing** (`preprocessor_config.json`): resize the shortest edge to 256, **center-crop 224×224**, ImageNet mean/std.
  - A portrait phone photo loses its top and bottom sixths before the model sees it.
- **Inputs.** The pipeline accepts a `Blob` directly (`RawImage.read`).
- **Model files.** Defaults: q8 for WASM, fp32 for everything else (including WebGPU), so we always pass `dtype`.
  - Suffix mapping: `q8` → `model_quantized.onnx`, `fp16` → `_fp16`, `fp32` → no suffix.
  - Sizes: fp32 88.5 MB, fp16 44.4 MB, q8 24.5 MB, uint8 22.4 MB, q4 15.0 MB, q4f16 12.9 MB, bnb4 13.7 MB.

**Loading models from our own site (`env` defaults in the browser)**
- **Defaults.** `allowLocalModels=false`, `allowRemoteModels=true`, `localModelPath="/models/"`, `useBrowserCache=true`, `cacheKey="transformers-cache"`.
- **Gotcha 1: the path must be relative.** The default `/models/` is absolute, so on Pages it points to `bkingcs.github.io/models/`. We set `models/`.
- **Gotcha 2: no full URLs.** In 4.3.1 the local "does this file exist?" check is skipped when `localModelPath` is a full URL.
  - It then concludes `preprocessor_config.json` is missing, and the pipeline fails with "this.processor is not a function" even though the model loaded.
- **Caching.** Transformers.js caches the model files *and* the ONNX Runtime WASM (from jsDelivr, pinned to the exact `onnxruntime-web` dependency) in the Cache API.
  - So the service worker doesn't need to cache the model; `forceRefresh` keeps `transformers-cache`.

**Precision experiment** (desktop Chromium, WebGPU available; 6 photos, cosine similarity of each config's CLS embedding to WASM fp32):

| Config | Similarity to fp32 | Time per photo |
|---|---|---|
| WASM fp32 | 1.0000 | 1.0–2.9 s |
| WASM fp16 | 1.0000 | 0.5–1.1 s |
| WASM q8 | 0.989–0.993 | 0.5–1.2 s |
| WebGPU fp32 | 1.0000 | 0.2–0.8 s |
| WebGPU fp16 | 0.9996–0.9998 | 0.2–0.9 s |
| WebGPU q8 | 0.989–0.993 | 0.5–1.0 s |

For scale:
- Two different photos of the same bee: 0.92.
- Two different cat photos: 0.65.
- Unrelated photos: -0.05 to 0.11.

q8's ~0.01 drift is small next to that gap, so we chose q8 for the smallest download. Pinning one dtype everywhere matters more than which one.

**First download, measured on the live site**
- Model 19.7 MB (gzip; 24.5 MB raw), ONNX Runtime WASM 5.5 MB, library 0.17 MB: **≈25 MB once**.
- In Chromium the model is fetched twice (a metadata request, then the load), but only one network transfer happens: the second is served from the HTTP cache.
- About 5 s from page open to model ready on a laptop.

### iPhone "Out of memory" in setup.html (2026-10-16, fixed in v0.2.1)

**What happened.** On Brian's iPhone the player loaded the model fine (WebGPU, 783 ms). setup.html then failed with
`no available backend found. ERR: [webgpu] RangeError: Out of memory`.

**Cause, from the bundled ONNX Runtime source plus a reproduction on desktop:**
- **The 4 GB reservation.** ONNX Runtime starts with `new WebAssembly.Memory({initial: 256, maximum: 65536, shared: true})`, i.e. room to grow to 4 GB.
  - iOS Safari throws `RangeError: Out of memory` when it can't reserve that.
  - We reproduced the exact message on desktop by making `WebAssembly.Memory` throw for a large `maximum`.
- **The failure is cached for the life of the page.** ONNX Runtime's backend registry sets `aborted = true` and returns the stored error from then on.
  - WebGPU and WASM share the same WebAssembly module, so our WASM fallback runs but gets the same WebGPU error back.
  - **Retrying in the page can't work; only a reload can.**
- **Likely trigger:** the player page still held its model when setup.html opened, for example in the same tab, where Safari's back/forward cache keeps the previous page alive. This is still to confirm with Brian.

**Fixes in v0.2.1:**
- **Release on `pagehide`.** `embeddings.js` disposes the model when the page is hidden, so the next page has room.
- **Recovery screens.**
  - `ModelLoadError` carries a plain-language `friendlyMessage`, worded for memory or connection problems.
  - The player shows "The photo checker needs a restart … Your progress is saved" with a Reload button. The failed photo doesn't count as a miss.
  - setup.html shows the message plus a "Reload page" button; references are saved in localStorage.
- **Lower peak memory in setup.html.**
  - Wait for the model before opening any photos.
  - Make the thumbnail from the 1024 px copy instead of decoding the full-size photo a second time.
  - A 24 MP photo is about 96 MB of pixels while it's decoded.
- **Tested** with a simulated failure on both pages, and with navigating away and back: the model reloads fine.

## To verify (with links when done)

- [ ] iPhone: does Safari's HTTP cache keep the 24 MB model between the two requests, or does it download twice?
- [ ] iPhone and Android: WebGPU or WASM, model load time, and time per photo (the debug panel shows all three).
  - iPhone, first report: WebGPU, model loaded in 783 ms.
- [ ] iPhone: does setup.html load reliably in a fresh tab and after the v0.2.1 `pagehide` release? If not, consider decoding photos at reduced size and loading setup in its own tab.
- [ ] Transformers.js `image-feature-extraction`: pinned version, the `pool` option, output shape for DINOv2, and the preprocessing (resize and center crop?).
- [ ] iOS: whether a home-screen web app has storage separate from Safari. If it does, players should install first, then play.

## Open issues

- Before step 7 there's no service worker. "Refresh app" reloads the page, but the browser may still serve cached JS for a few minutes. Step 7's versioned service worker fixes this.
- **Half-updated app (until step 7).** Pages lets browsers reuse each file for 10 minutes, and a normal reload doesn't re-check them.
  - A phone can end up with some new modules and some old ones. A missing export then stops the whole app from starting. We hit this locally: an old `config.js` without `MODEL_DTYPE`.
  - Mitigation for now: `pwa.js` is self-contained and loaded separately. "Refresh app" re-fetches every file with `cache: 'reload'`, and if no screen appears within 4 s the app shows "didn't load completely, tap Refresh app".
  - The real fix is step 7's versioned service worker.
- **`SIMILARITY_THRESHOLD = 0.5` is a guess.** Replace it with the eval.html result.
- **Things eval.html should compare:**
  - CLS embedding vs. mean of patch tokens.
  - Center crop vs. letterboxing the whole photo into a square (center crop drops the top and bottom of portrait shots).
  - q8 vs. fp16.
- The placeholder gems in `gems.json` have one approximate campus coordinate and no references, so any photo passes (`no-references`). Replace them with setup-mode exports.
- `setup.html` is minimal for now: reference photos and export only. Step 5 adds names, clues, backup answers, GPS and spacing.

### Our first deploy (observed 2026-10-16)

- **Live URL:** <https://bkingcs.github.io/BU_Hack02/>. The repo is public and the About box links to the site.
- **Pages settings.**
  - Source already defaulted to "Deploy from a branch"; Branch started as "None" (Pages off).
  - After choosing `main` / `/ (root)` and saving, **Enforce HTTPS** was checked and greyed out: "Required for your site because you are using the default domain."
- **Deploy run.** The Actions tab showed **pages build and deployment** #1, with jobs `build` → `report-build-status` → `deploy`. It took **28 s** from push to live, and the repo sidebar showed "Deployments: github-pages".
- **Checks with `curl` against the live site.**
  - `http://` gets a 301 to `https://`.
  - `/BU_Hack02` (no slash) gets a 301 to `/BU_Hack02/`.
  - **`/bu_hack02/` returns 404: the repo path is case-sensitive.**
  - Every response carries `Cache-Control: max-age=600`.
  - Correct content types for `.js` and `.json`.
- **`.nojekyll`: we keep it.** We don't use Jekyll, and it tells Pages to publish the files as they are.
  - Side effect: dot-folders get published too. `.claude/launch.json` is publicly readable, which is harmless but a reminder that everything in a Pages repo is public.
  - Without it, Jekyll would silently drop any future file or folder whose name starts with `_`.
- **Live page check.** In a browser: `isSecureContext` is true, `crypto.subtle` is available, and the footer shows Version 0.1.0.
- **Tooling.** `gh` 2.102.0 is installed and logged in as bkingcs. The repo and Pages setup were done in the web UI, as the spec asks, so the steps match what students will do.

## Step log

- **Step 1 (static player flow): done locally 2026-10-16.**
  - Start → clue → photo → (stub) check → result → album.
  - Backup question after 3 misses.
  - Progress and photos persist in IndexedDB across reloads; "Start over" clears them.
  - Photos are downscaled to a 1024 px long edge (a 3000×4000 test image is stored as 768×1024).
  - URL switches: `?demo=1` shows the banner and allows camera-roll photos; `?stub=fail` forces misses (step 1 only).
- **Step 2 (publish to Pages): done 2026-10-16.**
  - Live at <https://bkingcs.github.io/BU_Hack02/>.
  - `PUBLISHING.md` written for students.
  - Phone test on the live URL is still pending (Brian).
- **Step 3 (embeddings, similarity check, debug overlay): done 2026-10-16. Live as v0.2.0.**
  - Tested in the browser:
    - setup.html adds references and exports a compact gems.json.
    - Cat references: another cat photo scores 0.665 (pass), a bee 0.073 (fail).
    - Bee reference: a second bee photo scores 0.909 (pass), baklava 0.079 (fail).
    - The debug panel and CSV export work.
  - Phone test pending.
