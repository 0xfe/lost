# Live rat

`types.ts` defines the rat pose. `locomotion.ts` supplies foot homes, distinct gait timing and grooming targets to the shared contact planner. `../simulation.ts` owns the actor's root motor and continuous presentation samples.

`model.ts` assembles `body.ts`, `head.ts`, `limbs.ts` and `tail.ts`. These rat-specific parts use shared mesh primitives and IK. `materials.ts` supplies the palette; `raster.ts` supplies camera, light, mood tint and fur binding to the generic pixel rasterizer. The live output remains one bounded 384 × 288 pixel atlas region.

Reusable mechanisms live in `../model/` and `../animation/`, with no rat imports. Another subject owns its own anatomy and pose and reuses those functions. See [the full design guide](../../docs/rat-design.md) and [the plant example](../examples/sprout.ts).

Keep root, foot and camera units identical. Never move stance feet with the root, choose a sprite by heading, or drive walking feet from wall-clock time. Airborne feet may retarget; stance feet may not. Starts, stops and turns must finish recovery steps without snapping planted paws.

The original generated body sheet is retained as reference, and a patch of its fur supplies the live material. Do not claim the original images were reconstructed into geometry: the mesh and rig are authored in TypeScript.
