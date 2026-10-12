'use client';
import { useEffect, useRef } from 'react';

/**
 * Dotted glow background (canvas, no dependencies). A grid of dots whose opacity and radius
 * pulse on independent phases, so the field shimmers like the Aceternity effect.
 * Colours come from the semantic CSS variables, so it follows the paper / dark tokens.
 * Pauses off-screen and renders one static frame under prefers-reduced-motion.
 */
export function DottedGlow({
  gap = 18,
  radius = 1.2,
  colorVar = '--ink',
  glowVar = '--skim',
  opacity = 0.35,
  speed = 1,
  className = '',
}: {
  gap?: number;
  radius?: number;
  colorVar?: string;
  glowVar?: string;
  opacity?: number;
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    let dots: { x: number; y: number; phase: number; rate: number; glow: boolean }[] = [];
    let raf = 0;
    let visible = true;
    let ink = '17 17 20';
    let glow = '238 83 24';

    const readColors = () => {
      const cs = getComputedStyle(canvas);
      ink = cs.getPropertyValue(colorVar).trim() || ink;
      glow = cs.getPropertyValue(glowVar).trim() || glow;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = [];
      for (let y = gap / 2; y < h; y += gap) {
        for (let x = gap / 2; x < w; x += gap) {
          dots.push({ x, y, phase: Math.random() * Math.PI * 2, rate: 0.4 + Math.random() * 1.2, glow: Math.random() < 0.12 });
        }
      }
      readColors();
      draw(0);
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        const k = 0.5 + 0.5 * Math.sin(d.phase + t * d.rate * speed);
        const a = opacity * (0.25 + 0.75 * k);
        if (d.glow && k > 0.55) {
          ctx.shadowBlur = 8 * k;
          ctx.shadowColor = `rgb(${glow})`;
          ctx.fillStyle = `rgb(${glow} / ${Math.min(1, a * 2.2)})`;
        } else {
          ctx.shadowBlur = 0;
          ctx.fillStyle = `rgb(${ink} / ${a * 0.55})`;
        }
        ctx.beginPath();
        ctx.arc(d.x, d.y, radius * (0.7 + 0.5 * k), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (ms: number) => {
      if (visible) draw(ms / 1000);
      raf = requestAnimationFrame(loop);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);
    const mo = new MutationObserver(readColors);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    if (!reduce) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
    };
  }, [gap, radius, colorVar, glowVar, opacity, speed]);

  return <canvas ref={ref} aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />;
}
