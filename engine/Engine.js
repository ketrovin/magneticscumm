/**
 * Engine — main game loop, canvas, room/actor management, room transitions.
 */

class Engine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;

        this.rooms = {};    // id → Room
        this.room = null;  // current Room
        this.actors = [];    // actors in current room
        this.player = null;  // player Actor

        // Global state shared across rooms
        this.gameState = {
            inventory: [],          // item ids collected
            roomStates: {},         // per-room state: { roomId: { key: value } }
            dialogLine: null,       // current one-liner text
            dialogSpeaker: null,    // the Actor who is speaking
            dialogTimer: 0,
            activeDialogChoices: null, // [string] or null
            onChoiceCallback: null,
        };

        this.quips = {
            'Look at': ["It's just a {T}.", "I've seen better {T}s.", "Not much to say about this {T}.", "Standard issue {T}."],
            'Pick up': ["I can't carry a {T}!", "It's bolted down.", "My pockets aren't that big.", "I don't think that's portable."],
            'Talk to': ["It doesn't seem to want to talk to me.", "I'm talking to a {T}. I need a vacation.", "No response.", "It's giving me the silent treatment."],
            'Use': ["Use it how? I'm not a magician.", "I can't figure out how to use it.", "That doesn't seem to do anything."],
            'Push': ["It won't budge.", "It's heavier than it looks.", "I'm not strong enough to move that."],
            'Pull': ["It's stuck.", "I'm pulling, but nothing's happening.", "It seems firmly attached."],
            'Nothing': ["Nothing there.", "I'm staring at the scenery.", "Just empty space.", "Yep, that's part of the background."],
            'Default': ["I can't do that.", "No.", "Doesn't work.", "Maybe later."],
            'Item': ["Using {I} on {T}... nope.", "That doesn't fit.", "I don't think {I} works with {T}.", "Unlikely."]
        };

        this.ui = new ScummUI(this.canvas.width, this.canvas.height);
        this.input = new InputManager(this.canvas);
        this._lastTime = null;
        this._rafId = null;
        this.debug = false;

        this._wireInput();
    }

    // ── Room registry ──────────────────────────────────────────────────────
    registerRoom(room) {
        this.rooms[room.id] = room;
    }

    /** Switch to a different room, placing player at (entryX, entryY) */
    changeRoom(roomId, entryX, entryY) {
        if (!this.rooms[roomId]) {
            console.warn(`Room "${roomId}" not registered`);
            return;
        }
        this.room = this.rooms[roomId];
        this.actors = [];
        if (this.player) {
            this.player.x = entryX;
            this.player.y = entryY;
            this.player.stopWalking();
            this.actors.push(this.player);
        }
        // Re-add static NPC actors stored on the room
        if (this.room.npcs && this.room.npcs.length) {
            this.actors.push(...this.room.npcs);
        }
        console.log(`[Engine] → ${roomId}`);
    }

    loadRoom(room) {
        this.registerRoom(room);
        this.room = room;
    }

    // ── Actors ─────────────────────────────────────────────────────────────
    addActor(actor) { this.actors.push(actor); }
    setPlayer(actor) {
        this.player = actor;
        if (!this.actors.includes(actor)) this.actors.push(actor);
    }

    // ── Inventory helpers ──────────────────────────────────────────────────
    hasItem(id) { return this.gameState.inventory.includes(id); }
    addItem(id, displayName) {
        if (!this.hasItem(id)) {
            this.gameState.inventory.push(id);
            this.ui.inventory.push({ id, name: displayName ?? id });
            
            // Preload the item image if not already loaded
            if (!this.ui.loadedItemImages) this.ui.loadedItemImages = {};
            if (!this.ui.loadedItemImages[id]) {
                const img = new Image();
                img.src = `assets/item_${id}.png`;
                this.ui.loadedItemImages[id] = img;
            }
        }
    }
    removeItem(id) {
        const i = this.gameState.inventory.indexOf(id);
        if (i >= 0) {
            this.gameState.inventory.splice(i, 1);
            this.ui.inventory.splice(i, 1);
        }
    }

    say(text, duration = 3500, speaker = null) {
        // Clear any previous dialogue immediately when a new one starts
        if (this.gameState.dialogTimer > 3500) this.gameState.dialogTimer = 3500; 

        let actualText = text;
        let actualSpeaker = speaker;

        // Smart speaker detection: if text starts with "Name: ", try to find that actor
        if (!actualSpeaker) {
            const colonIndex = text.indexOf(':');
            if (colonIndex > 0 && colonIndex < 20) { // arbitrary limit to avoid catching long sentences
                const possibleName = text.substring(0, colonIndex).trim();
                // Find actor by name (case-insensitive)
                const found = this.actors.find(a => a.name.toLowerCase() === possibleName.toLowerCase());
                if (found) {
                    actualSpeaker = found;
                    // Strip the "Name: " and any surrounding quotes
                    actualText = text.substring(colonIndex + 1).trim();
                    if ((actualText.startsWith('"') && actualText.endsWith('"')) || 
                        (actualText.startsWith("'") && actualText.endsWith("'"))) {
                        actualText = actualText.substring(1, actualText.length - 1);
                    }
                }
            }
        }

        this.gameState.dialogLine = actualText;
        this.gameState.dialogTimer = duration;
        this.gameState.dialogSpeaker = actualSpeaker || this.player;
    }

    enterDialog(choices, callback) {
        this.gameState.activeDialogChoices = choices;
        this.gameState.onChoiceCallback = callback;
        this.ui.selectedVerb = null; // Hide the active verb pointer
    }

    onChoiceClick(index) {
        const callback = this.gameState.onChoiceCallback;
        const choice = this.gameState.activeDialogChoices[index];
        this.gameState.activeDialogChoices = null;
        this.gameState.onChoiceCallback = null;
        this.ui.selectedVerb = 'Walk to'; // Reset verb
        if (callback) callback(index, choice);
    }

    // ── Room state helpers ─────────────────────────────────────────────────
    getRoomState(roomId) {
        if (!this.gameState.roomStates[roomId])
            this.gameState.roomStates[roomId] = {};
        return this.gameState.roomStates[roomId];
    }

    // ── Input wiring ───────────────────────────────────────────────────────
    _wireInput() {
        this.input.onMouseMove((mx, my) => {
            this.ui.onMouseMove(mx, my);
            if (this.room && !this.ui.isInPanel(mx, my)) {
                this.ui.hoveredHotspot = this.room.getHotspotAt(mx, my, this);
            } else {
                this.ui.hoveredHotspot = null;
            }
        });

        this.input.onClick((mx, my) => {
            const verbClicked = this.ui.onClick(mx, my);
            if (verbClicked) return;
            if (!this.room) return;

            const hotspot = this.room.getHotspotAt(mx, my, this);
            if (hotspot) {
                // Walk Dave toward hotspot centre first, then interact
                if (this.player) {
                    const tx = hotspot.walkToX ?? (hotspot.x + hotspot.w / 2);
                    const ty = hotspot.walkToY ?? Math.min(hotspot.y + hotspot.h, 450);
                    const clamped = this.room.clampToWalkbox(tx, ty);
                    this.player.walkTo(clamped.x, clamped.y);
                    // Queue interaction after walk (simple: slight delay)
                    this.player._pendingInteract = () => this._onHotspotInteract(hotspot);
                } else {
                    this._onHotspotInteract(hotspot);
                }
            } else if (this.ui.selectedVerb === 'Walk to') {
                const clamped = this.room.clampToWalkbox(mx, my);
                if (this.player) this.player.walkTo(clamped.x, clamped.y);
            } else if (!this.ui.isInPanel(mx, my)) {
                // Clicked on background (no hotspot)
                if (this.ui.selectedVerb !== 'Walk to') {
                    this.triggerQuip('Nothing');
                }
            }
        });
    }

    triggerQuip(type, targetName = '', itemName = '') {
        const list = this.quips[type] || this.quips['Default'];
        let text = list[Math.floor(Math.random() * list.length)];
        text = text.replace('{T}', targetName || 'thing');
        text = text.replace('{I}', itemName || 'item');
        this.say(text);
    }

    _onHotspotInteract(hotspot) {
        const verb = this.ui.selectedVerb;
        const item = this.ui.selectedInventoryItem;
        
        // Track if say was called during interaction
        let saidSomething = false;
        const originalSay = this.say;
        this.say = (text, dur, speaker) => {
            saidSomething = true;
            originalSay.call(this, text, dur, speaker);
        };

        if (typeof hotspot.onInteract === 'function') {
            hotspot.onInteract(verb, this, item);
        }

        this.say = originalSay;

        // Fallback if the interaction didn't trigger any dialogue
        if (!saidSomething && verb !== 'Walk to') {
            if (item) {
                this.triggerQuip('Item', hotspot.name, (typeof item === 'string' ? item : item.name));
            } else {
                this.triggerQuip(verb, hotspot.name);
            }
        }
    }

    // ── Main loop ──────────────────────────────────────────────────────────
    start() {
        this._lastTime = performance.now();
        const loop = (now) => {
            this._rafId = requestAnimationFrame(loop);
            const dt = Math.min(now - this._lastTime, 100);
            this._lastTime = now;
            this._update(dt);
            this._render();
        };
        this._rafId = requestAnimationFrame(loop);
    }

    stop() { if (this._rafId) cancelAnimationFrame(this._rafId); }

    _update(dt) {
        // Dialog timer
        if (this.gameState.dialogTimer > 0) {
            this.gameState.dialogTimer -= dt;
            if (this.gameState.dialogTimer <= 0) {
                this.gameState.dialogLine = null;
                this.gameState.dialogSpeaker = null;
            }
        }

        for (const actor of this.actors) {
            const wasWalking = actor.state === 'walking';
            actor.update(dt, this.room);
            // Fire queued interaction when actor finishes walking
            if (wasWalking && actor.state === 'idle' && actor._pendingInteract) {
                const fn = actor._pendingInteract;
                actor._pendingInteract = null;
                fn();
            }
        }
    }

    _render() {
        const { ctx, canvas } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. Room fills entire scene area above UI panel
        if (this.room) {
            this.room.draw(ctx, this);
            if (this.debug) this.room.drawDebugWalkbox(ctx);
        }

        // 2. Actors sorted by Y (depth)
        [...this.actors].sort((a, b) => a.y - b.y).forEach(a => a.draw(ctx));

        // 3. Dialogue speech (above speaker's head)
        if (this.gameState.dialogLine) {
            this._drawDialog(ctx, this.gameState.dialogLine, this.gameState.dialogSpeaker);
        }

        // 4. UI panel
        this.ui.draw(ctx);
    }

    _drawDialog(ctx, text, speaker) {
        const actor = speaker || this.player;
        const x = actor ? actor.x : this.canvas.width / 2;
        const h = actor ? (actor.animator.defaultFrameH * actor.animator.scale) : 60;
        const y = actor ? (actor.y - h - 10) : 80;

        ctx.save();
        ctx.font = 'bold 18px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        
        const words = text.split(' ');
        const lines = [];
        let line = '';
        const maxW = 350;

        for (const word of words) {
            const test = line ? `${line} ${word}` : word;
            if (ctx.measureText(test).width > maxW && line) {
                lines.push(line);
                line = word;
            } else {
                line = test;
            }
        }
        if (line) lines.push(line);

        const lh = 22;
        const startY = y - (lines.length * lh);

        lines.forEach((l, i) => {
            const ly = startY + i * lh;
            
            // Text Shadow
            ctx.fillStyle = '#000000';
            ctx.fillText(l, x + 2, ly + 2);
            
            // Main Text Color (from actor or white)
            ctx.fillStyle = actor ? (actor.color || '#ffffff') : '#ffffff';
            ctx.fillText(l, x, ly);
        });

        ctx.restore();
    }
}
