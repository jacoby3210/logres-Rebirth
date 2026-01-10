// Pointy-top axial hex coords (q,r). We'll render into a bounded 7x5 board.
// Slightly larger hexes (+20%) for better readability.
export const HEX_SIZE = 41;

export function hexToPixel(q, r, originX, originY, size=HEX_SIZE) {
  const x = size * Math.sqrt(3) * (q + r/2);
  const y = size * 1.5 * r;
  return { x: originX + x, y: originY + y };
}

export function polygonCorners(x, y, size=HEX_SIZE) {
  const pts = [];
  for (let i=0;i<6;i++){
    const angle = Math.PI/180 * (60*i - 30);
    pts.push({ x: x + size*Math.cos(angle), y: y + size*Math.sin(angle) });
  }
  return pts;
}

export function drawHex(ctx, x, y, size=HEX_SIZE, stroke='rgba(255,255,255,0.10)', fill=null) {
  const pts = polygonCorners(x, y, size);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

export function pointInHex(px, py, hx, hy, size=HEX_SIZE) {
  // cheap circle check then accurate polygon using winding
  const dx = px - hx, dy = py - hy;
  if (dx*dx + dy*dy > (size*size*1.2)) return false;
  const pts = polygonCorners(hx, hy, size);
  let inside = false;
  for (let i=0, j=pts.length-1; i<pts.length; j=i++) {
    const xi=pts[i].x, yi=pts[i].y, xj=pts[j].x, yj=pts[j].y;
    const intersect = ((yi>py)!=(yj>py)) && (px < (xj-xi)*(py-yi)/(yj-yi+1e-9)+xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
