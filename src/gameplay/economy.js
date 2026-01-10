// Economy helpers: keep all resource rules in one place.

/**
 * Clamp VE to veMax.
 * Overflow is converted to gold (simple 1 VE -> 2 Gold tuning).
 */
export function clampResources(model) {
  const veMax = model.res.veMax ?? 100;
  if (model.res.ve > veMax) {
    const overflow = model.res.ve - veMax;
    model.res.ve = veMax;
    model.res.gold += overflow * 2;
    return { overflowVe: overflow };
  }
  if (model.res.ve < 0) model.res.ve = 0;
  if (model.res.gold < 0) model.res.gold = 0;
  return { overflowVe: 0 };
}
