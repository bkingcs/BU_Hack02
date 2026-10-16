# SPEC: Hidden Gems reference prototype

This is the original brief for the reference prototype, kept verbatim.
Decisions made after this brief are recorded in `NOTES.md`.

---

I run the App MakerSpace at Bucknell University with my partner, Joe Meiser. Our next student hackathon, "Hidden Gems: The Best of Bucknell," opens Sunday Oct 18 at 11:59 PM and is due Friday Oct 23 at 3:00 PM. Students, many with no coding background, will use Claude to build a photo scavenger hunt app. Before we release the prompt, I need a reference prototype built. It has three jobs:

1. Prove the brief is buildable by a student team in a week with AI help.
2. Measure the real numbers the brief currently guesses at: the photo-similarity threshold, the GPS radius (40 m), the minimum gem spacing (80 m), and the 3-attempt fallback.
3. Become a place we can use to showcase what could be done, and to give the student staff some tips, and maybe even a starter template repo that can also be created for students to start with, so they spend their week on gems and clues instead of configuration, though the configuration is an important part of being an app dev. So, we will need to determine this as we near completion of the prototype.

It is a progressive web app (PWA): a website players open in Safari or Chrome and can add to their home screen. No native iOS or Android development, no Xcode, no app stores. Hosting is GitHub Pages.
Let's keep our prototype simple, readable, but also exemplary. A non-CS student should be able to open the code and follow it with Claude's help.

## What the app does (player view)

For each gem, in a fixed order:

1. Show the clue.
2. The player goes there and takes a photo.
3. The app checks the photo on the phone:
   * Location: the phone is within a set radius of the gem's recorded coordinates.
   * Image: the photo's embedding is similar enough to at least one of the gem's 3 to 5 reference embeddings.
   * Both checks pass: unlock the next clue.
4. After 3 failed attempts on a gem, offer the gem's backup question (something you only know by standing there). A correct answer unlocks the next clue.

At the end, show an album of the player's photos with each gem's name.
Progress and photos persist on the phone, so a refresh or closed tab does not lose the hunt. Nothing is uploaded anywhere.

## Technical requirements

* Plain HTML, CSS, and JavaScript (ES modules). No bundler, no npm build step. It must run from static hosting on GitHub Pages.
* Progressive web app: a `manifest.webmanifest` and a service worker that caches the app shell and the model files, so the hunt keeps working on weak campus cellular. Version the cache and include a visible "app version" in the footer so we can tell when an update has landed. Give it a simple way to force-refresh.
* Image embeddings: Transformers.js (`@huggingface/transformers`) using the `image-feature-extraction` pipeline with `Xenova/dinov2-small`. Load it from a pinned CDN version, not "latest." Try `device: "webgpu"` and fall back to WASM if WebGPU is unavailable or fails. Verify the pipeline options, pooling behavior, and output shape against the official Transformers.js docs before relying on them. Don't guess. Normalize embeddings and compare by cosine similarity. Show a clear loading state on first model download, and report the download size in the README.
* Camera: use `<input type="file" accept="image/*" capture="environment">`. It is the most reliable option on iOS Safari and Android Chrome. Downscale photos before embedding and before storing.
* Location: the Geolocation API with high accuracy. Use the haversine distance. Show the reported accuracy. If accuracy is worse than the radius, don't fail the player on location alone: let the image check decide, and log it.
* Storage: IndexedDB for photos and progress, plus `navigator.storage.persist()` where supported.
* Gem data: one `gems.json` file with id, name, clue, lat/lng, radius, reference embeddings, backup question, and backup answer. Store the backup answer as a SHA-256 hash of the normalized answer (lowercase, trimmed, punctuation stripped). It isn't real security. It's a teaching point for students about what client-side code can and can't hide.
* Accessibility and phone layout: large tap targets, readable in bright sunlight, works one-handed, no instructions needed.

## Organizer setup mode

Add a hidden setup page (for example `setup.html`, not linked from the player UI). It lets an organizer stand at each gem and:

1. Enter the gem name, clue, backup question, and answer.
2. Record the location. Average several GPS readings and show accuracy.
3. Take 3 to 5 reference photos from different angles. The page computes and stores their embeddings.
4. Warn if this gem is closer than the minimum spacing to an existing gem.
5. Export one `gems.json` file to commit to the repo. Don't commit the reference photos themselves, only embeddings and an optional small thumbnail.

## Evaluation tools (the most important part for us)

We need evidence to set the thresholds, not guesses. Build:

