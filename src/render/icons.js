// Canvas-drawn icons (no external assets).
// Goal: readable and "pretty" at small sizes, with consistent style.

export function drawUnitIcon(ctx, type, cx, cy, size, side = 'player') {
  const s = size;
  ctx.save();
  ctx.translate(cx, cy);

  const stroke = 'rgba(0,0,0,0.55)';
  const ink = side === 'player' ? 'rgba(210,235,255,0.95)' : 'rgba(255,220,220,0.95)';
  const accent = side === 'player' ? 'rgba(120,190,255,0.95)' : 'rgba(255,90,90,0.95)';

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (type === 'swordsman') {
    // Sword + small shield
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1.5, s * 0.08);
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, s * 0.35);
    ctx.lineTo(s * 0.35, -s * 0.25);
    ctx.stroke();

    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1.2, s * 0.06);
    ctx.beginPath();
    ctx.moveTo(-s * 0.12, s * 0.32);
    ctx.lineTo(s * 0.32, -s * 0.22);
    ctx.stroke();

    // hilt
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(1.5, s * 0.08);
    ctx.beginPath();
    ctx.moveTo(s * 0.08, s * 0.12);
    ctx.lineTo(s * 0.22, s * 0.26);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.02, s * 0.26);
    ctx.lineTo(s * 0.18, s * 0.06);
    ctx.stroke();

    // shield
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = Math.max(1.2, s * 0.06);
    roundedRect(ctx, -s * 0.42, -s * 0.12, s * 0.30, s * 0.40, s * 0.10);
    ctx.fill();
    ctx.stroke();
  } else if (type === 'archer') {
    // Bow + arrow
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = Math.max(1.5, s * 0.08);
    ctx.beginPath();
    ctx.arc(-s * 0.05, 0, s * 0.35, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();

    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(1.2, s * 0.06);
    ctx.beginPath();
    ctx.moveTo(-s * 0.05, -s * 0.35);
    ctx.lineTo(-s * 0.05, s * 0.35);
    ctx.stroke();

    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1.2, s * 0.06);
    ctx.beginPath();
    ctx.moveTo(-s * 0.05, 0);
    ctx.lineTo(s * 0.42, 0);
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(s * 0.42, 0);
    ctx.lineTo(s * 0.32, -s * 0.07);
    ctx.lineTo(s * 0.32, s * 0.07);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'mage') {
    // Staff with orb
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = Math.max(2, s * 0.10);
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, s * 0.40);
    ctx.lineTo(s * 0.10, -s * 0.35);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.30)';
    ctx.lineWidth = Math.max(1.2, s * 0.06);
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, s * 0.40);
    ctx.lineTo(s * 0.10, -s * 0.35);
    ctx.stroke();

    ctx.fillStyle = 'rgba(140,220,255,0.80)';
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.beginPath();
    ctx.arc(s * 0.18, -s * 0.42, s * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(s * 0.15, -s * 0.46, s * 0.04, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'healer') {
    // Cross + wand
    ctx.fillStyle = 'rgba(140,255,200,0.20)';
    ctx.strokeStyle = 'rgba(140,255,200,0.55)';
    ctx.lineWidth = Math.max(1.2, s * 0.06);
    roundedRect(ctx, -s * 0.16, -s * 0.30, s * 0.32, s * 0.60, s * 0.12);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = Math.max(2, s * 0.10);
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.22);
    ctx.lineTo(0, s * 0.22);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.16, 0);
    ctx.lineTo(s * 0.16, 0);
    ctx.stroke();
  } else {
    // fallback dot
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawTileIcon(ctx, kind, cx, cy, size, state = {}) {
  const s = size;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const used = state.used || state.opened || state.defeated;
  const alpha = used ? 0.35 : 1.0;

  const stroke = `rgba(0,0,0,${0.55 * alpha})`;
  const line = `rgba(255,255,255,${0.35 * alpha})`;
  const gold = `rgba(255,220,90,${0.95 * alpha})`;
  const red = `rgba(255,90,90,${0.95 * alpha})`;
  const orange = `rgba(255,140,90,${0.95 * alpha})`;
  const purple = `rgba(190,120,255,${0.95 * alpha})`;
  const green = `rgba(90,255,160,${0.90 * alpha})`;
  const cyan = `rgba(140,220,255,${0.90 * alpha})`;
  const gray = `rgba(210,210,210,${0.85 * alpha})`;
  const mint = `rgba(150,255,200,${0.85 * alpha})`;

  if (kind === 'chest') {
    ctx.fillStyle = `rgba(255,220,90,${0.18 * alpha})`;
    ctx.strokeStyle = line;
    ctx.lineWidth = Math.max(1.2, s * 0.08);
    roundedRect(ctx, -s * 0.45, -s * 0.20, s * 0.90, s * 0.55, s * 0.14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.arc(0, -s * 0.02, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1, s * 0.06);
    ctx.beginPath();
    ctx.moveTo(-s * 0.45, -s * 0.05);
    ctx.lineTo(s * 0.45, -s * 0.05);
    ctx.stroke();
  } else if (kind === 'camp') {
    // Tent
    ctx.fillStyle = `rgba(90,255,160,${0.14 * alpha})`;
    ctx.strokeStyle = line;
    ctx.lineWidth = Math.max(1.2, s * 0.08);
    ctx.beginPath();
    ctx.moveTo(-s * 0.40, s * 0.35);
    ctx.lineTo(0, -s * 0.35);
    ctx.lineTo(s * 0.40, s * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = green;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.35);
    ctx.lineTo(0, s * 0.35);
    ctx.stroke();
  } else if (kind === 'enemy' || kind === 'elite') {
    // Skull (elite adds star)
    ctx.fillStyle = `rgba(255,90,90,${0.14 * alpha})`;
    ctx.strokeStyle = red;
    ctx.lineWidth = Math.max(1.2, s * 0.08);
    ctx.beginPath();
    ctx.arc(0, -s * 0.05, s * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = stroke;
    ctx.beginPath();
    ctx.arc(-s * 0.12, -s * 0.08, s * 0.06, 0, Math.PI * 2);
    ctx.arc(s * 0.12, -s * 0.08, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = line;
    ctx.beginPath();
    ctx.moveTo(-s * 0.14, s * 0.14);
    ctx.lineTo(s * 0.14, s * 0.14);
    ctx.stroke();
    if (kind === 'elite') {
      drawStar(ctx, 0, -s * 0.42, s * 0.16, orange, line);
    }
  } else if (kind === 'boss') {
    // Crown
    ctx.fillStyle = `rgba(190,120,255,${0.18 * alpha})`;
    ctx.strokeStyle = purple;
    ctx.lineWidth = Math.max(1.2, s * 0.08);
    ctx.beginPath();
    ctx.moveTo(-s * 0.42, s * 0.18);
    ctx.lineTo(-s * 0.28, -s * 0.18);
    ctx.lineTo(-s * 0.08, s * 0.02);
    ctx.lineTo(0, -s * 0.22);
    ctx.lineTo(s * 0.08, s * 0.02);
    ctx.lineTo(s * 0.28, -s * 0.18);
    ctx.lineTo(s * 0.42, s * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = line;
    ctx.beginPath();
    ctx.moveTo(-s * 0.44, s * 0.20);
    ctx.lineTo(s * 0.44, s * 0.20);
    ctx.stroke();
  } else if (kind === 'shrine') {
    // Obelisk
    ctx.fillStyle = `rgba(140,220,255,${0.16 * alpha})`;
    ctx.strokeStyle = cyan;
    ctx.lineWidth = Math.max(1.2, s * 0.08);
    roundedRect(ctx, -s * 0.16, -s * 0.38, s * 0.32, s * 0.76, s * 0.10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${0.22 * alpha})`;
    ctx.beginPath();
    ctx.arc(0, -s * 0.48, s * 0.10, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'ruins') {
    // Broken columns
    ctx.fillStyle = `rgba(210,210,210,${0.10 * alpha})`;
    ctx.strokeStyle = gray;
    ctx.lineWidth = Math.max(1.2, s * 0.08);
    roundedRect(ctx, -s * 0.40, -s * 0.08, s * 0.22, s * 0.46, s * 0.08);
    roundedRect(ctx, s * 0.18, -s * 0.26, s * 0.22, s * 0.64, s * 0.08);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = line;
    ctx.beginPath();
    ctx.moveTo(-s * 0.45, s * 0.38);
    ctx.lineTo(s * 0.45, s * 0.38);
    ctx.stroke();
  } else if (kind === 'anomaly') {
    // Swirl
    ctx.strokeStyle = mint;
    ctx.lineWidth = Math.max(1.6, s * 0.10);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.30, 0.2, Math.PI * 1.4);
    ctx.stroke();
    ctx.strokeStyle = line;
    ctx.lineWidth = Math.max(1.2, s * 0.06);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.16, 0.6, Math.PI * 1.8);
    ctx.stroke();
    ctx.fillStyle = `rgba(150,255,200,${0.10 * alpha})`;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'hero') {
    // Simple helm + plume
    ctx.fillStyle = `rgba(120,190,255,${0.22 * alpha})`;
    ctx.strokeStyle = `rgba(120,190,255,${0.95 * alpha})`;
    ctx.lineWidth = Math.max(1.2, s * 0.08);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.30, Math.PI, 0);
    ctx.lineTo(s * 0.30, s * 0.18);
    ctx.lineTo(-s * 0.30, s * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = line;
    ctx.beginPath();
    ctx.moveTo(-s * 0.12, 0);
    ctx.lineTo(s * 0.20, 0);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.25 * alpha})`;
    ctx.beginPath();
    ctx.moveTo(-s * 0.06, -s * 0.34);
    ctx.lineTo(s * 0.12, -s * 0.46);
    ctx.stroke();
  } else {
    // fallback dot
    ctx.fillStyle = line;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawStar(ctx, x, y, r, fill, stroke) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(1, r * 0.22);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
