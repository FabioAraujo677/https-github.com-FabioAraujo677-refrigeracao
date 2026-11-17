import React, { useState } from 'react';
import { Download, Monitor, Smartphone, Share, X, CheckCircle2, Sparkles, Copy, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'header' | 'footer' | 'floating';
  showLabel?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Caso 1: Já instalado em modo standalone -> oculta o botão
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Caso 2: PC (Chrome/Edge) ou Android com prompt nativo disponível -> 1 clique direto
    if (isInstallable || (typeof window !== 'undefined' && window.__deferredInstallPrompt)) {
      await install();
      return;
    }

    // Caso 3: iPhone/iPad (iOS) ou navegador sem prompt automático -> modal compacto guiado
    setShowGuideModal(true);
  };

  return (
    <>
      <div
        onClick={handleInstallClick}
        className={`group relative px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#121418]/95 backdrop-blur-xl border border-cyan-500/30 hover:border-cyan-400 text-slate-200 flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.15)] cursor-pointer transition-all duration-300 shrink-0 ${className}`}
        title="Instalar App no seu Computador ou Celular (PWA)"
      >
        <div className="h-7 w-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 group-hover:scale-110 transition-transform">
          <Monitor className="w-3.5 h-3.5" />
        </div>
        <div className="hidden sm:block text-left leading-tight">
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-white">App Desktop</span>
            <span className="px-1 py-0.2 rounded text-[8px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase font-black">
              PWA
            </span>
          </div>
          <p className="text-[9px] text-slate-400">Instalar em janela</p>
        </div>
        <button
          type="button"
          onClick={handleInstallClick}
          className="ml-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-[10px] shadow-sm active:scale-95 transition-all shrink-0 flex items-center gap-1 cursor-pointer"
        >
          <Download className="w-3 h-3" />
          <span>Instalar</span>
        </button>
      </div>

      {showGuideModal && <InstallGuideModal isIOS={isIOS} onClose={() => setShowGuideModal(false)} />}
    </>
  );
};

// Modal compacto para iPhone/iPad (iOS Safari) ou PC/Android sem prompt automático
const InstallGuideModal: React.FC<{ isIOS: boolean; onClose: () => void }> = ({ isIOS, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#121418] border border-cyan-500/30 rounded-3xl p-6 shadow-2xl relative text-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-blue-600/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between gap-3 mb-4 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              {isIOS ? <Smartphone className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-tech tracking-wide">
                {isIOS ? 'Instalar no iPhone / iPad' : 'Instalar Aplicativo (PWA)'}
              </h3>
              <p className="text-xs text-slate-400">
                {isIOS ? 'Siga os 3 passos rápidos no Safari' : 'Atalho direto na Área de Trabalho ou Tela Inicial'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isIOS ? (
          <div className="space-y-3 text-xs text-slate-300 relative z-10">
            <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
                <Share className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-white mb-0.5">1. Toque em Compartilhar</p>
                <p className="text-slate-400">
                  Toque no ícone <strong>Compartilhar</strong> (quadrado com seta para cima na barra inferior/superior).
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
                <PlusSquare className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-white mb-0.5">2. Adicionar à Tela de Início</p>
                <p className="text-slate-400">
                  Role para baixo e toque em <strong>Adicionar à Tela de Início</strong>.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-white mb-0.5">3. Confirmar Instalação</p>
                <p className="text-slate-400">
                  Toque em <strong>Adicionar</strong> no canto superior direito para criar o ícone na tela.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-xs text-slate-300 relative z-10">
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
                <Monitor className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-white mb-1">Instalar pela barra de endereço (PC / Android):</p>
                <p className="text-slate-400 leading-relaxed">
                  Clique no ícone de <strong>instalar (computador com seta para baixo)</strong> no lado direito da barra de endereço no Chrome/Edge ou toque nos <strong>3 pontinhos → Instalar aplicativo</strong> no Android.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyLink}
              className={`w-full py-2.5 px-4 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                copied
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-900 hover:bg-slate-800 border-cyan-500/30 text-cyan-300'
              }`}
            >
              {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Link Copiado ✓' : 'Copiar Link para Abrir no Chrome / Edge'}</span>
            </button>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-white/10 flex justify-end relative z-10">
          <button
            onClick={onClose}
            type="button"
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg active:scale-95 transition-all cursor-pointer"
          >
            Entendi, fechar
          </button>
        </div>
      </div>
    </div>
  );
};
