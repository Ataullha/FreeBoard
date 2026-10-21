/** Exact, code-defined 1200 × 630 artwork, shared by browser and raster exporters. */
export function drawLaunchArtwork(
  c: CanvasRenderingContext2D,
  logo: CanvasImageSource,
  product: CanvasImageSource,
  productWidth: number,
  productHeight: number,
) {
  c.fillStyle = '#f5f4f0';
  c.fillRect(0, 0, 1200, 630);
  c.drawImage(logo, 52, 40, 36, 36);
  c.fillStyle = '#171717';
  c.font = '600 27px Inter';
  c.fillText('FreeBoard', 99, 67);
  c.fillStyle = '#ffffff70';
  c.strokeStyle = '#d6d6cf';
  c.lineWidth = 1;
  c.beginPath();
  c.roundRect(988, 43, 160, 30, 5);
  c.fill();
  c.stroke();
  c.font = '500 10px Inter';
  c.fillStyle = '#171717';
  c.letterSpacing = '1.55px';
  c.fillText('FREE & OPEN SOURCE', 999, 62);
  c.font = '500 9px Inter';
  c.fillStyle = '#6d6d63';
  c.letterSpacing = '1.8px';
  c.fillText('A QUIET PLACE TO THINK', 52, 167);
  c.font = '500 78px Inter';
  c.fillStyle = '#171717';
  c.letterSpacing = '-4.7px';
  c.fillText('Make space', 52, 261);
  c.fillText('for ideas.', 52, 342);
  c.letterSpacing = '0px';
  c.strokeStyle = '#171717';
  c.lineWidth = 2.5;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(163, 364);
  c.bezierCurveTo(204, 356, 281, 357, 349, 365);
  c.moveTo(178, 370);
  c.bezierCurveTo(242, 364, 287, 365, 326, 368);
  c.stroke();
  c.font = '400 15px Inter';
  c.fillStyle = '#717167';
  c.letterSpacing = '-.15px';
  c.fillText('Your ideas. Your browser.', 52, 410);
  c.fillText('A whiteboard for clearer thinking.', 52, 438);
  const pw = 652,
    ph = (pw * productHeight) / productWidth;
  c.save();
  c.translate(548 + pw / 2, 128 + ph / 2);
  c.rotate((-2 * Math.PI) / 180);
  c.shadowColor = '#24241930';
  c.shadowBlur = 45;
  c.shadowOffsetY = 18;
  c.fillStyle = 'white';
  c.beginPath();
  c.roundRect(-pw / 2, -ph / 2, pw, ph, 11);
  c.fill();
  c.shadowColor = 'transparent';
  c.clip();
  c.drawImage(product, -pw / 2, -ph / 2, pw, ph);
  c.restore();
  c.save();
  c.translate(548 + pw / 2, 128 + ph / 2);
  c.rotate((-2 * Math.PI) / 180);
  c.strokeStyle = '#d1d1c9';
  c.lineWidth = 1;
  c.beginPath();
  c.roundRect(-pw / 2, -ph / 2, pw, ph, 11);
  c.stroke();
  c.restore();
  c.font = '500 13px Inter';
  c.fillStyle = '#171717';
  c.letterSpacing = '-.2px';
  c.fillText('ataullha.github.io/FreeBoard', 52, 589);
  c.strokeStyle = '#171717';
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(241, 589);
  c.lineTo(249, 581);
  c.moveTo(242, 581);
  c.lineTo(249, 581);
  c.lineTo(249, 588);
  c.stroke();
  c.font = '400 10px Inter';
  c.fillStyle = '#77776c';
  c.letterSpacing = '0px';
  c.fillText('Draw naturally', 858, 586);
  c.fillText('Save locally', 969, 586);
  c.fillText('Work offline', 1074, 586);
  c.fillStyle = '#aaa99e';
  for (const x of [950, 1055]) {
    c.beginPath();
    c.arc(x, 582, 1.5, 0, Math.PI * 2);
    c.fill();
  }
}
