# CLASSIC: crowds (gen 9)

## Capabilities
- No crowd collision detection or spatial queries.
- Games check every object against every other object for proximity (O(n²) loops).
- For 20+ moving objects checking neighbors, games write nested loops that become slow.

## Behaviour
- A game with bunnies that react to being near each other must loop over all pairs every frame.
- Tapping near a group requires checking distance to every object individually.

## Evaluation
- No builtin crowd functions exist.
- Example games with 30+ objects avoid neighbor checks to stay fast.
