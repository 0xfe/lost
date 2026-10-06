# Live rat

`locomotion.ts` owns world-space paw contacts and distinct gait timing. `simulation.ts` owns the root motor and continuous presentation samples. `model.ts` solves limb joints around those contacts and produces an articulated, textured mesh. `raster.ts` draws that mesh through a fixed orthographic camera into one bounded 384 × 288 pixel atlas region.

Keep root, foot and camera units identical. Never move stance feet with the root, choose a sprite by heading, or drive walking feet from wall-clock time. Airborne feet may retarget; stance feet may not. Starts, stops and turns must finish recovery steps without snapping planted paws.

The original generated body sheet is retained as reference, and a patch of its fur supplies the live material. Do not claim the original images were reconstructed into geometry: the mesh and rig are authored in TypeScript.
