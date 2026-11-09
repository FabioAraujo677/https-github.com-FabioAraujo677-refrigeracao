import React, { useState } from 'react';
import { Download, Monitor, Smartphone, Share, X, CheckCircle2, Sparkles, ExternalLink } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'header' | 'footer' | 'floating';
  showLabel?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'header',
  showLabel = true,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // If already installed or running as standalone desktop app, do not show
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isInstallable) {
      const success = await install();
      if (success) {
        setJustInstalled(true);
        setTimeout(() => setJustInstalled(false), 3000);
      }
    } else {
      // Show instructional modal if beforeinstallprompt is not yet fired or on iOS/Desktop Chrome
      setShowGuideModal(true);
    }
  };

  // Header Variant (Compact, sleek desktop button)
  if (variant === 'header') {
    return (
      <>
        <button
          onClick={handleInstallClick}
          type="button"
          title="Instalar App no seu Computador ou Celular (PWA)"
          className={`relative group px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600/20 via-blue-600/20 to-indigo-600/20 hover:from-cyan-600/30 hover:to-indigo-600/30 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 hover:text-white transition-all duration-300 text-xs font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.15)] hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] active:scale-95 shrink-0 ${className}`}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
          <Download className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 group-hover:translate-y-0.5 transition-transform" />
          {showLabel && (
            <span className="hidden sm:inline font-semibold tracking-wide">
              Instalar App
            </span>
          )}
        </button>

        {showGuideModal && <InstallGuideModal isIOS={isIOS} onClose={() => setShowGuideModal(false)} />}
      </>
    );
  }

  // Footer / Floating Variant
  return (
    <>
      <div
        className={`fixed bottom-4 right-4 z-40 max-w-sm p-3.5 rounded-2xl bg-[#121418]/95 backdrop-blur-xl border border-cyan-500/30 shadow-[0_10px_35px_rgba(0,0,0,0.8)] text-slate-200 flex items-center gap-3 animate-fadeIn ${className}`}
      >
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
          <Monitor className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white leading-tight">
            <span>Usar como App Desktop</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase font-black">
              PWA
            </span>
          </div>
          <p className="text-[11px] text-slate-400 truncate mt-0.5">
            Instale para acesso rápido em janela própria.
          </p>
        </div>
        <button
          onClick={handleInstallClick}
          type="button"
          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs shadow-lg active:scale-95 transition-all shrink-0 flex items-center gap-1"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Instalar</span>
        </button>
      </div>

      {showGuideModal && <InstallGuideModal isIOS={isIOS} onClose={() => setShowGuideModal(false)} />}
    </>
  );
};

// Modal for guidance when browser requires manual tap (e.g. iOS Safari or desktop browser prompt delay)
const InstallGuideModal: React.FC<{ isIOS: boolean; onClose: () => void }> = ({ isIOS, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div
        className="w-full max-w-md bg-[#121418] border border-cyan-500/30 rounded-3xl p-6 shadow-2xl relative text-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow blurs */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-blue-600/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-tech tracking-wide">
                Instalação do Aplicativo (PWA)
              </h3>
              <p className="text-xs text-slate-400">Modo Desktop & Mobile sem barras do navegador</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isIOS ? (
          <div className="space-y-3.5 text-xs text-slate-300">
            <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
                <Share className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-white mb-0.5">1. Toque em Compartilhar</p>
                <p className="text-slate-400">Na barra inferior do Safari no iPhone ou iPad, toque no ícone de compartilhar.</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-white mb-0.5">2. Adicionar à Tela de Início</p>
                <p className="text-slate-400">Role para baixo na lista de ações e toque em <strong>"Adicionar à Tela de Início"</strong>.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-xs text-slate-300">
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
                <Monitor className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-white mb-1">No Computador (Chrome / Edge / Opera / Brave):</p>
                <p className="text-slate-400 leading-relaxed">
                  Clique no ícone de <strong>instalar (computador com seta para baixo)</strong> localizado no lado direito da barra de endereços (URL) do seu navegador e confirme <strong>"Instalar"</strong>.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-white mb-1">No Celular Android:</p>
                <p className="text-slate-400 leading-relaxed">
                  Toque nos <strong>três pontinhos (menu)</strong> no topo do navegador e selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            type="button"
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg active:scale-95 transition-all"
          >
            Entendi, fechar
          </button>
        </div>
      </div>
    </div>
  );
};
