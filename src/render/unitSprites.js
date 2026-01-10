// Sprite-like unit rendering (no external assets).
// Inspired by classic fantasy tactics silhouettes, but fully original drawings.

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function strokeCircle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function roundedRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function shade(side, a = 1) {
  // Player: cooler palette, Enemy: warmer.
  const base = side === 'player' ? [90, 170, 255] : [255, 95, 95];
  return `rgba(${base[0]},${base[1]},${base[2]},${a})`;
}

function armor(side, a = 1) {
  const base = side === 'player' ? [210, 235, 255] : [255, 225, 225];
  return `rgba(${base[0]},${base[1]},${base[2]},${a})`;
}

function ink(a = 1) { return `rgba(0,0,0,${0.55 * a})`; }

export function drawStackSprite(ctx, stack, x, y, px = 36, opts = {}) {
  // opts: { t, active, selected, facing, fxFlash, fxShake, phase }
  const t = opts.t || 0;
  const side = stack.side || 'player';
  const active = !!opts.active;
  const selected = !!opts.selected;
  const facing = opts.facing ?? (side === 'player' ? 1 : -1);
  const flash = clamp01(opts.fxFlash || 0);
  const shake = clamp01(opts.fxShake || 0);
  const phase = opts.phase || 'idle';

  // Slight idle motion.
  const bob = Math.sin(t * 3.2 + (stack.q * 11 + stack.r * 7)) * 0.9;
  const sx = (Math.sin(t * 22) * 1.2) * shake;
  const sy = (Math.cos(t * 18) * 1.2) * shake;

  ctx.save();
  ctx.translate(x + sx, y + bob + sy);
  ctx.scale(facing, 1);

  // Base plate
  const r = px * 0.44;
  ctx.fillStyle = `rgba(0,0,0,${active ? 0.22 : 0.16})`;
  ctx.beginPath();
  ctx.ellipse(0, px * 0.28, r, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  // Highlight rings
  if (selected) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, px * 0.28, r * 1.05, r * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (active) {
    ctx.strokeStyle = 'rgba(120,190,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, px * 0.28, r * 1.05, r * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Flash overlay (hit/heal)
  if (flash > 0.01) {
    ctx.fillStyle = `rgba(255,255,255,${0.22 * flash})`;
    ctx.beginPath();
    ctx.ellipse(0, px * 0.05, r * 0.95, r * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Body anchor
  const bodyY = px * 0.04;
  const headY = -px * 0.18;
  const stroke = ink(1);
  const metal = armor(side, 0.95);
  const accent = shade(side, 0.95);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Shared: cloak/robe silhouette
  ctx.fillStyle = `rgba(255,255,255,${side === 'player' ? 0.06 : 0.04})`;
  ctx.strokeStyle = `rgba(255,255,255,0.10)`;
  ctx.lineWidth = 1;
  roundedRectPath(ctx, -px * 0.20, bodyY - px * 0.05, px * 0.40, px * 0.44, px * 0.12);
  ctx.fill();
  ctx.stroke();

  // Type-specific
  if (stack.type === 'swordsman') {
    // Armor torso
    ctx.fillStyle = metal;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.6;
    roundedRectPath(ctx, -px * 0.18, bodyY - px * 0.02, px * 0.36, px * 0.26, px * 0.10);
    ctx.fill();
    ctx.stroke();

    // Helmet + face slit
    ctx.fillStyle = metal;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.4;
    circle(ctx, 0, headY, px * 0.12);
    strokeCircle(ctx, 0, headY, px * 0.12);
    ctx.strokeStyle = `rgba(0,0,0,0.35)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-px * 0.06, headY);
    ctx.lineTo(px * 0.07, headY);
    ctx.stroke();

    // Shield
    ctx.fillStyle = `rgba(255,255,255,0.10)`;
    ctx.strokeStyle = `rgba(255,255,255,0.25)`;
    ctx.lineWidth = 1.4;
    roundedRectPath(ctx, -px * 0.30, bodyY - px * 0.02, px * 0.16, px * 0.26, px * 0.06);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = accent;
    circle(ctx, -px * 0.22, bodyY + px * 0.08, px * 0.025);

    // Sword (attack lunge)
    const lunge = phase === 'attack' ? 1 : 0;
    const swX = px * (0.16 + 0.10 * lunge);
    const swY = bodyY + px * (-0.05 - 0.06 * lunge);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(swX - px * 0.04, swY + px * 0.20);
    ctx.lineTo(swX + px * 0.12, swY - px * 0.18);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,0.55)`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(swX - px * 0.03, swY + px * 0.18);
    ctx.lineTo(swX + px * 0.11, swY - px * 0.16);
    ctx.stroke();
    // Hilt
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(swX - px * 0.07, swY + px * 0.05);
    ctx.lineTo(swX + px * 0.06, swY + px * 0.10);
    ctx.stroke();
  } else if (stack.type === 'archer') {
    // Hood
    ctx.fillStyle = `rgba(0,0,0,${side === 'player' ? 0.20 : 0.24})`;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.3;
    circle(ctx, 0, headY, px * 0.12);
    strokeCircle(ctx, 0, headY, px * 0.12);

    // Tunic
    ctx.fillStyle = `rgba(255,255,255,0.08)`;
    ctx.strokeStyle = `rgba(255,255,255,0.12)`;
    ctx.lineWidth = 1;
    roundedRectPath(ctx, -px * 0.16, bodyY - px * 0.01, px * 0.32, px * 0.28, px * 0.09);
    ctx.fill();
    ctx.stroke();

    // Bow + arrow
    const drawPull = phase === 'attack' ? 1 : 0;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(px * 0.16, bodyY + px * 0.02, px * 0.18, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,0.45)`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(px * 0.16, bodyY - px * 0.16);
    ctx.lineTo(px * (0.16 - 0.08 * drawPull), bodyY + px * 0.18);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255,255,255,0.70)`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-px * 0.04, bodyY + px * 0.02);
    ctx.lineTo(px * 0.38, bodyY + px * 0.02);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,0.85)`;
    ctx.beginPath();
    ctx.moveTo(px * 0.38, bodyY + px * 0.02);
    ctx.lineTo(px * 0.32, bodyY - px * 0.03);
    ctx.lineTo(px * 0.32, bodyY + px * 0.07);
    ctx.closePath();
    ctx.fill();
  } else if (stack.type === 'mage') {
    // Hat
    ctx.fillStyle = `rgba(20,20,40,${side === 'player' ? 0.55 : 0.60})`;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-px * 0.10, headY + px * 0.02);
    ctx.lineTo(px * 0.04, headY - px * 0.18);
    ctx.lineTo(px * 0.16, headY + px * 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Robe
    ctx.fillStyle = `rgba(255,255,255,0.06)`;
    ctx.strokeStyle = `rgba(255,255,255,0.10)`;
    ctx.lineWidth = 1.0;
    roundedRectPath(ctx, -px * 0.18, bodyY - px * 0.02, px * 0.36, px * 0.34, px * 0.12);
    ctx.fill();
    ctx.stroke();

    // Staff + orb
    const cast = phase === 'attack' ? 1 : 0;
    ctx.strokeStyle = `rgba(0,0,0,0.55)`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(px * (0.10 + 0.08 * cast), bodyY + px * 0.20);
    ctx.lineTo(px * 0.20, headY - px * 0.06);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,0.35)`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(px * (0.10 + 0.08 * cast), bodyY + px * 0.20);
    ctx.lineTo(px * 0.20, headY - px * 0.06);
    ctx.stroke();
    const glow = 0.55 + 0.25 * Math.sin(t * 5.5);
    ctx.fillStyle = `rgba(140,220,255,${0.55 + 0.35 * glow})`;
    circle(ctx, px * 0.22, headY - px * 0.10, px * 0.06);
    ctx.strokeStyle = `rgba(255,255,255,0.35)`;
    ctx.lineWidth = 1.0;
    strokeCircle(ctx, px * 0.22, headY - px * 0.10, px * 0.06);
  } else if (stack.type === 'healer') {
    // Halo
    const halo = 0.65 + 0.25 * Math.sin(t * 4.2);
    ctx.strokeStyle = `rgba(140,255,200,${0.35 + 0.25 * halo})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, headY - px * 0.08, px * 0.10, px * 0.05, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Head
    ctx.fillStyle = `rgba(255,255,255,0.16)`;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.2;
    circle(ctx, 0, headY, px * 0.11);
    strokeCircle(ctx, 0, headY, px * 0.11);

    // Robe
    ctx.fillStyle = `rgba(140,255,200,0.10)`;
    ctx.strokeStyle = `rgba(140,255,200,0.18)`;
    ctx.lineWidth = 1.1;
    roundedRectPath(ctx, -px * 0.18, bodyY - px * 0.02, px * 0.36, px * 0.34, px * 0.12);
    ctx.fill();
    ctx.stroke();

    // Cross on chest
    ctx.strokeStyle = `rgba(255,255,255,0.70)`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, bodyY + px * 0.02);
    ctx.lineTo(0, bodyY + px * 0.16);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-px * 0.06, bodyY + px * 0.09);
    ctx.lineTo(px * 0.06, bodyY + px * 0.09);
    ctx.stroke();

    // Healing sparkle
    if (phase === 'heal') {
      const p = 0.5 + 0.5 * Math.sin(t * 10);
      ctx.strokeStyle = `rgba(140,255,200,${0.35 + 0.35 * p})`;
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI * 2 * i) / 6 + t * 0.6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * px * 0.06, headY + Math.sin(ang) * px * 0.06);
        ctx.lineTo(Math.cos(ang) * px * 0.12, headY + Math.sin(ang) * px * 0.12);
        ctx.stroke();
      }
    }
  } else {
    // Fallback blob
    ctx.fillStyle = armor(side, 0.35);
    circle(ctx, 0, bodyY, px * 0.16);
  }

  // Count badge
  ctx.scale(facing, 1); // back to screen space for text
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.ellipse(0, px * 0.42, px * 0.22, px * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.90)';
  ctx.font = `${Math.max(10, Math.floor(px * 0.24))}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(stack.count), 0, px * 0.42);

  ctx.restore();
}
