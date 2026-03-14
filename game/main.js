/**
 * main.js — Bootstrap all 7 rooms, Dave, and start the engine.
 *
 * Rooms:
 *   bedroom   → kitchen (Living Room door) | secret (trapdoor under carpet)
 *   kitchen   → bedroom | street (front door)
 *   street    → kitchen (Apt 2B) | alley (right side)
 *   alley     → street | gate (ladder — inexplicably sideways)
 *   gate      → alley | pawn_shop | van_horne_mansion (locked)
 *   pawn_shop → gate
 *   secret    → bedroom (ladder up)
 */

// ── Canvas / scene dims ────────────────────────────────────────────────────────
const CW = 960, CH = 600, PANEL_H = 80, SCENE_H = CH - PANEL_H; // 520

// ── Asset loading ──────────────────────────────────────────────────────────────
function loadImage(src) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => { console.warn(`Missing: ${src}`); resolve(null); };
        img.src = src;
    });
}

// ── Dave animations ────────────────────────────────────────────────────────────
// Dave3.png is 1024x559. 12 columns, 3 rows.
// We use fractional steps for perfect grid alignment, but smaller frameW/H to "crop" 
// out potential bleeding from neighboring characters.
const DAVE_ANIMS = {
    idle: {
        fps: 1,
        frames: [{ x: 27, y: 376, w: 59, h: 163 }]
    },
    impatient: {
        fps: 4,
        frames: [
            { x: 111, y: 376, w: 59, h: 163 },
            { x: 195, y: 376, w: 58, h: 163 },
            { x: 308, y: 376, w: 59, h: 163 },
            { x: 389, y: 376, w: 59, h: 163 },
            { x: 502, y: 376, w: 60, h: 163 },
            { x: 577, y: 376, w: 61, h: 163 },
            { x: 648, y: 376, w: 89, h: 163 }
        ]
    },
    walkR: {
        fps: 10,
        flipH: true,
        frames: [
            { x: 24, y: 188, w: 68, h: 149 },
            { x: 123, y: 188, w: 69, h: 149 },
            { x: 212, y: 188, w: 75, h: 149 },
            { x: 312, y: 188, w: 52, h: 149 },
            { x: 386, y: 188, w: 67, h: 149 },
            { x: 486, y: 188, w: 50, h: 149 },
            { x: 569, y: 188, w: 68, h: 149 },
            { x: 666, y: 188, w: 45, h: 149 }
        ]
    },
    walkL: {
        fps: 10,
        frames: [
            { x: 24, y: 188, w: 68, h: 149 },
            { x: 123, y: 188, w: 69, h: 149 },
            { x: 212, y: 188, w: 75, h: 149 },
            { x: 312, y: 188, w: 52, h: 149 },
            { x: 386, y: 188, w: 67, h: 149 },
            { x: 486, y: 188, w: 50, h: 149 },
            { x: 569, y: 188, w: 68, h: 149 },
            { x: 666, y: 188, w: 45, h: 149 }
        ]
    }
};
const FRAME_W = 59, FRAME_H = 163; // Updated fallback

// ── NPC spritesheet config (matches user-supplied chargen sheet format) ─────
// Sheet layout (approx 1024 × 660 px):
//   Top row (y≈0):   9 frames total — left 4 = walkR, lamp post gap, right 4 = walkL
//   Mid sections:    push/use/action poses (not used in gameplay)
//   Bottom mini-row (y≈555): 6 small talk/idle frames
//
// All coords are ESTIMATES — tweak if sprites appear offset.
const CHARGEN_ANIMS = {
    walkR: {
        fps: 8,
        flipH: true,
        frames: [
            { x: 576, y: 0, w: 113, h: 210 },
            { x: 689, y: 0, w: 113, h: 210 },
            { x: 802, y: 0, w: 113, h: 210 },
            { x: 915, y: 0, w: 113, h: 210 },
        ],
    },
    walkL: {
        fps: 8,
        frames: [
            { x: 576, y: 0, w: 113, h: 210 },
            { x: 689, y: 0, w: 113, h: 210 },
            { x: 802, y: 0, w: 113, h: 210 },
            { x: 915, y: 0, w: 113, h: 210 },
        ],
    },
    idle: {
        fps: 2,
        frames: [
            { x: 0, y: 555, w: 80, h: 110 },
            { x: 80, y: 555, w: 80, h: 110 },
        ],
    },
    talk: {
        fps: 6,
        frames: [
            { x: 160, y: 555, w: 80, h: 110 },
            { x: 240, y: 555, w: 80, h: 110 },
            { x: 320, y: 555, w: 80, h: 110 },
            { x: 400, y: 555, w: 80, h: 110 },
        ],
    },
};

/**
 * Create a static NPC Actor and attach it to room.npcs.
 * Engine.changeRoom re-adds room.npcs on every room entry automatically.
 * If sheet is null the NPC remains dialogue-only (hotspot still works).
 */
function buildNPCActor({ room, id, name, x, y, sheet, color = '#00ff00', scale = 0.55 }) {
    if (!sheet) return;

    // AI generated NPC sheets are 9 columns x 4 rows
    const cols = 9;
    const rows = 4;
    const frameW = sheet.width / cols;
    const frameH = sheet.height / rows;

    const customAnims = {
        idle: { row: 0, count: 1, fps: 1 },
        walkR: { row: 1, count: 8, fps: 8 },
        walkL: { row: 2, count: 8, fps: 8 },
        walkFront: { row: 0, count: 8, fps: 8 },
        walkBack: { row: 3, count: 8, fps: 8 }
    };

    const anim = new SpriteAnimator(sheet, frameW, frameH, customAnims, 'auto');

    anim.play('idle');
    const actor = new Actor({ id, name, x, y, animator: anim });
    actor.baseScale = scale; // Set base scale on actor
    actor.speed = 0; 
    actor.color = color;

    // Talking animation: Cycle front-walk or just play
    actor.talkAnim = () => {
        anim.play('walkFront');
        setTimeout(() => anim.play('idle'), 1500);
    };

    room.npcs = room.npcs ?? [];
    room.npcs.push(actor);
    return actor;
}


