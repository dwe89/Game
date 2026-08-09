# Last Light

An original squad-building arcade survival shooter with generated survivor, zombie and wrecked-city artwork.

## Run it

Open `index.html` directly in a browser, or serve the folder with any static server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Controls

- Drag or move the pointer to aim and hold to fire.
- Use `A` / `D` or the arrow keys to move horizontally.
- Press `Space` to fire in the direction of the pointer.
- Press `P` or `Escape` to pause.

The game loop is built around growing a visible squad: collect recruits and rifle upgrades through road gates, fight zombie waves, survive barriers, and take down giant mutant bosses. The game uses Canvas 2D for gameplay and local image assets for the environment and characters. It stores the best score in local storage.
