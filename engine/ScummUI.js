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
        this.hoveredScroll = null;

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
        this.inventoryOffset = 0; // Each offset unit = 2 items (one row)

        // Scroll buttons (arrows) on the right of the inventory
        const arrowW = 20;
        const arrowH = 20;
        this.scrollUpRect = {
            x: this.cw - arrowW - 5,
            y: this.panelY + 30,
            w: arrowW,
            h: arrowH
        };
        this.scrollDownRect = {
            x: this.cw - arrowW - 5,
            y: this.panelY + this.panelH - 30,
            w: arrowW,
            h: arrowH
        };

        // Dialog choice area (same as verb area)
        this.dialogChoiceRects = [];
        for (let i = 0; i < 6; i++) {
            this.dialogChoiceRects.push({
                x: 20,
                y: this.panelY + 32 + i * 20,
                w: this.verbAreaW - 40,
                h: 20
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
        const startIdx = this.inventoryOffset * 2;
        for (let i = 0; i < Math.min(this.inventory.length - startIdx, 8); i++) {
            const actualIdx = startIdx + i;
            const row = Math.floor(i / 2);
            const col = i % 2;
            const ix = this.invX + col * (this.invW / 2);
            const iy = iy_start + row * 25;
            if (mx >= ix && mx < ix + this.invW/2 && my >= iy && my < iy + 25) {
                this.hoveredInventoryItem = this.inventory[actualIdx];
                return this.hoveredInventoryItem;
            }
        }

        // Scroll button hits
        if (mx >= this.scrollUpRect.x && mx < this.scrollUpRect.x + this.scrollUpRect.w &&
            my >= this.scrollUpRect.y && my < this.scrollUpRect.y + this.scrollUpRect.h) {
            this.hoveredScroll = 'up';
            return 'up';
        }
        if (mx >= this.scrollDownRect.x && mx < this.scrollDownRect.x + this.scrollDownRect.w &&
            my >= this.scrollDownRect.y && my < this.scrollDownRect.y + this.scrollDownRect.h) {
            this.hoveredScroll = 'down';
            return 'down';
        }
        this.hoveredScroll = null;

        return null;
    }

    onWheel(deltaY, mx, my) {
        if (!this.isInPanel(mx, my)) return;
        
        // Only scroll if hovering over the inventory area
        if (mx < this.invX) return;

        if (deltaY > 0) {
            // Scroll down
            if ((this.inventoryOffset + 4) * 2 < this.inventory.length) {
                this.inventoryOffset++;
            }
        } else if (deltaY < 0) {
            // Scroll up
            if (this.inventoryOffset > 0) {
                this.inventoryOffset--;
            }
        }
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
        
        // Scroll button hits
        if (this.hoveredScroll === 'up' && this.inventoryOffset > 0) {
            this.inventoryOffset--;
            return true;
        }
        if (this.hoveredScroll === 'down' && (this.inventoryOffset + 4) * 2 < this.inventory.length) {
            this.inventoryOffset++;
            return true;
        }

        const iy_start = this.panelY + 30;
        const startIdx = this.inventoryOffset * 2;
        for (let i = 0; i < Math.min(this.inventory.length - startIdx, 8); i++) {
            const row = Math.floor(i / 2);
            const col = i % 2;
            const ix = this.invX + col * (this.invW / 2);
            const iy = iy_start + row * 25;
            if (mx >= ix && mx < ix + this.invW/2 && my >= iy && my < iy + 25) {
                const actualIdx = startIdx + i;
                const clickedItem = this.inventory[actualIdx];
                
                // --- ITEM COMBINATION LOGIC ---
                if (this.selectedVerb === 'Use' && this.selectedInventoryItem && this.selectedInventoryItem !== clickedItem) {
                    if (engine && engine.handleItemCombine(this.selectedInventoryItem, clickedItem)) {
                        this.selectedInventoryItem = null;
                        this.selectedVerb = 'Walk to';
                        return true;
                    }
                }

                this.selectedInventoryItem = clickedItem;
                
                // Allow engine to handle special self-interactions (like cell phone toggle)
                if (engine && engine.handleInventoryClick(clickedItem)) {
                    return true; 
                }

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
        const startIdx = this.inventoryOffset * 2;
        for (let i = 0; i < Math.min(this.inventory.length - startIdx, 8); i++) {
            const actualIdx = startIdx + i;
            const item = this.inventory[actualIdx];
            const row = Math.floor(i / 2);
            const col = i % 2;
            const ix = this.invX + col * (this.invW / 2);
            const iy = iy_start + row * 25;

            const isSelected = this.selectedInventoryItem === item;
            const isHovered = this.hoveredInventoryItem === item;

            ctx.fillStyle = isSelected ? COLOR_SELECTED : (isHovered ? '#ffffff' : '#00aaaa'); // Cyan for items
            ctx.fillText(item.name, ix + 5, iy + 5);
        }

        // 4b. Draw Scroll Arrows (More Prominent)
        ctx.font = 'bold 24px "Share Tech Mono", monospace';
        if (this.inventoryOffset > 0) {
            ctx.fillStyle = this.hoveredScroll === 'up' ? '#ffffff' : '#00ffee'; // Brighter neon
            ctx.fillText('▲', this.scrollUpRect.x, this.scrollUpRect.y + 18);
        }
        if ((this.inventoryOffset + 4) * 2 < this.inventory.length) {
            ctx.fillStyle = this.hoveredScroll === 'down' ? '#ffffff' : '#00ffee';
            ctx.fillText('▼', this.scrollDownRect.x, this.scrollDownRect.y + 18);
        }

        // 5. Active Command / Status Line
        this._drawStatusLine(ctx);
    }

    _drawStatusLine(ctx) {
        ctx.font = 'bold 22px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ff00ff'; // Zak active pink

        // Case 1: Typed command buffer takes priority
        if (this.engine.gameState.commandBuffer) {
            ctx.fillText("> " + this.engine.gameState.commandBuffer, this.cw / 2, this.panelY + 15);
            return;
        }

        // Case 2: Interactive SCUMM sentence
        const verb = (this.selectedVerb === 'Walk to' && this.hoveredVerb) ? this.hoveredVerb : this.selectedVerb;
        let text = verb;
        let item = this.selectedInventoryItem;

        if (item) {
            const itemName = (typeof item === 'string') ? item : item.name;
            if (verb === 'Give') text += ` ${itemName} to`;
            else if (verb === 'Use') text += ` ${itemName} with`;
            else text += ` ${itemName}`;
        }

        if (this.hoveredHotspot) {
            const hname = this.hoveredHotspot.name || "";
            text += ' ' + hname;
        } else if (this.hoveredInventoryItem && !this.selectedInventoryItem) {
            const iname = (typeof this.hoveredInventoryItem === 'string' ? this.hoveredInventoryItem : this.hoveredInventoryItem.name) || "";
            text += ' ' + iname;
        }

        ctx.fillText(text, this.cw / 2, this.panelY + 15);
    }
}
