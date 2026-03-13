/**
 * Room — holds background image, walkbox polygon, and hotspots.
 *
 * Walkbox is an array of {x,y} points defining the walkable floor area.
 * Hotspots: [{ id, name, x, y, w, h, verb, action }]
 */
class Room {
    constructor({ id, name, background, walkbox, hotspots = [] }) {
        this.id = id;
        this.name = name;
        this.background = background; // HTMLImageElement
        this.walkbox = walkbox;       // [{x,y}, ...]  polygon points (canvas coords)
        this.hotspots = hotspots;
    }

    /** Point-in-polygon test (ray casting) */
    isWalkable(px, py) {
        const poly = this.walkbox;
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y;
            const xj = poly[j].x, yj = poly[j].y;
            const intersect =
                yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
            if (intersect) inside = !inside;
        }
        return inside;
    }

    /** Clamp a target point to the nearest point inside the walkbox */
    clampToWalkbox(tx, ty) {
        if (this.isWalkable(tx, ty)) return { x: tx, y: ty };
        // Find the closest point on any edge of the walkbox polygon
        const poly = this.walkbox;
        let best = null, bestDist = Infinity;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const pt = closestPointOnSegment(poly[j], poly[i], { x: tx, y: ty });
            const d = dist(pt, { x: tx, y: ty });
            if (d < bestDist) { bestDist = d; best = pt; }
        }
        return best || { x: tx, y: ty };
    }

    /** Return hotspot under (px, py), or null. Respects isVisible(engine). */
    getHotspotAt(px, py, engine = null) {
        for (const h of this.hotspots) {
            if (typeof h.isVisible === 'function' && engine && !h.isVisible(engine)) continue;
            if (px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h) {
                return h;
            }
        }
        return null;
    }

    draw(ctx) {
        if (this.background && this.background.complete) {
            ctx.drawImage(this.background, 0, 0, ctx.canvas.width, ctx.canvas.height - 140);
        } else {
            // Fallback gradient while image loads
            const grad = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height - 140);
            grad.addColorStop(0, '#1a0a3a');
            grad.addColorStop(1, '#4a2060');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height - 140);

            // Draw floor
            ctx.fillStyle = '#2a1540';
            ctx.fillRect(0, ctx.canvas.height - 200, ctx.canvas.width, 120);
        }
    }

    drawDebugWalkbox(ctx) {
        if (!this.walkbox.length) return;
        ctx.save();
        ctx.strokeStyle = 'rgba(0,255,0,0.4)';
        ctx.fillStyle = 'rgba(0,255,0,0.08)';
        ctx.beginPath();
        ctx.moveTo(this.walkbox[0].x, this.walkbox[0].y);
        for (let i = 1; i < this.walkbox.length; i++) {
            ctx.lineTo(this.walkbox[i].x, this.walkbox[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

function dist(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
}

function closestPointOnSegment(a, b, p) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return { x: a.x, y: a.y };
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return { x: a.x + t * dx, y: a.y + t * dy };
}
