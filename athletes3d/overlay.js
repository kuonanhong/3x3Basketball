/* Lower-third used when a 3D clip is recorded to video (the on-screen page uses HTML instead). MIT. */
export function drawOverlay(x, w, h, info, alpha = 1) {
  const s = h / 720;
  x.save(); x.globalAlpha = alpha;
  // brand tag
  x.fillStyle = 'rgba(11,22,28,.72)'; round(x, 24 * s, 22 * s, 300 * s, 42 * s, 12 * s); x.fill();
  x.fillStyle = '#daef90'; round(x, 32 * s, 29 * s, 28 * s, 28 * s, 7 * s); x.fill();
  x.fillStyle = '#12272b'; x.font = `900 ${20 * s}px Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('S', 46 * s, 44 * s);
  x.fillStyle = '#e8f1ec'; x.textAlign = 'left'; x.font = `800 ${15 * s}px Arial, "Noto Sans CJK TC", sans-serif`; x.fillText('SMARTACTION SPORTS · 3D', 70 * s, 44 * s);
  // lower third
  const y0 = h - 150 * s, W = Math.min(w - 48 * s, 760 * s);
  const g = x.createLinearGradient(24 * s, 0, 24 * s + W, 0); g.addColorStop(0, 'rgba(11,22,28,.9)'); g.addColorStop(1, 'rgba(11,22,28,.55)');
  x.fillStyle = g; round(x, 24 * s, y0, W, 112 * s, 16 * s); x.fill();
  x.fillStyle = '#daef90'; x.fillRect(24 * s, y0 + 14 * s, 6 * s, 84 * s);
  x.fillStyle = '#ffffff'; x.font = `900 ${34 * s}px Arial, "Noto Sans CJK TC", sans-serif`; x.textBaseline = 'alphabetic';
  x.fillText(info.title, 46 * s, y0 + 46 * s);
  const tw = x.measureText(info.title).width;
  if (info.number) { x.fillStyle = '#13baad'; x.font = `900 ${30 * s}px Arial, sans-serif`; x.fillText('#' + info.number, 46 * s + tw + 14 * s, y0 + 45 * s); }
  x.fillStyle = '#cfe0dc'; x.font = `600 ${17 * s}px Arial, "Noto Sans CJK TC", sans-serif`; x.fillText(info.sub, 46 * s, y0 + 72 * s);
  x.fillStyle = '#daef90'; x.font = `800 ${18 * s}px Arial, "Noto Sans CJK TC", sans-serif`; x.fillText(info.move, 46 * s, y0 + 98 * s);
  // disclaimer
  x.fillStyle = 'rgba(232,241,236,.75)'; x.font = `500 ${12 * s}px Arial, "Noto Sans CJK TC", sans-serif`; x.textAlign = 'right';
  x.fillText(info.note, w - 24 * s, h - 20 * s);
  x.restore();
}
function round(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
