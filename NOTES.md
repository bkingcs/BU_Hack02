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

## To verify (with links when done)

- [ ] Secure-context requirements on MDN for Geolocation, service workers, `navigator.storage.persist()`, WebGPU, `crypto.subtle`, and file input `capture`. Hypothesis: `<input capture>` works over HTTP; the rest need HTTPS or localhost.
- [ ] Transformers.js `image-feature-extraction`: pinned version, the `pool` option, output shape for DINOv2, and the preprocessing (resize and center crop?).
- [ ] iOS: whether a home-screen web app has storage separate from Safari. If it does, players should install first, then play.
- [ ] GitHub Pages: everything in the walkthrough (step 2).
- [ ] Pages `Cache-Control` max-age, which affects how quickly phones see updates before the service worker exists.

## Open issues

- Before step 7 there's no service worker. "Refresh app" reloads the page, but the browser may still serve cached JS for a few minutes. Step 7's versioned service worker fixes this.
- `normalizeAnswer` in `js/answer.js` is a minimal placeholder for Brian to finish. If it changes, re-hash the placeholder answers in `gems.json` (setup mode will do this automatically later).
- The placeholder gems in `gems.json` use one approximate campus coordinate. They will be replaced by setup-mode exports.

## Step log

- **Step 1 (static player flow): done locally 2026-10-16.**
  - Start → clue → photo → (stub) check → result → album.
  - Backup question after 3 misses.
  - Progress and photos persist in IndexedDB across reloads; "Start over" clears them.
  - Photos are downscaled to a 1024 px long edge (a 3000×4000 test image is stored as 768×1024).
  - URL switches: `?demo=1` shows the banner and allows camera-roll photos; `?stub=fail` forces misses (step 1 only).
