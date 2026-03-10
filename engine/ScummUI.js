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
        // Panel background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, this.panelY, this.cw, this.panelH);

        // Divider line
        ctx.strokeStyle = '#555566';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, this.panelY);
        ctx.lineTo(this.cw, this.panelY);
        ctx.stroke();

        // Verb cells
        ctx.font = 'bold 11px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < this.verbs.length; i++) {
            const v = this.verbs[i];
            const r = this._verbRects[i];
            const isSelected = v === this.selectedVerb;
            const isHovered = v === this.hoveredVerb;

            if (isSelected) {
                ctx.fillStyle = '#334455';
                ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
            }

            ctx.fillStyle = isSelected
                ? '#ffff88'
                : isHovered
                    ? '#aaddff'
                    : '#88aacc';

            ctx.fillText(v, r.x + r.w / 2, r.y + r.h / 2);
        }

        // Inventory area background
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(this.invX, this.panelY, this.invW, this.panelH);
        ctx.strokeStyle = '#333355';
        ctx.strokeRect(this.invX, this.panelY, this.invW, this.panelH);

        // Inventory label
        ctx.fillStyle = '#556677';
        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('INVENTORY', this.invX + 4, this.panelY + 8);

        // Inventory items
        ctx.fillStyle = '#aabbcc';
        ctx.font = '10px monospace';
        for (let i = 0; i < Math.min(this.inventory.length, 6); i++) {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const ix = this.invX + col * this.invSlotW + 4;
            const iy = this.panelY + 16 + row * 24;
            ctx.fillText(this.inventory[i], ix, iy);
        }

        // Status / action line above panel
        this._drawStatusLine(ctx);
    }

    _drawStatusLine(ctx) {
        const lineH = 16;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, this.panelY - lineH, this.cw, lineH);

        let text = this.selectedVerb;
        if (this.hoveredHotspot) {
            text += ' ' + this.hoveredHotspot.name;
        }

        ctx.fillStyle = '#ffff88';
        ctx.font = 'bold 11px "Courier New", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 8, this.panelY - lineH / 2);
    }
}
