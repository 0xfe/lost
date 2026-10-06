# The sound of the street

The soundscape uses real CC0 recordings, edited into small local PCM clips and arranged procedurally. It is deliberately quiet: the rat is a small animal in a large street. There is no music, dialogue script, runtime audio library, CDN or external service.

Every visit starts muted, with the interface hidden. The top-right button or `M` enables sound. `H` / Show controls reveals the menu, including **Sound mix** with independent rain, insects, foliage, people, candle and rat sliders. Zero silences a group, including its reflection send. The Rain checkbox controls both visible rain and its two audio layers. Pause and backgrounding suspend the audio clock. Reset clears the score and active sounds while retaining the current mute/mix choices.

## Recordings and provenance

All six sources are offered under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Original downloads, source-page snapshots, author credits, URLs and SHA-256 hashes are retained under `assets/audio/`. Licenses apply to these recordings, not automatically to the original project code or artwork.

| Material | Creator and source | Use |
| --- | --- | --- |
| Rain | [Ove Melaa — Rainy](https://opengameart.org/content/rain-ambient-not-loopable-2-versions-available) | Two separate excerpts, overlapped at their seams; full rain and softer filtered drizzle |
| Crickets | [Ted Kerr / Wolfgang_ — Crickets Ambient Noise](https://opengameart.org/content/crickets-ambient-noise-loopable) | World-anchored night insects, gently varying level and pitch |
| Dry foliage | [Iwan Gabovitch / qubodup — 20 Rustles of dry leaves](https://opengameart.org/content/20-rustles-dry-leaves) | Sparse verge rustles and tiny crawl grains; these are indoor leaf foley recordings |
| Fire | [AntumDeluge — Fire Crackling](https://opengameart.org/content/fire-crackling) | Very quiet, high-pass-filtered wick foley at lamps; the source is a fireplace, not an actual candle |
| Footsteps | [Fantozzi, sliced by qubodup — Grass/Sand & Stone](https://opengameart.org/content/fantozzis-footsteps-grasssand-stone) | Three hard and three soft human impacts; shortened/pitched/filtered hard impacts become rat paw foley |
| People | [Breviceps — Busy Room Ambience](https://freesound.org/people/Breviceps/sounds/457043/) | Intermittent, muffled moving murmurs; retained file is the publicly offered HQ MP3 preview |

The voices are an adapted room-crowd recording, not isolated period dialogue. Human figures are not rendered; the sound suggests passers outside the shot. Dry leaves stand in for vegetation rustling. Rat sounds are designed foley, not recordings of rat paws. These are intentional approximations that can be replaced by better recordings without changing contact or spatial logic.

## Offline asset preparation

`npm run audio:prepare` verifies original hashes, extracts the two retained 7z packs using `tar` with 7z support, and decodes recordings through installed Chrome's native audio codecs. No account or API key is required. Chrome path follows `CHROME_PATH`, then the usual macOS/Linux install locations. This optional authoring command uses existing Playwright Core; normal builds never launch Chrome or fetch recordings.

The preparation script downmixes to mono at 24 kHz, removes DC, normalizes toward 0.12 RMS with a 0.85 peak ceiling, trims leading silence from impact recordings, and fades transient edges. Ambient loops crossfade the tail against the head over up to 650 ms. Source crop recipes, frames and final hashes live in `clips.json`. Rain was explicitly supplied as non-looping audio: the prepared versions provide the loop seam. Mono clips are positioned independently in the stereo mixer.

Fourteen PCM16 WAVs total approximately 3 MB delivered / 6 MB decoded. WAV avoids runtime codec differences. `npm run build` verifies hashes and copies content-hashed WAVs into `dist/assets`; source recordings and archives are not deployed. Fetch/decode happens once, after a sound-button gesture. Decoder implementations may change authoring results across Chrome versions; the checked-in WAVs are the canonical build inputs.

## Score and world behavior

`src/audio/score.ts` is a DOM-free, seeded score. Its random stream is independent of rat exploration. Sound never changes the rat's simulation, and camera zoom never changes physical sound distances.

- **Paws:** compare previous/current contacts after each 60 Hz physics update. Only landing edges emit impacts. Forefeet are lighter; speed, sample choice and slight pitch/gain variation shape the sound. A subset adds a short high-frequency crawl scuff. Recovery steps can make contact sounds; settled paws are silent. Walking and galloping inherit their distinct physical contact rhythms.
- **Rain/drizzle:** two differently filtered/pitched excerpts flank the listening position. A slow coherent field changes intensity. Switching Rain off fades both layers down; insects become more prominent.
- **Insects:** three nearby world cells carry independently offset cricket loops. They stay at the verges as the camera moves, with slowly changing activity. Cells leaving the active region fade out.
- **Foliage:** a short rustle appears every 4–14 simulation seconds, with varied duration, gain and position near either verge. It is not synchronized to a particular rendered plant.
- **People:** at most one passer is active. First arrival begins after nine simulation seconds; subsequent passes have 15–40 seconds of separation after the previous path ends. A person crosses a 24-unit path on either side of the street, with a seeded speed, slightly irregular cadence and hard/soft footstep family. Some talk in short phrases separated by silence. Voices and footsteps share the same moving path.
- **Candles:** three nearby lamp sources use the exact world positions and flicker power from `world/street.ts`. Coherent noise at two rates modulates visible flame, illumination and crackle level. Crackle is intentionally faint and low frequencies are removed to avoid a bonfire rumble.

`mix` contains per-group defaults; individual event definitions expose duration, offset, gain, rate, cutoff, high-pass, wet send and world position. Change the score for behavior, the graph for acoustics, and the player for browser lifecycle.

## Spatial rendering and reflections

`src/audio/graph.ts` accepts sound descriptions and decoded buffers. The same graph runs in `AudioContext` and `OfflineAudioContext`.

Screen-right corresponds to positive world X / negative world Y. Stereo pan follows that projection and is limited to ±0.94. Distance attenuates gain as `1 / (1 + (distance / 4)^2)` and progressively lowers the low-pass cutoff. Lamp height contributes to distance. Parameters ease over 60–80 ms, avoiding abrupt jumps while the listener moves.

Each voice passes through high-pass and low-pass filters, distance gain, an attack/release envelope and a stereo panner. Dry and reflection routes both respect category volume. Reflections use a seeded stereo impulse: discrete short echoes at about 55, 103 and 171 ms with a filtered 850 ms decaying tail. A conservative output gain and compressor provide headroom. This is camera-aligned stereo and a stylized stone alley, not HRTF binaural audio, ray-traced occlusion or a measured acoustic space.

The live listener follows the rat. Rain is broad camera-relative ambience; everything local has world coordinates. Sustained sources are limited to eight plus brief outgoing fades. The graph caps tracked voices at forty; ended sources disconnect. Muting fades then clears active sounds and suspends the context; the score continues with simulation, so unmuting does not replay a backlog. Pausing retains audio time with simulation. Motion-lab slow playback slows event timing; sample pitch and ambient playback remain natural-speed.

## Browser lifecycle and verification

`src/audio/player.ts` owns lazy loading, user-gesture resume, mute, suspension, retries, score reset and mix preferences. Audio failures leave the rendering usable and change the button to Retry sound. Preferences are in-memory only; reload always starts muted. Controls are hidden directly in HTML to avoid a startup flash.

- `npm run check`: contact synchronization, silence after settling, deterministic passes, different footstep families, distance/pan/filter behavior, lamp registration, rain gating, source/clip integrity and delivery budget, alongside existing visual/mechanical checks.
- `npm run test:browser`: real Chrome WebGL/Canvas and responsive UI, no audio load before consent, gesture unlock, paused startup, mute/unmute, pause/resume, category control and a failed-decode retry.
- `npm run audio:preview`: renders 45 seconds through the production graph in a real OfflineAudioContext, with full street, isolated rat and isolated people tracks. Writes `artifacts/audio-street.wav`, `audio-rat.wav`, `audio-people.wav` and level/voice-budget metrics. Checks non-silence, stereo difference and output headroom.

Offline levels and browser graph tests do not replace headphone listening or testing Safari/iOS audio interruptions on a physical phone. Use the isolated tracks to tune foley and the full mix to judge masking; do not normalize every layer to equal perceived loudness.
