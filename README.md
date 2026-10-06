# lost.

**A little rat. A long night.** A close-up isometric pixel-art study for a short film about finding a way home through a medieval city.

![A rat sniffing, walking and scurrying along a candlelit medieval street](docs/media/lost.gif)

This demo explores rendering, atmosphere, camera-relative movement and a rat's performance. Study 002 replaces four-frame sprite playback with a continuously articulated 3D rat, rasterized into pixel art. World-space paw contacts drive its limbs; walking and scurrying have separate footfall schedules and body motion. Generated cobbles and castle masonry provide the street, and the original generated rat supplies an appearance reference and fur material. This is a motion study, not a complete movie.

## Run

Node 22 or newer:

```sh
npm ci
npm run dev
```

Open **http://localhost:4173**. After a build, `npm run serve` starts the preview without rebuilding. `PORT=4180 npm run serve` chooses another port.

The browser has **zero runtime dependencies**. TypeScript, esbuild, Sharp, tsx and Playwright Core are development tools. Generated source images are retained locally; normal builds need no image-generation service, API key, CDN or network access after `npm ci`.

## Controls

| Control | Behavior |
| --- | --- |
| Explore | Alternates cautious walking with sniffing and listening; click again to rest |
| Walk / `1` | Four-beat walk, with long planted stance and low paw recovery |
| Scurry / `2` | Asymmetric gallop, with fore/hind support groups, suspension and spine flexion |
| Sniff / `3` | Stop and investigate, with head and whisker motion |
| Listen / `4` | Stop, hold alert, gently move the head |
| Groom / `5` | A small head/paw wash gesture; most readable in front/side views |
| Rest / `0` | Decelerate and settle |
| Compass | Turn to one of eight screen directions; retains the selected action |
| Arrow keys | Hold to guide the rat; release to stop |
| Hold/click the street | Walk toward that screen direction; release to stop; touch supported |
| Pause / `Space` | Freeze simulation, tail, lighting and rain |
| Light at the end | Ease the palette from cold/lost to warmer/home |
| Rain | Toggle rain streaks; the street stays wet |
| Closer | Adjust the close-up framing |
| `H` / minus button | Hide the interface; use `H` or Show controls to restore |
| Motion lab | Open contact indicators, playback speed and joint overlays |
| Playback | Real time, half speed or quarter speed; simulation still uses fixed steps |
| Step 1/60 s | Pause and advance one simulation step |
| Show joints & contacts | Blue limb chains; green planted paws; amber airborne paws |
| Reset | Restore the opening scene; retain Motion lab review settings |
| Field notes | About the study and keyboard reference |
| Fullscreen icon | Toggle browser fullscreen where supported |

Space uses native activation when a button is focused. Sliders retain native keyboard controls. Reduced-motion preference starts the scene paused. Background tabs do not accumulate simulation time.

WebGL is the default. `?renderer=canvas` explicitly selects the Canvas comparison renderer. Use `?paused&time=6` for a reproducible opening still. Source errors and unavailable WebGL appear visibly instead of silently rendering an empty scene.

## Check and inspect

```sh
npm run check          # assets, strict TypeScript, build, Node tests, memory-rendered PNGs
npm run test:browser   # actual Chrome: WebGL/Canvas, desktop/mobile, input and controls
npm run motion         # animated gait comparisons and contact/performance measurements
npm run preview:gif    # regenerate the five-second README animation
```

Browser tests use installed Google Chrome (`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` on macOS, `/usr/bin/google-chrome` on Linux). Override with `CHROME_PATH=/path/to/chrome`. Playwright Core does not download a browser. Tests start and stop their own local server; no separate preview is required.

Open **http://localhost:4173/?lab** for live motion inspection. `artifacts/motion-study.html` plays walking and scurrying side by side after `npm run motion`; each two-second loop includes contact overlays and a scrolling diagnostic floor. `motion-metrics.json` records stance drift, support counts and CPU raster timings. These loops reset at their boundaries; they are inspection clips, not seamless animation assets.

Inspect `artifacts/browser-motion-lab.png`, `browser-webgl.png`, `browser-mobile.png`, `browser-home.png`, `rat-directions.png`, `lost-memory.png`, `home-memory.png` and `budget.json`. `npm run snapshot` recreates the software renders. The atlas remains **1536 × 896, 5.25 MiB decoded**, below the 16 MiB atlas limit. A reserved **384 × 288** region receives the live rat each frame. WebGL updates that region with `texSubImage2D`; no additional texture or runtime library is needed.

## Build and deploy

`npm run build` produces a self-contained `dist/` folder. Serve it with any static host, including under a subdirectory: all delivered references are relative and assets are content-hashed. Upload assets before `index.html`; cache hashed assets immutably and give HTML a short cache lifetime.

For Google Cloud Storage, an explicit destination is required:

```sh
npm run deploy -- --dry-run gs://YOUR_BUCKET/lost
npm run deploy -- gs://YOUR_BUCKET/lost
```

The script checks/builds first, copies assets before HTML, and never deletes remote files. It requires your existing `gcloud` login. Nothing has been published by this initial implementation. No host/domain is assumed.

The uploader's flags follow the [official gcloud storage reference](https://docs.cloud.google.com/sdk/gcloud/reference/storage/rsync). Its argument validation, dry-run behavior, cache settings, ordering and failure handling are tested with a mock uploader; no live deployment has been tested.

## Design

- [How procedural models, animation and pixel rendering work](docs/rat-design.md)
- [Strategy, rat-motion research, implementation and limits](docs/STRATEGY.md)
- [Assets, exact prompts, crop registration and provenance](docs/ASSETS.md)
- [Contributor guidance](AGENTS.md)

`src/model/` provides reusable geometry, materials, camera projection and pixel rasterization. `src/animation/` provides contact planning, joint solving, curves and trailing chains. `src/rat/` supplies anatomy, gait choices and appearance; `src/simulation.ts` owns the actor's behavior and motor. A small plant in `src/examples/sprout.ts` demonstrates reuse and renders to `artifacts/sprout-example.png` during snapshots.

`src/scene.ts` composes DOM-free draw commands; `src/main.ts` owns browser lifecycle and controls. Software, Canvas and WebGL renderers share the draw-command and texture-patch contract. The camera follows the rat exactly; the street remains world-anchored and bounded in memory.

The renderer, math, quad, batch and local-server foundations were reused from [0xfe/jungle](https://github.com/0xfe/jungle), at local revision `50803498ad97b244042fb026ead4fc6fc47f2207`, as requested. Rat behavior, scene, interface and generated art are new. No license has been selected for the original work.
