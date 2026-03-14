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
        this.panelH = 140; 
        this.panelY = canvasHeight - this.panelH;

        this.verbs = [
            'Walk to', 'Pick up', 'Look at', 'Talk to',
            'Use', 'Open', 'Close', 'Buy',
            'Give', 'Read', 'Push', 'Pull'
        ];
        this.selectedVerb = 'Walk to';
        this.hoveredVerb = null;
        this.hoveredHotspot = null;
        this.inventory = [];
        this.hoveredInventoryItem = null;
        this.selectedInventoryItem = null;

        // EGA Style: 4 columns, 3 rows for 12 verbs
        this.verbAreaW = Math.floor(canvasWidth * 0.70);
        this.cellW = Math.floor(this.verbAreaW / 4);
        this.cellH = Math.floor((this.panelH - 30) / 3); 

        this._verbRects = this.verbs.map((_, i) => ({
            x: (i % 4) * this.cellW,
            y: (this.panelY + 30) + Math.floor(i / 4) * this.cellH,
            w: this.cellW,
            h: this.cellH,
        }));

        this.invX = this.verbAreaW;
        this.invW = canvasWidth - this.verbAreaW;

        // Dialog choice area (same as verb area)
        this.dialogChoiceRects = [];
        for (let i = 0; i < 4; i++) {
            this.dialogChoiceRects.push({
                x: 20,
                y: this.panelY + 36 + i * 25,
                w: this.verbAreaW - 40,
                h: 25
            });
        }
    }

    onMouseMove(mx, my) {
        this.hoveredVerb = null;
        this.hoveredInventoryItem = null;
        if (my < this.panelY) return null;
        
        // Dialog choices hit detection
        const engine = window.engine; // Injected globally usually, or we can assume it exists
        if (engine && engine.gameState.activeDialogChoices) {
            for (let i = 0; i < engine.gameState.activeDialogChoices.length; i++) {
                const r = this.dialogChoiceRects[i];
                if (r && mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h) {
                    this.hoveredDialogChoice = i;
                    return i;
                }
            }
            this.hoveredDialogChoice = null;
            return null;
        }

        for (let i = 0; i < this._verbRects.length; i++) {
            const r = this._verbRects[i];
            if (mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h) {
                this.hoveredVerb = this.verbs[i];
                return this.hoveredVerb;
            }
        }
        
        // Inventory hit detection
        const iy_start = this.panelY + 30;
        for (let i = 0; i < Math.min(this.inventory.length, 8); i++) {
            const row = Math.floor(i / 2);
            const col = i % 2;
            const ix = this.invX + col * (this.invW / 2);
            const iy = iy_start + row * 25;
            if (mx >= ix && mx < ix + this.invW/2 && my >= iy && my < iy + 25) {
                this.hoveredInventoryItem = this.inventory[i];
                return this.hoveredInventoryItem;
            }
        }
        return null;
    }

    onClick(mx, my) {
        if (my < this.panelY) return false;

        const engine = window.engine;
        if (engine && engine.gameState.activeDialogChoices) {
            const idx = this.onMouseMove(mx, my);
            if (typeof idx === 'number' && idx >= 0 && idx < engine.gameState.activeDialogChoices.length) {
                engine.onChoiceClick(idx);
                return true;
            }
            return true; // Clicked in panel but not on choice
        }
        
        for (let i = 0; i < this._verbRects.length; i++) {
            const r = this._verbRects[i];
            if (mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h) {
                this.selectedVerb = this.verbs[i];
                if (this.selectedVerb !== 'Use' && this.selectedVerb !== 'Give' && this.selectedVerb !== 'Look at') {
                    this.selectedInventoryItem = null;
                }
                return true;
            }
        }
        
        const iy_start = this.panelY + 30;
        for (let i = 0; i < Math.min(this.inventory.length, 8); i++) {
            const row = Math.floor(i / 2);
            const col = i % 2;
            const ix = this.invX + col * (this.invW / 2);
            const iy = iy_start + row * 25;
            if (mx >= ix && mx < ix + this.invW/2 && my >= iy && my < iy + 25) {
                this.selectedInventoryItem = this.inventory[i];
                if (this.selectedVerb !== 'Give' && this.selectedVerb !== 'Use' && this.selectedVerb !== 'Look at') {
                    this.selectedVerb = 'Use';
                }
                return true;
            }
        }
        return true;
    }

    isInPanel(mx, my) {
        return my >= this.panelY;
    }

    draw(ctx) {
        // 1. Solid Black Background (Zak EGA Style)
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, this.panelY, this.cw, this.panelH);

        // 2. Status Line Divider
        ctx.strokeStyle = '#555555';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, this.panelY + 28);
        ctx.lineTo(this.cw, this.panelY + 28);
        ctx.stroke();

        // 3. Verbs
        ctx.font = '20px "Share Tech Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const COLOR_AVAILABLE = '#c8a84b'; // Title Gold
        const COLOR_SELECTED = '#ff00ff';  // Pure Pink/Magenta

        // Check for dialogue choices
        const engine = window.engine;
        if (engine && engine.gameState.activeDialogChoices) {
            ctx.font = '20px "Share Tech Mono", monospace';
            engine.gameState.activeDialogChoices.forEach((choice, i) => {
                const r = this.dialogChoiceRects[i];
                if (!r) return;
                const isHovered = this.hoveredDialogChoice === i;
                ctx.fillStyle = isHovered ? '#ffffff' : '#00aaaa';
                ctx.fillText(`> ${choice}`, r.x, r.y);
            });
        } else {
            for (let i = 0; i < this.verbs.length; i++) {
                const v = this.verbs[i];
                const r = this._verbRects[i];
                const isSelected = v === this.selectedVerb;
                const isHovered = v === this.hoveredVerb;

                ctx.fillStyle = isSelected ? COLOR_SELECTED : (isHovered ? '#ffffff' : COLOR_AVAILABLE);
                ctx.fillText(v, r.x + 10, r.y + 5);
            }
        }

        // 4. Inventory
        ctx.font = '18px "Share Tech Mono", monospace';
        const iy_start = this.panelY + 30;
        for (let i = 0; i < Math.min(this.inventory.length, 8); i++) {
            const item = this.inventory[i];
            const row = Math.floor(i / 2);
            const col = i % 2;
            const ix = this.invX + col * (this.invW / 2);
            const iy = iy_start + row * 25;

            const isSelected = this.selectedInventoryItem === item;
            const isHovered = this.hoveredInventoryItem === item;

            ctx.fillStyle = isSelected ? COLOR_SELECTED : (isHovered ? '#ffffff' : '#00aaaa'); // Cyan for items
            ctx.fillText(item.name, ix + 5, iy + 5);
        }

        // 5. Active Command / Status Line
        this._drawStatusLine(ctx);
    }

    _drawStatusLine(ctx) {
        ctx.font = 'bold 22px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ff00ff'; // Zak active pink

        let text = this.selectedVerb;
        let item = this.selectedInventoryItem;

        if (item) {
            const itemName = (typeof item === 'string') ? item : item.name;
            if (this.selectedVerb === 'Give') text += ` ${itemName} to`;
            else if (this.selectedVerb === 'Use') text += ` ${itemName} with`;
            else text += ` ${itemName}`;
        }

        if (this.hoveredHotspot) {
            text += ' ' + this.hoveredHotspot.name;
        } else if (this.hoveredInventoryItem && !this.selectedInventoryItem) {
            text += ' ' + (typeof this.hoveredInventoryItem === 'string' ? this.hoveredInventoryItem : this.hoveredInventoryItem.name);
        }

        ctx.fillText(text, this.cw / 2, this.panelY + 15);
    }
}
