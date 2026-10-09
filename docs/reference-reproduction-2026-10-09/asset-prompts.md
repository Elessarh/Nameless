# Reference reproduction assets — 9 October 2026

New decorative environments produced with the built-in `image_gen` tool, using the user supplied mockup as the composition and style authority. These are illustrations, not official server screenshots, map data, creatures or equipment. Existing catalog media remain intact.

## Homepage environment

- Reference: `C:/Users/julie/AppData/Local/Temp/codex-clipboard-312d033d-283d-49f5-84d1-f37874bebb4e.png`.
- Built-in output: `C:/Users/julie/.codex/generated_images/01a11f08-4f19-75b2-a02c-81fb5c1a75ef/exec-410a686f-15b2-43bd-aefa-b07638afa928.png`.
- Project source: `assets/reference-v2/home-environment-source.png`, actual 1672 × 941 pixels.
- Inspected: all interface text, thumbnails, cards, header, divider lines, marks and borders removed; original composition preserved. Dark ruins/forest left and sides, floating Aincrad architecture upper right, golden clouds, lantern bridge and turquoise side waterfalls retained.
- Export processing: aspect-preserving WebP resizing and recorded crop only; no raster repainting or invented resolution.
- Full background exports: 1672 × 941, 1280 × 720 and 960 × 540. Mobile: 640 × 917, crop `[760, 0, 1417, 941]`.
- Castle category art: `home-castle-card-640.webp` (640 × 200) and `home-castle-card-320.webp` (320 × 100), crop `[640, 70, 1520, 345]`; decorative illustration, not a map or an asserted server location.
- All source and export dimensions, bytes and SHA256 are recorded in `assets/reference-v2/asset-manifest.json`.

Exact prompt:

```text
+Use case: precise-object-edit.
Asset type: a clean full-bleed website environment background extracted from the supplied homepage reference; final output landscape 16:9, ideally 2560x1440.
Input image 1 is the EDIT TARGET and composition/style authority.
Primary request: Remove ALL user interface, all text, logos, borders, icons, cards, thumbnails, buttons, divider lines, the full top header, and every lower panel from the supplied image. Seamlessly reconstruct the scenery hidden beneath those UI areas. The entire result must be ONE continuous cohesive illustrated environment, with absolutely no residual UI rectangles or lettering.
Preserve the target's exact camera, layout and art direction: dark monumental voxel stone ruins and dense forest on the far left, left center remaining very dark and calm; a magnificent intricate multi-tier floating Aincrad Minecraft castle and connecting sky bridges in the center-right upper half; ivory golden sunlit clouds at the upper right; a stone foreground bridge lit by amber lanterns spanning diagonally through the middle-right; dark stone pillars and leafy ruins framing both extreme sides all the way down to the bottom; vivid yet controlled turquoise waterfalls/light in both lower side corners. Preserve the feeling of being inside the ruins looking outward toward the grand sky castle.
The left 40 percent should stay shadowy for actual HTML text. The brightest focal architecture and golden sky remain in the upper right. Continue the forested dark cavern-like framing and lanterns behind the original lower cards so the bottom 45 percent naturally blends into deep blue-black, with readable detailed scenery along the far sides.
Style: faithfully match the supplied lush cinematic SAO/Minecraft illustrated art, rich painterly atmospheric light and fine architectural detail but unmistakable blocks/voxel stone and foliage, staircase silhouettes, cube textures. Elegant blue-night, dark petroleum teal, ancient amber-gold lights, ivory clouds. Do not simplify into a vanilla flat Minecraft screenshot, a smooth fantasy castle, a huge skyball, or a realistic photo.
Constraints: preserve scene framing and visual detail; no typography, no UI, no logos, no monograms, no banner lettering, no creatures, no weapons, no people, no map pins. Architecture must remain coherent and Minecraft-inspired. Output ONLY the clean continuous environment background.
```

## Forest environment

- Built-in output: `C:/Users/julie/.codex/generated_images/01a11f08-4f19-75b2-a02c-81fb5c1a75ef/exec-e4b32ac7-a2fb-497e-b5b2-cebe9383484f.png`.
- Project source: `assets/reference-v2/forest-environment-source.png`, actual 1672 × 941 pixels.
- Export sizes: 1280 × 720, 640 × 360, 320 × 180, WebP quality 84, no crop. All three scenes inspected: coherent voxel architecture, reference palette/light, no text or interface, no invented game characters/items.

Exact prompt:

```text
Use case: stylized-concept.
Asset type: clean full-width forest environment art for a SAO Minecraft website bestiary category card and page backdrop, landscape 16:9.
Input image 1 is the user's STYLE AND COMPOSITION REFERENCE; reproduce specifically the dark forest turquoise atmosphere visible in the Bestiaire card of this image, but draw only the ENVIRONMENT without its wolf.
A deep blue-petroleum enchanted forest of voxel stone ruins and cubic dark tree trunks, dense blocky leaves, a narrow path, some mossy stepped stone fragments, soft mist, cool turquoise shafts of moonlight in the background, no subjects in the foreground. A strong dark canopy framing the top and left, middle distance forest remaining readable and rich, brighter cyan glade toward center-right. Fine dense cinematic Minecraft/SAO painterly render in the same style, palette and level of detail as the supplied homepage.
Faithful to its blocky architectural materials and foliage; avoid bland flat block screenshots, overly smooth generic fantasy or photoreal vegetation.
No words, no lettering, no UI, no borders, no logo, no creatures, no people, no weapons, no equipment, no map pins. The existing genuine creature render will be overlaid separately in HTML. Output only one cohesive forest environment image.
```

## Workshop environment

- Built-in output: `C:/Users/julie/.codex/generated_images/01a11f08-4f19-75b2-a02c-81fb5c1a75ef/exec-24f5b0cc-0529-49c1-81c0-d2829f5d27c1.png`.
- Project source: `assets/reference-v2/workshop-environment-source.png`, actual 1672 × 941 pixels.
- Export sizes: 1280 × 720, 640 × 360, 320 × 180, WebP quality 84, no crop. All three scenes inspected: coherent voxel architecture, reference palette/light, no text or interface, no invented game characters/items.

Exact prompt:

```text
Use case: stylized-concept.
Asset type: clean 16:9 landscape environment for the Objets category illustration of a SAO Minecraft website, also usable as page ambience.
Input image 1 is the user's ART AND COMPOSITION REFERENCE. Faithfully reproduce the warm workshop/treasure interior shown in the Objets card of this supplied image as its own clean detailed environment; no interface, no catalog sprites.
An ancient Minecraft stone atelier inside Aincrad, viewed from the doorway at eye level. Amber lanterns on tall cubic stone walls, timber-beamed shelves, several coherent sturdy wooden storage chests and crafting worktables across center and left, a modest blue luminous mineral cluster at lower right, a furnace fire in the background, rich shadowy corners. Hero composition is close and readable in a narrow category-card crop, with objects arranged together around the middle width. Warm old gold/amber light against petroleum-blue shadows, cool slate stone, dark timber. Fine cinematic illustrated Minecraft craftsmanship matching the supplied art, stepped cube silhouettes, pixelized block material textures, high detail and atmosphere without excessive glowing effects.
Constraints: ONLY environmental furniture and architecture; do not invent any weapon or item catalog render, no people, no creature, no equipment, no typography, no labels, no UI, no border, no logo, no symbols. Avoid photoreal stone, smooth generic fantasy, incoherent tiny detail. The result must feel like the original Objets card expanded as cohesive scenery.
```

## Guild environment

- Built-in output: `C:/Users/julie/.codex/generated_images/01a11f08-4f19-75b2-a02c-81fb5c1a75ef/exec-74710706-b4ad-42b7-aaec-2fe27b3e8f1b.png`.
- Project source: `assets/reference-v2/guild-environment-source.png`, actual 1672 × 941 pixels.
- Export sizes: 1280 × 720, 640 × 360, 320 × 180, WebP quality 84, no crop. All three scenes inspected: coherent voxel architecture, reference palette/light, no text or interface, no invented game characters/items.

Exact prompt:

```text
Use case: stylized-concept.
Asset type: clean 16:9 landscape illustration environment for a SAO Minecraft guild category card and Quartier général backdrop.
Input image 1 is the user's exact ART REFERENCE. Faithfully reproduce the grand amber stone guild hall shown in the Guilde category thumbnail of this image as its own uninterrupted environment, rich cinematic SAO Minecraft painterly style with obvious voxel/block geometry.
Camera eye level from inside the grand hall: tall cubic stone columns and stair-stepped arches, dark timber balconies, a broad central aisle toward a slightly raised distant dais, long solid wooden tables at sides, many coherent warm amber wall lanterns and torchlights, a few deep navy hanging banners with plain simple gold edging but NO writing or logos. The architecture should be readable even cropped into a very wide short category card. The center aisle and the distant amber-lit dais provide depth. Slate blue shadows and bronze/gold light belong to the same palette and artistic detail level as the supplied reference.
Maintain blocky stone, squared timber, stepped vertical silhouettes, atmospheric modest haze and premium craftsmanship. Avoid smooth realistic Gothic architecture, distorted details or excessive neon. Do not add officials, players, people, fantasy creatures, statistics, equipment or illustrated catalog items.
No text, no alphabet/lettering, no monogram, no UI, no borders, no map markers, no logos. This is purely a guild hall atmosphere illustration, not an official server location. Output only the clean full-bleed environment.
```

