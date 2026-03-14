/**
 * Actor — a character in the game world.
 * Supports walking to a target and playing idle/walk animations.
 */
class Actor {
    constructor({ id, name, x, y, animator }) {
        this.id = id;
        this.name = name;
        this.x = x;
        this.y = y;
        this.animator = animator;
        this.speed = 120; // pixels per second (at canvas resolution)
        this.target = null;    // { x, y }
        this.facing = 'right'; // 'left' | 'right'
        this.state = 'idle';   // 'idle' | 'walking'

        // Depth scaling: characters appear smaller near the top of the screen
        this.baseScale = 1.0;
    }

    /** Order the actor to walk to (tx, ty). Room clamping done by Engine. */
    walkTo(tx, ty) {
        this.target = { x: tx, y: ty };
        this.state = 'walking';
        if (tx < this.x) {
            this.facing = 'left';
            this.animator.play('walkL');
        } else {
            this.facing = 'right';
            this.animator.play('walkR');
        }
    }

    stopWalking() {
        this.target = null;
        this.state = 'idle';
        this.animator.play('idle');
    }

    update(dt, room) {
        if (this.state === 'walking' && this.target) {
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            const d = Math.hypot(dx, dy);
            if (d < 2) {
                this.x = this.target.x;
                this.y = this.target.y;
                this.stopWalking();
            } else {
                const step = this.speed * (dt / 1000);
                const nx = this.x + (dx / d) * step;
                const ny = this.y + (dy / d) * step;
                // Accept position if walkable, else stop at current
                if (room && room.isWalkable(nx, ny)) {
                    this.x = nx;
                    this.y = ny;
                } else {
                    this.stopWalking();
                }
            }
        }

        // Depth-based scale: bottom of walkable area = 1.0, top = 0.55
        // Canvas height is 600, UI panel is 80px, so scene height = 520
        const minY = 200, maxY = 480;
        const t = Math.max(0, Math.min(1, (this.y - minY) / (maxY - minY)));
        this.animator.scale = 0.55 + t * 0.55;

        this.animator.update(dt);
    }

    draw(ctx) {
        this.animator.draw(ctx, this.x, this.y);

        // Optional: draw name tag in debug mode
        if (Actor.debugMode) {
            ctx.fillStyle = 'yellow';
            ctx.font = '10px monospace';
            ctx.fillText(this.name, this.x - 12, this.y - (this.animator.defaultFrameH * this.animator.scale) - 4);
        }
    }
}

Actor.debugMode = false;
