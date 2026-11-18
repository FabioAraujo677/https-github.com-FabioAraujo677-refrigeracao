import React, { useEffect, useRef, useState } from 'react';
import { Download, Monitor, Smartphone, Share, X, CheckCircle2, Sparkles, Copy, PlusSquare, BellRing } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { unlockAudioContext } from '../utils/audio';

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
  const [showInstalledToast, setShowInstalledToast] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const requestWakeLockSafe = async () => {
    try {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && navigator.wakeLock) {
        if (wakeLockRef.current && !wakeLockRef.current.released) {
          return;
        }
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch {
      // Navegador sem suporte ou janela em segundo plano
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Mantém Wake Lock ativo se já configurado pelo usuário
    if (localStorage.getItem('pwaWakeLockEnabled') === 'true') {
      requestWakeLockSafe();
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && localStorage.getItem('pwaWakeLockEnabled') === 'true') {
        requestWakeLockSafe();
      }
    };

    const handleAppInstalled = () => {
      setShowGuideModal(false);
      setShowInstalledToast(true);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!showInstalledToast) return;
    const timer = setTimeout(() => setShowInstalledToast(false), 11000);
    return () => clearTimeout(timer);
  }, [showInstalledToast]);

  const handleInstallClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // a) Desbloqueio imediato do AudioContext no gesto do usuário
    try {
      const ctx = unlockAudioContext(audioCtxRef.current);
      if (ctx) {
        audioCtxRef.current = ctx;
        if (ctx.state === 'suspended') {
          await ctx.resume().catch(() => {});
        }
        // Pulso silencioso para destravar áudio no Safari/Chrome mobile
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      }
    } catch {
      // Ignora caso navegador restrinja áudio
    }

    // b) Ativação das Notificações
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        let perm = Notification.permission;
        if (perm === 'default') {
          perm = await Notification.requestPermission();
        }
        if (perm === 'granted') {
          localStorage.setItem('notificationsEnabled', 'true');
        }
      }
    } catch {
      // Ignora erro caso Notification API não esteja disponível
    }

    // c) Registro do Service Worker (sw.js), Wake Lock e sessão persistente
    try {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
      }
      await requestWakeLockSafe();
      localStorage.setItem('pwaWakeLockEnabled', 'true');
      localStorage.setItem('pwaPersistentSession', 'true');
      if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
        navigator.storage.persist().catch(() => {});
      }
    } catch {
      // Ignora erro de storage/SW
    }

    // d) Instalação nativa do App (PWA) ou guia rápido de 2 toques no iOS
    if (isIOS) {
      setShowGuideModal(true);
      return;
    }

    if (typeof window !== 'undefined' && window.__deferredInstallPrompt) {
      try {
        const promptEvent = window.__deferredInstallPrompt;
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice.catch(() => null);
        window.__deferredInstallPrompt = null;
        if (choice?.outcome === 'accepted') {
          setShowInstalledToast(true);
          return;
        }
      } catch {
        // Fallback abaixo para o hook ou guia
      }
    }

    if (isInstallable) {
      const accepted = await install();
      if (accepted) {
        setShowInstalledToast(true);
        return;
      }
    }

    setShowGuideModal(true);
  };

  // Caso 1: Já instalado em modo standalone -> oculta botão, mas mantém aviso pós-instalação se ativo
  if (isInstalled && !showInstalledToast) {
    return null;
  }

  return (
    <>
      {!isInstalled && (
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
      )}

      {showGuideModal && <InstallGuideModal isIOS={isIOS} onClose={() => setShowGuideModal(false)} />}

      {showInstalledToast && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-[90] flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-slate-950/95 border border-emerald-500/40 text-emerald-100 shadow-[0_10px_35px_rgba(16,185,129,0.25)] backdrop-blur-xl animate-fadeIn">
          <div className="h-7 w-7 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
            <BellRing className="w-4 h-4" />
          </div>
          <div className="text-xs leading-relaxed flex-1">
            <p className="font-bold text-emerald-300">
              App instalado e notificações ativadas!
            </p>
            <p className="text-slate-300 mt-0.5">
              No celular, mantenha a bateria do app em <strong>&apos;Sem restrições&apos;</strong> para nunca perder alertas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowInstalledToast(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            title="Fechar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
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
                {isIOS ? 'Guia rápido de 2 toques no Safari' : 'Atalho direto na Área de Trabalho ou Tela Inicial'}
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
                  Toque no ícone <strong>Compartilhar</strong> (quadrado com seta para cima na barra do Safari).
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
                  Role para baixo, toque em <strong>Adicionar à Tela de Início</strong> e confirme em <strong>Adicionar</strong>.
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
