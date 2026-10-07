# Lost contributor guide

Lost is a close-up isometric pixel-art film study about a lost rat in a medieval city at night. Preserve the rat's central framing, tactile stonework, quiet sadness and eventual warmth. This is a mechanics demo, not a complete film.

- TypeScript, static deployment, no runtime dependencies. Build-only dependencies are acceptable. Keep normal builds offline after npm ci.
- Keep simulation and scene composition DOM-free. Inject time; use fixed 60 Hz updates and interpolated presentation. Do not use Date.now or Math.random in world/simulation code.
- src/math.ts, quad.ts, render.ts, batch.ts, webgl.ts and canvas.ts were reused from the user's Jungle project. Keep renderer code independent of rat behavior.
- Locomotion follows heading. Turn before travel, accelerate smoothly and advance gait by actual distance. Planted paws are immutable world-space anchors; only airborne paws may retarget. Stops/blocking finish recovery steps. Turns must respect limb reach. Preserve bone lengths and distinct walk/gallop contact schedules.
- src/model/ owns reusable geometry, materials and pixel rasterization; src/animation/ owns reusable contact, IK, curve and chain mechanics. Neither may import rat or application state. src/rat/ supplies anatomy, gait policy and appearance. Prefer composition over a universal creature superclass; see docs/rat-design.md and src/examples/sprout.ts.
- Keep exploration seeded, route-aware and separate from the root/contact motor. Changes of attention tempo must not alter distance-driven paw contacts. Street and model illumination must use the same world lamp positions.
- Keep head, ears, spine, limbs and tail independently articulated. Tail motion is a separate attached chain. Do not replace contact planning with faster playback of a walking sheet.
- Keep street dressing seeded and world-anchored; avoid scattering weeds uniformly over stone crowns or rerolling them when the camera moves. Retain third-party asset licenses and source hashes in assets/environment-provenance.json.
- Retain third-party provenance as curated credits, license names, source URLs and hashes. Do not commit downloaded HTML pages or embedded site scripts/tokens. Run `npm run secrets:check` before pushing.
- Keep generated source art and exact prompts in assets/. Normal builds must never call image generation. Preserve directional frame registration and nearest-neighbor sampling. Review all headings and loop boundaries.
- Keep rendering memory bounded. One shared atlas, maximum 16 MiB decoded. The live rat and cast shadow update reserved 384 × 288 and 352 × 288 regions; all renderers must consume the same texture patches. Never reorder transparent commands to improve batching.
- Keep README, docs/STRATEGY.md and docs/rat-design.md honest about implemented behavior, component contracts, approximations and future work. Document every control. Preserve the pre-refactor state/pixel fixtures during behavior-preserving refactors; intentional visual changes need reviewed new baselines.
- Run npm run check for changes to mechanics/art; npm run test:browser for renderer/input changes; npm run motion for gait changes. Inspect contacts, transitions and silhouettes in Motion lab and the actual browser. Software snapshots alone do not prove WebGL behavior.
- Use small readable modules, explicit units, light comments on public contracts and non-obvious logic. Add focused tests for actual behavior.
- Do not publish, choose an original-work license, or push without user instructions.
