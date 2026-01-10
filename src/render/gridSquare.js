export function drawSquareGrid(ctx, originX, originY, cols, rows, cell, stroke='rgba(255,255,255,0.08)') {
  ctx.save();
  ctx.strokeStyle = stroke;
  for (let x = 0; x <= cols; x++) {
    ctx.beginPath();
    ctx.moveTo(originX + x * cell, originY);
    ctx.lineTo(originX + x * cell, originY + rows * cell);
    ctx.stroke();
  }
  for (let y = 0; y <= rows; y++) {
    ctx.beginPath();
    ctx.moveTo(originX, originY + y * cell);
    ctx.lineTo(originX + cols * cell, originY + y * cell);
    ctx.stroke();
  }
  ctx.restore();
}

export function screenToGrid(px, py, originX, originY, cell) {
  const gx = Math.floor((px - originX) / cell);
  const gy = Math.floor((py - originY) / cell);
  return { gx, gy };
}
