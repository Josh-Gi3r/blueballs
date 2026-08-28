export type CoverFrame = {
  progress: number;
  imageScale: number;
  imageShift: number;
  cardOpacity: number;
  cardShift: number;
  coverOpacity: number;
  homeReveal: number;
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (value: number, start: number, end: number) => {
  const t = clamp((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};

export function coverFrame(progress: number): CoverFrame {
  const p = clamp(progress);
  const cardExit = smoothstep(p, 0.2, 0.58);
  const coverExit = smoothstep(p, 0.54, 0.96);
  return {
    progress: p,
    imageScale: 1 + p * 0.045,
    imageShift: -14 * p,
    cardOpacity: 1 - cardExit,
    cardShift: -42 * cardExit,
    coverOpacity: 1 - coverExit,
    homeReveal: smoothstep(p, 0.45, 1),
  };
}
