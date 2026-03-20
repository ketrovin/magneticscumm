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
            isGameOver: false,
            inventory: [],          // item ids collected
            roomStates: {},         // per-room state: { roomId: { key: value } }
            dialogLine: null,       // current one-liner text
            dialogSpeaker: null,    // the Actor who is speaking
            dialogTimer: 0,
            activeDialogChoices: null, // [string] or null
            onChoiceCallback: null,
            commandBuffer: "",      // For typed commands
            music: {
                currentTrack: null,     // The track actually playing right now
                backgroundTrack: null,  // Selected on cell phone
                volume: 0.5,
                isLooping: true,
                userDisabled: false,   // Manual toggle via cell phone
                tracks: [] // { id, name, url }
            }
        };

        this.quips = {
            'Look at': ["I see nothing special.", "Just an ordinary object.", "It looks... like itself."],
            'Pick up': ["I can't carry a {T}!", "It's bolted down.", "My pockets aren't that big.", "I don't think that's portable."],
            'Talk to': ["No response.", "I'm talking to myself again.", "Silence is golden. This is very golden."],
            'Use': ["Use it how? I'm not a magician.", "I can't figure out how to use it.", "That doesn't seem to do anything."],
            'Open': ["It's either already open or I'm not strong enough to force it.", "I can't open that.", "It won't budge."],
            'Close': ["It's already closed or it's not meant to be shut.", "I can't close that.", "It's stuck open."],
            'Push': ["It won't budge. I should have gone to the gym. Once. Ever.", "I'm not strong enough.", "It's firmly in place."],
            'Pull': ["I'm pulling, but nothing is happening.", "I can't move it.", "It's anchored."],
            'Give': ["I'm keeping it.", "They don't want it.", "I'd rather not."],
            'Default': ["I can't do that.", "No.", "Doesn't work.", "Not right now."],
            'Item': ["Using {I} on {T}... nope.", "That doesn't fit.", "I don't think {I} works with {T}.", "Unlikely."]
        };

        this.ui = new ScummUI(this.canvas.width, this.canvas.height);
        this.input = new InputManager(this.canvas);
        this._lastTime = null;
        this._rafId = null;
        this.debug = false;
        this.assetStatus = { loaded: 0, total: 0 };

        this._wireInput();
    }

    /** Preload a list of image URLs. Updates this.assetStatus. */
    loadAssets(urls) {
        this.assetStatus.total = urls.length;
        this.assetStatus.loaded = 0;

        if (urls.length === 0) return Promise.resolve();

        const promises = urls.map(url => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    this.assetStatus.loaded++;
                    resolve(img);
                };
                img.onerror = () => {
                    console.error(`Failed to load asset: ${url}`);
                    this.assetStatus.loaded++; // Count it anyway to avoid hang
                    resolve(null);
                };
                img.src = url;
            });
        });

        return Promise.all(promises);
    }

    // ── Room registry ──────────────────────────────────────────────────────
    registerRoom(room) {
        this.rooms[room.id] = room;
        // If the player is currently in this room, refresh the reference 
        // to pick up new NPCs and props added during late initialization.
        if (this.room && this.room.id === room.id) {
            this.room = room;
            // Also refresh the actors list to include new room NPCs
            const player = this.actors.find(a => a.id === 'dave');
            this.actors = [];
            if (player) this.actors.push(player);
            if (this.room.npcs) this.actors.push(...this.room.npcs);
        }
    }

    /** Handle combining two items in inventory */
    handleItemCombine(itemA, itemB) {
        const idA = itemA.id;
        const idB = itemB.id;

        // Remote Control + Enormous Battery = Overpowered Remote
        if ((idA === 'remote_control' && idB === 'battery') || (idA === 'battery' && idB === 'remote_control')) {
            this.removeItem('remote_control');
            this.removeItem('battery');
            this.addItem('overpowered_remote', 'Overpowered Remote');
            this.say("Dave: 'I've jammed the hydrant-sized battery into the TV remote. It's glowing a faint, dangerous violet. This is definitely OSHA-compliant.'");
            return true;
        }

        return false;
    }

    removeItem(id) {
        const idx = this.gameState.inventory.findIndex(i => i.id === id);
        if (idx !== -1) this.gameState.inventory.splice(idx, 1);
    }

    /** Switch to a different room, placing player at (entryX, entryY) */
    changeRoom(roomId, entryX, entryY) {
        if (!this.rooms[roomId]) {
            console.warn(`Room "${roomId}" not registered`);
            return;
        }
        this.room = this.rooms[roomId];
        this.gameState._interactTriggered = true;
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
        
        // Handle music transition
        this._updateMusic();
    }

    loadRoom(room) {
        this.registerRoom(room);
        this.room = room;
        this._updateMusic();
    }

    /** Handle natural language commands (e.g., from console or Dave dialogue) */
    processCommand(text) {
        const input = text.toLowerCase().trim();
        console.log(`[Engine] Command: "${input}"`);

        // Handle "Leave" intent
        if (input.includes('leave') || input.includes('exit') || input.includes('get out')) {
            if (!this.room) return;
            
            // Find a hotspot that looks like an exit
            const exitKeywords = ['door', 'exit', 'stairs', 'street', 'gate', 'alley', 'bedroom', 'kitchen', 'to_'];
            const exit = this.room.hotspots.find(h => {
                const name = (h.name || h.id).toLowerCase();
                return exitKeywords.some(k => name.includes(k.toLowerCase()));
            });

            if (exit) {
                this.say(`Dave: 'Right. Time to head out.'`);
                setTimeout(() => this._onHotspotInteract(exit), 1500);
            } else {
                this.say("Dave: 'There doesn't seem to be an obvious way out of here.'");
            }
            return;
        }

        this.say(`Dave: 'I'm not sure how to "${text}".'`);
    }

    /** Choose and play the correct music (Room override vs Phone background) */
    _updateMusic() {
        if (!this.room) return;
        
        // Prioritize Room Music!
        const targetTrackId = this.room.music || this.gameState.music.backgroundTrack;
        
        if (targetTrackId && !this.gameState.music.userDisabled) {
            if (this.gameState.music.currentTrack !== targetTrackId) {
                this.playMusic(targetTrackId);
            }
        } else {
            this.stopMusic();
        }
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
        if (this.gameState.dialogTimer > 0) {
            this.gameState.dialogTimer = 0; // Force immediate cleanup if called again? 
            // Actually, keep it simple: just overwrite.
        }

        let actualText = text;
        let actualSpeaker = speaker;

        // Smart speaker detection: if text starts with "Name: ", try to find that actor
        if (!actualSpeaker) {
            const colonIndex = text.indexOf(':');
            if (colonIndex > 0 && colonIndex < 25) { 
                const possibleName = text.substring(0, colonIndex).trim();
                const found = this.actors.find(a => a.name.toLowerCase() === possibleName.toLowerCase());
                if (found) {
                    actualSpeaker = found;
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

        // Trigger talking animation if speaker is an actor
        if (actualSpeaker && typeof actualSpeaker.talkAnim === 'function') {
            actualSpeaker.talkAnim();
        }
    }

    /** Sequence of lines. duration can be a number or an array of numbers. */
    saySequence(lines, callback) {
        if (!lines || lines.length === 0) {
            if (callback) callback();
            return;
        }

        const next = (index) => {
            if (index >= lines.length) {
                if (callback) callback();
                return;
            }

            const item = lines[index];
            const text = typeof item === 'string' ? item : item.text;
            const dur = typeof item === 'object' && item.duration ? item.duration : 4000;
            const speaker = typeof item === 'object' && item.speaker ? item.speaker : null;

            this.say(text, dur, speaker);

            // Wait for duration + small gap
            setTimeout(() => next(index + 1), dur + 200);
        };

        next(0);
    }

    enterDialog(choices, callback) {
        this.gameState.activeDialogChoices = choices;
        this.gameState.onChoiceCallback = callback;
        this.ui.selectedVerb = null; // Hide the active verb pointer
        
        // Track that we successfully entered a conversation to prevent fallback quips
        this.gameState._interactTriggered = true;
    }

    onChoiceClick(index) {
        const callback = this.gameState.onChoiceCallback;
        const choice = this.gameState.activeDialogChoices[index];
        this.gameState.activeDialogChoices = null;
        this.gameState.onChoiceCallback = null;
        this.ui.selectedVerb = 'Walk to'; // Reset verb
        if (callback) callback(index, choice);
    }

    // ── Music ──────────────────────────────────────────────────────────────
    playMusic(trackId) {
        const track = this.gameState.music.tracks.find(t => t.id === trackId);
        if (!track) return;

        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }

        const audio = new Audio(track.url);
        audio.loop = this.gameState.music.isLooping;
        audio.volume = this.gameState.music.volume;
        audio.play().catch(e => console.warn("Music auto-play blocked by browser. Click to start."));
        
        this.currentAudio = audio;
        this.gameState.music.currentTrack = trackId;
    }

    stopMusic() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
            this.gameState.music.currentTrack = null;
        }
    }

    toggleMusic() {
        this.gameState.music.userDisabled = !this.gameState.music.userDisabled;
        if (this.gameState.music.userDisabled) {
            this.stopMusic();
            this.say("Music: OFF");
        } else {
            this._updateMusic();
            this.say("Music: ON");
        }
    }

    /** Handle direct interaction with inventory items (self-use) */
    handleInventoryClick(item) {
        if (this.ui.selectedVerb === 'Use' && item.id === 'cell_phone') {
            this.toggleMusic();
            return true;
        }
        return false;
    }

    // ── Interactable helpers ───────────────────────────────────────────────
    getInteractableAt(mx, my) {
        if (!this.room) return null;

        // 1. Check actors (front to back)
        const actors = [...this.actors]
            .filter(a => a.isVisible !== false)
            .sort((a, b) => b.y - a.y); // Closest to bottom = front
            
        for (const actor of actors) {
            const h = actor.getHitbox();
            if (mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h) {
                return h; // Returns hitbox object which acts like a hotspot
            }
        }

        // 2. Check room hotspots
        return this.room.getHotspotAt(mx, my, this);
    }

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
                this.ui.hoveredHotspot = this.getInteractableAt(mx, my);
            } else {
                this.ui.hoveredHotspot = null;
            }
        });

        this.input.onKey((e) => {
            if (this.gameState.dialogLine) return; // Ignore keys during dialog

            if (e.key === 'Enter') {
                if (this.gameState.commandBuffer.trim()) {
                    this.processCommand(this.gameState.commandBuffer);
                    this.gameState.commandBuffer = "";
                }
            } else if (e.key === 'Backspace') {
                if (this.gameState.commandBuffer.length > 0) {
                    this.gameState.commandBuffer = this.gameState.commandBuffer.slice(0, -1);
                    e.preventDefault();
                }
            } else if (e.key === 'Escape') {
                this.gameState.commandBuffer = "";
            } else if (e.key.length === 1) {
                this.gameState.commandBuffer += e.key;
            }
        });

        this.input.onClick((mx, my) => {
            // Unblock audio on first click
            if (this.currentAudio && this.currentAudio.paused) {
                this.currentAudio.play().catch(() => {});
            }
            
            const verbClicked = this.ui.onClick(mx, my);
            if (verbClicked) return;
            if (!this.room) return;

            const hotspot = this.getInteractableAt(mx, my);
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

        this.input.onWheel((delta) => {
            this.ui.onWheel(delta, this.input.mouseX, this.input.mouseY);
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
        
        // Track if any activity was triggered during interaction
        this.gameState._interactTriggered = false;
        const originalSay = this.say;
        this.say = (text, dur, speaker) => {
            this.gameState._interactTriggered = true;
            originalSay.call(this, text, dur, speaker);
        };

        if (typeof hotspot.onInteract === 'function') {
            hotspot.onInteract(verb, this, item);
        }

        this.say = originalSay;

        // Fallback if the interaction didn't trigger any dialogue or menu
        if (!this.gameState._interactTriggered && verb !== 'Walk to') {
            if (item) {
                this.triggerQuip('Item', hotspot.name, (typeof item === 'string' ? item : item.name));
            } else {
                this.triggerQuip(verb, hotspot.name);
            }
        }

        // Standard SCUMM behavior: reset to 'Walk to' after interaction
        this.ui.selectedVerb = 'Walk to';
        this.ui.selectedInventoryItem = null;
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

        // 2. Actors sorted        // Draw actors
        [...this.actors]
          .filter(a => a.isVisible !== false) // Only draw visible actors
          .sort((a, b) => a.y - b.y)
          .forEach(a => a.draw(ctx));

        // 3. Dialogue speech (above speaker's head)
        if (this.gameState.dialogLine) {
            this._drawDialog(ctx, this.gameState.dialogLine, this.gameState.dialogSpeaker);
        }

        // 4. UI panel
        this.ui.draw(ctx);

        // 5. Game Over Overlay
        if (this.gameState.isGameOver) {
            this._drawGameOver(ctx);
        }
    }

    _drawGameOver(ctx) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        ctx.fillStyle = '#ff00ff';
        ctx.font = 'bold 48px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('THE END', this.canvas.width / 2, this.canvas.height / 2);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '24px "Share Tech Mono", monospace';
        ctx.fillText('You have successfully broken the physics of Moncton.', this.canvas.width / 2, this.canvas.height / 2 + 60);
        ctx.restore();
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
