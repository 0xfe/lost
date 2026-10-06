# Study 001: the street

## The artistic target

Stay close to one small animal. See worn paving, the feet of heavy walls, and occasional warm light. Keep the rat near the center; let the world pass beneath it. Sadness should come from hesitations, empty space, cool color and pacing, rather than a human expression painted onto the animal. Eventually the pauses become less fearful, the gait more confident and the light warmer.

This implementation is a rendering/mechanics demo. The “Home” slider auditions the color transition; it does not implement a journey, destination or finished story.

## What Jungle contributes

The local checkout of Jungle was inspected at `50803498ad97b244042fb026ead4fc6fc47f2207`, including its renderer, fixed clock, directional animation notes and offline asset guidance. Lost directly reuses its `math`, `quad`, `render`, `batch`, `webgl` and `canvas` modules and static server. The useful decisions are:

- Pure simulation and scene assembly; no DOM in the mechanics.
- Fixed 60 Hz simulation with interpolated positions, heading and unwrapped stride phase.
- A common draw-command contract for actual software pixels, Canvas and WebGL.
- One atlas, nearest-neighbor sampling and one painter-ordered WebGL batch.
- Retained generated originals and prompts; deterministic, offline preparation.
- Validate the actual browser, not just a software image.

Lost intentionally starts smaller: one actor and a bounded, procedurally repeated street. It does not inherit Jungle's ecology, persistent chunks or enormous species catalog.

## Motion references and interpretation

[Cohen and Gans, *Muscle activity in rat locomotion: movement analysis*](https://deepblue.lib.umich.edu/bitstream/handle/2027.42/50259/1051?sequence=1) describes lateral-sequence footfalls and changes in stance duration with speed. [Hruska et al., *Quantitative aspects of normal locomotion in rats*](https://doi.org/10.1016/0024-3205(79)90389-8) characterizes walking as lateral sequence with diagonal coupling. [Alves et al., *Flexible coupling of respiration and vocalizations with locomotion and head movements in the freely behaving rat*](https://doi.org/10.1155/2016/4065073) describes alternating diagonal pairs during trotting and relationships between footsteps and head motion.

[Towal and Hartmann, *Right–left asymmetries in the whisking behavior of rats anticipate head movements*](https://pmc.ncbi.nlm.nih.gov/articles/PMC6674387/) supports treating exploratory whisking and head direction as connected, but not perfectly synchronized or bilaterally rigid.

These papers guide the animation design; this demo is not a validated biomechanical simulation. The generated sheet does not enforce a scientifically measured footfall sequence. Implemented movement uses:

- Turn before translating, with a bounded angular speed.
- Bounded acceleration/deceleration, rather than instant movement.
- Distance-driven four-pose walking, and faster playback for scurrying.
- No stride progression when a wall blocks movement.
- A registered 8 × 8 body mesh for small head/shoulder gestures.
- Separate whisker movement and a 15-point damped tail, with fixed segment lengths and a registered rump attachment for every view.
- Breathing, stop-and-sniff intervals, alert pauses and a small paw-washing gesture.

Scurry currently reuses the walk artwork. Sniff, listen and groom deform the same generated body reference; they are not complete independently generated action clips. Paw wash is most visible from the front or sides. Breathing and deformation are artistic approximations. Tail dynamics are planar and do not model contact forces or wall collisions.

## Directional sprites versus 3D

| Approach | Why use it | Main cost |
| --- | --- | --- |
| Generated directional sheet + articulated parts | Fast to establish the character and painterly/pixel texture; used here | Anatomy drifts between poses; four poses are visibly limited close up |
| Authored 3D rat, baked offline | Consistent body, foot registration, 16+ headings, rich actions and smooth transitions; recommended next | Requires a proper animal model and rig, plus an offline baker |
| Real-time 3D rat | Arbitrary poses and headings | Additional lighting/depth/shader path; harder to preserve the chosen pixels |
| Image-to-3D reconstruction | Potential starting geometry | Still requires cleanup, topology, rigging and authored motion; not performed here |

For the next pass, keep the generated rat as the appearance reference and create a compact articulated rat model. Use a spine, pelvis, shoulder girdle, neck/head, ears, two-segment limbs and a tapered tail. Bake through a fixed 2:1 orthographic camera, initially at 16 headings and 16–24 phases per gait. Keep the browser sprite-based. A 3D model is a pose producer, not a reason to add a game engine to the runtime.

Use a lateral-sequence slow walk, diagonal-pair trot, and a separate faster gait only after reference review. Calibrate stance displacement against body scale and world speed; plant feet during stance, recover them during swing, and blend head transitions. Bake body/feet together for reliable occlusion; keep the tail as a separate attached part or behind/front passes. Compare 100% crops at the actual final viewing size before adding more actions.

Do not interpolate unrelated sprite images with alpha crossfades: the double silhouettes are conspicuous this close. Increase pose quality/count or deform registered parts instead. The current four-pose sheet is an honest prototype, not the final smooth performance.

## Scene and camera

Ground coordinates project as `(x − y, (x + y) / 2)`. A fixed close orthographic camera subtracts the interpolated rat position from every world point. Floor tiles, wall segments, drains, sconces and puddles stay anchored in world space. Wall collision constrains the actor to a corridor; it is not a navigable city yet.

Generated cobbles and limestone cover projected surfaces. Code adds gutter geometry, iron grilles, lanterns, warm light masks, reflections and rain. These are layered artistic lighting effects, not physical light transport. Cold-to-warm mood smoothly changes stone and rat tints. Rain can be disabled independently.

The visible neighborhood is rebuilt within a bounded radius. No visited-coordinate collection accumulates. The current shared atlas is 5.25 MiB decoded; the project limit is 16 MiB. Source artwork and PNG storage are separate from decoded texture memory.

## Growing this into a film

1. Approve the silhouette, scale, camera and palette in this study.
2. Replace the four-pose body with a registered rig/bake; add convincing sniff, rear, wash, turn and hesitant-stop transitions. Keep current controls as an animation review tool.
3. Add a few authored street modules and meaningful landmarks: a blocked drain, a doorway, a recognizable warm refuge. Separate the route from the performance.
4. Build a deterministic shot/beat timeline with deliberate pauses and light progression. Keep manual controls for rehearsal; add fixed-time frame export for delivery.
5. Add sound and music against approved pacing, then render the short film. No soundtrack, narrative ending, recording/export pipeline or final edit is implemented yet.

## Verification and boundaries

`npm run check` exercises signed projection, all eight facing mappings, frame-rate independence, turn-before-travel, distance-driven gait, blocking, tail constraints, repeatable ten-minute exploration and bounded scene composition. It produces software-rendered Lost/Home images and a 32-pose contact sheet.

`npm run test:browser` launches installed Chrome and checks WebGL and Canvas, desktop and narrow layouts, actions, facing, mood, notes, pause and keyboard behavior. Browser screenshots are inspectable artifacts. Headless WebGL uses SwiftShader: it proves the browser rendering path, not performance on every physical GPU. Mobile layout uses a browser viewport; physical touch hardware has not been tested.

Generated row gutters were unequal despite the equal-cell prompt. The baker records reviewed row bands, keeps a shared vertical registration for all poses in a row, and checks for clipping/transparency. Direction changes still quantize to eight views, and generated body proportions still vary. Address those in the rig pass before making cinematic motion claims.
