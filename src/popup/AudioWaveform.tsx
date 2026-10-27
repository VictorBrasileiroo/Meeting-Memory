import { useEffect, useRef } from 'react';

export function AudioWaveform({ levels, simulated }: { levels: { tab: number; microphone: number } | null; simulated: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const samples = useRef({ tab: Array<number>(56).fill(0), microphone: Array<number>(56).fill(0) });
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    for (const source of ['tab', 'microphone'] as const) {
      samples.current[source].shift();
      const value = levels?.[source] ?? 0;
      samples.current[source].push(Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0);
    }
    context.clearRect(0, 0, 352, 112);
    context.fillStyle = '#2B3A66'; context.fillRect(0, 65, 352, 1);
    for (const source of ['tab', 'microphone'] as const) {
      context.fillStyle = source === 'tab' ? '#8FB0FF' : '#7EE6BE';
      samples.current[source].forEach((value, index) => {
        const height = 2 + value * (source === 'tab' ? 58 : 38);
        context.beginPath(); context.roundRect(index * 6.3, source === 'tab' ? 64 - height : 68, 3, height, 1.5); context.fill();
      });
    }
  }, [levels]);
  return <canvas ref={canvas} width="352" height="112" className="block h-28 w-full" role="img" aria-label={simulated ? 'Barras ilustrativas da simulação, sem medição de áudio' : 'Representação visual aproximada do áudio: aba acima, microfone abaixo'} />;
}
