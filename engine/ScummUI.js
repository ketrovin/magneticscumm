/**
 * ScummUI — Classic SCUMM verb bar and inventory panel renderer.
 *
 * Layout at bottom of canvas (80px tall):
 *  ┌──────────────────────────────────────┬───────────────┐
 *  │  Verb grid (2 rows × 5 cols)         │  Inventory    │
 *  │  Walk to  Look at  Use  Pick up Open │  [item slots] │
 *  │  Push     Pull     Give Talk to Close│               │
 *  └──────────────────────────────────────┴───────────────┘
 */
class ScummUI {
    constructor(canvasWidth, canvasHeight) {
        this.cw = canvasWidth;
        this.ch = canvasHeight;
        this.panelH = 80;
        this.panelY = canvasHeight - this.panelH;

        this.verbs = [
            'Walk to', 'Look at', 'Use', 'Pick up', 'Open',
            'Push', 'Pull', 'Give', 'Talk to', 'Close',
        ];
        this.selectedVerb = 'Walk to';
        this.hoveredVerb = null;
        this.hoveredHotspot = null; // set by Engine
        this.inventory = [];        // array of item name strings

        // Precompute verb cell layout
        this.verbAreaW = Math.floor(canvasWidth * 0.65);
        this.cellW = Math.floor(this.verbAreaW / 5);
        this.cellH = Math.floor(this.panelH / 2);

        this._verbRects = this.verbs.map((_, i) => ({
            x: (i % 5) * this.cellW,
            y: this.panelY + Math.floor(i / 5) * this.cellH,
            w: this.cellW,
            h: this.cellH,
        }));

        // Inventory area
        this.invX = this.verbAreaW;
        this.invW = canvasWidth - this.verbAreaW;
        this.invSlotW = Math.floor(this.invW / 3);
    }

    /** Call on every mouse move — returns hovered verb or null */
    onMouseMove(mx, my) {
        this.hoveredVerb = null;
        if (my < this.panelY) return null;
        for (let i = 0; i < this._verbRects.length; i++) {
            const r = this._verbRects[i];
            if (mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h) {
                this.hoveredVerb = this.verbs[i];
                return this.hoveredVerb;
            }
        }
        return null;
    }

    /** Returns verb if click is in panel, null if click is in scene */
    onClick(mx, my) {
        if (my < this.panelY) return null; // scene click
        for (let i = 0; i < this._verbRects.length; i++) {
            const r = this._verbRects[i];
            if (mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h) {
                this.selectedVerb = this.verbs[i];
                return this.verbs[i];
            }
        }
        return null;
    }

    /** Is this coordinate inside the UI panel? */
    isInPanel(mx, my) {
        return my >= this.panelY;
    }

    draw(ctx) {
        // Panel background - FM Towns Era / VGA style metallic dark gradient
        const bgGrad = ctx.createLinearGradient(0, this.panelY, 0, this.panelY + this.panelH);
        bgGrad.addColorStop(0, '#2b2b40');
        bgGrad.addColorStop(1, '#0e0e1a');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, this.panelY, this.cw, this.panelH);

        // Ridge divider line
        ctx.fillStyle = '#5a5a75';
        ctx.fillRect(0, this.panelY, this.cw, 2);
        ctx.fillStyle = '#0a0a10';
        ctx.fillRect(0, this.panelY + 2, this.cw, 2);

        // Verb cells
        ctx.font = 'normal 16px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < this.verbs.length; i++) {
            const v = this.verbs[i];
            const r = this._verbRects[i];
            const isSelected = v === this.selectedVerb;
            const isHovered = v === this.hoveredVerb;

            if (isSelected) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.fillRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
                ctx.strokeStyle = '#6c8fb5';
                ctx.strokeRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
            } else if (isHovered) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.fillRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
            }

            ctx.fillStyle = isSelected
                ? '#ffe14d'
                : isHovered
                    ? '#ffffff'
                    : '#78a2d4';

            // Text shadow for classic depth
            ctx.shadowColor = '#000000';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            ctx.fillText(v, r.x + r.w / 2, r.y + r.h / 2);
            ctx.shadowColor = 'transparent';
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }

        // Inventory area background - inset look
        ctx.fillStyle = '#10101d';
        ctx.fillRect(this.invX, this.panelY + 4, this.invW - 4, this.panelH - 8);
        
        ctx.strokeStyle = '#2d2d42';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.invX, this.panelY + 4, this.invW - 4, this.panelH - 8);
        ctx.strokeStyle = '#4e4e68';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.invX - 1, this.panelY + 3, this.invW - 2, this.panelH - 6);

        // Inventory label
        ctx.fillStyle = '#6a7e93';
        ctx.font = '11px "Share Tech Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText('INVENTORY', this.invX + 8, this.panelY + 16);

        // Inventory items
        ctx.fillStyle = '#d5e2f0';
        ctx.font = '13px "Share Tech Mono", monospace';
        for (let i = 0; i < Math.min(this.inventory.length, 6); i++) {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const ix = this.invX + col * (this.invSlotW * 1.5) + 8;
            const iy = this.panelY + 34 + row * 20;
            ctx.fillText(this.inventory[i], ix, iy);
        }

        // Status / action line above panel
        this._drawStatusLine(ctx);
    }

    _drawStatusLine(ctx) {
        const lineH = 22;
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, this.panelY - lineH, this.cw, lineH);

        let text = this.selectedVerb;
        if (this.hoveredHotspot) {
            text += ' ' + this.hoveredHotspot.name;
        }

        ctx.fillStyle = '#ffe14d';
        ctx.font = 'normal 15px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, this.cw / 2, this.panelY - lineH / 2);
    }
}
