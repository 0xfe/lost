# A worn medieval lane

The street combines researched prop artwork, a real paving scan and small procedural models. It should feel like heavy, irregular materials surrounding a small animal: damp joints, worn stone crowns, rough timber, forged iron and plants growing where traffic leaves them alone. The rat’s rig and locomotion remain unchanged in this pass.

## References and what we reproduced

| Reference | Observed construction or surface detail | Adaptation in Lost |
| --- | --- | --- |
| [Ulfberth / Celtic Webmerchant, 15th-century lantern reproduction](https://www.celticwebmerchant.com/en/products/15th-century-lantern-museum-of-london) | Cylindrical horn panels, iron bands, domed cap and suspension ring | Hanging candle enclosure with rivets, a vented cap, hinge and latch; placed on an authored oak street post |
| [Lombardia Beni Culturali, Torre dei Foresti](https://www.lombardiabeniculturali.it/architetture/schede/RL560-00088/) | Thick square iron lattice, deep stone surround, real bar intersections and inset darkness | Recessed cellar grille with substantial bars and riveted cross-straps, framed by a chipped low stone arch |
| [The Met, Italian iron grille, 15th–16th century, 55.61.48](https://www.metmuseum.org/art/collection/search/468498) | Collection evidence for period iron grilles | Material/period context; no museum photograph is shipped or copied into the texture |
| [Rob Tuytel / Poly Haven, Cobblestone Large 01](https://polyhaven.com/a/cobblestone_large_01) | Worn irregular stones, soil-filled gaps, missing stones, pebbles and small weeds | The actual CC0 diffuse, normal, AO and displacement maps form the paving source |
| [Historic England, maintaining cobbled paths](https://historicengland.org.uk/advice/technical-advice/parks-gardens-and-landscapes/garden-features/) | Soil/sand jointing, growth in joints, edging stones and drainage | Clustered verge growth, dirt deposits and interrupted stone kerbs |

The lantern reference is a modern commercial reproduction, not an independently verified archaeological record. The repeating upright street posts and low arch composition are film-design adaptations. This is a historically informed fictional lane, not a reconstruction of one documented medieval street. Reference photos were inspected during design; they are not distributed with the game.

## Prop sprites

Built-in `image_gen.imagegen` produced two new assets: `assets/source/street-lantern-original.png` and `assets/source/cellar-grille.png`. The exact prompts are in [environment-prompts.json](../assets/environment-prompts.json). They requested credible construction and material wear rather than schematic lines or uniformly colored shapes. Both originals retain genuine alpha.

The offline baker finds the alpha bounds, retains padding, removes alpha below 16/255, preserves aspect ratio and samples with nearest-neighbor filtering. The post occupies 144 × 632 atlas pixels. Its ground anchor is at `.335 × width, .985 × height`, with a total scene height of 8.73 units. The candle registers at world Z 6.35 and at a screen-horizontal offset equivalent to `(+.45, −.45)` world units from the post. The world lamp field, local halo and rat shadow all use that candle position.

The grille is 384 × 272 pixels, generated in front elevation. A world-space wall quad supplies its isometric perspective, so it sits flush against the existing masonry without a second perspective transform baked into its image. The surround includes its own chipped stones, dark reveal and bar occlusion. Its displayed size is 1.9 × 1.44 world units. Props are fixed-view artwork; they do not support a rotating camera.

## Ground and organic detail

The paving scan is retained under `assets/source/polyhaven/`. Normal builds never download it. `scripts/street-assets.mjs` resamples the diffuse, OpenGL normal and AO maps to 512 × 512. A fixed low-contrast directional relief bake uses the normals and AO to reveal edges and dirt-filled recesses; modest desaturation makes the scan fit the pixel palette. The scene’s existing lamp field then modulates the surface using interpolated corner colors.

The texture repeats every twelve world units and is subdivided into 1.5-unit lighting cells, each using its correct 64 × 64 subregion. Signed modulo keeps that registration continuous across negative coordinates. Soil overlays have irregular noise-shaped alpha and occur at world-anchored positions. Damp patches and individual kerbstones break up the old uniform strips. The original generated paving is retained for provenance but is no longer the displayed road.

`src/environment/plants.ts` creates four grass clumps, two broadleaf rosettes and two rubble clusters. Grass blades and leaves are tapered, curved triangle ribbons with different lengths and directions. Rubble begins with low-resolution ellipsoids, perturbs their surfaces and uses scalar stone grain. These meshes are rendered offline by the same `rasterMesh()` used for the rat, into eight 64 × 64 sprites. This demonstrates the reusable model pipeline without adding per-frame plant mesh work.

`src/world/dressing.ts` places these sprites on a bounded .8-unit candidate grid with seeded position, type and scale variation. Dampness noise raises density along the verges. A 64 × 64 copy of the scanned displacement map favors low joints for plants in the road; central traffic remains sparse. Rubble and plants are ordered by world depth with the actor and posts. Scrolling the camera does not reroll their positions, and there is no growing world cache.

## Limits and verification

The ground’s unevenness is visual: normal-map relief, baked joint darkness, raised small props and kerb faces. Paw contacts still use Z = 0, with no heightfield collision or obstacle avoidance for individual pebbles. The scan’s normal lighting is baked, while broad lamp falloff is dynamic. Prop sprites also contain fixed surface shading. Plants do not yet bend when touched or cast individual projected shadows. These limits preserve the established animation foundation while improving the environment’s appearance.

The shared atlas is 1536 × 1536: **9 MiB decoded**, within the 16 MiB limit. The rat and shadow retain their previous registered regions. No runtime package dependencies were added. Assets are prepared through `tsx` so the offline baker can reuse TypeScript model code.

Tests check all atlas regions for overlap and bounds, alpha in the new cutouts, finite vegetation geometry, stable scatter under camera shifts, negative-coordinate texture continuity, richer verge density and correct prop replacement/depth ordering. `npm run check` renders software snapshots; `npm run test:browser` checks actual Chrome WebGL and Canvas at desktop/mobile sizes. The rat’s saved state/pixel baselines remain unchanged.

## Asset rights and reproducibility

The paving files are **Cobblestone Large 01 by Rob Tuytel**, distributed by Poly Haven under [CC0](https://polyhaven.com/license). Source download records and SHA-256 hashes are in [environment-provenance.json](../assets/environment-provenance.json). The diffuse, normal, AO and displacement JPEGs are retained unchanged; the game uses derived offline pixels. Poly Haven branding, site text and preview photographs are not game assets.

New lantern/grille artwork was generated for this project with the built-in tool. No third-party animal, lantern or grille model is bundled. Distribution terms for Lost’s original artwork/code remain undecided; the CC0 attribution applies only to the named paving files. The existing build tools—Sharp, tsx and TypeScript—prepare the output locally.
