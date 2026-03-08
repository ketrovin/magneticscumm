# SCUMM Game — Assets Needed
## Image Generation Queue (do these tomorrow)

All items should be **pixel art style, 16-bit era, warm/warm-lit palette, transparent background** unless noted.
Resolution: render at roughly 64×64 px for inventory icons; room backgrounds at 960×600.

---

## 🎒 Inventory Item Icons

| Filename              | Description |
|-----------------------|-------------|
| `item_spoon.png`      | A regular dessert spoon. Silver. Unremarkable. Slightly too clean for a crime scene. |
| `item_bent_knife.png` | A butter knife bent at ~45°, mounted on a small velvet plaque that says NOT A SPOON |
| `item_camera.png`     | A 35mm film camera (late 80s style, black, with strap) |
| `item_radio.png`      | Vintage tube radio (wooden cabinet, glowing dial, retro) |
| `item_binoculars.png` | Classic binoculars, black rubber grip, brass accents |
| `item_cell_phone.png` | A mid-2000s flip phone (like a Motorola Razr). Closed. |
| `item_cash_card.png`  | A plain white bank card with "DAVE" on it and a magnetic stripe |
| `item_house_key.png`  | A standard door key, slightly rusty, on a plain ring |
| `item_battery.png`    | An enormous D-cell battery the size of a bread loaf. Labelled ENORMOUS |
| `item_cheese.png`     | A wedge of obviously old cheese. Grey-green around the edges. |
| `item_rotten_egg.png` | A single egg with a green aura and wavy stink lines |
| `item_poutine.png`    | A styrofoam cup of poutine rapée. Steam rising. Looks wrong somehow. |
| `item_battle_bread.png`| A French baguette that is clearly structurally a weapon. Glowing slightly. |
| `item_mansion_key.png`| An ornate Victorian skeleton key with a raccoon-shaped bow |
| `item_remote_control.png` | A TV remote control with one extra button labelled MAGNET in red |
| `item_red_herring.png`| A literal red herring on a small plate. Very red. |
| `item_canadian_shield.png` | A knight's shield, stone texture, with maple leaf engraved, Precambrian grey |
| `item_geo_hammer.png` | A geological rock hammer (short-handled, square head) |
| `item_oos_sign.png`   | A small rectangular sign that says OUT OF ORDER in block letters |
| `item_main_route_closed.png` | A weathered wooden sign: "MAIN ROUTE CLOSED" |

---

## 🖼️ Room Backgrounds (all provided by user ✅ — save to `assets/`)

| Filename              | Status  | Notes |
|-----------------------|---------|-------|
| `bedroom_bg.png`      | ✅ Done | From user |
| `kitchen_bg.jpg`      | ✅ Done | From user |
| `street_bg.jpg`       | ✅ Done | From user |
| `alley_bg.jpg`        | ✅ Done | From user |
| `secret_bg.jpg`       | ✅ Done | From user (red herring room) |
| `gate_bg.jpg`         | ✅ Done | From user |
| `pawn_bg.jpg`         | ✅ Done | From user |
| `courtyard_bg.jpg`    | ✅ Done | From user |
| `foyer_bg.jpg`        | ✅ Done | From user (crime scene) |
| `library_bg.jpg`      | ✅ Done | From user |
| `backyard_bg.jpg`     | ✅ Done | From user |
| `police_ext_bg.jpg`   | ✅ Done | From user |
| `police_int_bg.jpg`   | ✅ Done | From user |
| `mag_entrance_bg.jpg` | ✅ Done | From user |
| `geo_strata_bg.jpg`   | ✅ Done | From user |
| `magnetic_hill_bg.jpg`| ✅ Done | From user |

---

## 🧑 NPC Character Sprites (future work)

| Filename                | Description |
|-------------------------|-------------|
| `npc_baker.png`         | Angry Moncton baker in white apron and toque, holding baguette like a weapon |
| `npc_poutine_man.png`   | Friendly poutine stand man, 60s-style, thick moustache |
| `npc_doorman.png`       | Herring Club doorman. Big guy. Unimpressed expression. Clip-on tie. |
| `npc_pawnbroker.png`    | Thin elderly pawnbroker. Reading glasses on chain. One eyebrow always raised. |
| `npc_raccoon.png`       | A large, confident raccoon with the body posture of a man who owns property |
| `npc_raccoon_gang.png`  | Three raccoons, one slightly larger as apparent leader |
| `npc_cat.png`           | A grey/dark cat. Sitting. Judging. Unmoving. |

---

## 🔊 Sound Effects (optional, for later)

| Filename              | Description |
|-----------------------|-------------|
| `sfx_footstep.wav`    | Single footstep on hard floor |
| `sfx_footstep_soft.wav`| Footstep on carpet/grass |
| `sfx_door_open.wav`   | Classic creaky door open |
| `sfx_item_pickup.wav` | Classic point-and-click pickup chime |
| `sfx_dialog.wav`      | Text blip (like SCUMM) |
| `sfx_error.wav`       | Dave can't do that sound |
| `sfx_magnet_off.wav`  | Heavy electrical HUM → silence (game over) |
| `sfx_bread_impact.wav`| A baguette hitting something solid |
| `sfx_fall.wav`        | Short comedic falling sound |

---

## 📝 Notes for Image Gen Session

- **Style ref**: SCUMM-era adventure games (Maniac Mansion, Zak McKracken, Day of the Tentacle)
- **Palette**: Dark nights, warm lamp-lit interiors, pixel dithering
- **Dave sprite**: Already complete (`dave_spritesheet.png`) — use as colour reference
- **No speech bubbles** in character art — those are drawn by the engine
- Each room image: **exactly 960×600 px**, no UI bar included
