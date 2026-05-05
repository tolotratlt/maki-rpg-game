# Captain Clown Nose RPG

A small 2D pixel RPG prototype built with `@tialops/maki`.

## Run the game

```bash
npm install
npm run dev
npm run map-editor
npx maki dev
```

If Vite does not open the browser automatically, open `http://127.0.0.1:5173/`.

## Tilemap editor

This project includes two map editors.

### Maki tilemap editor

Run the original Maki editor with:

```bash
npm run tilemap
```

This project applies local Maki tilemap editor fixes automatically during `npm install` through the `postinstall` script.

The auto-installed fixes currently cover:

- proper editor URL opening on Windows so the selected map name is preserved
- a resizable tileset and map split view
- map panning with `Shift + left click` or middle mouse drag

### Custom map editor

Run the dedicated custom editor with:

```bash
npm run map-editor
```

If the browser does not open automatically, open:

```text
http://127.0.0.1:5173/map-editor.html
```

To open a specific map directly:

```text
http://127.0.0.1:5173/map-editor.html?map=default_map
```

The custom editor saves directly to `assets/maps/<name>.json` and stays compatible with the current Maki map format.

Current custom editor features:

- load an existing map from `assets/maps/`
- create a new map with a chosen name, size and tileset
- resize the current map
- paint and erase with adjustable brush size
- paint collisions with adjustable brush size
- resize the tileset panel
- pan the map with middle mouse drag or `Space` plus drag
- zoom with the mouse wheel
- save directly to the current JSON map format

## Project structure

```text
assets/
assets/audios/
assets/maps/
assets/sprites/
scenes/
game.js
index.html
maki.config.js
vite.config.js
```

## Controls

- `Arrow keys`: move Captain Clown Nose
- `Space`: spawn a bomb
- `Mouse click on Play`: start the game

## Asset source

The character art used in this project comes from the free asset pack [Treasure Hunters](https://pixelfrog-assets.itch.io/treasure-hunters) by Pixel Frog.
The bomb sprites used in this project come from the free asset pack [Pirate Bomb](https://pixelfrog-assets.itch.io/pirate-bomb) by Pixel Frog.
The background music used in this project comes from the free asset pack [High Quality 16-Bit Music](https://hydrogene.itch.io/high-quality-16-bit-music) by Hydrogene.
The UI play button used in this project comes from the free asset pack [Robin](https://prinbles.itch.io/robin) by Prinbles.
