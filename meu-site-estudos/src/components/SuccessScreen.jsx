import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const SuccessScreen = ({ email }) => {
    const [reenviando, setReenviando] = useState(false);
    const [status, setStatus] = useState('');

    const handleResend = async () => {
        setReenviando(true);
        setStatus('');
        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email,
            options: { emailRedirectTo: window.location.origin }
        });
        if (error) setStatus('erro');
        else setStatus('sucesso');
        setReenviando(false);
        setTimeout(() => setStatus(''), 5000);
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center font-sans
      bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <div className="p-10 rounded-3xl border shadow-2xl max-w-md w-full animate-in zoom-in duration-300 relative
        bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                <div className="w-20 h-20 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-cyan-500/20">
                    <div className={`w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full ${reenviando ? 'animate-spin' : 'animate-pulse'}`}></div>
                </div>
                <h2 className="text-3xl font-black mb-4">Quase lá! 🚀</h2>
                <p className="text-slate-600 dark:text-slate-400 mb-2">Enviamos um link para:</p>
                <p className="text-cyan-600 dark:text-cyan-400 font-bold mb-6 break-all">{email}</p>
                <div className="bg-cyan-500/5 border border-cyan-500/20 p-4 rounded-xl text-sm text-cyan-700 dark:text-cyan-200/70 mb-4 animate-pulse">
                    Aguardando confirmação do e-mail...
                </div>
                <div className="mt-6 flex flex-col items-center gap-3">
                    <button onClick={handleResend} disabled={reenviando} className="text-cyan-600 hover:text-cyan-500 dark:text-cyan-500 dark:hover:text-cyan-400 text-sm font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                        {reenviando ? "Reenviando..." : "Não recebeu? Reenviar e-mail de confirmação"}
                    </button>
                    {status === 'sucesso' && <span className="text-emerald-500 text-xs font-medium animate-bounce">Novo link enviado!</span>}
                    {status === 'erro' && <span className="text-red-500 text-xs font-medium">Erro ao reenviar.</span>}
                </div>
                <p className="text-slate-500 text-xs leading-relaxed italic mt-8 border-t border-slate-200 dark:border-slate-800 pt-4">
                    Assim que você clicar no link enviado, esta tela fechará sozinha e você entrará no seu Planner!
                </p>
            </div>
        </div>
    );
};

export default SuccessScreen;