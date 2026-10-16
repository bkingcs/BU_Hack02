# Hidden Gems: The Best of Bucknell

A photo scavenger hunt that runs in your phone's web browser. Read a clue, find
the spot, take a photo. The phone checks that you're in the right place and
that your photo looks like the spot, then unlocks the next clue. At the end you
get an album of your hunt. Nothing is uploaded: everything stays on your phone.

> This README is a stub. It will be finished as the prototype is built.
> For now: see `SPEC.md` for the plan and `NOTES.md` for progress.

## Try it on your computer

The app is plain HTML, CSS and JavaScript, with no install step. Your browser
needs it served from a local web address, not opened as a file. In this folder, run:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/?demo=1> (`?demo=1` lets you pick photos instead of using a camera).

## Where things are

| File | What it does |
|---|---|
| `index.html` | Every screen's text and layout |
| `css/style.css` | Colors and sizes (change the colors at the top) |
| `gems.json` | The hunt: each gem's name, clue, location and backup question |
| `js/config.js` | Numbers you can tune, like how many tries before the backup question |
| `js/app.js` | What happens when you tap things |
