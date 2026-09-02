/**
 * 场景 A/B 切换动画：3D 翻转 + 沙散过渡
 */

export function toggleSceneFlip(flipInner, isSceneB) {
  flipInner.classList.toggle('flipped', isSceneB);
}

export function playSandDissolve(container, fromUrl, toUrl, { duration = 2200 } = {}) {
  return new Promise((resolve) => {
    const rect = container.getBoundingClientRect();
    const w = Math.floor(rect.width) || 320;
    const h = Math.floor(rect.height) || 440;

    const canvas = document.createElement('canvas');
    canvas.className = 'scene-sand-canvas';
    canvas.width = w;
    canvas.height = h;
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const imgA = new Image();
    const imgB = new Image();
    let loaded = 0;

    const onLoad = () => {
      loaded += 1;
      if (loaded < 2) return;
      runDissolve();
    };

    imgA.onload = onLoad;
    imgB.onload = onLoad;
    imgA.src = fromUrl;
    imgB.src = toUrl;

    function runDissolve() {
      let imageData;
      try {
        ctx.drawImage(imgA, 0, 0, w, h);
        imageData = ctx.getImageData(0, 0, w, h);
      } catch {
        canvas.remove();
        resolve();
        return;
      }
      const particles = [];
      const step = 6;

      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
          const i = (y * w + x) * 4;
          if (imageData.data[i + 3] < 20) continue;
          particles.push({
            x,
            y,
            ox: x,
            oy: y,
            r: imageData.data[i],
            g: imageData.data[i + 1],
            b: imageData.data[i + 2],
            delay: (x / w) * 0.35 + Math.random() * 0.25,
            vx: 1.5 + Math.random() * 3,
            vy: -0.5 + Math.random() * 1.2,
            size: step * (0.6 + Math.random() * 0.5),
            life: 1,
          });
        }
      }

      ctx.drawImage(imgB, 0, 0, w, h);
      const bgSnapshot = ctx.getImageData(0, 0, w, h);

      const start = performance.now();

      function frame(now) {
        const t = Math.min(1, (now - start) / duration);
        ctx.putImageData(bgSnapshot, 0, 0);

        particles.forEach((p) => {
          const local = Math.max(0, Math.min(1, (t - p.delay) / (1 - p.delay)));
          if (local <= 0) {
            ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},0.95)`;
            ctx.fillRect(p.ox, p.oy, p.size, p.size);
            return;
          }
          p.x += p.vx * local * 2.2;
          p.y += p.vy * local * 2.2 + local * 1.5;
          p.life = 1 - local;
          ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${p.life * 0.9})`;
          ctx.fillRect(p.x, p.y, p.size * p.life, p.size * p.life);
        });

        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          canvas.remove();
          resolve();
        }
      }

      requestAnimationFrame(frame);
    }
  });
}
