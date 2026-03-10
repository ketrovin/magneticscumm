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
            dialogLine: null,       // current one-liner text for Dave
            dialogTimer: 0,
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
            this.ui.inventory.push(displayName ?? id);
        }
    }
    removeItem(id) {
        const i = this.gameState.inventory.indexOf(id);
        if (i >= 0) {
            this.gameState.inventory.splice(i, 1);
            this.ui.inventory.splice(i, 1);
        }
    }

    // ── Dave says ──────────────────────────────────────────────────────────
    say(text, duration = 3500) {
        this.gameState.dialogLine = text;
        this.gameState.dialogTimer = duration;
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
                    const ty = hotspot.walkToY ?? Math.min(hotspot.y + hotspot.h, 480);
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
            }
        });
    }

    _onHotspotInteract(hotspot) {
        const verb = this.ui.selectedVerb;
        if (typeof hotspot.onInteract === 'function') {
            hotspot.onInteract(verb, this);
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
            if (this.gameState.dialogTimer <= 0) this.gameState.dialogLine = null;
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
            this.room.draw(ctx);
            if (this.debug) this.room.drawDebugWalkbox(ctx);
        }

        // 2. Actors sorted by Y (depth)
        [...this.actors].sort((a, b) => a.y - b.y).forEach(a => a.draw(ctx));

        // 3. Dave's dialog speech bubble
        if (this.gameState.dialogLine) {
            this._drawDialog(ctx, this.gameState.dialogLine);
        }

        // 4. UI panel
        this.ui.draw(ctx);
    }

    _drawDialog(ctx, text) {
        const panelY = this.canvas.height - 80;
        const x = this.player ? this.player.x : this.canvas.width / 2;
        const y = this.player ? (this.player.y - 90) : 80;

        ctx.save();
        ctx.font = 'bold 12px "Courier New", monospace';
        const maxW = 280;

        // Word-wrap
        const words = text.split(' ');
        const lines = [];
        let line = '';
        for (const word of words) {
            const test = line ? `${line} ${word}` : word;
            if (ctx.measureText(test).width > maxW && line) {
                lines.push(line); line = word;
            } else { line = test; }
        }
        if (line) lines.push(line);

        const lh = 16, pad = 8;
        const bw = maxW + pad * 2;
        const bh = lines.length * lh + pad * 2;
        const bx = Math.max(4, Math.min(x - bw / 2, this.canvas.width - bw - 4));
        const by = Math.max(4, Math.min(y - bh, panelY - bh - 4));

        // Bubble
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.strokeStyle = '#ffff88';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 4);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = '#ffff88';
        ctx.textBaseline = 'top';
        lines.forEach((l, i) => ctx.fillText(l, bx + pad, by + pad + i * lh));
        ctx.restore();
    }
}
