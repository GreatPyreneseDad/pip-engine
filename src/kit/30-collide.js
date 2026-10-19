// Collision detection and simple bounce physics.
// Consumed from phaserjs/phaser @ 02d8931b626d (MIT License)
// Adapted from:
//   src/geom/intersects/CircleToCircle.js
//   src/geom/intersects/CircleToRectangle.js
//   src/geom/intersects/RectangleToRectangle.js

(function() {
  // Check if two shapes overlap. Each shape is either {x, y, r} for a circle or {x, y, w, h} for a rectangle.
  kit.hit = function(a, b) {
    if (!a || typeof a !== 'object' || !b || typeof b !== 'object') return false;

    const aIsCircle = typeof a.r === 'number' && !isNaN(a.r);
    const bIsCircle = typeof b.r === 'number' && !isNaN(b.r);

    if (typeof a.x !== 'number' || isNaN(a.x) || typeof a.y !== 'number' || isNaN(a.y)) return false;
    if (typeof b.x !== 'number' || isNaN(b.x) || typeof b.y !== 'number' || isNaN(b.y)) return false;

    if (aIsCircle && bIsCircle) {
      // Circle to circle
      if (a.r <= 0 || b.r <= 0) return false;
      return kit.dist(a.x, a.y, b.x, b.y) <= (a.r + b.r);
    } else if (aIsCircle && !bIsCircle) {
      // Circle to rectangle
      if (typeof b.w !== 'number' || isNaN(b.w) || typeof b.h !== 'number' || isNaN(b.h)) return false;
      if (a.r <= 0 || b.w <= 0 || b.h <= 0) return false;
      return circleToRect(a, b);
    } else if (!aIsCircle && bIsCircle) {
      // Rectangle to circle (swap)
      if (typeof a.w !== 'number' || isNaN(a.w) || typeof a.h !== 'number' || isNaN(a.h)) return false;
      if (b.r <= 0 || a.w <= 0 || a.h <= 0) return false;
      return circleToRect(b, a);
    } else {
      // Rectangle to rectangle
      if (typeof a.w !== 'number' || isNaN(a.w) || typeof a.h !== 'number' || isNaN(a.h)) return false;
      if (typeof b.w !== 'number' || isNaN(b.w) || typeof b.h !== 'number' || isNaN(b.h)) return false;
      if (a.w <= 0 || a.h <= 0 || b.w <= 0 || b.h <= 0) return false;
      const aRight = a.x + a.w;
      const aBottom = a.y + a.h;
      const bRight = b.x + b.w;
      const bBottom = b.y + b.h;
      // Phaser uses < not <= for edges: touching edges is not overlapping
      return !(aRight <= b.x || aBottom <= b.y || a.x >= bRight || a.y >= bBottom);
    }
  };

  function circleToRect(circle, rect) {
    const halfWidth = rect.w / 2;
    const halfHeight = rect.h / 2;
    const cx = Math.abs(circle.x - rect.x - halfWidth);
    const cy = Math.abs(circle.y - rect.y - halfHeight);
    const xDist = halfWidth + circle.r;
    const yDist = halfHeight + circle.r;

    if (cx > xDist || cy > yDist) {
      return false;
    } else if (cx <= halfWidth || cy <= halfHeight) {
      return true;
    } else {
      const xCornerDist = cx - halfWidth;
      const yCornerDist = cy - halfHeight;
      const xCornerDistSq = xCornerDist * xCornerDist;
      const yCornerDistSq = yCornerDist * yCornerDist;
      const maxCornerDistSq = circle.r * circle.r;
      return (xCornerDistSq + yCornerDistSq <= maxCornerDistSq);
    }
  }

  // Reflect object velocity when it hits bounds edges and clamp it inside.
  // o must have {x, y, vx, vy} and optionally {r} or {w, h}. bounds is {x, y, w, h}.
  kit.bounce = function(o, bounds) {
    if (!o || typeof o !== 'object' || !bounds || typeof bounds !== 'object') return;
    if (typeof o.x !== 'number' || isNaN(o.x) || typeof o.y !== 'number' || isNaN(o.y)) return;
    if (typeof o.vx !== 'number' || isNaN(o.vx) || typeof o.vy !== 'number' || isNaN(o.vy)) return;
    if (typeof bounds.x !== 'number' || isNaN(bounds.x) || typeof bounds.y !== 'number' || isNaN(bounds.y)) return;
    if (typeof bounds.w !== 'number' || isNaN(bounds.w) || typeof bounds.h !== 'number' || isNaN(bounds.h)) return;

    const isCircle = typeof o.r === 'number' && !isNaN(o.r) && o.r > 0;
    const isRect = typeof o.w === 'number' && !isNaN(o.w) && typeof o.h === 'number' && !isNaN(o.h) && o.w > 0 && o.h > 0;

    let minX = bounds.x;
    let maxX = bounds.x + bounds.w;
    let minY = bounds.y;
    let maxY = bounds.y + bounds.h;

    if (isCircle) {
      minX += o.r;
      maxX -= o.r;
      minY += o.r;
      maxY -= o.r;
    } else if (isRect) {
      maxX -= o.w;
      maxY -= o.h;
    }
    // else: treat as point (no adjustment to bounds)

    // Check and reflect x (use <= for edge comparison to handle exact boundary)
    if (o.x <= minX) {
      o.x = minX;
      if (o.vx < 0) o.vx = -o.vx;
    } else if (o.x >= maxX) {
      o.x = maxX;
      if (o.vx > 0) o.vx = -o.vx;
    }

    // Check and reflect y (use <= for edge comparison to handle exact boundary)
    if (o.y <= minY) {
      o.y = minY;
      if (o.vy < 0) o.vy = -o.vy;
    } else if (o.y >= maxY) {
      o.y = maxY;
      if (o.vy > 0) o.vy = -o.vy;
    }
  };
})();
