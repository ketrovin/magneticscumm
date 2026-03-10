/**
 * InputManager — captures mouse events and dispatches to Engine.
 */
class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this._listeners = [];
        this.mouseX = 0;
        this.mouseY = 0;
        this._clickCallbacks = [];
        this._moveCallbacks = [];

        const onMove = (e) => {
            const r = canvas.getBoundingClientRect();
            const scaleX = canvas.width / r.width;
            const scaleY = canvas.height / r.height;
            this.mouseX = (e.clientX - r.left) * scaleX;
            this.mouseY = (e.clientY - r.top) * scaleY;
            this._moveCallbacks.forEach(cb => cb(this.mouseX, this.mouseY));
        };
        const onClick = (e) => {
            const r = canvas.getBoundingClientRect();
            const scaleX = canvas.width / r.width;
            const scaleY = canvas.height / r.height;
            const mx = (e.clientX - r.left) * scaleX;
            const my = (e.clientY - r.top) * scaleY;
            this._clickCallbacks.forEach(cb => cb(mx, my));
        };

        canvas.addEventListener('mousemove', onMove);
        canvas.addEventListener('click', onClick);
        this._listeners.push({ type: 'mousemove', fn: onMove });
        this._listeners.push({ type: 'click', fn: onClick });
    }

    onMouseMove(cb) { this._moveCallbacks.push(cb); }
    onClick(cb) { this._clickCallbacks.push(cb); }

    destroy() {
        this._listeners.forEach(({ type, fn }) =>
            this.canvas.removeEventListener(type, fn)
        );
    }
}
