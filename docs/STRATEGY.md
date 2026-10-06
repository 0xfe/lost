# Study 002: finding his feet

For the detailed construction, animation, texturing and reusable component design, see [rat-design.md](rat-design.md).

## What changed, and why

The first demo used four generated body poses per direction. Advancing those images by distance did not establish where each paw touched the street. The feet could slide even when the cycle rate looked plausible. Deforming the body image could not independently articulate its hidden limbs, neck or ears, and playing the same images faster could not produce a different gait.

The live rat is now an authored procedural 3D mesh and rig. A contact planner places paws in world space; two-link inverse kinematics connects the shoulders and hips to those paws. A small CPU rasterizer draws the continuous pose through the same isometric camera as the street, then updates a reserved rectangle in the existing WebGL atlas. The generated rat remains an appearance reference and source of fur texture. Its pixels were **not** reconstructed into geometry.

This gives us a controllable foundation for close-up motion: arbitrary headings, continuously changing poses, visible contact diagnostics and independent head, ear and spine movement. The current anatomy and material are simplified. This is a kinematic animation study, not a validated simulation of rat biomechanics or final character art.

## Research and interpretation

[Spinal control of locomotion before and after spinal cord injury (2023)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10055332/) discusses speed-dependent rat gait patterns, including lateral-sequence walking and faster asymmetric gaits. This motivates using different contact schedules rather than speeding up a walking clip. Our “scurry” is an authored asymmetric gallop; it does not claim every rat uses that gait at a particular speed.

[Bonnan et al., Forelimb Kinematics of Rats Using XROMM (2016)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4775064/) describes crouched forelimb movement and the contribution of scapular motion. The rig therefore uses bent limbs and shoulder glide, rather than straight legs rotating around fixed shoulder sockets. [Towal and Hartmann (2006)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6674387/) connects asymmetric whisking with head movement; exploratory whiskers consequently follow the head but have different phases on each side.

These are qualitative design references. The numerical stride lengths, phase offsets, duty factors and joint proportions below are authored parameters, not measurements fitted to those papers. Reference video tracing and anatomical refinement remain useful next steps.

## Contact drives the motion

The core invariant is simple: while a paw is planted, its world-space position stays unchanged. The street and paw are projected through the same camera, so they move across the screen together as the body advances. Camera interpolation preserves that relationship. Pixel sampling still quantizes the displayed result.

1. The root motor turns, accelerates and translates in street units. Actual distance advances the gait phase; blocked motion does not advance it.
2. Each paw alternates between stance and swing. Stance stores an immutable ground anchor. Swing predicts a landing point from remaining stride distance and uses a smooth recovery arc.
3. Starts and stops finish airborne steps. Turns replant feet before the body can rotate beyond their reachable stance. Grooming explicitly releases the front paws and returns them through recovery steps.
4. Shoulder and hip positions come from the moving trunk. Two-link inverse kinematics places elbows and knees between those joints and the paw anchors. Front and hind limbs bend differently; the shoulder glides with reach.
5. The head anticipates turns and independently scans, sniffs and listens. Ears swivel and flick on separate schedules; eyes blink; whiskers sweep; the pelvis and 19-point tail chain move independently.

| Parameter | Walk | Scurry |
| --- | --- | --- |
| Root speed | 1.25 world units/s | 4.1 world units/s |
| Distance per full cycle | 0.50 | 0.94 |
| Stance fraction | 0.70 per paw | 0.30 fore / 0.32 hind |
| Contact organization | Four-beat lateral sequence | Slightly offset fore pair, then hind pair |
| Steady support | Two or three paws | Zero, one or two paws; short suspension intervals |
| Paw clearance | 0.065 | 0.15 |
| Trunk | Small lateral sway and breathing | Gather, stretch, arch and vertical motion |

Parameters live in `src/rat/locomotion.ts`. Gait schedule changes occur at cycle boundaries or rest; body effects blend continuously. Walk and scurry share anatomy, not an animation clip.

## Why a live model instead of another sprite sheet

