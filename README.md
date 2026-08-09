# Last Light

An original, dependency-free arcade survival shooter prototype inspired by vertical wave shooters.

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

The game uses Canvas 2D for all rendering, has no external asset dependency, and stores the best score in local storage.