* A debug overlay (toggle with a query parameter like `?debug=1`) that shows, for every photo check: best similarity score, which reference matched, distance, GPS accuracy, the pass or fail reason, and timing.
* A local log of every check, with timestamp, gem id, scores, distance, accuracy, device and browser info, and the outcome. It should export as CSV from the debug view.
* An evaluation page (`eval.html`) where I can load a folder of labeled test photos (for example `gem-03/positive/*.jpg` and `gem-03/negative/*.jpg`, where negatives are other campus spots and near-misses). It computes the similarity distributions against each gem's references and shows, per gem and overall:
   * Histograms of positive vs. negative scores.
   * A precision and recall table across thresholds.
   * The threshold that achieves a 95% true-accept rate, and the false-accept rate at that threshold.

Our rule is that wrongly rejecting a player is worse than wrongly accepting one, so choose thresholds for high recall.

## Test plan to support

Seed the prototype with 3 to 4 real outdoor gems near Taylor Hall that I'll capture with setup mode. Also include a desk demo mode (`?demo=1`) that skips the location check and lets me pick test photos from the camera roll, so judges and I can run the flow without walking campus. Make it obvious in the UI when demo mode is on.
We will test on at least one iPhone (Safari, and installed to the home screen) and one Android phone (Chrome), outdoors, on campus Wi-Fi and cellular.

## Walk me through GitHub Pages

I use Git and GitHub every day, but I have never used GitHub Pages. Teach it to me as part of this build. I'll be helping students do the same thing next week. Don't explain Git basics. Do explain everything specific to Pages.

* Why this comes early: the phone's camera and GPS only work on a secure (HTTPS) page. Testing on my phone over my laptop's local network address won't give me that, so we publish to Pages right after step 1 and test every step on the live URL. Confirm or correct this reasoning against the browser docs.
* Walk me through it step by step, and pause for me to do each part myself in the GitHub web UI. Don't do it for me with the `gh` CLI or an Actions workflow unless I ask. Cover:
   1. Creating a public repo. Explain why it should be public: Pages on a free account needs a public repo, and a Pages site is public even when the repo is private.
   2. Settings → Pages → "Deploy from a branch," choosing the branch and the root folder. Explain the "Deploy from a branch" vs. "GitHub Actions" choice and why branch deploy fits a no-build static app.
   3. The resulting URL format (`https://<username>.github.io/<repo>/`), and what that subpath means for our links, manifest `start_url` and `scope`, service worker scope, and asset paths. Use relative paths so the same code works locally and on Pages.
   4. Whether we need a `.nojekyll` file, and why.
   5. How to see that a deploy finished (the Actions tab and the deployment status), roughly how long it takes, and what a failed deploy looks like.
   6. The HTTPS setting, and confirming the live site is served over HTTPS.
   7. Caching gotchas: browser cache and service worker cache, and how to confirm my phone is running the newest version (the footer version number).
* Check everything Pages-specific against the official GitHub Pages docs (docs.github.com/pages) and link the pages you used in `NOTES.md`.
* Write a one-page `PUBLISHING.md` for students from what we just did: the same steps in plain language, with the common mistakes we hit.

## How I want you to work

1. Read this spec and ask me any clarifying questions before writing code.
2. Propose a short plan, file layout, and milestones. Wait for my OK.
3. Build in this order, stopping after each step so I can test on a phone:
   1. Static player flow with hard-coded gems: clue, photo, album, persistence.
   2. Publish to GitHub Pages (see the walkthrough section below), so every later step can be tested on a real phone over HTTPS.
   3. Embeddings plus the similarity check, with the debug overlay.
   4. Location check.
   5. Setup mode and `gems.json` export.
   6. Evaluation page.
   7. PWA manifest, service worker, offline caching, and installing to the home screen on iPhone and Android.
4. Keep a `NOTES.md` with what you verified in official docs (with links), what you assumed, and any open issues.
5. Write a `README.md` aimed at a non-CS student: what the app is, how to make it their own (run setup mode, replace `gems.json`, change colors and text), a link to `PUBLISHING.md`, and how to force an update when changes don't appear.

## Deliverables

* A working repo I can push to GitHub and publish with Pages.
* A live GitHub Pages URL that installs to the home screen on iPhone and Android.
* `README.md` (student-facing), `PUBLISHING.md` (student-facing Pages guide), `NOTES.md` (organizer-facing), and `SPEC.md` (this file).
* A short findings section in `NOTES.md` after my campus test: recommended threshold, radius, spacing, attempt count, model load time and size, and anything in the student brief that should change.
