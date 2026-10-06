# Original art and offline preparation

The original rat and masonry materials and the new lantern/grille sprites were created with built-in `image_gen.imagegen` on 2026-10-06. Paving now uses Rob Tuytel’s CC0 **Cobblestone Large 01** scan from Poly Haven. Grass, broadleaf weeds and rubble are authored meshes baked offline. No fonts or audio are shipped. See [street-design.md](street-design.md) for references, adaptation choices and licenses.

| Retained source | Purpose |
| --- | --- |
| `assets/source/rat-original.png` | Initial 4-column, 8-row directional rat sheet |
| `assets/source/rat.png` | Edited true-alpha cutouts retained as reference; also supplies the live fur material |
| `assets/source/cobbles.png` | Original generated setts, retained for provenance; superseded in the live street |
| `assets/source/polyhaven/cobbles-*.jpg` | CC0 diffuse, normal, AO and height scan maps used by the new paving baker |
| `assets/source/street-lantern-original.png` | Generated transparent timber/iron/horn lantern post |
| `assets/source/cellar-grille.png` | Generated front-elevation stone arch and recessed iron grille |
| `assets/source/masonry.png` | Generated weathered limestone, projected onto castle walls |

Exact initial prompts are in `assets/prompts.json`; the edit prompt is in `assets/transparency-edit.json`. `assets/provenance.json` records source SHA-256 hashes. Original output files are retained unchanged. Derived assets live under ignored `public/assets/` and rebuild from those originals.

The image generator painted brown RGB under the initial sheet. The follow-up edit requested true transparency; the delivered RGBA file contains genuine alpha, including low-alpha matte residue. The offline baker zeros alpha below 12/255 and makes alpha above 245/255 opaque, preserving intermediate fur edges. It does not synthesize missing directions or mirror side views.

The apparent eight-row layout is **not an exact equal-height grid**. Reviewed vertical band boundaries in source pixels are `0, 196, 367, 550, 727, 890, 1080, 1280, 1536`. Each row's four poses share one union-bounds vertical offset into a 256 × 208 registration canvas. They are then sampled with nearest-neighbor at 192 × 144. Never trim each pose independently. Rump and nose landmarks are recorded per direction in the baker.

The archived source heading order is screen-space right, lower-right, down, lower-left, left, upper-left, up, upper-right. `directionRow()` retains the correct world-to-screen mapping for these references. The live rat does not select a directional frame: `src/rat/model.ts` assembles continuously posed body, head, limb and tail geometry using the shared `src/model/` components. See [rat-design.md](rat-design.md) for the complete pipeline.

`scripts/prepare-assets.mjs` retains the 32 reference frames plus a 512-pixel scanned paving tile, 256-pixel masonry, prop and vegetation sprites, procedural light/shadow masks and a white utility texel in one 1536 × 1536 RGBA texture. It reserves a 384 × 288 region at `(800, 600)` for the live rat. A second 352 × 288 region at `(1184, 600)` holds the posed cast shadow. All three renderers apply both RGBA patches before drawing. The lantern and grille use registered generated cutouts. `scripts/street-assets.mjs` bakes the new terrain and prop regions; `assets/environment-prompts.json` retains the exact generation prompts, and `assets/environment-provenance.json` records all new source hashes and the third-party attribution. No filtering or mipmaps are used. The articulated tail is code-authored 3D geometry and does not need its own bitmap sheet.

The live material uses a 65 × 48 fur crop at `(80, 87)` from `rat.png`, sampled to 32 × 32 grayscale. Its luminance is normalized and contrast reduced to avoid carrying the source image's baked lighting onto the model. Stable model-space UVs attach that variation to the moving anatomy. Source images remain unchanged; geometry, joint placement and animation are authored, not image-to-3D reconstruction.

The source art is pixel-styled. Its inconsistent body proportions and paw positions motivated the live rig described in [STRATEGY.md](STRATEGY.md). `rat-directions.png` now reviews continuous live poses; the original sheet and its registered atlas regions remain available for comparison. The new silhouette and material are still an animation-study approximation, not final character art.

Renderer and server code was reused from the user's Jungle repository, revision `50803498ad97b244042fb026ead4fc6fc47f2207`. No third-party animal model or animation is included. Original-work distribution terms have not been selected.
