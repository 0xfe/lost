# Original art and offline preparation

All three visual materials were created for this project with the built-in `image_gen.imagegen` tool on 2026-10-06. No downloaded asset packs, fonts or audio are shipped.

| Retained source | Purpose |
| --- | --- |
| `assets/source/rat-original.png` | Initial 4-column, 8-row directional rat sheet |
| `assets/source/rat.png` | Edited true-alpha rat cutouts used by the baker |
| `assets/source/cobbles.png` | Generated wet medieval setts, projected onto the ground |
| `assets/source/masonry.png` | Generated weathered limestone, projected onto castle walls |

Exact initial prompts are in `assets/prompts.json`; the edit prompt is in `assets/transparency-edit.json`. `assets/provenance.json` records source SHA-256 hashes. Original output files are retained unchanged. Derived assets live under ignored `public/assets/` and rebuild from those originals.

The image generator painted brown RGB under the initial sheet. The follow-up edit requested true transparency; the delivered RGBA file contains genuine alpha, including low-alpha matte residue. The offline baker zeros alpha below 12/255 and makes alpha above 245/255 opaque, preserving intermediate fur edges. It does not synthesize missing directions or mirror side views.

The apparent eight-row layout is **not an exact equal-height grid**. Reviewed vertical band boundaries in source pixels are `0, 196, 367, 550, 727, 890, 1080, 1280, 1536`. Each row's four poses share one union-bounds vertical offset into a 256 × 208 registration canvas. They are then sampled with nearest-neighbor at 192 × 144. Never trim each pose independently. Rump and nose landmarks are recorded per direction in the baker.

The source heading order is screen-space right, lower-right, down, lower-left, left, upper-left, up, upper-right. `directionRow()` maps a world heading through the actual isometric projection before selecting a row. World-angle quantization alone would choose the wrong art.

`scripts/prepare-assets.mjs` packs all body frames plus 256-pixel stone textures, procedural light/shadow masks and a white utility texel into one 1536 × 896 RGBA texture. Transparent source margins protect the frames. No filtering or mipmaps are used. The tail is code-authored geometry with pink/grey segment shading; it is deliberately absent from the generated body art and does not need its own bitmap sheet.

The source art is pixel-styled, with downsampling making the delivered pixel structure explicit. The tool sometimes varies fur pattern, body size and feet between frames. The directional contact sheet is a required review artifact. For consistent close-up film animation, follow the offline rig proposal in [STRATEGY.md](STRATEGY.md).

Renderer and server code was reused from the user's Jungle repository, revision `50803498ad97b244042fb026ead4fc6fc47f2207`. No third-party animal model or animation is included. Original-work distribution terms have not been selected.
