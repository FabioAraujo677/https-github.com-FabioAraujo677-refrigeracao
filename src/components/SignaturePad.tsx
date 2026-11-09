import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Check, PenTool, Sparkles } from 'lucide-react';

interface SignaturePadProps {
  initialSignature?: string;
  onSave: (signatureDataUrl: string) => void;
  onClear?: () => void;
  title?: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  initialSignature,
  onSave,
  onClear,
  title = 'Assinatura do Cliente',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(Boolean(initialSignature));
  const [savedPreview, setSavedPreview] = useState<string | undefined>(initialSignature);

  useEffect(() => {
    if (initialSignature) {
      setSavedPreview(initialSignature);
      setHasSignature(true);
    }
  }, [initialSignature]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#06b6d4'; // Cyan neon stroke
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && hasSignature) {
      const dataUrl = canvas.toDataURL('image/png');
      setSavedPreview(dataUrl);
      onSave(dataUrl);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setSavedPreview(undefined);
    if (onClear) onClear();
  };

  const handleSimulateSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#06b6d4';

    // Draw an elegant simulated signature curve
    const startX = 60;
    const startY = 100;
    ctx.moveTo(startX, startY);
    ctx.bezierCurveTo(90, 40, 120, 140, 160, 80);
    ctx.bezierCurveTo(190, 50, 210, 120, 260, 95);
    ctx.bezierCurveTo(290, 80, 330, 110, 380, 85);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(120, 110);
    ctx.lineTo(390, 110);
    ctx.stroke();

    setHasSignature(true);
    const dataUrl = canvas.toDataURL('image/png');
    setSavedPreview(dataUrl);
    onSave(dataUrl);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
        <span className="flex items-center gap-1.5 text-cyan-400">
          <PenTool className="w-3.5 h-3.5" />
          {title}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSimulateSignature}
            className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors py-0.5 px-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 active:scale-95"
            title="Assinatura simulada para testes rápidos"
          >
            <Sparkles className="w-3 h-3 text-indigo-400" />
            Auto-assinar
          </button>
          <button
            type="button"
            onClick={clearCanvas}
            className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 transition-colors py-0.5 px-2 rounded-lg bg-rose-500/10 border border-rose-500/20 active:scale-95"
          >
            <Eraser className="w-3 h-3" />
            Limpar
          </button>
        </div>
      </div>

      <div className="relative rounded-2xl border border-cyan-500/30 bg-slate-900/80 p-2 backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.08)] overflow-hidden">
        {/* Neon target guide line */}
        <div className="absolute inset-x-6 bottom-7 border-b border-dashed border-cyan-500/20 pointer-events-none flex justify-between text-[10px] text-slate-500 px-1">
          <span>Assinar sobre a linha</span>
          <span>{hasSignature ? '✓ Registrado' : 'Touch / Mouse'}</span>
        </div>

        <canvas
          ref={canvasRef}
          width={460}
          height={160}
          className="w-full h-36 rounded-xl bg-slate-950/70 touch-none cursor-crosshair border border-slate-800"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        {!hasSignature && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400/80">
            <PenTool className="w-6 h-6 mb-1 text-cyan-400/60 animate-pulse" />
            <span className="text-xs font-medium">Toque e assine na tela com o dedo</span>
          </div>
        )}
      </div>

      {hasSignature && (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium px-1">
          <Check className="w-3.5 h-3.5" />
          <span>Assinatura digital capturada com sucesso</span>
        </div>
      )}
    </div>
  );
};
