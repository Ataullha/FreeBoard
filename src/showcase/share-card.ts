import { drawLaunchArtwork } from './launchArtwork';
import './share-card.css';

// Owner-facing artwork export. Render the code-defined layout at its exact size.
const button = document.createElement('button');
button.textContent = 'Download 1200 × 630 PNG';
button.style.cssText =
  'margin:20px 52px;padding:14px 20px;background:#171717;color:white;border:0;border-radius:8px;cursor:pointer;font:13px Inter,sans-serif';
document.body.append(button);
button.addEventListener('click', async () => {
  button.disabled = true;
  try {
    await Promise.all([
      document.fonts.load('500 78px Inter'),
      document.fonts.load('600 27px Inter'),
      document.fonts.load('400 15px Inter'),
    ]);
    const logo = document.querySelector<HTMLImageElement>('.share-brand img')!;
    const product =
      document.querySelector<HTMLImageElement>('.share-product img')!;
    await Promise.all([logo.decode(), product.decode()]);
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const c = canvas.getContext('2d')!;
    drawLaunchArtwork(
      c,
      logo,
      product,
      product.naturalWidth,
      product.naturalHeight,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(Error('Image export failed'))),
        'image/png',
      ),
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = 'FreeBoard-LinkedIn-launch.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    button.textContent =
      error instanceof Error ? error.message : 'Please reload and retry';
  } finally {
    button.disabled = false;
  }
});
