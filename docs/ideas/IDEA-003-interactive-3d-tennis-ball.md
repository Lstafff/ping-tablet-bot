# IDEA-003 — Interactive 3D tennis ball

Status: open

## Product intent

Make the total number of recorded balls feel physical and memorable rather than only numeric.

## Implementation hypotheses

- A 3D tennis ball with local deformation/contact shadow.
- Hold or drag rotation.
- A lighter 2D physical microinteraction if it communicates the value better.

These are hypotheses, not requirements. Use `$ask-nodumb`, `$emil-design-eng` and `$animate` before choosing a renderer.

## Why

This may turn an abstract cumulative metric into a distinctive product moment.

## Relevant when

- statistics redesign;
- rare delight or immersive visualization;
- bundle/performance budgeting.

## Done when

The interaction improves comprehension or emotion in testing; it is isolated and lazy-loaded; resources clean up; reduced-motion and low-power fallbacks exist; core statistics do not depend on the renderer.

## Evidence

Not implemented. No Three.js, R3F or WebGL runtime is in the active product dependency list.