// ── Procedural Dave fallback (if spritesheet not yet saved) ────────────────────
function buildProceduralDave() {
    const oc = document.createElement('canvas');
    oc.width = 8 * 48; oc.height = 3 * 64;
    const ctx = oc.getContext('2d');
    for (let col = 0; col < 8; col++) {
        for (let row = 0; row < 3; row++) drawDavePx(ctx, col * 48, row * 64, col, row);
    }
    return oc;
}
function drawDavePx(ctx, ox, oy, col, row) {
    const sw = Math.sin(col * Math.PI / 4) * 6;
    const COAT = '#3355aa', PANTS = '#8a7040', SKIN = '#f4c890', HAIR = '#5c3218', SH = '#1a1a2a';
    ctx.fillStyle = COAT; ctx.fillRect(ox + 14, oy + 18, 20, 22);
    ctx.fillStyle = SKIN; ctx.fillRect(ox + 16, oy + 4, 16, 14);
    ctx.fillStyle = HAIR; ctx.fillRect(ox + 16, oy + 4, 16, 5);
    ctx.fillStyle = COAT; ctx.fillRect(ox + 8, oy + 20, 6, row === 0 ? 14 + sw : 14); ctx.fillRect(ox + 34, oy + 20, 6, row === 0 ? 14 - sw : 14);
    ctx.fillStyle = PANTS; ctx.fillRect(ox + 14, oy + 38, 9, 18 + (row > 0 ? 0 : sw)); ctx.fillRect(ox + 25, oy + 38, 9, 18 - (row > 0 ? 0 : sw));
    ctx.fillStyle = SH; ctx.fillRect(ox + 12, oy + 54 + (row > 0 ? 0 : sw), 12, 6); ctx.fillRect(ox + 24, oy + 54 - (row > 0 ? 0 : sw), 12, 6);
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOM DEFINITIONS
// All coordinates are in canvas space (960×520 scene).
// Backgrounds are drawn to fill the full scene area.
// ══════════════════════════════════════════════════════════════════════════════

// ── BEDROOM ───────────────────────────────────────────────────────────────────
function buildBedroom(bg) {
    return new Room({
        id: 'bedroom', name: "Dave's Bedroom",
        background: bg,
        walkbox: [
            { x: 100, y: 510 }, { x: 860, y: 510 },
            { x: 750, y: 315 }, { x: 160, y: 315 },
        ],
        hotspots: [
            // Lamp / nightstand
            {
                id: 'lamp', name: 'Lamp', x: 60, y: 200, w: 120, h: 170, walkToX: 155, walkToY: 460,
                onInteract(v, e) { e.say("A trusty desk lamp. It's the only bright spot in my life right now. Literally."); }
            },
            // Bed
            {
                id: 'bed', name: 'Bed', x: 130, y: 190, w: 240, h: 160, walkToX: 260, walkToY: 440,
                onInteract(v, e) {
                    if (v === 'Sleep on' || v === 'Use') e.say("I'd love to, but I have a feeling the game won't let me advance the plot while unconscious.");
                    else e.say("My bed. It's where I dream of being an accountant. Accountants don't find batteries in their fridges.");
                }
            },
            // Nightstand drawer — has cash card inside
            {
                id: 'drawer', name: 'Nightstand Drawer', x: 20, y: 310, w: 130, h: 90, walkToX: 120, walkToY: 450,
                onInteract(v, e) {
                    if (v === 'Open' || v === 'Look at' || v === 'Pick up' || v === 'Use') {
                        if (e.hasItem('cash_card')) { e.say("The drawer is empty. Just like my social calendar."); }
                        else { e.addItem('cash_card', 'Cash Card'); e.say("My cash card! This plastic rectangle is the only thing keeping me from a career in urban scavenging."); }
                    } else { e.say("It's a nightstand drawer. It's currently participating in a silent protest against being organized."); }
                }
            },
            // Computer on desk
            {
                id: 'computer', name: 'Computer', x: 455, y: 200, w: 170, h: 155, walkToX: 540, walkToY: 450,
                onInteract(v, e) {
                    if (v === 'Use') e.say("I try to use it, but the fish screensaver has achieved sentience and refuses to yield. It's a very assertive fish.");
                    else e.say("My trusty computer. It's so old, it actually has 'adventure' listed as a hardware requirement.");
                }
            },
            // Cell phone — sitting on desk next to computer
            {
                id: 'phone', name: 'Cell Phone', x: 615, y: 305, w: 50, h: 50, walkToX: 620, walkToY: 450,
                onInteract(v, e) {
                    if (v === 'Pick up' || v === 'Use') {
                        if (e.hasItem('cell_phone')) { e.say("I already have my phone. Zero bars, zero friends, 100% fish screensaver."); }
                        else { e.addItem('cell_phone', 'Cell Phone'); e.say("My cell phone! It's low on battery and even lower on purpose, but at least I can look busy while I'm being ignored."); }
                    } else { e.say("My phone is sitting next to the computer. It hasn't buzzed since 2004. I'm sure it's just a network issue."); }
                }
            },
            // Green carpet — Push/Pull to reveal trapdoor
            {
                id: 'carpet', name: 'Green Rug', x: 270, y: 300, w: 300, h: 150, walkToX: 420, walkToY: 450,
                isVisible(e) { return !e.getRoomState('bedroom').carpetMoved; },
                onInteract(v, e) {
                    if (v === 'Push' || v === 'Pull') {
                        e.getRoomState('bedroom').carpetMoved = true;
                        e.say("I heave the carpet aside. A trapdoor! Just like the realtor promised: 'hidden underground infrastructure included'.");
                    } else { e.say("A green rug. It really ties the room together. Or hides the fact that I'm living on top of a conspiracy."); }
                }
            },
            // Rolled rug hotspot
            {
                id: 'rolled_rug_hot', name: 'Rolled Rug', x: 550, y: 320, w: 100, h: 120, walkToX: 520, walkToY: 450,
                isVisible(e) { return !!e.getRoomState('bedroom').carpetMoved; },
                onInteract(v, e) { e.say("The rug, rolled up and out of the way. It was hiding a lot of dust. And a trapdoor."); }
            },
            // Trapdoor — only visible after carpet moved
            {
                id: 'trapdoor', name: 'Trapdoor', x: 310, y: 340, w: 210, h: 100, walkToX: 420, walkToY: 450,
                isVisible(e) { return !!e.getRoomState('bedroom').carpetMoved; },
                onInteract(v, e) {
                    if (v === 'Open' || v === 'Use' || v === 'Walk to') {
                        e.say("Down into the darkness. If I'm not back in ten minutes, call the poutine guy.");
                        setTimeout(() => e.changeRoom('secret', 480, 460), 1000);
                    } else { e.say("A trapdoor. In my room. I'm starting to think my landlord isn't telling me everything."); }
                }
            },
            // Living Room door → Kitchen
            {
                id: 'kitchen_door', name: 'Living Room Door', x: 790, y: 100, w: 155, h: 330, walkToX: 860, walkToY: 430,
                onInteract(v, e) {
                    if (v === 'Open' || v === 'Walk to' || v === 'Use') {
                        if (e.hasItem('cash_card')) {
                            e.changeRoom('kitchen', 95, 440);
                        } else {
                            e.say("Wait! I shouldn't leave without my cash card. This city doesn't run on good intentions.");
                            // Auto-pickup sequence
                            setTimeout(() => {
                                e.player.walkTo(120, 450); // Walk to nightstand
                                const checkArrival = setInterval(() => {
                                    if (e.player.state === 'idle') {
                                        clearInterval(checkArrival);
                                        e.addItem('cash_card', 'Cash Card');
                                        e.say("Got it. Now I can face the world with $12.43 of buying power.");
                                        setTimeout(() => {
                                            e.player.walkTo(860, 430); // Walk back to door
                                            const checkExit = setInterval(() => {
                                                if (e.player.state === 'idle') {
                                                    clearInterval(checkExit);
                                                    e.changeRoom('kitchen', 95, 440);
                                                }
                                            }, 100);
                                        }, 1800);
                                    }
                                }, 100);
                            }, 2000);
                        }
                    } else { e.say("The door to the living room slash kitchen slash wherever I put things."); }
                }
            },
        ]
    });
}

// ── KITCHEN / LIVING ROOM ─────────────────────────────────────────────────────
function buildKitchen(bg) {
    return new Room({
        id: 'kitchen', name: "Dave's Kitchen",
        background: bg,
        walkbox: [
            { x: 60, y: 510 }, { x: 920, y: 510 },
            { x: 820, y: 295 }, { x: 140, y: 295 },
        ],
        hotspots: [
            // Bedroom door (left, shown open in art)
            {
                id: 'to_bedroom', name: 'Bedroom Door', x: 20, y: 130, w: 115, h: 340, walkToX: 80, walkToY: 450,
                onInteract(v, e) {
                    if (v === 'Walk to' || v === 'Open' || v === 'Use') e.changeRoom('bedroom', 800, 440);
                    else e.say("That's my bedroom. I just came from there. Or am going back. It's confusing.");
                }
            },
            // Street / front door (right)
            {
                id: 'to_street', name: 'Front Door', x: 870, y: 130, w: 90, h: 330, walkToX: 875, walkToY: 450,
                onInteract(v, e) {
                    if (v === 'Open' || v === 'Walk to' || v === 'Use') {
                        if (e.hasItem('house_key') || true) { // door is always unlockable for now
                            e.changeRoom('street', 110, 440);
                        } else { e.say("The door is locked. I need my house key..."); }
                    } else { e.say("The front door. Beyond it: the street, the night, and my choices."); }
                }
            },
            // Window (center-back)
            {
                id: 'window', name: 'Window', x: 355, y: 100, w: 215, h: 155, walkToX: 460, walkToY: 380,
                onInteract(v, e) {
                    if (v === 'Open') {
                        const rs = e.getRoomState('kitchen');
                        rs.windowOpen = !rs.windowOpen;
                        e.say(rs.windowOpen ? "A cool night breeze drifts in. I can hear the poutine stand from here." : "I close the window. The poutine smell goes away.");
                    } else e.say("The window overlooks the street. Same street as always.");
                }
            },
            // Fridge (closed)
            {
                id: 'fridge', name: 'Refrigerator', x: 590, y: 115, w: 115, h: 325, walkToX: 640, walkToY: 450,
                isVisible(e) { return !e.getRoomState('kitchen').fridgeOpen; },
                onInteract(v, e) {
                    if (v === 'Open' || v === 'Use') {
                        e.getRoomState('kitchen').fridgeOpen = true;
                        e.say("I open the fridge. There's a massive battery, some cheese, a rotten egg, and... my house key?!");
                    } else e.say("The fridge hums politely. It's keeping SOMETHING cold.");
                }
            },
            // Fridge contents — only visible when open
            {
                id: 'big_battery', name: 'Enormous Battery', x: 590, y: 145, w: 50, h: 70,
                isVisible(e) { return !!e.getRoomState('kitchen').fridgeOpen; },
                onInteract(v, e) {
                    if (v === 'Pick up') {
                        if (e.hasItem('battery')) e.say("I already have the battery. My pocket is now 50% battery by volume.");
                        else { e.addItem('battery', 'Enormous Battery'); e.say("A D-cell battery the size of a fire hydrant. I suppose if I ever need to jump-start a submarine, I'm prepared. Or just power a very, very large remote control."); }
                    } else e.say("An enormous battery chilling in my fridge. Completely normal. I like my power supply served cold.");
                }
            },
            {
                id: 'cheese', name: 'Old Cheese', x: 635, y: 195, w: 50, h: 50,
                isVisible(e) { return !!e.getRoomState('kitchen').fridgeOpen; },
                onInteract(v, e) {
                    if (v === 'Pick up') {
                        if (e.hasItem('cheese')) e.say("I have enough cheese. My inventory is starting to smell like a specialized Deli.");
                        else { e.addItem('cheese', 'Old Cheese'); e.say("It smells like a sweaty gym sock that's been used to wrap a dead fish. I'll take it, because that's apparently the kind of day I'm having. And it might be useful for... something. Probably not eating."); }
                    } else e.say("Well-aged. Very well-aged. Possibly pre-aged at the factory... or in the basement of a condemned building.");
                }
            },
            {
                id: 'rotten_egg', name: 'Rotten Egg', x: 595, y: 265, w: 50, h: 40,
                isVisible(e) { return !!e.getRoomState('kitchen').fridgeOpen; },
                onInteract(v, e) {
                    if (v === 'Pick up') {
                        if (e.hasItem('rotten_egg')) e.say("One rotten egg is already a lifestyle choice I'm not ready for.");
                        else { e.addItem('rotten_egg', 'Rotten Egg'); e.say("A rotten egg. Why am I touching this? Why am I putting it in my pocket? I'm questioning my life choices as we speak. This better be important later."); }
                    } else e.say("It is... not a good egg. It has developed its own political opinions.");
                }
            },
            {
                id: 'house_key', name: 'House Key', x: 635, y: 325, w: 40, h: 40,
                isVisible(e) { return e.getRoomState('kitchen').fridgeOpen && !e.hasItem('house_key'); },
                onInteract(v, e) {
                    if (v === 'Pick up' || v === 'Use') {
                        e.addItem('house_key', 'House Key'); e.say("My house key. Chilling in the fridge next to the sentient mold. Because security is best served cold, I guess. And I definitely didn't check the fridge first.");
                    } else e.say("My house key. In the fridge. It's the only thing in my life that's 'cool' right now.");
                }
            },
            {
                id: 'pizza', name: 'Pizza Slice', x: 375, y: 335, w: 50, h: 40,
                isVisible(e) { return !e.hasItem('pizza'); },
                onInteract(v, e) {
                    if (v === 'Pick up' || v === 'Use') {
                        if (e.hasItem('pizza')) e.say("I already have a slice. I'm not running a buffet.");
                        else { e.addItem('pizza', 'Cold Pizza'); e.say("A slice of cold pizza. It's been sitting here since the Reagan administration. It's probably a biohazard, but in an adventure game, that's called 'useful'. And delicious. Probably."); }
                    } else e.say("A slice of cold pizza sitting on the box. It defies the laws of room-sharing and basic hygiene.");
                }
            },
            // Boombox / stereo
            {
                id: 'boombox', name: 'Boombox', x: 480, y: 240, w: 80, h: 60, walkToX: 520, walkToY: 400,
                onInteract(v, e) {
                    if (v === 'Use') e.say("I press play. ♪ ...Danger Zone plays forever ♪. It's the soundtrack to my life. Unfortunately.");
                    else e.say("A vintage boombox. It has excellent taste in music, mainly because it's stuck on one tape.");
                }
            },
            // Coffee table with pizza
            {
                id: 'pizza', name: 'Pizza Box', x: 305, y: 330, w: 160, h: 80, walkToX: 385, walkToY: 460,
                onInteract(v, e) {
                    if (v === 'Pick up' || v === 'Use') {
                        if (e.hasItem('pizza')) e.say("I already have the remaining slice. It's cold anyway.");
                        else { e.addItem('pizza', 'Cold Pizza'); e.say("Cold pizza. I'll eat it later. ...much later."); }
                    } else e.say("A pizza box. There's one slice left, remarkably. It defies the laws of room-sharing.");
                }
            },
            // Couch
            {
                id: 'couch', name: 'Couch', x: 165, y: 300, w: 200, h: 130, walkToX: 265, walkToY: 450,
                onInteract(v, e) {
                    if (v === 'Sleep on' || v === 'Use') e.say("I could sleep on the couch, but the fridge mystery is haunting me.");
                    else e.say("A comfortable couch. It's seen better days. It has seen my days, which are not the best days.");
                }
            },
            // Bookshelf
            {
                id: 'bookshelf', name: 'Bookshelf', x: 435, y: 235, w: 80, h: 170, walkToX: 475, walkToY: 440,
                onInteract(v, e) {
                    e.say("Books. I should read more. The titles are all 'HOW TO' something I should already know.");
                }
            },
            // Sink
            {
                id: 'sink', name: 'Kitchen Sink', x: 770, y: 260, w: 95, h: 90, walkToX: 800, walkToY: 440,
                onInteract(v, e) {
                    if (v === 'Use') e.say("I wash my hands. The water is lukewarm. Very lukewarm. Disappointingly lukewarm.");
                    else e.say("A standard kitchen sink. The faucet drips in B-flat.");
                }
            },
        ]
    });
}

// ── STREET ────────────────────────────────────────────────────────────────────
function buildStreet(bg) {
    return new Room({
        id: 'street', name: 'The Street Outside',
        background: bg,
        walkbox: [
            { x: 0, y: 510 }, { x: 960, y: 510 },
            { x: 880, y: 370 }, { x: 80, y: 370 },
        ],
        hotspots: [
            // Apt 2B door — back to kitchen
            {
                id: 'apt_door', name: 'Apt 2B Door', x: 22, y: 260, w: 90, h: 250, walkToX: 80, walkToY: 460,
                onInteract(v, e) {
                    if (v === 'Open' || v === 'Walk to' || v === 'Use') e.changeRoom('kitchen', 870, 440);
                    else e.say("My apartment door. Home sweet suspiciously-keyed-up home.");
                }
            },
            // Apt 2B window — mysterious occupant
            {
                id: 'apt_window', name: 'Apartment Window', x: 110, y: 230, w: 145, h: 180, walkToX: 180, walkToY: 440,
                onInteract(v, e) {
                    if (v === 'Look at') {
                        e.say("I look into my own window and... wait. The furniture is different. The layout is backwards. And I'm pretty sure I don't own a velvet bust of a penguin. This is deeply confusing.");
                    } else {
                        e.say("That's my room. But I'M out here. I hope whoever's in there is at least charging their phone correctly.");
                    }
                }
            },
            // Moncton Bakery — Baker NPC (prime suspect)
            {
                id: 'bakery', name: 'Moncton Bakery', x: 295, y: 215, w: 185, h: 315, walkToX: 388, walkToY: 470,
                onInteract(v, e) {
                    const s = e.getRoomState('street');
                    if (v === 'Talk to') {
                        s.bakerTalks = (s.bakerTalks || 0) + 1;
                        const lines = [
                            "Baker: 'I know nothing about any mansion! NOTHING! You want bread? BUY BREAD!",
                            "Baker: 'Van Horne? Pfff. He complained about MY baguette being too hard. TOO HARD! It is PERFECT!'",
                            "Baker: 'I was HERE. All night. Baking. Do not look at me like that. EVERYONE looks at me like that.'",
                            "Baker: 'My baguette is not a weapon. It is ARTISANAL. The fact that it COULD be a weapon is a matter of QUALITY, not CHARACTER!'",
                            "Baker: '...Are you still here? Non. Non non non. Au revoir, Dave.'",
                        ];
                        e.say(lines[(s.bakerTalks - 1) % lines.length]);
                    } else if (v === 'Pick up' || v === 'Use' || v === 'Walk to' || v === 'Open') {
                        if (e.hasItem('battle_bread')) {
                            e.say("The baker eyes me. I already have his baguette-sword. He seems to want it back. I'm not giving it back. It's mine now.");
                        } else {
                            s.breadGiven = true;
                            e.addItem('battle_bread', 'Battle Bread');
                            e.say("Baker: 'You DARE enter?! TASTE MY ARTISANAL WRATH!' He hurls a baguette at supersonic speed. I catch it. It's solid as iron. And surprisingly aerodynamic. This could be useful.");
                        }
                    } else {
                        e.say('Moncton Bakery. Incredible bread. Baker looks absolutely furious. Standard.');
                    }
                }
            },

            // Poutine stand
            {
                id: 'poutine', name: 'Poutine Stand', x: 488, y: 255, w: 130, h: 255, walkToX: 553, walkToY: 470,
                onInteract(v, e) {
                    const s = e.getRoomState('street');
                    if (v === 'Talk to' || v === 'Use' || v === 'Walk to') {
                        if (s.poutineGiven) {
                            e.say("The poutine stand owner gives me a sympathetic look. 'No more rapée, friend. You finish it?' I nod. I finished it. I regret nothing. Mostly.");
                        } else {
                            s.poutineGiven = true;
                            e.addItem('poutine', 'Poutine Rapée');
                            e.say("Poutine Guy: 'For you, free! Poutine rapée, best in Moncton!' I accept. It is... technically poutine. It is not what I wanted. But it's free. I eat it anyway. And now I own it. Literally.");
                        }
                    } else e.say("A poutine stand. The sign says 'BEST POUTINE'. It is specifically poutine rapée. The poutine guy looks friendly.");
                }
            },
            // CB Phone Co.
            {
                id: 'phone_co', name: 'CB Phone Co.', x: 625, y: 205, w: 205, h: 310, walkToX: 725, walkToY: 470,
                onInteract(v, e) {
                    e.say("I'm not going in there! My phone bill is... outstanding. As in, the amount is outstanding. As in astronomical.");
                }
            },
            // Alley entrance
            {
                id: 'to_alley', name: 'Alley', x: 870, y: 320, w: 90, h: 200, walkToX: 920, walkToY: 470,
                onInteract(v, e) {
                    if (v === 'Walk to' || v === 'Use') e.changeRoom('alley', 480, 460);
                    else e.say("A classic dark alley. Every adventure has one.");
                }
            },
            // Left world edge
            {
                id: 'world_end_left', name: '...', x: 0, y: 350, w: 30, h: 180,
                onInteract(v, e) {
                    e.say("The world ends over there. Someone forgot to program the next screen. I respect the developer's right to take a nap, but it's physically uncomfortable to look at.");
                }
            },
        ]
    });
}

// ── ALLEY ─────────────────────────────────────────────────────────────────────
function buildAlley(bg) {
    return new Room({
        id: 'alley', name: 'The Alley',
        background: bg,
        walkbox: [
            { x: 80, y: 510 }, { x: 880, y: 510 },
            { x: 820, y: 320 }, { x: 130, y: 320 },
        ],
        hotspots: [
            // Back to street (the gap/light at end of alley)
            {
                id: 'to_street', name: 'Street', x: 340, y: 260, w: 200, h: 180, walkToX: 440, walkToY: 430,
                onInteract(v, e) {
                    if (v === 'Walk to' || v === 'Use') e.changeRoom('street', 900, 460);
                    else e.say("The street. Moncton at night. I should probably go back.");
                }
            },
            // Fire escape ladder — inexplicably leads sideways to gate area
            {
                id: 'ladder', name: 'Fire Escape Ladder', x: 55, y: 110, w: 90, h: 280, walkToX: 130, walkToY: 440,
                onInteract(v, e) {
                    if (v === 'Climb' || v === 'Use' || v === 'Walk to') {
                        e.say("I grab the ladder and climb. Up is... sideways? I emerge next to a pawn shop. I don't know how. The ladder doesn't go that way. And yet.");
                        setTimeout(() => e.changeRoom('gate', 80, 460), 2500);
                    } else e.say("A fire escape ladder. It looks like it goes up. It does not go up. It goes... elsewhere.");
                }
            },
            // Dumpster
            {
                id: 'dumpster', name: 'Dumpster', x: 265, y: 330, w: 165, h: 150, walkToX: 350, walkToY: 470,
                onInteract(v, e) {
                    if (v === 'Look at') e.say("A treasure trove of Moncton's secrets. Mostly pizza boxes. Some are from MY building.");
                    else if (v === 'Open' || v === 'Use') e.say("I open the dumpster. Something in there has EYES. We make eye contact. I close the dumpster.");
                    else e.say("It's a dumpster. Green. Municipal.");
                }
            },
            // Trash cans
            {
                id: 'trash', name: 'Trash Cans', x: 100, y: 380, w: 155, h: 150, walkToX: 175, walkToY: 470,
                onInteract(v, e) { e.say("Trash cans. I'm not looking in there. I have some standards left. About three percent of my standards, but they're firmly in place."); }
            },
            // The Herring Club door + doorman
            {
                id: 'club_door', name: 'Herring Club Door', x: 590, y: 220, w: 200, h: 310, walkToX: 660, walkToY: 470,
                onInteract(v, e) {
                    const s = e.getRoomState('alley');
                    if (v === 'Use' && item && (item === 'battle_bread' || item.id === 'battle_bread')) {
                        e.say("Dave's BATTLE BREAD technique: I swing the iron-hard baguette with all my might. THWACK! The doorman doesn't even have time to say 'Dave's not here'. He slumps to the ground, out cold.");
                        s.bouncerKnockedOut = true;
                        e.addItem('club_key', 'Herring Club Key');
                        e.say("He dropped a brass key with a fish-shaped handle. Poetic justice, if a bit yeasty.");
                        return;
                    }

                    if (s.bouncerKnockedOut) {
                        if (v === 'Open' || v === 'Walk to' || v === 'Use') {
                            e.say("The doorman is snoring. I step over him and enter the Herring Club. It smells like exclusivity and tartar sauce.");
                            setTimeout(() => e.changeRoom('herring_club', 100, 450), 1600);
                        } else e.say("The Herring Club door. Now unattended. The snoring doorman provides a rhythmic welcome.");
                        return;
                    }

                    if (v === 'Talk to' || v === 'Knock' || v === 'Use' || v === 'Open') {
                        // Dave's Not Here joke — cycles through exchange
                        s.daveCount = (s.daveCount || 0) + 1;
                        if (s.daveCount === 1) {
                            e.say("I knock. A slot opens. A voice: 'Who's there?' Me: 'Dave.' Voice: 'Dave's not here, man.'");
                        } else if (s.daveCount === 2) {
                            e.say("I knock again. 'DAVE IS RIGHT HERE.' Slot opens. 'Dave's not here, man.' Slot closes.");
                        } else if (s.daveCount === 3) {
                            e.say("I knock a third time. The slot doesn't even open. 'Dave's not here, man.' ...He knew it was me.");
                        } else {
                            e.say("I don't need to knock again. Dave is not here. I AM DAVE. And yet.");
                        }
                    } else {
                        e.say("'THE HERRING CLUB. PRIVATE MEMBERS ONLY.' A fish wearing a crown glows in neon above. This place is aggressively ironic.");
                    }
                }
            },
            // Club sign / plaque
            {
                id: 'club_sign', name: 'Members Plaque', x: 575, y: 345, w: 110, h: 95, walkToX: 620, walkToY: 470,
                onInteract(v, e) {
                    e.say("'PRIVATE MEMBERS ONLY.' And a smaller sign below it: 'If you have to ask, you're not a member. If you were a member, you would know not to ask.'");
                }
            },
            // Herring Club neon sign
            {
                id: 'neon_sign', name: 'Neon Fish Sign', x: 565, y: 40, w: 375, h: 190,
                onInteract(v, e) { e.say("A massive neon fish wearing a crown. It winks. Or maybe that's the flicker. Either way, I feel judged by a neon fish."); }
            },
        ]
    });
}

// ── HERRING CLUB ──────────────────────────────────────────────────────────────
function buildHerringClub(bg) {
    return new Room({
        id: 'herring_club', name: 'The Herring Club',
        background: bg,
        walkbox: [
            { x: 50, y: 510 }, { x: 910, y: 510 },
            { x: 800, y: 340 }, { x: 150, y: 340 },
        ],
        hotspots: [
            // Exit back to alley
            {
                id: 'to_alley', name: 'Exit', x: 0, y: 350, w: 80, h: 170, walkToX: 60, walkToY: 460,
                onInteract(v, e) {
                    if (v === 'Walk to' || v === 'Use') e.changeRoom('alley', 660, 460);
                    else e.say("Back to the reality of the alley. I'm not ready to leave the neon fish quite yet.");
                }
            },
            // The Weather Scientist NPC
            {
                id: 'weather_scientist', name: 'Weather Scientist', x: 450, y: 320, w: 100, h: 180, walkToX: 520, walkToY: 460,
                onInteract(v, e) {
                    if (v === 'Talk to') {
                        const startWeatherBranch = () => {
                            e.enterDialog([
                                "Tell me about the clouds!",
                                "Why all the rain?",
                                "What's with the wind?",
                                "Tell me about Thermodynamics!",
                                "Get bored and depart."
                            ], (idx) => {
                                if (idx === 0) {
                                    e.say("Weather Scientist: 'CLOUDS! They are the lungs of the sky! Cumulonimbus, Cirrus, Altostratus! It's a grand ballet of moisture and pressure!'");
                                    setTimeout(() => {
                                        e.enterDialog([
                                            "Tell me about the Bergeron-Findeisen process!",
                                            "How much does a cloud weigh?",
                                            "Back.",
                                            "Get bored and depart."
                                        ], (idx2) => {
                                            if (idx2 === 0) {
                                                e.say("Weather Scientist: 'The process of ice crystal growth in mixed-phase clouds! Water vapor deposits on ice at the expense of liquid droplets! It's the engine of precipitation!'");
                                                setTimeout(startWeatherBranch, 5000);
                                            } else if (idx2 === 1) {
                                                e.say("Weather Scientist: 'A single cumulus can weigh a million pounds! It stays afloat because it's slightly warmer than the surrounding air. Thermodynamics in action!'");
                                                setTimeout(startWeatherBranch, 5000);
                                            } else if (idx2 === 2) startWeatherBranch();
                                            else e.say("Weather Scientist: 'Keep your head in the clouds, Dave!'");
                                        });
                                    }, 4000);
                                } else if (idx === 1) {
                                    e.say("Weather Scientist: 'Precipitation is the planet's way of recycling its spirit! It's GEOPHYSICAL CELEBRATION!'");
                                    setTimeout(() => {
                                        e.enterDialog([
                                            "Tell me about Adiabatic Cooling!",
                                            "What about Orographic Lift?",
                                            "Back.",
                                            "Get bored and depart."
                                        ], (idx3) => {
                                            if (idx3 === 0) {
                                                e.say("Weather Scientist: 'The reduction of heat as air pressure decreases! Rising air expands and cools, leading to saturation and condensation! It's the fundamental law of the troposphere!'");
                                                setTimeout(startWeatherBranch, 5000);
                                            } else if (idx3 === 1) {
                                                e.say("Weather Scientist: 'Air forced upward by terrain! As it rises over the Magnetic Hill, it cools adiabatically and dumps its moisture! That's why Moncton is so... damp!'");
                                                setTimeout(startWeatherBranch, 5000);
                                            } else if (idx3 === 2) startWeatherBranch();
                                            else e.say("Weather Scientist: 'Don't forget your yellow raincoat!'");
                                        });
                                    }, 4000);
                                } else if (idx === 2) {
                                    e.say("Weather Scientist: 'The wind is the Earth's breath! It carries the seeds of time!'");
                                    setTimeout(() => {
                                        e.enterDialog([
                                            "Tell me about the Coriolis Effect!",
                                            "What is Geostrophic Balance?",
                                            "Back.",
                                            "Get bored and depart."
                                        ], (idx4) => {
                                            if (idx4 === 0) {
                                                e.say("Weather Scientist: 'The deflection of moving objects due to Earth's rotation! It curves the winds into the great cyclones! It's the invisible hand of the world!'");
                                                setTimeout(startWeatherBranch, 5000);
                                            } else if (idx4 === 1) {
                                                e.say("Weather Scientist: 'The equilibrium between the Pressure Gradient Force and the Coriolis Force! It's why the wind blows parallel to the isobars! It's mathematical beauty!'");
                                                setTimeout(startWeatherBranch, 5000);
                                            } else if (idx4 === 2) startWeatherBranch();
                                            else e.say("Weather Scientist: 'The wind will always find you, Dave.'");
                                        });
                                    }, 4000);
                                } else if (idx === 3) {
                                    e.say("Weather Scientist: 'THERMODYNAMICS! The study of energy and entropy! It's the reason anything happens at all!'");
                                    setTimeout(() => {
                                        e.enterDialog([
                                            "Explain Latent Heat!",
                                            "What about Convection?",
                                            "Back.",
                                            "Get bored and depart."
                                        ], (idx5) => {
                                            if (idx5 === 0) {
                                                e.say("Weather Scientist: 'The energy absorbed or released during a phase change! When water vapor condenses, it releases heat, fueling the massive power of thunderstorms!'");
                                                setTimeout(startWeatherBranch, 5000);
                                            } else if (idx5 === 1) {
                                                e.say("Weather Scientist: 'Vertical transport of heat and moisture! Warm air rises, cold air sinks—creating the currents that build the sky! It's a never-ending cycle of energy!'");
                                                setTimeout(startWeatherBranch, 5000);
                                            } else if (idx5 === 2) startWeatherBranch();
                                            else e.say("Weather Scientist: 'May your entropy always be low, Dave!'");
                                        });
                                    }, 4000);
                                } else {
                                    const s = e.getRoomState('herring_club');
                                    if (!s.gotToken) {
                                        s.gotToken = true;
                                        e.addItem('fishy_token', 'Fishy Token');
                                        e.say("Weather Scientist: 'Wait! Before you depart, take this FISHY TOKEN. It acknowledges your atmospheric excellence!'");
                                    } else e.say("Weather Scientist: 'Keep your eyes on the barometer, friend!'");
                                }
                            });
                        };
                        startWeatherBranch();
                    } else if (v === 'Look at') {
                        e.say("A scientist in a very bright yellow raincoat. He's holding a barometer and looking at the ceiling as if he's expecting a hurricane.");
                    } else e.say("He's busy calculating the dew point. Best not to interfere.");
                }
            },
            // Red Herring Key on a pedestal
            {
                id: 'red_herring_key', name: 'Red Herring Key', x: 235, y: 355, w: 60, h: 60, walkToX: 265, walkToY: 430,
                onInteract(v, e) {
                    if (v === 'Pick up' || v === 'Use') {
                        if (e.hasItem('red_herring_key')) e.say("I already have the Red Herring Key. It's suspiciously bright.");
                        else {
                            e.addItem('red_herring_key', 'Red Herring Key');
                            e.say("I pick up the Red Herring Key. It's literally shaped like a fish and painted bright red. This is getting ridiculous.");
                        }
                    } else e.say("A bright red key on a velvet cushion. It looks important. Which probably means it's a distraction.");
                }
            },
        ]
    });
}

// ── SECRET ROOM ───────────────────────────────────────────────────────────────
function buildSecretRoom(bg) {
    return new Room({
        id: 'secret', name: 'The Secret Room',
        background: bg,
        walkbox: [
            { x: 50, y: 510 }, { x: 910, y: 510 },
            { x: 800, y: 360 }, { x: 160, y: 360 },
        ],
        hotspots: [
            // Ladder back up to bedroom
            {
                id: 'ladder_up', name: 'Ladder', x: 620, y: 75, w: 145, h: 450, walkToX: 692, walkToY: 480,
                onInteract(v, e) {
                    if (v === 'Climb' || v === 'Use' || v === 'Walk to') {
                        e.say("I climb back up. The trapdoor is still open, thankfully.");
                        setTimeout(() => e.changeRoom('bedroom', 420, 420), 1500);
                    } else e.say("A wooden ladder leading back up to my bedroom. Simple. Effective. Bewildering.");
                }
            },
            // Red herrings — left shelves
            {
                id: 'herring_L1', name: 'Red Herring', x: 65, y: 210, w: 60, h: 40, walkToX: 120, walkToY: 460,
                onInteract(v, e) { pickUpHerring(v, e, 'herring_L1'); }
            },
            {
                id: 'herring_L2', name: 'Red Herring', x: 65, y: 335, w: 60, h: 40, walkToX: 120, walkToY: 460,
                onInteract(v, e) { pickUpHerring(v, e, 'herring_L2'); }
            },
            // Red herrings — right shelves
            {
                id: 'herring_R1', name: 'Red Herring', x: 835, y: 210, w: 60, h: 40, walkToX: 840, walkToY: 460,
                onInteract(v, e) { pickUpHerring(v, e, 'herring_R1'); }
            },
            {
                id: 'herring_R2', name: 'Red Herring', x: 835, y: 335, w: 60, h: 40, walkToX: 840, walkToY: 460,
                onInteract(v, e) { pickUpHerring(v, e, 'herring_R2'); }
            },
            // The altar stone
            {
                id: 'altar', name: 'Stone Altar', x: 250, y: 235, w: 360, h: 130, walkToX: 430, walkToY: 460,
                onInteract(v, e) {
                    e.say("A stone altar, lit by candles. This is either very important or a very elaborate joke. The sign suggests the latter.");
                }
            },
            // The sign
            {
                id: 'sign', name: 'Strange Sign', x: 300, y: 175, w: 270, h: 115, walkToX: 430, walkToY: 460,
                onInteract(v, e) {
                    e.say("'IS THIS WORTH AN A?' ...I think whoever made this already knows the answer. But I respect the ambition.");
                }
            },
            // Stone pedestals with mysterious items
            {
                id: 'pedestal_L', name: 'Stone Pedestal', x: 155, y: 285, w: 80, h: 165, walkToX: 195, walkToY: 470,
                onInteract(v, e) { e.say("A small stone object. It hums faintly. Or maybe that's the pipes."); }
            },
            {
                id: 'pedestal_R', name: 'Vase', x: 700, y: 280, w: 80, h: 155, walkToX: 740, walkToY: 470,
                onInteract(v, e) {
                    if (v === 'Pick up') e.say("I don't touch mysterious vases in secret underground rooms. I've learned that much.");
                    else e.say("A clay vase. It's beautiful. It's also definitely a red herring.");
                }
            },
            // Candles
            {
                id: 'candles', name: 'Candles', x: 380, y: 235, w: 130, h: 55, walkToX: 430, walkToY: 460,
                onInteract(v, e) { e.say("Several candles. Someone lit these recently. There's... someone else who knows about this room?"); }
            },
        ]
    });
}

// ── GATE AREA (Moncton Pawn + Van Horne Mansion) ─────────────────────────────
function buildGateArea(bg) {
    return new Room({
        id: 'gate', name: 'Gate Area',
        background: bg,
        walkbox: [
            { x: 40, y: 510 }, { x: 920, y: 510 },
            { x: 840, y: 355 }, { x: 120, y: 355 },
        ],
        hotspots: [
            // Back to alley (far left)
            {
                id: 'to_alley', name: 'Alley', x: 0, y: 300, w: 60, h: 220, walkToX: 60, walkToY: 460,
                onInteract(v, e) {
                    if (v === 'Walk to' || v === 'Use') e.changeRoom('alley', 120, 450);
                    else e.say('The alley I came from. Somehow. Via that ladder.');
                }
            },
            // Pawn shop door (left building)
            {
                id: 'pawn_door', name: 'Moncton Pawn', x: 55, y: 165, w: 380, h: 360, walkToX: 240, walkToY: 470,
                onInteract(v, e) {
                    if (v === 'Walk to' || v === 'Open' || v === 'Use') e.changeRoom('pawn_shop', 105, 450);
                    else e.say('Moncton Pawn. The window is full of cameras, radios, binoculars... and is that a mannequin head? Yes it is.');
                }
            },
            // Pawn window display
            {
                id: 'pawn_window', name: 'Pawn Shop Window', x: 80, y: 270, w: 330, h: 190, walkToX: 240, walkToY: 470,
                onInteract(v, e) {
                    e.say('I can see cameras, a vintage radio, binoculars, and a mannequin head in the display. Classic pawn shop energy.');
                }
            },
            // Van Horne Mansion gate — locked until Dave has the mansion key
            {
                id: 'mansion_gate', name: 'Van Horne Mansion Gate', x: 510, y: 100, w: 450, h: 440, walkToX: 700, walkToY: 470,
                onInteract(v, e) {
                    if (v === 'Open' || v === 'Use' || v === 'Walk to') {
                        if (e.hasItem('mansion_key')) {
                            e.say('I fit the raccoon-bow skeleton key into the lock. It turns with a deeply satisfying CLUNK. The Van Horne gate swings open, yielding to the power of high-end pawn shop shopping.');
                            setTimeout(() => e.changeRoom('mansion_courtyard', 480, 460), 1800);
                        } else if (e.hasItem('house_key')) {
                            e.say("For no reason at all, I try my house key. The one I found in the fridge. It fits perfectly. It turns. The gate opens. I'm not going to think about the security implications or why my fridge key can unlock a millionaire's mansion. I'm just going in.");
                            setTimeout(() => e.changeRoom('mansion_courtyard', 480, 460), 2000);
                        } else {
                            e.say("The gate is locked with a heavy padlock. It has a raccoon-shaped keyhole, because of course it does. I need a key that matches this level of commitment to woodland-themed security.");
                        }
                    } else {
                        e.say("VAN HORNE MANSION. Iron gates. Lit windows. Eyes in the garden. The gate has a raccoon-shaped keyhole, which raises a number of questions about Van Horne's interior decorator.");
                    }
                }
            },
            // Mansion sign
            {
                id: 'mansion_sign', name: 'Van Horne Mansion Sign', x: 518, y: 65, w: 350, h: 85, walkToX: 700, walkToY: 470,
                onInteract(v, e) { e.say('"VAN HORNE MANSION." The letters are engraved VERY deeply. Whoever made this sign wanted it to be permanent. Ominously permanent.'); }
            },
        ]
    });
}

// ── PAWN SHOP INTERIOR ────────────────────────────────────────────────────────
// Items have prices; Dave needs his cash card to buy.
const PAWN_ITEMS = [
    { id: 'spoon', name: 'Spoon', price: 5, desc: "A spoon. Five dollars. For a spoon. I could probably find a better one in my own kitchen drawer, if I ever cleaned it. This is peak consumerism." },
    { id: 'bent_knife', name: 'Bent Butter Knife', price: 15, desc: "A butter knife, bent into a shape that suggests it's seen things. Fifteen dollars for a bent butter knife. The pawnbroker must be a connoisseur of cutlery-based trauma." },
    { id: 'camera', name: 'Camera', price: 50, desc: "A 35mm camera from 1991. It probably contains 24 exposures of someone's thumb, but it's 'vintage.' And potentially evidence. Fifty dollars for a camera that might incriminate me." },
    { id: 'radio', name: 'Vintage Radio', price: 25, desc: "A vintage tube radio. It only plays one station from 1987. Perfect for when I want to live in a perpetual state of 80s synth-pop dread. Or solve a murder. Probably both." },
    { id: 'binoculars', name: 'Binoculars', price: 30, desc: "Binoculars. For when you want to look at things far away, like the sanity I left behind when I started this quest. Or the killer. One of those." },
    { id: 'battle_bread', name: 'Baguette Fragment', price: 8, desc: "Moncton Bakery Baguette. It's so hard it has its own zip code. I could use this to fight off a dragon or build a small bridge. Or just eat it, if I'm desperate. I'm not desperate. Yet." },
    { id: 'remote_control', name: 'Remote Control', price: 12, desc: "A remote control. TV? Stereo? It has one extra button labelled MAGNET in red electrical tape. Because who doesn't need to control local physics from their couch? Or turn off a tourist attraction." },
    { id: 'mansion_key', name: 'Van Horne Mansion Key', price: 75, desc: "A skeleton key with a raccoon bowtie. Seventy-five dollars to potentially get arrested for trespassing? Bargain. A very specific, raccoon-themed bargain." },
];

// Pawnbroker NPC multi-line dialogue
const PAWNBROKER_LINES = [
    '"Welcome. Browse freely. Touch nothing that isn\'t labelled." He gestures vaguely at everything.',
    '"The spoon is a long story. I don\'t tell it." He does not tell it.',
    '"The knife? Not a spoon. Says so on the plaque. Non-negotiable."',
    '"The camera has film in it. I haven\'t developed it. I won\'t. Some things are better unknown."',
    '"The radio only picks up one station. CHOY. October 14th. 1987. Every time. I stopped asking why."',
    '"The binoculars? Previous owner watched something. Over and over. Same spot. Every Tuesday. I try not to think about which spot."',
    '"The bread? Baker brings me day-olds. This one\'s... unusually dense. I offered it to the raccoon. The raccoon declined."',
    '"The remote? Found it here when I bought the shop. Extra button. I have never pressed it. I suggest you don\'t either." He pauses. "Unless you need to."',
    '"You\'re investigating something, aren\'t you. I can tell. You have the look." He says nothing more.'
];

function tryBuyItem(v, item, e) {
    if (v === 'Look at' || v === 'Read') {
        const priceSuffix = v === 'Read' ? ` The price tag says $${item.price}.` : "";
        e.say((item.desc || `It's a ${item.name}. Priced at $${item.price}.`) + priceSuffix);
        return;
    }
    
    if (v === 'Buy' || v === 'Pick up' || v === 'Use' || v === 'Walk to' || v === 'Give') {
        if (e.hasItem(item.id)) { e.say(`I already have the ${item.name}. One is sufficient.`); return; }
        if (!e.hasItem('cash_card')) {
            e.say(`That's $${item.price}. I don't have my cash card on me. I should find it first.`);
            return;
        }
        e.addItem(item.id, item.name);
        e.say(`I slide my cash card across the counter. The pawnbroker swipes it without looking up. I now own a ${item.name}. $${item.price}. This is a legitimate transaction.`);
    } else {
        e.say(`I'm not sure what to do with the ${item.name} right now. Buying it seems like the best option.`);
    }
}

function buildPawnShop(bg) {
    return new Room({
        id: 'pawn_shop', name: 'Moncton Pawn — Interior',
        background: bg,
        walkbox: [
            { x: 115, y: 510 }, { x: 920, y: 510 },
            { x: 880, y: 310 }, { x: 175, y: 310 },
        ],
        hotspots: [
            // Exit back to gate area
            {
                id: 'exit', name: 'Exit', x: 40, y: 140, w: 140, h: 380, walkToX: 135, walkToY: 460,
                onInteract(v, e) {
                    if (v === 'Walk to' || v === 'Open' || v === 'Use') e.changeRoom('gate', 240, 460);
                    else e.say('The door back to the street. Or the gate. Or the alley. Geography is fuzzy today.');
                }
            },
            // Store room door (right)
            {
                id: 'storeroom', name: 'Store Room Door', x: 865, y: 145, w: 100, h: 330, walkToX: 855, walkToY: 460,
                onInteract(v, e) {
                    e.say('"STORE ROOM" — the door is locked. The pawnbroker watches me with one eyebrow raised. I back away.');
                }
            },
            // Counter / pawnbroker NPC
            {
                id: 'counter', name: 'Pawnbroker', x: 185, y: 300, w: 265, h: 220, walkToX: 310, walkToY: 470,
                onInteract(v, e) {
                    const s = e.getRoomState('pawn_shop');
                    s.pawnTalk = (s.pawnTalk || 0) + 1;
                    const line = PAWNBROKER_LINES[(s.pawnTalk - 1) % PAWNBROKER_LINES.length];
                    e.say(line);
                }
            },
            // Display case — spoon, plus the mansion key (the big ticket item)
            {
                id: 'display_case', name: 'Display Case', x: 580, y: 325, w: 300, h: 180, walkToX: 720, walkToY: 470,
                onInteract(v, e) {
                    e.say('A locked glass display case. Inside: a spoon, two pocket watches, and — behind everything — an ornate skeleton key on a tag that says V.H. MAIN GATE. $75.');
                }
            },
            // Van Horne Mansion Key — in the display case
            {
                id: 'mansion_key', name: 'Van Horne Mansion Key', x: 705, y: 360, w: 50, h: 50, walkToX: 720, walkToY: 470,
                onInteract(v, e) { tryBuyItem(v, PAWN_ITEMS[7], e); }
            },
            // Spoon (in display case — ask shopkeeper)
            {
                id: 'spoon', name: 'Spoon', x: 645, y: 375, w: 50, h: 50, walkToX: 660, walkToY: 470,
                onInteract(v, e) { tryBuyItem(v, PAWN_ITEMS[0], e); }
            },
            // Bent butter knife — on plaque, prominent on the wall or shelf
            {
                id: 'bent_knife', name: 'Bent Butter Knife ♦', x: 435, y: 185, w: 60, h: 50, walkToX: 480, walkToY: 450,
                onInteract(v, e) { tryBuyItem(v, PAWN_ITEMS[1], e); }
            },
            // Shelves — cameras
            {
                id: 'camera', name: 'Camera', x: 230, y: 200, w: 50, h: 50, walkToX: 310, walkToY: 440,
                onInteract(v, e) { tryBuyItem(v, PAWN_ITEMS[2], e); }
            },
            // Shelves — radios
            {
                id: 'radio', name: 'Vintage Radio', x: 340, y: 200, w: 60, h: 50, walkToX: 390, walkToY: 440,
                onInteract(v, e) { tryBuyItem(v, PAWN_ITEMS[3], e); }
            },
            // Shelves — binoculars
            {
                id: 'binoculars', name: 'Binoculars', x: 465, y: 195, w: 60, h: 50, walkToX: 510, walkToY: 440,
                onInteract(v, e) { tryBuyItem(v, PAWN_ITEMS[4], e); }
            },
            // Battle bread fragment
            {
                id: 'battle_bread', name: 'Baguette Fragment', x: 185, y: 230, w: 70, h: 50, walkToX: 230, walkToY: 440,
                onInteract(v, e) { tryBuyItem(v, PAWN_ITEMS[5], e); }
            },
            // Remote control ← the game-changing item
            {
                id: 'remote_control', name: 'Remote Control', x: 385, y: 235, w: 50, h: 40, walkToX: 415, walkToY: 440,
                onInteract(v, e) { tryBuyItem(v, PAWN_ITEMS[6], e); }
            },
            // Mannequin head
            {
                id: 'mannequin', name: 'Mannequin Head', x: 555, y: 175, w: 70, h: 90, walkToX: 600, walkToY: 440,
                onInteract(v, e) { e.say('A mannequin head on a shelf. It has an expression of mild regret. I relate to it deeply.'); }
            },
            // Shelves overview
            {
                id: 'shelves', name: 'Shelves', x: 210, y: 130, w: 440, h: 80, walkToX: 430, walkToY: 420,
                onInteract(v, e) { e.say('Shelves: cameras, radios, binoculars, a fragment of bread, a mysterious remote control, a mannequinhead. Standard pawn shop selection.'); }
            },
        ]
    });
}

// ── MANSION COURTYARD ───────────────────────────────────────────────────────
function buildMansionCourtyard(bg) {
    return new Room({
        id: 'mansion_courtyard', name: 'Van Horne Mansion Courtyard',
        background: bg,
        walkbox: [
            { x: 30, y: 510 }, { x: 930, y: 510 },
            { x: 840, y: 330 }, { x: 140, y: 330 },
        ],
        hotspots: [
            // Gate back to gate area
            {
                id: 'gate_exit', name: 'Iron Gate', x: 0, y: 140, w: 175, h: 370, walkToX: 100, walkToY: 460,
                onInteract(v, e) {
                    if (v === 'Walk to' || v === 'Open' || v === 'Use') e.changeRoom('gate', 670, 460);
                    else e.say('The iron gate. It swings open from this side, at least. Mansions and their one-way hospitality.');
                }
            },
            // Lamp post by gate
            {
                id: 'lamp_post', name: 'Lamp Post', x: 165, y: 195, w: 55, h: 270, walkToX: 215, walkToY: 460,
                onInteract(v, e) { e.say('A gas lamp. Still burning. Either someone lit it recently or it\'s been lit since the Van Hornes moved in, which, judging by the architecture, was 1887.'); }
            },
            // Raccoons in the garden bushes (left)
            {
                id: 'raccoons_L', name: 'Raccoons', x: 230, y: 340, w: 230, h: 150, walkToX: 345, walkToY: 470,
                onInteract(v, e) {
                    const s = e.getRoomState('mansion_courtyard');
                    s.raccoonTalks = (s.raccoonTalks || 0) + 1;
                    if (v === 'Talk to') {
                        const lines = [
                            '\'Hello,\' I say to the raccoons. They stare. They have always been here. They will always be here.',
                            'I try again. The raccoon on the left tilts its head. The raccoon on the right does not. They have different opinions about me.',
                            'I ask if they know anything about the Van Hornes. Silence. But knowing silence.',
                            'The raccoon winks. I am not prepared for a raccoon wink. I back away slowly.',
                        ];
                        e.say(lines[Math.min(s.raccoonTalks - 1, lines.length - 1)]);
                    } else if (v === 'Pick up') {
                        e.say('I try to pick up a raccoon. It looks at my hand. I look at my hand. We reach an understanding. I do not pick up the raccoon.');
                    } else if (v === 'Give') {
                        if (e.hasItem('cheese') || e.hasItem('rotten_egg')) {
                            e.say('I offer some food to the raccoons. They accept it with the dignity of tiny masked professionals. They seem pleased. More pleased than I expected.');
                        } else {
                            e.say('I have nothing to offer the raccoons right now. They judge me. Rightfully.');
                        }
                    } else {
                        e.say('A family of raccoons living in the garden of a mansion. The Van Hornes should be paying them rent.');
                    }
                }
            },
            // Raccoon right side (in the bush by the wall)
            {
                id: 'raccoon_R', name: 'Raccoon', x: 830, y: 390, w: 110, h: 100, walkToX: 840, walkToY: 470,
                onInteract(v, e) {
                    const lines = [
                        'This raccoon is alone. A loner raccoon. Very dramatic.',
                        'It\'s watching the mansion door. Maybe it\'s also trying to get in.',
                        'The raccoon has something shiny near it. On closer inspection, it\'s a bottle cap. Still shiny though.',
                    ];
                    const s = e.getRoomState('mansion_courtyard');
                    s.raccoonR = (s.raccoonR || 0) + 1;
                    e.say(lines[Math.min(s.raccoonR - 1, lines.length - 1)]);
                }
            },
            // Stone fountain (center)
            {
                id: 'fountain', name: 'Fountain', x: 395, y: 360, w: 210, h: 145, walkToX: 500, walkToY: 480,
                onInteract(v, e) {
                    if (v === 'Look at') {
                        e.say('A stone fountain. The water is running. It has been running for a very long time. The stone cherub at the top looks deeply tired of this assignment.');
                    } else if (v === 'Use') {
                        if (e.hasItem('rotten_egg')) {
                            e.say('I dip the rotten egg in the fountain. The water accepts this. It is a forgiving fountain. The smell, however, does not improve.');
                        } else {
                            e.say('I cup some water in my hands and splash my face. The water is cold. The night is cold. Everything is fine.');
                        }
                    } else e.say('A classic stone fountain. There\'s a coin at the bottom. I\'m not taking it. This is someone\'s mansion. I have SOME standards.');
                }
            },
            // Large trees
            {
                id: 'trees', name: 'Old Trees', x: 230, y: 120, w: 280, h: 280, walkToX: 330, walkToY: 430,
                onInteract(v, e) {
                    e.say('Ancient trees. They remember when Moncton was smaller. They\'re not impressed by any of this, including me.');
                }
            },
            // Mansion windows (upper floor, lit)
            {
                id: 'mansion_windows', name: 'Lit Windows', x: 530, y: 75, w: 350, h: 175, walkToX: 700, walkToY: 430,
                onInteract(v, e) {
                    const s = e.getRoomState('mansion_courtyard');
                    s.windowLooks = (s.windowLooks || 0) + 1;
                    if (s.windowLooks === 1) e.say('There\'s a light on upstairs. Someone is home. At almost midnight. In a mansion. Completely normal.');
                    else if (s.windowLooks === 2) e.say('I stare at the window. A shadow moves past it. I blink. The shadow is gone. I have made a decision to not think about this.');
                    else e.say('I\'ve been staring at that window too long. A curtain twitches. Or the wind. Definitely the wind.');
                }
            },
            // Mansion front door — now leads to foyer (crime scene)
            {
                id: 'mansion_door', name: 'Mansion Front Door', x: 560, y: 240, w: 190, h: 270, walkToX: 655, walkToY: 470,
                onInteract(v, e) {
                    if (v === 'Knock') {
                        e.say('I knock. The sounds echoes through an enormous hall. No one answers, though something stirs upstairs. No one answers.');
                    } else if (v === 'Open' || v === 'Use' || v === 'Walk to') {
                        e.say('The door swings open. A cold draught hits me. I step inside Van Horne Mansion.');
                        setTimeout(() => e.changeRoom('mansion_foyer', 480, 460), 1600);
                    } else {
                        e.say('Double front doors, arched, with iron knockers in the shape of — is that a raccoon? The Van Hornes had a sense of humour.');
                    }
                }
            },
            // Garden / grounds — also path around to backyard
            {
                id: 'garden', name: 'Garden Path', x: 795, y: 340, w: 165, h: 170, walkToX: 850, walkToY: 470,
                onInteract(v, e) {
                    if (v === 'Walk to' || v === 'Use') {
                        e.say('I follow the garden path around the side of the mansion. The raccoons watch me go.');
                        setTimeout(() => e.changeRoom('mansion_backyard', 80, 460), 1600);
                    } else {
                        e.say('A garden path that curves around to the back of the mansion. The raccoons use it as their primary commute.');
                    }
                }
            },
            // Front garden description
            {
                id: 'garden_front', name: 'Garden', x: 500, y: 380, w: 295, h: 130, walkToX: 640, walkToY: 470,
                onInteract(v, e) { e.say('The garden is immaculately maintained. Someone tends to this. Probably not the raccoons, though they\'re clearly invested in the property.'); }
            },
            // VAN HORNE MANSION sign on gate
            {
                id: 'courtyard_sign', name: 'Van Horne Mansion Sign', x: 0, y: 70, w: 190, h: 120,
                onInteract(v, e) { e.say('VAN HORNE MANSION. The sign from outside. It looks even more serious from in here.'); }
            },
        ]
    });
}

// ── MANSION FOYER (Crime Scene) ──────────────────────────────────────────────
// Evidence markers 1-6 each correspond to an item for sale at Moncton Pawn.
// Dave arrives late. VERY late. Hilariously late.
const EVIDENCE_ITEMS = {
    1: { id: 'camera_pawn', name: 'Camera', clue: 'The killer was photographed? Or was using a camera? Either way, there was a camera here. Now it\'s at the pawn shop.' },
    2: { id: 'binoculars', name: 'Binoculars', clue: 'Someone was watching the mansion from outside long before tonight. Binoculars. The pawn shop has a pair.' },
    3: { id: 'radio_pawn', name: 'Vintage Radio', clue: 'A vintage radio. Playing something specific? The pawnbroker bought it this morning. Before the body was found. Interesting.' },
    4: { id: 'spoon', name: 'Spoon', clue: 'Evidence marker 4 marks... a spoon. An ordinary spoon. It is in a glass case at Moncton Pawn and costs $5. WHY IS IT EVIDENCE.' },
    5: { id: 'bent_knife', name: 'Bent Butter Knife', clue: 'A bent butter knife was found near the body. It is now mounted on a velvet plaque at the pawn shop for $15. Someone moved the evidence.' },
    6: { id: 'battle_bread', name: 'Baguette Fragment', clue: 'A fragment of extremely hard baguette. From Moncton Bakery. The baker\'s alibi is "I was angry at everyone, not just Van Horne."' },
};

function buildMansionFoyer(bg) {
    return new Room({
        id: 'mansion_foyer', name: 'Van Horne Mansion — Foyer',
        background: bg,
        walkbox: [
            { x: 170, y: 510 }, { x: 930, y: 510 },
            { x: 880, y: 330 }, { x: 340, y: 330 },
        ],
        hotspots: [
            // Front door back to courtyard
            {
                id: 'front_door', name: 'Front Door', x: 335, y: 220, w: 160, h: 290, walkToX: 415, walkToY: 465,
                onInteract(v, e) {
                    if (v === 'Walk to' || v === 'Open' || v === 'Use') e.changeRoom('mansion_courtyard', 660, 460);
                    else e.say('The way out. The responsible choice. I came in here anyway, so clearly I\'m not making responsible choices today.');
                }
            },
            // Dark doorway center-right (leads somewhere dark — not built yet)
            {
                id: 'dark_doorway', name: 'Dark Doorway', x: 510, y: 220, w: 140, h: 280, walkToX: 580, walkToY: 460,
                onInteract(v, e) { e.say('A doorway into darkness. Whatever is in there is not lit. I have a feeling it should stay that way for now.'); }
            },
            // Right door (locked with padlock)
            {
                id: 'right_door', name: 'Library Door', x: 795, y: 200, w: 140, h: 310, walkToX: 840, walkToY: 470,
                onInteract(v, e) {
                    if (v === 'Walk to' || v === 'Open' || v === 'Use') {
                        e.changeRoom('mansion_library', 150, 440);
                    } else {
                        e.say('A heavy oak door. The label says "LIBRARY". It smells of old paper and even older secrets.');
                    }
                }
            },
            // Grand staircase
            {
                id: 'staircase', name: 'Grand Staircase', x: 55, y: 200, w: 320, h: 330, walkToX: 230, walkToY: 460,
                onInteract(v, e) {
                    const s = e.getRoomState('mansion_foyer');
                    if (v === 'Climb' || v === 'Walk to' || v === 'Use') {
                        s.stairAttempts = (s.stairAttempts || 0) + 1;
                        if (s.stairAttempts === 1) e.say('I start up the stairs. I get three steps up before I remember there is a CHALK OUTLINE on the floor and I haven\'t even looked at it yet. I come back down.');
                        else e.say('I\'m not going up there until I\'ve figured out the floor situation.');
                    } else e.say('A grand curved staircase. Very Van Horne. Very "my house is intimidating and I know it".');
                }
            },
            // Chandelier
            {
                id: 'chandelier', name: 'Chandelier', x: 340, y: 0, w: 300, h: 130,
                onInteract(v, e) { e.say('A chandelier with actual candles. Still lit. Either someone lit it recently or chandeliers in mansions just burn forever. Both are plausible.'); }
            },
            // Cat on the balcony
            {
                id: 'cat', name: 'Cat', x: 560, y: 115, w: 80, h: 80,
                onInteract(v, e) {
                    const s = e.getRoomState('mansion_foyer');
                    s.catTalks = (s.catTalks || 0) + 1;
                    if (v === 'Talk to') {
                        const catLines = [
                            '\'Did you see anything?\' The cat stares. It absolutely saw everything. It will tell no one.',
                            'The cat blinks slowly. Once. I take this as either a greeting or a verdict. I\'m not sure which.',
                            'The cat turns away. The conversation is over. The cat has decided I am not worth its time.',
                            'The cat is gone. It was here. Now it isn\'t. The cat operates on its own schedule.',
                        ];
                        e.say(catLines[Math.min(s.catTalks - 1, catLines.length - 1)]);
                    } else e.say('A cat on the balcony railing. Watching. Judging. Knowing.');
                }
            },
            // THE CHALK OUTLINE — Dave reacts to arriving late
            {
                id: 'chalk_outline', name: 'Chalk Outline', x: 240, y: 395, w: 400, h: 120, walkToX: 440, walkToY: 470,
                onInteract(v, e) {
                    const s = e.getRoomState('mansion_foyer');
                    if (!s.firstLook) {
                        s.firstLook = true;
                        e.say('Oh. OH. There is a chalk outline. A human chalk outline. On the floor of Van Horne Mansion. I am arriving to a murder that has already been solved, probably, by people who were here on time. I am SO late.');
                    } else if (!s.secondLook) {
                        s.secondLook = true;
                        e.say('The outline is professional. Precise. Someone drew this and then... left? Where is the police tape? Where are the police? This is Moncton. Did the police just... not come?');
                    } else {
                        e.say('I\'ve been staring at this chalk outline for a while now. It hasn\'t changed. I feel like I should do something. I feel like that something involves the pawn shop.');
                    }
                }
            },
            // Blood stain near body
            {
                id: 'bloodstain', name: 'Bloodstain', x: 390, y: 430, w: 100, h: 65, walkToX: 440, walkToY: 480,
                onInteract(v, e) { e.say('I don\'t touch the bloodstain. I have limits. Also hands. I\'m keeping both.'); }
            },
            // Evidence marker 1
            {
                id: 'evidence_1', name: 'Evidence ①', x: 480, y: 395, w: 45, h: 45, walkToX: 480, walkToY: 465,
                onInteract(v, e) { examineEvidence(1, v, e); }
            },
            // Evidence marker 2
            {
                id: 'evidence_2', name: 'Evidence ②', x: 590, y: 420, w: 45, h: 45, walkToX: 600, walkToY: 470,
                onInteract(v, e) { examineEvidence(2, v, e); }
            },
            // Evidence marker 3
            {
                id: 'evidence_3', name: 'Evidence ③', x: 245, y: 415, w: 45, h: 45, walkToX: 280, walkToY: 470,
                onInteract(v, e) { examineEvidence(3, v, e); }
            },
            // Evidence marker 4
            {
                id: 'evidence_4', name: 'Evidence ④', x: 355, y: 450, w: 45, h: 45, walkToX: 380, walkToY: 475,
                onInteract(v, e) { examineEvidence(4, v, e); }
            },
            // Evidence marker 5
            {
                id: 'evidence_5', name: 'Evidence ⑤', x: 545, y: 450, w: 45, h: 45, walkToX: 570, walkToY: 475,
                onInteract(v, e) { examineEvidence(5, v, e); }
            },
            // Evidence marker 6
            {
                id: 'evidence_6', name: 'Evidence ⑥', x: 285, y: 395, w: 45, h: 45, walkToX: 310, walkToY: 460,
                onInteract(v, e) { examineEvidence(6, v, e); }
            },
            // Wall sconces / ambience
            {
                id: 'wall_sconce', name: 'Wall Sconce', x: 305, y: 245, w: 55, h: 85,
                onInteract(v, e) { e.say('Gas sconces still burning. This house is unnervingly lively for a crime scene. Someone is paying the gas bill. Or was.'); }
            },
        ]
    });
}

function examineEvidence(num, verb, e) {
    const item = EVIDENCE_ITEMS[num];
    if (!item) { e.say(`Evidence marker ${num}. It marks something. Something is no longer here.`); return; }
    if (verb === 'Pick up') {
        e.say(`I try to pick up evidence marker ${num}. I\'m not a cop. But I also don't see any cops. The marker stays. I write down a mental note: check the pawn shop.`);
        return;
    }
    if (verb === 'Use' && e.hasItem(item.id)) {
        e.say(`I present the ${item.name} next to evidence marker ${num}. It's a perfect match. I have solved exactly ${num} sixth${num === 1 ? '' : 's'} of this mystery.`);
        e.getRoomState('mansion_foyer')[`solved_${num}`] = true;
        checkAllSolved(e);
        return;
    }
    e.say(`Marker ${num}: ${item.clue}`);
}

function checkAllSolved(e) {
    const fs = e.getRoomState('mansion_foyer');
    const solved = [1, 2, 3, 4, 5, 6].filter(n => fs[`solved_${n}`]).length;
    if (solved >= 6) {
        e.say('I have matched all six pieces of evidence. I have solved the Van Horne murder using items from a pawn shop. No one will believe me. I barely believe me. But I\'m right. I\'m definitely right.');
    } else {
        e.say(`${solved} of 6 clues matched. ${6 - solved} more to go. The pawn shop awaits.`);
    }
}

// ── MANSION LIBRARY ─────────────────────────────────────────────────────────
// Key mechanic: OUT OF ORDER sign on spiral staircase.
// Pick it up → staircase becomes usable.
const RESEARCH_BOOKS = [
    {
        id: 'book_camera', title: 'Candid Surveillance: A History',
        text: 'Van Horne was photographed the night of his death meeting someone at the gate. A camera was used. The camera was subsequently pawned. How. Why. When. The pawnbroker claims he "found it." In a pawn shop. Where things are found.'
    },
    {
        id: 'book_binoculars', title: 'Van Horne Family Correspondence, 1989-1991',
        text: 'Multiple letters discuss someone watching the mansion from across the street. Quote: "The figure with the binoculars returns each Tuesday." The binoculars found at the scene are, by description, those same binoculars. They are currently $30 at Moncton Pawn.'
    },
    {
        id: 'book_radio', title: 'Moncton Radio Log, CHOY-FM, October 14th',
        text: 'A vintage radio was found tuned to CHOY-FM. The last song played was "Baker Street." Coincidence? The baker would say yes. The radio was removed from the scene and pawned the following morning.'
    },
    {
        id: 'book_spoon', title: 'The Spoon: A Case Study in Inexplicable Evidence',
        text: 'Nothing in this library explains why a spoon is evidence. The spoon is a spoon. A regular spoon. It was beside the body. It should not have been beside the body. No one has a theory. The spoon is at the pawn shop for $5.'
    },
    {
        id: 'book_knife', title: 'Cutlery of the Van Horne Estate: An Inventory',
        text: 'The Van Horne Estate owned several butter knives. One is documented as "bent, from an incident in 1988 that we do not discuss." This is the knife found at the scene. It is mounted on a plaque at Moncton Pawn and the plaque says NOT A SPOON.'
    },
    {
        id: 'book_bread', title: 'Moncton Bakery: Customer Complaints, Volume 7',
        text: 'The baker has been in 47 documented disputes. Van Horne was customer 48. The dispute involved a baguette described by witnesses as "structurally a weapon." Fragments matching that baguette were found at the scene.'
    },
];

function buildMansionLibrary(bg) {
    return new Room({
        id: 'mansion_library', name: 'Van Horne Library',
        background: bg,
        walkbox: [
            { x: 70, y: 510 }, { x: 930, y: 510 },
            { x: 870, y: 300 }, { x: 130, y: 300 },
        ],
        hotspots: [
            // Exit back to foyer (through right door labelled Library)
            {
                id: 'library_exit', name: 'Library Door', x: 820, y: 175, w: 145, h: 350, walkToX: 860, walkToY: 470,
                onInteract(v, e) {
                    if (v === 'Walk to' || v === 'Open' || v === 'Use') e.changeRoom('mansion_foyer', 520, 460);
                    else e.say('The door back to the foyer. Back to the chalk outline and the crushing weight of unsolved mystery. I am really missing my fridge battery right now.');
                }
            },
            // Spiral staircase with OUT OF ORDER sign
            {
                id: 'staircase_sign', name: 'OUT OF ORDER Sign', x: 180, y: 290, w: 110, h: 60,
                isVisible(e) { return !e.getRoomState('mansion_library').signRemoved; },
                onInteract(v, e) {
                    if (v === 'Pick up') {
                        e.getRoomState('mansion_library').signRemoved = true;
                        e.addItem('oos_sign', 'OUT OF ORDER Sign');
                        e.say("I pick up the sign. Suddenly, the staircase is physically capable of supporting my weight again. It's amazing how much power a piece of cardboard has over the laws of physics.");
                    } else e.say("An 'OUT OF ORDER' sign. It's the ultimate gatekeeper of adventure games. I could climb it, but my character's moral code forbids using non-functional furniture.");
                }
            },
            // Spiral staircase — usable only after sign removed
            {
                id: 'staircase', name: 'Spiral Staircase', x: 185, y: 140, w: 200, h: 365, walkToX: 285, walkToY: 460,
                onInteract(v, e) {
                    const rs = e.getRoomState('mansion_library');
                    if (v === 'Climb' || v === 'Walk to' || v === 'Use') {
                        if (!rs.signRemoved) {
                            e.say('The staircase has an OUT OF ORDER sign on it. I cannot use an out-of-order staircase. That would be irresponsible.');
                        } else {
                            e.say('I climb the spiral staircase. The upper level has more books. Of course it does. It\'s a library.');
                            // Upper level — narrated for now, no separate room
                            setTimeout(() => e.say('Up here: a reading nook, a telescope pointed at the street, and a cat who was NOT here a moment ago. The upper shelves have only one book without dust: "How To Get Away With Everything In Moncton." Checked out.'), 2500);
                        }
                    } else e.say('A beautiful wrought-iron spiral staircase. It goes up to a second level. There is currently a sign on it.');
                }
            },
            // Study desk with open book
            {
                id: 'desk', name: 'Writing Desk', x: 345, y: 355, w: 310, h: 175, walkToX: 500, walkToY: 475,
                onInteract(v, e) {
                    e.say('An enormous writing desk. The chair is leather, the lamp is on, and there is an open book with handwritten notes. Someone was here recently. Or is still here. I look around. Nobody. Probably.');
                }
            },
            // The open book / research notes on desk — most important
            {
                id: 'open_book', name: 'Research Notes', x: 415, y: 365, w: 185, h: 85, walkToX: 500, walkToY: 470,
                onInteract(v, e) {
                    const rs = e.getRoomState('mansion_library');
                    rs.notesRead = (rs.notesRead || 0) + 1;
                    const summaries = [
                        'The notes are in a tight, anxious hand. At the top: "THE PAWNBROKER KNOWS." Then a list of six items. Then: "DO NOT GO TO THE PAWN SHOP ALONE." Then, in bigger letters: "SEND DAVE."',
                        'I re-read the note. Someone wrote SEND DAVE. I am Dave. I was sent here. By whom? The note doesn\'t say. The note says SEND DAVE like it\'s obvious who Dave is and why Dave would help.',
                        'Third reading. The note ends: "Dave will arrive late. That is fine. He always does. He\'ll figure it out." I am furious. I am also oddly touched.',
                    ];
                    e.say(summaries[Math.min(rs.notesRead - 1, summaries.length - 1)]);
                }
            },
            // Bookshelf center (main wall, floor to ceiling)
            {
                id: 'main_shelves', name: 'Bookshelves', x: 355, y: 60, w: 445, h: 295, walkToX: 580, walkToY: 430,
                onInteract(v, e) {
                    const rs = e.getRoomState('mansion_library');
                    rs.shelfBrowse = (rs.shelfBrowse || 0) + 1;
                    const book = RESEARCH_BOOKS[(rs.shelfBrowse - 1) % RESEARCH_BOOKS.length];
                    e.say(`I pull a book: "${book.title}". ${book.text}`);
                }
            },
            // Left wall shelves
            {
                id: 'left_shelves', name: 'Left Bookshelves', x: 0, y: 80, w: 185, h: 420, walkToX: 130, walkToY: 450,
                onInteract(v, e) { e.say('The left shelves are dedicated to Van Horne genealogy, Moncton shipping records, and, inexplicably, seventeen copies of the same cookbook. "Poutine: The Definitive Guide."'); }
            },
            // Right shelves (beside library door)
            {
                id: 'right_shelves', name: 'Right Bookshelves', x: 650, y: 155, w: 165, h: 330, walkToX: 735, walkToY: 450,
                onInteract(v, e) { e.say('These shelves contain legal documents, property surveys, and a sealed envelope labelled "DO NOT OPEN UNTIL THE MYSTERY IS SOLVED." I leave it. For now.'); }
            },
            // Window (left, overlooking courtyard with Van Horne Manor sign visible)
            {
                id: 'library_window', name: 'Window', x: 55, y: 185, w: 130, h: 165, walkToX: 130, walkToY: 430,
                onInteract(v, e) { e.say('The window overlooks the courtyard. I can see the fountain. A raccoon is sitting beside it, looking up at this window. We make eye contact. I close the curtain.'); }
            },
            // Quill / pen on desk
            {
                id: 'quill', name: 'Quill Pen', x: 490, y: 375, w: 40, h: 60, walkToX: 500, walkToY: 460,
                onInteract(v, e) {
                    if (v === 'Pick up') e.say('I pick up the quill. It is large and dramatic. I put it back. I have nowhere to put a quill. I am not a quill person.');
                    else e.say('A quill pen. In active use. Someone is still writing in here. I look around again. Still nobody. Probably.');
                }
            },
            // Cats (upper left and upper right balcony)
            {
                id: 'library_cat', name: 'Cat', x: 40, y: 40, w: 80, h: 80,
                onInteract(v, e) { e.say('A cat on the upper shelf, barely visible. It is watching me read. It has read everything in this library. It understands it all. It will not help.'); }
            },
            // Upper balcony books
            {
                id: 'upper_books', name: 'Upper Balcony', x: 390, y: 60, w: 380, h: 90,
                onInteract(v, e) { e.say('The upper level. Accessible via the spiral staircase, should said staircase be in order.'); }
            },
            // Chandelier
            {
                id: 'chandelier', name: 'Chandelier', x: 360, y: 0, w: 290, h: 100,
                onInteract(v, e) { e.say('A chandelier with all twelve candles lit. Someone lit twelve candles in this library tonight. Setting the mood for... research? Murder investigation? Both?'); }
            },
        ]
    });
}

// ── MANSION BACKYARD ─────────────────────────────────────────────────────────
// Accessible from courtyard (garden path around back).
// SHORTCUT TO MAGNETIC HILL leads to police_station_ext.
function buildMansionBackyard(bg) {
    return new Room({
        id: 'mansion_backyard', name: 'Van Horne Backyard',
        background: bg,
        walkbox: [
            { x: 30, y: 510 }, { x: 930, y: 510 },
            { x: 820, y: 370 }, { x: 120, y: 370 },
        ],
        hotspots: [
            // Back door of mansion — leads to foyer
            {
                id: 'back_door', name: 'Back Door', x: 35, y: 260, w: 80, h: 240, walkToX: 95, walkToY: 470,
                onInteract(v, e) {
                    if (v === 'Open' || v === 'Walk to' || v === 'Use') e.changeRoom('mansion_foyer', 580, 460);
                    else e.say('The back door to the mansion. Usually these are less grand than front doors. This one is still fairly grand.');
                }
            },
            // Back to courtyard (left edge)
            {
                id: 'to_courtyard', name: 'Garden', x: 0, y: 380, w: 45, h: 150,
                onInteract(v, e) {
                    if (v === 'Walk to' || v === 'Use') e.changeRoom('mansion_courtyard', 860, 460);
                    else e.say('The way back to the front garden.');
                }
            },
            // MAIN ROUTE CLOSED sign (left sign post, pickupable)
            {
                id: 'main_closed_sign', name: 'MAIN ROUTE CLOSED Sign',
                x: 400, y: 270, w: 185, h: 85, walkToX: 490, walkToY: 460,
                isVisible(e) { return !e.getRoomState('mansion_backyard').signTaken; },
                onInteract(v, e) {
                    if (v === 'Pick up') {
                        e.getRoomState('mansion_backyard').signTaken = true;
                        e.addItem('main_closed_sign', 'MAIN ROUTE CLOSED Sign');
                        e.say('I take the MAIN ROUTE CLOSED sign. The main route remains closed. The sign was not the reason. But now I have a sign.');
                    } else e.say('MAIN ROUTE CLOSED. The main route is, presumably, somewhere. It is closed. The shortcut remains, inexplicably, open.');
                }
            },
            // SHORTCUT TO MAGNETIC HILL sign (the important one)
            {
                id: 'shortcut_sign', name: 'SHORTCUT TO MAGNETIC HILL →',
                x: 550, y: 295, w: 260, h: 130, walkToX: 680, walkToY: 470,
                onInteract(v, e) {
                    if (v === 'Walk to' || v === 'Use') {
                        e.say("I follow the shortcut. The woods are dark, the atmosphere is heavy, and I'm fairly certain a raccoon is mocking my choice of footwear.");
                        setTimeout(() => e.changeRoom('police_station_ext', 160, 460), 2000);
                    } else e.say("A shortcut to Magnetic Hill. Usually, shortcuts in these games lead to death, but this is Moncton, so it probably just leads to more poutine.");
                }
            },
            // The path through the gap
            {
                id: 'shortcut_path', name: 'Shortcut Path', x: 430, y: 350, w: 340, h: 175, walkToX: 600, walkToY: 470,
                onInteract(v, e) {
                    e.say('I follow the shortcut. The path curves through the trees. Eyes watch from the dark. I pretend not to notice.');
                    setTimeout(() => e.changeRoom('police_station_ext', 160, 460), 2000);
                }
            },
            // Eyes in the forest
            {
                id: 'forest_eyes', name: 'Eyes', x: 440, y: 270, w: 360, h: 160,
                onInteract(v, e) {
                    const ls = [
                        'There are eyes in the treeline. Multiple eyes. They blink at different intervals. I decide this is normal.',
                        'The eyes have not moved. I have not moved. We are in an understanding.',
                        'One pair of eyes blinks out. A new pair appears slightly to the left. Progress.',
                    ];
                    const s = e.getRoomState('mansion_backyard');
                    s.eyeCount = (s.eyeCount || 0) + 1;
                    e.say(ls[Math.min(s.eyeCount - 1, ls.length - 1)]);
                }
            },
            // Can on the ground
            {
                id: 'can', name: 'Empty Can', x: 155, y: 455, w: 60, h: 40, walkToX: 185, walkToY: 475,
                onInteract(v, e) { e.say('An empty can on the ground. It has been here a while. It is coping.'); }
            },
        ]
    });
}

// ── POLICE STATION EXTERIOR ────────────────────────────────────────────────────
function buildPoliceExt(bg) {
    return new Room({
        id: 'police_station_ext', name: 'Moncton Police Station',
        background: bg,
        walkbox: [
            { x: 0, y: 510 }, { x: 960, y: 510 },
            { x: 870, y: 380 }, { x: 90, y: 380 },
        ],
        hotspots: [
            // Back towards backyard/shortcut
            {
                id: 'to_backyard', name: 'Shortcut Path', x: 0, y: 360, w: 60, h: 180,
                onInteract(v, e) {
                    if (v === 'Walk to' || v === 'Use') e.changeRoom('mansion_backyard', 650, 460);
                    else e.say('The path back through the woods. And the eyes.');
                }
            },
            // Police station main sign
            {
                id: 'police_sign', name: 'Moncton Police Station Sign', x: 195, y: 55, w: 560, h: 125,
                onInteract(v, e) { e.say('MONCTON POLICE STATION. There is a badge logo on the sign. The badge looks a little tired. It has been a long night for the badge.'); }
            },
            // Public Safety sign above door
            {
                id: 'public_safety', name: 'Public Safety Sign', x: 300, y: 180, w: 195, h: 55,
                onInteract(v, e) { e.say('"PUBLIC SAFETY." The station is dark. There is no one visible inside. Public safety is currently... offline, I think.'); }
            },
            // Blue front door
            {
                id: 'police_door', name: 'Police Station Door', x: 300, y: 220, w: 165, h: 300, walkToX: 385, walkToY: 475,
                onInteract(v, e) {
                    if (v === 'Open' || v === 'Walk to' || v === 'Use') {
                        e.say('I push the door open. Inside smells like old coffee and staple remover.');
                        setTimeout(() => e.changeRoom('police_station_int', 480, 460), 1400);
                    } else e.say('The blue front door of Moncton Police Station. It is unlocked. Police stations tend to stay open. Even at midnight. Especially at midnight.');
                }
            },
            // Window (shows interior desk)
            {
                id: 'police_window', name: 'Police Window', x: 480, y: 220, w: 230, h: 230, walkToX: 595, walkToY: 460,
                onInteract(v, e) {
                    e.say('I peer through the window. Inside: a desk, an extremely old computer, and a chair that has clearly been slept in. No officer visible. The clock on the wall is the only thing moving.');
                }
            },
            // Eyes in the dark alley (right side)
            {
                id: 'alley_eyes', name: 'Eyes', x: 825, y: 270, w: 140, h: 150,
                onInteract(v, e) { e.say('Eyes in the dark alley beside the station. I do not know what they belong to. Given the pattern this evening, probably raccoons. Or something raccoon-adjacent.'); }
            },
            // Road to Magnetic Hill
            {
                id: 'to_mag_hill', name: 'Road to Attraction', x: 880, y: 360, w: 80, h: 200, walkToX: 920, walkToY: 460,
                onInteract(v, e) {
                    if (v === 'Walk to' || v === 'Use') {
                        e.changeRoom('mag_entrance', 100, 450);
                    } else {
                        e.say("The road leads toward Magnetic Hill. The attraction of the century, according to the signs I saw earlier.");
                    }
                }
            },
            // Cracked wall
            {
                id: 'wall_crack', name: 'Cracked Wall', x: 90, y: 200, w: 220, h: 260,
                onInteract(v, e) { e.say('The wall of the police station has significant cracks. This is either structural damage, deferred maintenance, or the building is expressing its feelings. I relate to all three.'); }
            },
            // Trash on sidewalk
            {
                id: 'sidewalk_trash', name: 'Litter', x: 150, y: 450, w: 400, h: 60,
                onInteract(v, e) { e.say('The sidewalk outside a police station has litter on it. The irony is noted. The litter remains.'); }
            },
        ]
    });
}

// ── POLICE STATION INTERIOR ───────────────────────────────────────────────────
function buildPoliceInt(bg) {
    return new Room({
        id: 'police_station_int', name: 'Moncton Police — Reception',
        background: bg,
        walkbox: [
            { x: 245, y: 510 }, { x: 930, y: 510 },
            { x: 880, y: 310 }, { x: 310, y: 310 },
        ],
        hotspots: [
            // Exit back to exterior
            {
                id: 'exit', name: 'Front Door', x: 0, y: 0, w: 250, h: 520, walkToX: 290, walkToY: 465,
                onInteract(v, e) {
                    if (v === 'Walk to' || v === 'Open' || v === 'Use') e.changeRoom('police_station_ext', 390, 460);
                    else e.say('The way out. Into the night. The eyes are still out there.');
                }
            },
            // Jail cell (left, "WAITING AREA" sign)
            {
                id: 'jail_cell', name: 'Waiting Area', x: 238, y: 60, w: 260, h: 450, walkToX: 340, walkToY: 465,
                onInteract(v, e) {
                    const s = e.getRoomState('police_station_int');
                    if (v === 'Use' && e.getRoomState('mansion_foyer').allSolved) {
                        if (s.suspectJailed) {
                            e.say('The suspect is already in the Waiting Area. I have done what I came to do.');
                        } else {
                            s.suspectJailed = true;
                            e.say('I present my evidence to the empty station. I write the baker\'s name on a sticky note. I put it on the cell door. Justice, Moncton-style.');
                        }
                    } else if (s.suspectJailed) {
                        e.say('The cell holds the suspect\'s name, the evidence, and a sticky note that says "DAVE WAS RIGHT." I am proud of this.');
                    } else {
                        e.say('A jail cell labelled WAITING AREA. The chairs inside are extremely uncomfortable. This is intentional.');
                    }
                }
            },
            // Cell padlock
            {
                id: 'cell_lock', name: 'Cell Padlock', x: 488, y: 320, w: 40, h: 55, walkToX: 470, walkToY: 460,
                onInteract(v, e) { e.say('A padlock on the jail cell. The kind that has seen everyone it\'s ever held. It has opinions.'); }
            },
            // Clock on wall
            {
                id: 'clock', name: 'Wall Clock', x: 495, y: 155, w: 75, h: 75,
                onInteract(v, e) { e.say('The clock reads 12:47 AM. I have been running around Moncton for almost an hour solving a murder that happened without me. I\'m on time by "I made it before morning" standards.'); }
            },
            // RECEPTION sign
            {
                id: 'reception_sign', name: 'RECEPTION Sign', x: 435, y: 100, w: 235, h: 60,
                onInteract(v, e) { e.say('RECEPTION. There is no one at reception. There is a chair where someone was recently sitting. The indentation is still warm, probably. I choose not to check.'); }
            },
            // Reception desk — Officer Savoie, asleep on duty
            {
                id: 'desk', name: 'Officer Savoie', x: 390, y: 260, w: 310, h: 260, walkToX: 545, walkToY: 460,
                onInteract(v, e) {
                    const s = e.getRoomState('police_station_int');
                    const foyer = e.getRoomState('mansion_foyer');
                    if (v === 'Talk to' || v === 'Use' || v === 'Push') {
                        s.savoieTalks = (s.savoieTalks || 0) + 1;
                        if (s.savoieTalks === 1) {
                            e.say('Officer Savoie jolts awake. "Hnn— WHAT. Oh. Dave. I thought you weren\'t— when did you— there\'s a case— " He straightens his hat. It falls off.');
                        } else if (s.savoieTalks === 2) {
                            e.say('Savoie: "The Van Horne thing? Yeah. We got the call six hours ago. I sent a guy. He came back and said the evidence was \"being processed.\" That\'s all we have. That\'s the whole case."');
                        } else if (s.savoieTalks === 3) {
                            e.say('Savoie: "Did you go to the mansion? You\'re not authorized. You know you\'re not authorized. Why does your face look like you went to the mansion?"');
                        } else if (foyer.allSolved && !s.caseAccepted) {
                            s.caseAccepted = true;
                            e.say('Savoie stares at your evidence notes. "The baker. The bread. The pawn shop pipeline. Dave." He pauses. "Dave. You solved it. WITH PAWN SHOP STUFF." He stamps a form. Case closed.');
                        } else if (s.caseAccepted) {
                            e.say('Savoie: "The baker is being processed. We retrieved the evidence from the pawn shop. Yes, all of it. The pawnbroker was NOT surprised. That is also suspicious."');
                        } else {
                            e.say('Savoie: "You need more evidence. Or a warrant. Or a map. I have none of these things for you." He gestures at the empty desk.');
                        }
                    } else {
                        e.say('Officer Savoie is asleep at the reception desk. His hat is on the keyboard. The computer says: C:\\POLICE> The curser blinks. It\'s been blinking for hours.');
                    }
                }
            },

            // Old computer on desk
            {
                id: 'computer', name: 'Police Computer', x: 500, y: 255, w: 155, h: 120, walkToX: 545, walkToY: 460,
                onInteract(v, e) {
                    const s = e.getRoomState('police_station_int');
                    s.computerUse = (s.computerUse || 0) + 1;
                    if (s.computerUse === 1) {
                        e.say('I sit at the computer. It runs DOS. The blinking cursor asks: C:\\POLICE> The cursor waits. I type SOLVE MURDER. It says: BAD COMMAND OR FILE NAME.');
                    } else if (s.computerUse === 2) {
                        e.say('I try again. DIR. It lists files: UNSOLVED.TXT, ALSO_UNSOLVED.TXT, VANHORNE.TXT. I open VANHORNE.TXT. It says: SEE DAVE. I close the computer.');
                    } else {
                        e.say('I type HELP. It says: HELP IS NOT AVAILABLE AT THIS TIME. The computer understands public service.');
                    }
                }
            },
            // Booking door (right)
            {
                id: 'booking_door', name: 'Booking Room Door', x: 680, y: 155, w: 145, h: 360, walkToX: 760, walkToY: 460,
                onInteract(v, e) {
                    e.say('The BOOKING door is locked. "AUTHORIZED PERSONNEL ONLY." I am not authorized personnel. I am Dave. I have solved a murder with pawn shop items. I accept these distinctions.');
                }
            },
            // Waiting chairs (right)
            {
                id: 'chairs', name: 'Waiting Chairs', x: 815, y: 325, w: 150, h: 195, walkToX: 865, walkToY: 460,
                onInteract(v, e) { e.say('Waiting room chairs. The universal symbol of "this will take a while." Each one has left a mark on the souls of all who have sat there.'); }
            },
            // Barred window (right)
            {
                id: 'barred_window', name: 'Barred Window', x: 820, y: 205, w: 115, h: 115,
                onInteract(v, e) { e.say('A small barred window. It overlooks the alley with the eyes. The eyes can see into the police station. The windows bars are new. The eyes are older.'); }
            },
        ]
    });
}

// ── MAGNETIC HILL ENTRANCE ─────────────────────────────────────────────────
function buildMagEntrance(bg) {
    return new Room({
        id: 'mag_entrance', name: 'Magnetic Hill — Entrance',
        background: bg,
        walkbox: [
            { x: 0, y: 510 }, { x: 960, y: 510 },
            { x: 870, y: 360 }, { x: 90, y: 360 },
        ],
        hotspots: [
            // Back to police station exterior
            {
                id: 'to_police', name: 'Road Back', x: 0, y: 360, w: 80, h: 175,
                onInteract(v, e) {
                    if (v === 'Walk to' || v === 'Use') e.changeRoom('police_station_ext', 860, 460);
                    else e.say('The road back. Towards the police station. And the eyes. Always the eyes.');
                }
            },
            // Magnetic Hill sign
            {
                id: 'mag_sign', name: 'Magnetic Hill Attraction Sign', x: 380, y: 300, w: 290, h: 200, walkToX: 525, walkToY: 470,
                onInteract(v, e) {
                    e.say('MAGNETIC HILL ATTRACTION with an arrow pointing up the path. It is midnight. The attraction is technically closed. I am going anyway. This is consistent with my decision-making this evening.');
                }
            },
            // Ticket booth (stone building, left)
            {
                id: 'ticket_booth', name: 'Ticket Booth', x: 30, y: 195, w: 310, h: 340, walkToX: 190, walkToY: 465,
                onInteract(v, e) {
                    if (v === 'Walk to' || v === 'Open' || v === 'Use') {
                        e.say('I try the door of the ticket booth. It opens. I step inside. The floor gives way. I fall.');
                        setTimeout(() => e.changeRoom('geo_strata', 280, 430), 1800);
                    } else e.say('A stone ticket booth. TICKETS window is shuttered. Door is unlocked, which is suspicious. The booth looks solid but sounds... hollow underfoot.');
                }
            },
            // Tickets window
            {
                id: 'ticket_window', name: 'Ticket Window', x: 195, y: 235, w: 155, h: 115, walkToX: 230, walkToY: 440,
                onInteract(v, e) {
                    e.say('"TICKETS" — the window slot is closed. There\'s a hand-written note: "Closed for the night. Or possibly forever. — Management." The note has a small doodle of a magnet.');
                }
            },
            // Path up to magnetic hill
            {
                id: 'mag_path', name: 'Path to Magnetic Hill', x: 440, y: 200, w: 300, h: 250, walkToX: 600, walkToY: 440,
                onInteract(v, e) {
                    if (v === 'Walk to' || v === 'Use') {
                        e.say('I head up the path toward Magnetic Hill. Something pulls at my pockets. My keys. The battery. Everything metallic leans toward the hill.');
                        setTimeout(() => e.changeRoom('magnetic_hill', 480, 460), 2000);
                    } else e.say('A gravel path leading up into the dark trees toward Magnetic Hill. The trees lean slightly toward the hill. Or I\'m imagining it. I\'m not imagining it.');
                }
            },
            // Eyes in the woods
            {
                id: 'woods_eyes', name: 'Eyes', x: 430, y: 200, w: 530, h: 250,
                onInteract(v, e) { e.say('Eyes in the trees. Everywhere tonight, eyes. I\'m starting to feel like I\'m the tourist attraction.'); }
            },
            // Cars in parking lot (left)
            {
                id: 'parking_lot', name: 'Parked Cars', x: 0, y: 340, w: 135, h: 140,
                onInteract(v, e) { e.say('Two parked cars. At midnight. At Magnetic Hill Attraction. They were here before I arrived. Belonging to whom? Whoever it is, they\'re also here. Somewhere. Probably fine.'); }
            },
        ]
    });
}

// ── GEO STRATA (underground, Canadian Shield) ───────────────────────────────
// Dave falls through the ticket booth floor into this underground room.
const GEO_FACTS = [
    // Upper sedimentary layer (grey, top)
    'UPPER LAYER — Carboniferous sandstone and shale, approximately 300-360 million years old. During this period, New Brunswick was a tropical swamp near the equator. It was warm and swampy and Dave would have hated it for different reasons.',
    // Sub-sedimentary
    'SECOND LAYER — Windsor Group evaporites: gypsum and halite (rock salt) deposited when an ancient inland sea repeatedly evaporated around 340 million years ago. The Maritimes have enormous gypsum deposits because of this. This is why Moncton\'s ground sounds hollow in places. Like a ticket booth floor.',
    // Transitional zone
    'TRANSITIONAL ZONE — A deformation zone visible as fractured, twisted rock. This marks the Appalachian Orogeny, a mountain-building event 300-400 million years ago when proto-Africa collided with proto-North America. The mountains that resulted were once Himalayan in scale. They have since been entirely worn flat. Time is humbling.',
    // Pink/purple metamorphic band
    'THE PINK-PURPLE BAND — This is Grenville Province metamorphic rock: pre-existing granite and sediment crushed and recrystallized under enormous pressure and heat during the Grenvillian Orogeny, approximately 1.0-1.3 billion years ago. The distinctive pink colour comes from feldspar minerals recrystallizing under extreme pressure. It is beautiful and it took a billion years.',
    // Canadian Shield proper
    'THE CANADIAN SHIELD — Technically you are now in it. The Shield is 3.8-4.3 billion years old in places: some of the oldest exposed rock on Earth. It comprises about 5.1 million km² of North America. It is the foundation. Everything else is on top of it, including Dave.',
    // Igneous basement
    'IGNEOUS BASEMENT ROCK — The grey-black layer at the very bottom is mainly granite gneiss and tonalite, Archean in age (2.5-4 billion years). It was once molten, slowly cooled deep underground, was pushed to the surface by tectonics over billions of years, and is now holding up a tourist attraction. It is doing its best.',
    // Crystal inclusions
    'MINERAL INCLUSIONS — If you look closely at the wall, you can see glittering points of mica, feldspar, and quartz. Mica cleaves into flat sheets and was historically used as window glass. Quartz is piezoelectric — squeeze it and it produces a tiny electric current. Everything in this wall is working very hard and no one notices.',
    // Fault line
    'FAULT LINE — That diagonal crack running through the lower strata is a thrust fault from the Acadian Orogeny (~360-420 million years ago). Older rocks were shoved up and over younger rocks by compressive forces. This seems wrong. Geologically it\'s completely normal. It feels personal.',
    // Fossils
    'FOSSIL ZONE — Moncton-area Carboniferous rocks contain trace fossils of ancient plant matter that became coal seams, and occasionally fossil trackways of early tetrapods — four-limbed vertebrates just learning to walk on land. The ancestors of Dave were figuring themselves out in mud nearby. Progress has been slow.',
    // Magnetic anomaly note
    'MAGNETIC ANOMALY — The Canadian Shield contains large deposits of iron-rich rock, magnetite, and other ferrous minerals. This produces measurable magnetic anomalies. Magnetic Hill\'s famous optical illusion (cars appear to roll uphill) is caused by the surrounding topography creating a false horizon. The magnet above us is NOT the reason for the illusion. The magnet is something else entirely.',
    // Rock age vs humans
    'PERSPECTIVE CHECK — The oldest rock in these walls formed 3.8 billion years ago. Homo sapiens have existed for roughly 300,000 years. The Van Horne Mansion is 140 years old. Dave has been awake for about 4 hours solving this murder. The rocks have absolutely no opinion about any of this.',
    // Isostatic rebound
    'ISOSTATIC REBOUND — After the last ice age (10,000-12,000 years ago), the massive glaciers covering New Brunswick melted. The land, which had been compressed by the weight of ice in some places over 3km thick, began to slowly bounce back. New Brunswick is still rising. Imperceptibly. But rising. Up. Dave relates to the slow return.',
    // Trap rock / dykes
    'DIABASE DYKES — Those narrow dark vertical bands cutting across the strata are diabase dykes: cracks where molten basaltic rock intruded from below during ancient rifting events. They\'re harder than the surrounding rock and weather as raised ridges in the landscape. They cut through everything. Time cannot stop them. Dave finds this relatable.',
    // Closing note
    'THE SIGN SAYS GEO STRATA. Someone has carved a geological education exhibit into billion-year-old rock beneath a roadside attraction. The Van Hornes were extraordinary people in ways I am only beginning to understand.',
];

function buildGeoStrata(bg) {
    return new Room({
        id: 'geo_strata', name: 'Geo Strata Room',
        background: bg,
        walkbox: [
            { x: 30, y: 500 }, { x: 930, y: 500 },
            { x: 870, y: 370 }, { x: 100, y: 370 },
        ],
        hotspots: [
            // Ladder back up
            {
                id: 'ladder_up', name: 'Ladder', x: 210, y: 55, w: 115, h: 465, walkToX: 265, walkToY: 450,
                onInteract(v, e) {
                    if (v === 'Climb' || v === 'Walk to' || v === 'Use') {
                        e.say('I climb back up through the trapdoor in the ticket booth floor. The booth is intact. The floor holds. It felt more dramatic on the way down.');
                        setTimeout(() => e.changeRoom('mag_entrance', 205, 460), 1600);
                    } else e.say('A wooden ladder leading up through the ceiling. There\'s a trapdoor up there, which explains how I got here.');
                }
            },
            // Stairs back up to the shack
            {
                id: 'stairs_up', name: 'Stairs Up', x: 860, y: 150, w: 100, h: 360, walkToX: 900, walkToY: 460,
                onInteract(v, e) {
                    if (v === 'Climb' || v === 'Walk to' || v === 'Use') {
                        e.say("I head back up the stone stairs to the shack entrance on the hill.");
                        setTimeout(() => e.changeRoom('magnetic_hill', 455, 470), 1600);
                    } else e.say("Dark stone stairs leading up to the surface. To the shack. To the reality above.");
                }
            },
            // GEO STRATA label / wall
            {
                id: 'strata_label', name: 'GEO STRATA', x: 300, y: 370, w: 375, h: 65, walkToX: 490, walkToY: 445,
                onInteract(v, e) { e.say('"GEO STRATA" is carved into the stone. Someone carved this sign into billion-year-old geological formations. The Van Hornes had no concept of boundaries.'); }
            },
            // DR. PELLERIN — geologist NPC, been here since 1987
            {
                id: 'dr_pellerin', name: 'Dr. Pellerin', x: 100, y: 295, w: 90, h: 190, walkToX: 175, walkToY: 450,
                onInteract(v, e) {
                    if (v === 'Talk to') {
                        const startBranch = () => {
                            e.enterDialog([
                                "Tell me about the STRATA!",
                                "How does weather affect this?",
                                "What about 'DEEP TIME'?",
                                "Tell me about the minerals!",
                                "Get bored and depart."
                            ], (idx) => {
                                if (idx === 0) {
                                    e.say("Dr. Pellerin: 'Oh! The STRATA! Look at these rhythmic successions! These are billions of years of story told in silicate and carbonate! Each layer is a fossilized mood of the planet!'");
                                    setTimeout(() => {
                                        e.enterDialog([
                                            "What are we looking at right here?",
                                            "Tell me about the Grenville Province!",
                                            "Is it all just rock?",
                                            "Get bored and depart."
                                        ], (idx2) => {
                                            if (idx2 === 0) {
                                                e.say("Dr. Pellerin: 'This! This is the Grenville Province! It's a high-grade metamorphic belt. We're talking granulite and amphibolite facies! It was cooked in the heart of a mountain range taller than the Himalayas!'");
                                                setTimeout(startBranch, 5000);
                                            } else if (idx2 === 1) {
                                                e.say("Dr. Pellerin: 'The Grenville Orogeny! A 1.1 billion year old collision of tectonic plates that assembled the supercontinent Rodinia! We are standing in the roots of an ancient world!'");
                                                setTimeout(startBranch, 5000);
                                            } else if (idx2 === 2) {
                                                e.say("Dr. Pellerin: 'JUST rock? Heavens, no! It's a chemistry set! Feldspar, mica, quartz—and look at that pink! That's Potassium Feldspar, lithified under immense pressure!'");
                                                setTimeout(startBranch, 5000);
                                            } else e.say("Dr. Pellerin: 'The rocks will still be here when you return, Dave!'");
                                        });
                                    }, 4000);
                                } else if (idx === 1) {
                                    e.say("Dr. Pellerin: 'Weathering! The great sculptor! Even down here, the rain from millions of years ago has left its CHEMICAL signature. Water is the universal solvent!'");
                                    setTimeout(() => {
                                        e.enterDialog([
                                            "Does it reach down here?",
                                            "What about Hydrothermal Alteration?",
                                            "Back to the main lecture.",
                                            "Get bored and depart."
                                        ], (idx3) => {
                                            if (idx3 === 0) {
                                                e.say("Dr. Pellerin: 'Hydrothermal alteration, Dave! Hot fluids circulating through cracks, depositing minerals! It's weather from the INSIDE! It's glorious!'");
                                                setTimeout(startBranch, 5000);
                                            } else if (idx3 === 1) {
                                                e.say("Dr. Pellerin: 'Fluids leaching ions from the host rock and reprecipitating them as new mineral phases! It's a subterranean alchemical process! Simply EXHILARATING!'");
                                                setTimeout(startBranch, 5000);
                                            } else if (idx3 === 2) startBranch();
                                            else e.say("Dr. Pellerin: 'Watch out for the erosion on your way out!'");
                                        });
                                    }, 4000);
                                } else if (idx === 2) {
                                    e.say("Dr. Pellerin: 'Deep Time is the only time that matters! We are standing on 3.8 BILLION years of history. To the Shield, a human life is just a single photon's transit!'");
                                    setTimeout(() => {
                                        e.enterDialog([
                                            "Does it make you feel small?",
                                            "How do you track it?",
                                            "Tell me about Isotopic Dating!",
                                            "Get bored and depart."
                                        ], (idx4) => {
                                            if (idx4 === 0) {
                                                e.say("Dr. Pellerin: 'Small? No! It makes me feel IMMENSE! I am the eyes through which the Shield finally gets to see itself! What a privilege!'");
                                                setTimeout(startBranch, 5000);
                                            } else if (idx4 === 1) {
                                                e.say("Dr. Pellerin: 'Isotopic dating! Uranium-Lead ratios in zircon crystals! They are the time-capsules of the planet! The precision is breathtaking!'");
                                                setTimeout(startBranch, 5000);
                                            } else if (idx4 === 2) {
                                                e.say("Dr. Pellerin: 'The decay of radioactive isotopes at a constant rate! We measure the daughter products to determine the crystallization age of the magma! It's the clock of the universe!'");
                                                setTimeout(startBranch, 5000);
                                            } else e.say("Dr. Pellerin: 'Billions of years wait for no man, Dave.'");
                                        });
                                    }, 4000);
                                } else if (idx === 3) {
                                    e.say("Dr. Pellerin: 'MINERALS! The alphabet of the Earth! Every crystal system is a geometric masterpiece!'");
                                    setTimeout(() => {
                                        e.enterDialog([
                                            "Tell me about Potassium Feldspar!",
                                            "What about the Mica?",
                                            "Back.",
                                            "Get bored and depart."
                                        ], (idx5) => {
                                            if (idx5 === 0) {
                                                e.say("Dr. Pellerin: 'Orthoclase! Monoclinic crystal habit! It provides the vibrant pink hue to the granitic intrusions. It's the blush of the Precambrian!'");
                                                setTimeout(startBranch, 5000);
                                            } else if (idx5 === 1) {
                                                e.say("Dr. Pellerin: 'Phyllosilicates! Perfect basal cleavage! You can peel the history of the world apart like the pages of a book!'");
                                                setTimeout(startBranch, 5000);
                                            } else if (idx5 === 2) startBranch();
                                            else e.say("Dr. Pellerin: 'Enjoy your walk on the surface, Dave!'");
                                        });
                                    }, 4000);
                                } else {
                                    e.say("Dr. Pellerin: 'Keep looking at the rocks, Dave! They have so much to tell us!'");
                                }
                            });
                        };
                        startBranch();
                    } else if (v === 'Look at') {
                        e.say("She's practically vibrating with scientific excitement. Her lab coat is stained with various mineral dusts, and she looks like she hasn't slept in a geological era.");
                    } else {
                        e.say("She looks busy with her strata. Best not to disturb the geological peace.");
                    }
                }
            },

            // Rock layers on walls
            {
                id: 'rock_layers', name: 'Rock Layers', x: 0, y: 250, w: 960, h: 175, walkToX: 480, walkToY: 430,
                onInteract(v, e) {
                    const s = e.getRoomState('geo_strata');
                    s.geoRead = (s.geoRead || 0) + 1;
                    e.say(GEO_FACTS[(s.geoRead - 1) % GEO_FACTS.length]);
                }
            },
            // THE CANADIAN SHIELD — literal shield with maple leaf, embedded in rock
            {
                id: 'canadian_shield', name: 'Canadian Shield', x: 540, y: 290, w: 120, h: 120, walkToX: 580, walkToY: 420,
                onInteract(v, e) {
                    if (v === 'Pick up') {
                        if (e.hasItem('canadian_shield')) { e.say('I already have the Canadian Shield. One is sufficient.'); return; }
                        e.addItem('canadian_shield', 'Canadian Shield');
                        e.say('I pry the Canadian Shield out of the Precambrian rock. It is a literal shield. It has a maple leaf on it. It is made of Canadian Shield rock. The recursion is dizzying.');
                    } else {
                        e.say('A shield-shaped object embedded in the rock wall. It has a maple leaf engraved on it. It IS the Canadian Shield. It is also a shield. These are the same thing. I need to sit down.');
                    }
                }
            },
            // Candles on wall
            {
                id: 'candles', name: 'Candles', x: 175, y: 310, w: 60, h: 90, walkToX: 210, walkToY: 420,
                onInteract(v, e) { e.say('Wall candles. Underground. Someone has been maintaining them. Either the Van Hornes or something that does not need air. I prefer the Van Horne explanation.'); }
            },
            {
                id: 'candles2', name: 'Candles', x: 430, y: 295, w: 60, h: 90, walkToX: 460, walkToY: 420,
                onInteract(v, e) { e.say('More candles. This room is quite well lit for a geological formation that no one is supposed to know about.'); }
            },
            {
                id: 'candles3', name: 'Candles', x: 680, y: 295, w: 60, h: 90, walkToX: 710, walkToY: 420,
                onInteract(v, e) { e.say('Third set of candles. Someone is paying a lot for candles down here. I respect the commitment.'); }
            },
            // Mining tools
            {
                id: 'pickaxe', name: 'Pickaxe', x: 100, y: 400, w: 140, h: 120, walkToX: 175, walkToY: 450,
                onInteract(v, e) {
                    if (v === 'Pick up') e.say('I try to pick up a pickaxe. It is heavy and also clearly used regularly. I put it back before someone who uses it regularly notices.');
                    else e.say('Pickaxes in a geological strata room. Either someone works here or this is the best-themed breakroom in Moncton.');
                }
            },
            {
                id: 'shovel', name: 'Shovel', x: 665, y: 390, w: 90, h: 120, walkToX: 710, walkToY: 450,
                onInteract(v, e) { e.say('A shovel. Dirt on the blade. Recent. I don\'t think about this too hard.'); }
            },
            {
                id: 'hammer_geo', name: 'Geological Hammer', x: 780, y: 410, w: 130, h: 100, walkToX: 840, walkToY: 455,
                onInteract(v, e) {
                    if (v === 'Pick up') { 
                        if (e.hasItem('geo_hammer')) e.say("I already have the geo hammer.");
                        else { e.addItem('geo_hammer', 'Geological Hammer'); e.say('I pick up the geological hammer. For science. And also self-defense if the candle-lighter meets me down here.'); }
                    } else e.say('A geological hammer, for breaking rock samples. Standard field equipment. In a strange underground room under a haunted attraction. Sure.');
                }
            },
            // Eyes in corners
            {
                id: 'corner_eyes', name: 'Eyes', x: 0, y: 230, w: 95, h: 200,
                onInteract(v, e) { e.say('Eyes in the dark edges of the underground room. They were here before the candles. They were here before the rock. They have opinions about me.'); }
            },
        ]
    });
}

// ── MAGNETIC HILL (the actual hill + magnet) ─────────────────────────────────
// Turning off the magnet = GAME OVER (Tourism Failure).
function buildMagneticHill(bg) {
    return new Room({
        id: 'magnetic_hill', name: 'Magnetic Hill',
        background: bg,
        walkbox: [
            { x: 30, y: 510 }, { x: 930, y: 510 },
            { x: 820, y: 380 }, { x: 130, y: 380 },
        ],
        hotspots: [
            // Back to entrance
            {
                id: 'to_entrance', name: 'Path Back', x: 0, y: 380, w: 110, h: 160,
                onInteract(v, e) {
                    if (v === 'Walk to' || v === 'Use') e.changeRoom('mag_entrance', 600, 460);
                    else e.say('The path back down. To the ticket booth. To the road. To my normal life. If such a thing still exists.');
                }
            },
            // The horseshoe magnet monument
            {
                id: 'magnet', name: 'Magnetic Hill Magnet', x: 255, y: 30, w: 450, h: 330, walkToX: 480, walkToY: 440,
                onInteract(v, e) {
                    const s = e.getRoomState('magnetic_hill');
                    s.magnetLooks = (s.magnetLooks || 0) + 1;
                    if (s.magnetLooks === 1) e.say('A GIANT HORSESHOE MAGNET on a hill. The attraction is called Magnetic Hill, and there is, on the hill, a magnet. The Van Hornes were nothing if not literal.');
                    else if (s.magnetLooks === 2) e.say('The magnet has text on it: it says MECO on both sides. I do not know what this means. No one here can tell me. Absolutely no one.');
                    else e.say('I stare at the magnet. The magnet does not stare back. It just pulls on everything metal within a 40-meter radius. My keys are pointing north. North is the magnet.');
                }
            },
            // Magnet — use remote control to turn it off (game over)
            {
                id: 'magnet_switch', name: 'Magnet Switch', x: 400, y: 350, w: 160, h: 90, walkToX: 480, walkToY: 430,
                onInteract(v, e) {
                    if (v === 'Use' || v === 'Push' || v === 'Pull') {
                        e.say('The switch is sealed inside a protective housing labelled AUTHORIZED ACCESS ONLY. There is a receiver slot. It looks like it needs a remote signal. A very specific remote signal.');
                    } else {
                        e.say('A protected switch on the stone base of the magnet. The housing says ON. The warning label says TURNING OFF WILL END MONCTON TOURISM. The font is very large.');
                    }
                }
            },
            // Remote receiver on magnet — use remote_control here for game over
            {
                id: 'magnet_receiver', name: 'Remote Receiver', x: 290, y: 310, w: 90, h: 60, walkToX: 400, walkToY: 450,
                onInteract(v, e) {
                    if (v === 'Use') {
                        if (!e.hasItem('remote_control') && !e.hasItem('battery')) {
                            e.say('A small IR receiver on the side of the magnet housing. It wants a remote signal. I have neither a remote nor any idea what powers it.');
                        } else if (!e.hasItem('remote_control')) {
                            e.say('I can sense this receiver wants a remote signal. I do not have the remote. I have the enormous battery though, which was extremely heavy to carry all the way here.');
                        } else if (!e.hasItem('battery')) {
                            e.say('I point the remote at the receiver. Nothing. I shake it. The battery compartment rattles. It is empty. This remote needs a battery. A very specific battery. An enormous one.');

                        } else {
                            e.say('I point the remote at the receiver. The red MAGNET button blinks. I press it. There is a long pause. A deep THUNK. The humming stops. My keys fall. In the distance, a thousand tourism brochures become inaccurate.');
                            setTimeout(() => {
                                const cv = document.getElementById('game');
                                const ctx = cv.getContext('2d');
                                ctx.fillStyle = 'rgba(0,0,0,0.9)';
                                ctx.fillRect(0, 0, cv.width, cv.height);
                                ctx.fillStyle = '#ff3333';
                                ctx.font = 'bold 60px monospace';
                                ctx.textAlign = 'center';
                                ctx.fillText('GAME OVER', cv.width / 2, cv.height / 2 - 55);
                                ctx.fillStyle = '#ffcc00';
                                ctx.font = '30px monospace';
                                ctx.fillText('TOURISM FAILURE', cv.width / 2, cv.height / 2 + 5);
                                ctx.fillStyle = '#ffffff';
                                ctx.font = '17px monospace';
                                ctx.fillText('You turned off Magnetic Hill.', cv.width / 2, cv.height / 2 + 48);
                                ctx.fillText('With a TV remote. From a pawn shop.', cv.width / 2, cv.height / 2 + 72);
                                ctx.fillText('Moncton will not recover from this.', cv.width / 2, cv.height / 2 + 96);
                                ctx.fillStyle = '#888888';
                                ctx.font = '13px monospace';
                                ctx.fillText('F5 to try again. (Just… leave it on next time.)', cv.width / 2, cv.height / 2 + 135);
                            }, 2800);
                        }
                    } else e.say('A small receiver unit on the magnet housing. It wants a remote signal. Specifically.');
                }
            },
            // Shack entrance in hillside
            {
                id: 'shack_entrance', name: 'Shack Entrance', x: 385, y: 380, w: 155, h: 175, walkToX: 455, walkToY: 470,
                onInteract(v, e) {
                    if (v === 'Open' || v === 'Walk to' || v === 'Use') {
                        e.say('The shack door leads to a set of stairs going down. I\'ve already fallen through a floor tonight. Stairs are practically a luxury.');
                        setTimeout(() => e.changeRoom('geo_strata', 800, 430), 1600);
                    } else e.say('A small, sturdy shack embedded in the hillside below the magnet. Leading underground. Obviously.');
                }
            },
            // Geological strata layers visible in hill
            {
                id: 'hill_strata', name: 'Rock Layers', x: 130, y: 330, w: 700, h: 200, walkToX: 480, walkToY: 440,
                onInteract(v, e) { e.say('The hill itself shows the geological strata — the same layers as the room underground. The Canadian Shield is very much present here. Not just the literal shield. The real one.'); }
            },
            // Parking lot / cars visible on left
            {
                id: 'parking', name: 'Parking Lot', x: 0, y: 345, w: 145, h: 185,
                onInteract(v, e) { e.say('Cars in the parking lot. I see the same two cars as before. They were here before me. Their owners remain unknown. I\'m adding this to my list of things I\'m not thinking about.'); }
            },
            // Eyes in the woods (everywhere)
            {
                id: 'mag_eyes', name: 'Eyes', x: 700, y: 200, w: 260, h: 250,
                onInteract(v, e) { e.say('Eyes in the dark trees surrounding the hill. There are more of them up here. They all face the magnet. They\'ve always faced the magnet. They chose to be here.'); }
            },
        ]
    });
}

// Helper for picking up red herrings
function pickUpHerring(v, e, id) {
    if (v === 'Pick up' || v === 'Use') {
        if (e.hasItem(id)) { e.say("I already have a red herring. Maybe more are better?"); return; }
        e.addItem(id, 'Red Herring');
        const lines = [
            "A literal red herring. Of course.",
            "I pick up the red herring. It is, in fact, red. And a herring.",
            "Red herring acquired. I have a feeling this won't help me at all. That's kind of the point.",
        ];
        e.say(lines[Math.floor(Math.random() * lines.length)]);
    } else {
        e.say("It's a red herring on a plate. Literally. This room is deeply on-the-nose.");
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// BOOTSTRAP
// ══════════════════════════════════════════════════════════════════════════════
async function main() {
    const engine = new Engine('game');
    engine.debug = false; // set true to see walkboxes

    // Load all backgrounds (null-safe — gradient fallback used if file missing)
    const assets = await Promise.all([
            loadImage('assets/bedroom_bg.png'),
            loadImage('assets/kitchen_bg.jpg'),
            loadImage('assets/street_bg.jpg'),
            loadImage('assets/alley_bg.jpg'),
            loadImage('assets/secret_bg.jpg'),
            loadImage('assets/gate_bg.jpg'),
            loadImage('assets/pawn_bg.jpg'),
            loadImage('assets/courtyard_bg.jpg'),
            loadImage('assets/foyer_bg.jpg'),
            loadImage('assets/library_bg.jpg'),
            loadImage('assets/backyard_bg.jpg'),
            loadImage('assets/police_ext_bg.jpg'),
            loadImage('assets/police_int_bg.jpg'),
            loadImage('assets/mag_entrance_bg.jpg'),
            loadImage('assets/geo_strata_bg.jpg'),
            loadImage('assets/magnetic_hill_bg.jpg'),
            loadImage('assets/herring_club_bg.png'),
            loadImage('Dave3.png'),
            // NPC sprite sheets
            loadImage('npc_baker_.png'),
            loadImage('npc_poutine_guy.png'),
            loadImage('npc_bouncer.png'),
            loadImage('npc_pawnbroker.png'),
            loadImage('npc_officer.png'),
            loadImage('assets/cat.png'),
            loadImage('npc_woman_scientist .png'),
            loadImage('npc_weather_scientist.png'),
            loadImage('npc_raccoon.png'),
            loadImage('trapdoor_patch_bedroom_1773407490032.png'),
            loadImage('rug_rolled_up_pixel_art_1773411308683.png'),
            loadImage('cold_pizza_slice_pixel_art_icon_1773411325046.png')
        ]);

    const [bedroomBg, kitchenBg, streetBg, alleyBg, secretBg, gateBg, pawnBg,
        courtyardBg, foyerBg, libraryBg, backyardBg, policeExtBg, policeIntBg,
        magEntranceBg, geoStrataBg, magHillBg, herringClubBg, daveSheet,
        npcBaker, npcPoutine, npcDoorman, npcPawnbroker, npcSavoie,
        npcCat, npcPellerin, npcWeatherSheet, npcRaccoon, trapdoorImg, rugRolledImg, pizzaImg] = assets;

    // Preload item images for props and inventory
    const itemIcons = {};
    const itemsToLoad = [
        'spoon', 'bent_knife', 'camera', 'radio', 'binoculars', 'cell_phone', 
        'cash_card', 'house_key', 'battery', 'cheese', 'rotten_egg', 'poutine', 
        'battle_bread', 'mansion_key', 'remote_control', 'red_herring', 
        'canadian_shield', 'geo_hammer', 'oos_sign', 'main_route_closed', 'pizza',
        'club_key', 'red_herring_key', 'fishy_token'
    ];
    await Promise.all(itemsToLoad.map(async id => {
        itemIcons[id] = await loadImage(`assets/item_${id}.png`);
    }));

    // Herrings all use the same icon
    ['herring_L1', 'herring_L2', 'herring_R1', 'herring_R2'].forEach(id => {
        itemIcons[id] = itemIcons['red_herring'];
    });

    // Map pizza specifically
    itemIcons['pizza'] = pizzaImg;

    // ── Register all 16 rooms + attach NPC actors ────────────────────────────
    const bedroom = buildBedroom(bedroomBg);
    bedroom.props.push({
        id: 'trapdoor_prop', image: trapdoorImg, x: 310, y: 340, w: 210, h: 100,
        isVisible(e) { return !!e.getRoomState('bedroom').carpetMoved; }
    });
    bedroom.props.push({
        id: 'rug_rolled_prop', image: rugRolledImg, x: 550, y: 320, w: 100, h: 120,
        isVisible(e) { return !!e.getRoomState('bedroom').carpetMoved; }
    });
    bedroom.props.push({
        id: 'phone_prop', image: itemIcons['cell_phone'], x: 620, y: 310, w: 40, h: 40,
        isVisible(e) { return !e.hasItem('cell_phone'); }
    });
    engine.registerRoom(bedroom);

    const kitchen = buildKitchen(kitchenBg);
    kitchen.props.push({
        id: 'battery_prop', image: itemIcons['battery'], x: 595, y: 150, w: 40, h: 60,
        isVisible(e) { return !!e.getRoomState('kitchen').fridgeOpen && !e.hasItem('battery'); }
    });
    kitchen.props.push({
        id: 'cheese_prop', image: itemIcons['cheese'], x: 640, y: 200, w: 40, h: 40,
        isVisible(e) { return !!e.getRoomState('kitchen').fridgeOpen && !e.hasItem('cheese'); }
    });
    kitchen.props.push({
        id: 'egg_prop', image: itemIcons['rotten_egg'], x: 600, y: 270, w: 40, h: 30,
        isVisible(e) { return !!e.getRoomState('kitchen').fridgeOpen && !e.hasItem('rotten_egg'); }
    });
    kitchen.props.push({
        id: 'key_prop', image: itemIcons['house_key'], x: 640, y: 330, w: 30, h: 30,
        isVisible(e) { return !!e.getRoomState('kitchen').fridgeOpen && !e.hasItem('house_key'); }
    });
     kitchen.props.push({
        id: 'pizza_prop', image: itemIcons['pizza'], x: 380, y: 340, w: 40, h: 30,
        isVisible(e) { return !e.hasItem('pizza'); }
    });
    engine.registerRoom(kitchen);

    { // Street — baker + poutine guy
        const r = buildStreet(streetBg);
        buildNPCActor({ room: r, id: 'baker_npc', name: 'Baker', x: 388, y: 460, sheet: npcBaker, color: '#ff5555' });
        buildNPCActor({ room: r, id: 'poutine_npc', name: 'Poutine Guy', x: 553, y: 455, sheet: npcPoutine, color: '#ffff55' });
        r.props.push({ id: 'p_poutine', image: itemIcons['poutine'], x: 520, y: 400, w: 60, h: 60, isVisible(e) { return !e.hasItem('poutine'); } });
        engine.registerRoom(r);
    }
    { // Alley — club doorman
        const r = buildAlley(alleyBg);
        buildNPCActor({ room: r, id: 'doorman_npc', name: 'Doorman', x: 655, y: 455, sheet: npcDoorman, color: '#55ffff' });
        engine.registerRoom(r);
    }
    { // Herring Club — weather scientist
        const r = buildHerringClub(herringClubBg);
        buildNPCActor({ room: r, id: 'weather_npc', name: 'Weather Scientist', x: 480, y: 460, sheet: npcWeatherSheet, color: '#ffff55' });
        engine.registerRoom(r);
    }
    const secret = buildSecretRoom(secretBg);
    secret.props.push({ id: 'p_herring_L1', image: itemIcons['red_herring'], x: 70, y: 215, w: 50, h: 30, isVisible(e) { return !e.hasItem('herring_L1'); } });
    secret.props.push({ id: 'p_herring_L2', image: itemIcons['red_herring'], x: 70, y: 340, w: 50, h: 30, isVisible(e) { return !e.hasItem('herring_L2'); } });
    secret.props.push({ id: 'p_herring_R1', image: itemIcons['red_herring'], x: 840, y: 215, w: 50, h: 30, isVisible(e) { return !e.hasItem('herring_R1'); } });
    secret.props.push({ id: 'p_herring_R2', image: itemIcons['red_herring'], x: 840, y: 340, w: 50, h: 30, isVisible(e) { return !e.hasItem('herring_R2'); } });
    engine.registerRoom(secret);
    
    engine.registerRoom(buildGateArea(gateBg));

    { // Pawn shop — pawnbroker
        const r = buildPawnShop(pawnBg);
        buildNPCActor({ room: r, id: 'pawnbroker_npc', name: 'Pawnbroker', x: 720, y: 420, sheet: npcPawnbroker, color: '#00ffff' });
        
        // Add item props to shelves
        r.props.push({ id: 'p_camera', image: itemIcons['camera'], x: 230, y: 200, w: 50, h: 50, isVisible(e) { return !e.hasItem('camera'); } });
        r.props.push({ id: 'p_radio', image: itemIcons['radio'], x: 340, y: 200, w: 60, h: 50, isVisible(e) { return !e.hasItem('radio'); } });
        r.props.push({ id: 'p_binoculars', image: itemIcons['binoculars'], x: 465, y: 195, w: 60, h: 50, isVisible(e) { return !e.hasItem('binoculars'); } });
        r.props.push({ id: 'p_knife', image: itemIcons['bent_knife'], x: 435, y: 185, w: 60, h: 50, isVisible(e) { return !e.hasItem('bent_knife'); } });
        r.props.push({ id: 'p_spoon', image: itemIcons['spoon'], x: 645, y: 375, w: 50, h: 50, isVisible(e) { return !e.hasItem('spoon'); } });
        r.props.push({ id: 'p_mansion_key', image: itemIcons['mansion_key'], x: 705, y: 360, w: 50, h: 50, isVisible(e) { return !e.hasItem('mansion_key'); } });
        r.props.push({ id: 'p_remote', image: itemIcons['remote_control'], x: 385, y: 235, w: 50, h: 40, isVisible(e) { return !e.hasItem('remote_control'); } });
        r.props.push({ id: 'p_bread', image: itemIcons['battle_bread'], x: 185, y: 230, w: 70, h: 50, isVisible(e) { return !e.hasItem('battle_bread'); } });
        
        engine.registerRoom(r);
    }
    { // Mansion courtyard — raccoon family in garden
        const r = buildMansionCourtyard(courtyardBg);
        buildNPCActor({ room: r, id: 'raccoon_npc', name: 'Raccoon', x: 210, y: 455, sheet: npcRaccoon, color: '#aaaaaa' });
        engine.registerRoom(r);
    }
    { // Mansion foyer — cat on a pedestal
        const r = buildMansionFoyer(foyerBg);
        buildNPCActor({ room: r, id: 'cat_npc', name: 'Cat', x: 760, y: 455, sheet: npcCat, color: '#ffffff', scale: 0.15 });
        engine.registerRoom(r);
    }
    { // Mansion library — cat reappears upstairs (same sheet)
        const r = buildMansionLibrary(libraryBg);
        buildNPCActor({ room: r, id: 'cat_npc', name: 'Cat', x: 820, y: 440, sheet: npcCat, color: '#ffffff', scale: 0.15 });
        engine.registerRoom(r);
    }
    engine.registerRoom(buildMansionBackyard(backyardBg));
    engine.registerRoom(buildPoliceExt(policeExtBg));

    { // Police station interior — Officer Savoie at desk
        const r = buildPoliceInt(policeIntBg);
        buildNPCActor({ room: r, id: 'savoie_npc', name: 'Savoie', x: 545, y: 420, sheet: npcSavoie, color: '#5555ff' });
        engine.registerRoom(r);
    }
    { // Mag entrance — signage props
        const r = buildMagEntrance(magEntranceBg);
        r.props.push({ id: 'p_oos_sign', image: itemIcons['oos_sign'], x: 200, y: 220, w: 60, h: 40, isVisible(e) { return !e.hasItem('oos_sign'); } });
        r.props.push({ id: 'p_closed_sign', image: itemIcons['main_route_closed'], x: 500, y: 400, w: 80, h: 60, isVisible(e) { return !e.hasItem('main_route_closed'); } });
        engine.registerRoom(r);
    }

    { // Geo strata — Dr. Pellerin (been here since 1987)
        const r = buildGeoStrata(geoStrataBg);
        buildNPCActor({ room: r, id: 'pellerin_npc', name: 'Dr. Pellerin', x: 175, y: 450, sheet: npcPellerin, color: '#ffcc00' });
        
        // Add geological items
        r.props.push({ id: 'p_shield', image: itemIcons['canadian_shield'], x: 540, y: 290, w: 120, h: 120, isVisible(e) { return !e.hasItem('canadian_shield'); } });
        r.props.push({ id: 'p_hammer', image: itemIcons['geo_hammer'], x: 780, y: 410, w: 130, h: 100, isVisible(e) { return !e.hasItem('geo_hammer'); } });
        
        engine.registerRoom(r);
    }
    engine.registerRoom(buildMagneticHill(magHillBg));
    console.log('[Rooms] 16 rooms registered, NPCs attached.');


    // Dave
    const sheetImg = daveSheet ?? buildProceduralDave();
    const useRealSheet = !!daveSheet;
    const animator = new SpriteAnimator(
        sheetImg,
        useRealSheet ? FRAME_W : 48,
        useRealSheet ? FRAME_H : 64,
        useRealSheet ? DAVE_ANIMS : {
            idle: { row: 3, count: 1, fps: 3 },
            walkR: { row: 0, count: 6, fps: 8 },
            walkL: { row: 0, count: 6, fps: 8, flipH: true },
        },
        'auto' // Enable auto-transparency for Dave3.png
    );
    animator.scale = 0.55; // Scale Dave down to fit room
    animator.play('idle');

    const dave = new Actor({ id: 'dave', name: 'Dave', x: 480, y: 450, animator });
    engine.setPlayer(dave);

    // Start in bedroom
    engine.changeRoom('bedroom', 480, 450);
    engine.start();

    // Console helpers
    window._engine = engine;
    window._goto = (id, x = 480, y = 450) => engine.changeRoom(id, x, y);
    console.log("Dave's adventure started. window._goto('kitchen') to warp.");
}

main();