| Approach | Useful property | Limitation for this study |
| --- | --- | --- |
| Generated pose sheets | Quick appearance exploration and fur reference | Inconsistent anatomy and uncalibrated paw trajectories |
| Offline 3D bakes | Consistent art, cheap runtime playback | Large heading/action/transition combinations; arbitrary turns and acceleration still need contact correction |
| Live articulated model, rasterized to the atlas | Continuous joints, headings and contacts; shared pixel output across renderers | CPU pose/raster cost and an authored model that needs visual refinement |
| Image-to-3D reconstruction | Possible starting shape | Still needs topology cleanup, rigging and motion; not used here |

For one central animal, a small live rig is a useful tradeoff. Its 384 × 288 raster region is bounded; the mesh has about 9,560 triangles. Local CPU-only measurements are written by `npm run motion`, rather than assuming universal frame rates. If the cast grows, we can cache approved poses or move rasterization to an offscreen GPU target while keeping the same contact planner and rig. We do not crossfade unrelated sprite silhouettes.

The CPU rasterizer handles rat self-occlusion, smooth normals, stable model-space fur sampling and quantized shading. WebGL remains the main scene renderer, with one texture and one painter-ordered batch. Canvas and memory renderers consume the same dynamic pixels, so headless snapshots test the actual pose producer.

## The scene and Jungle foundations

Stay close to one small animal. Show worn paving, the feet of heavy walls and occasional warm light. Keep the rat near the center and let the world pass beneath it. Hesitations, empty space, cool color and pacing should carry the sadness. The Home slider auditions a warmer ending; it does not implement a journey or destination.

Ground points project as `(x − y, (x + y) / 2)`; height subtracts from screen Y. Floor tiles, wall segments, drains, sconces and puddles remain world-anchored. The normal scene constrains the actor to a corridor. Motion exports use an unbounded floor so a wall cannot interrupt gait inspection. Lighting, reflections and rain are artistic layers, not physical light transport.

The original implementation inspected Jungle at revision `50803498ad97b244042fb026ead4fc6fc47f2207` and reused its math, quad, render, batch, WebGL, Canvas and static-server foundations. We retain its useful separation of pure simulation, fixed 60 Hz updates, interpolated presentation, common rendering contract, bounded scene memory and offline asset preparation. The atlas remains 5.25 MiB decoded, within the 16 MiB atlas limit; this is not a total-process RAM limit.

## Inspect and verify

Open `/?lab`. Compare Walk and Scurry at quarter speed, inspect green stance contacts versus amber airborne contacts, and use Step 1/60 s to examine landing and liftoff. Disable the overlay to judge the silhouette and acting. Compare starts, braking, opposite-direction turns and grooming transitions as well as steady loops.

- `npm run check`: strict TypeScript/build, Node tests and actual software-rendered snapshots.
- `npm run test:browser`: installed Chrome, WebGL and Canvas, desktop/mobile viewports, action controls, Motion lab, quarter-speed selection and single stepping.
- `npm run motion`: two-second animated WebP gait studies, a comparison sheet, and JSON contact/raster measurements. Open `artifacts/motion-study.html` to compare them. Export loops reset visibly at their boundaries.

Motion tests verify zero world-space stance drift, identical paw/ground camera displacement through interpolation, distinct support patterns, constant limb lengths through cycles and mixed transitions, moving head/ears at rest, grounded recovery after stops/blocking, deterministic pixels and sixteen distinct continuous headings. These invariants establish a sound animation mechanism; they cannot establish perceptual realism by themselves.

Headless WebGL uses SwiftShader, so browser tests prove the rendering path rather than physical GPU performance. A mobile viewport is not a physical touch-device test.

## Remaining limits and next work

The gait planner is kinematic: it does not solve ground reaction forces, mass distribution, friction or a physically balanced center of mass. Gallop body height and spine flexion are authored curves. Tail dynamics do not model wall collisions. Toe contact uses a flat ground plane, so steps and uneven stones will need sampled terrain heights. Sniff/listen/groom are procedural studies rather than detailed reference-matched performances.

The most valuable next pass is to compare slow-motion rat footage against this rig, tune shoulder/hip proportions and footfall timing, and improve the fur and silhouette without losing contact correctness. A trot and a rearing action can then be added as distinct performances. After the actor reads convincingly, add a small set of authored street landmarks and a deterministic shot/beat timeline. Sound, a narrative ending, final film export and an edit remain future work.
