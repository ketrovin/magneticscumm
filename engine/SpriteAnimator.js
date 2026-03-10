/**
 * SpriteAnimator — flexible per-frame spritesheet animation player.
 *
 * Supports both:
 *   - Uniform grid layouts: { row, count, fps, frameW, frameH }
 *   - Per-frame coordinates: { frames: [{x,y,w,h}, ...], fps }
 *
 * Background color removal: pass bgColor (e.g. '#e8d7b0') to make
 * that color transparent on load (color-keying).
 */
class SpriteAnimator {
  /**
   * @param {HTMLImageElement|HTMLCanvasElement} image
   * @param {number} defaultFrameW  – used for uniform-grid animations
   * @param {number} defaultFrameH  – used for uniform-grid animations
   * @param {Object} animations     – map of name → animation config
   * @param {string|null} bgColor   – hex color to key out (e.g. '#e8d7b0')
   */
  constructor(image, defaultFrameW, defaultFrameH, animations, bgColor = null) {
    this.defaultFrameW = defaultFrameW;
    this.defaultFrameH = defaultFrameH;
    this.animations = animations;
    this.current = null;
    this.frame = 0;
    this.elapsed = 0;
    this.scale = 1.0;

    // Apply background color removal and store resulting canvas as source
    if (bgColor && image) {
      this.image = removeBackground(image, bgColor);
    } else {
      this.image = image;
    }
  }

  play(name) {
    if (this.current === name) return;
    this.current = name;
    this.frame = 0;
    this.elapsed = 0;
  }

  update(dt) {
    if (!this.current) return;
    const anim = this.animations[this.current];
    if (!anim) return;
    const count = anim.frames ? anim.frames.length : anim.count;
    const frameDuration = 1000 / anim.fps;
    this.elapsed += dt;
    while (this.elapsed >= frameDuration) {
      this.elapsed -= frameDuration;
      this.frame = (this.frame + 1) % count;
    }
  }

  draw(ctx, x, y) {
    if (!this.current || !this.image) return;
    const anim = this.animations[this.current];
    if (!anim) return;

    let sx, sy, sw, sh;

    if (anim.frames) {
      // Per-frame coordinate mode
      const f = anim.frames[this.frame];
      if (!f) return;
      sx = f.x; sy = f.y; sw = f.w; sh = f.h;
    } else {
      // Uniform grid mode
      const fw = anim.frameW ?? this.defaultFrameW;
      const fh = anim.frameH ?? this.defaultFrameH;
      sx = this.frame * fw;
      sy = anim.row * fh;
      sw = fw;
      sh = fh;
    }

    const dw = sw * this.scale;
    const dh = sh * this.scale;

    ctx.save();
    if (anim.flipH) {
      // Flip horizontally for left-walk derived from right-walk frames
      ctx.translate(Math.floor(x + dw / 2), Math.floor(y - dh));
      ctx.scale(-1, 1);
      ctx.drawImage(this.image, sx, sy, sw, sh, -dw / 2, 0, dw, dh);
    } else {
      ctx.drawImage(
        this.image,
        sx, sy, sw, sh,
        Math.floor(x - dw / 2), Math.floor(y - dh),
        dw, dh
      );
    }
    ctx.restore();
  }
}

/**
 * Remove a background color from a spritesheet by making matching pixels
 * transparent. Samples the top-left corner if bgColor is 'auto'.
 * Returns an HTMLCanvasElement usable as an image source.
 */
function removeBackground(img, bgColor = 'auto', tolerance = 40) {
  const oc = document.createElement('canvas');
  oc.width = img.width || img.naturalWidth || 512;
  oc.height = img.height || img.naturalHeight || 512;
  const ctx = oc.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, oc.width, oc.height);
  const data = imageData.data;

  let tr, tg, tb;
  if (bgColor === 'auto') {
    // Sample top-left pixel
    tr = data[0]; tg = data[1]; tb = data[2];
  } else {
    const c = hexToRgb(bgColor);
    tr = c.r; tg = c.g; tb = c.b;
  }

  for (let i = 0; i < data.length; i += 4) {
    const dr = Math.abs(data[i] - tr);
    const dg = Math.abs(data[i + 1] - tg);
    const db = Math.abs(data[i + 2] - tb);
    if (dr + dg + db < tolerance * 3) {
      data[i + 3] = 0; // transparent
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return oc;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}
