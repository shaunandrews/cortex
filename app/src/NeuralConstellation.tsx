import { useEffect, useRef } from 'react';

interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

export default function NeuralConstellation() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    let mx = -9999;
    let my = -9999;
    let raf = 0;

    const resize = () => {
      const dpr = devicePixelRatio || 1;
      w = innerWidth;
      h = innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();

    const COUNT = 80;
    const CONN = 140;
    const MRAD = 200;

    const pts: Point[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5,
    }));

    const onMouse = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };

    const frame = () => {
      ctx.clearRect(0, 0, w, h);

      if (!reduced) {
        for (const p of pts) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < -20) p.x = w + 20;
          if (p.x > w + 20) p.x = -20;
          if (p.y < -20) p.y = h + 20;
          if (p.y > h + 20) p.y = -20;
        }
      }

      // Connections
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d >= CONN) continue;

          const a = (1 - d / CONN) * 0.12;
          const cx = (pts[i].x + pts[j].x) / 2;
          const cy = (pts[i].y + pts[j].y) / 2;
          const md = Math.sqrt((cx - mx) ** 2 + (cy - my) ** 2);
          const boost = Math.max(0, 1 - md / MRAD);

          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(56, 88, 233, ${a + boost * 0.2})`;
          ctx.lineWidth = 0.5 + boost * 0.5;
          ctx.stroke();
        }
      }

      // Points
      for (const p of pts) {
        const md = Math.sqrt((p.x - mx) ** 2 + (p.y - my) ** 2);
        const boost = Math.max(0, 1 - md / MRAD);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + boost * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(56, 88, 233, ${0.15 + boost * 0.6})`;
        ctx.fill();
      }

      if (!reduced) {
        raf = requestAnimationFrame(frame);
      }
    };

    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else if (!reduced) {
        raf = requestAnimationFrame(frame);
      }
    };

    addEventListener('resize', resize);
    addEventListener('mousemove', onMouse);
    document.addEventListener('visibilitychange', onVis);

    if (reduced) {
      frame();
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      removeEventListener('mousemove', onMouse);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return <canvas ref={ref} className="neural-constellation" />;
}
