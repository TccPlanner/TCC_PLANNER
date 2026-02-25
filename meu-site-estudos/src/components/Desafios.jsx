import React from "react";
import { Trophy, Target, CheckCircle2 } from "lucide-react";

export default function Desafios({ user }) {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-cyan-600 text-white">
                    <Trophy size={20} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold">Desafios</h2>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">
                        Missões para te dar foco e gamificar sua rotina.
                    </p>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
                <div className="rounded-2xl border p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2 font-semibold">
                        <Target size={18} /> Desafio do dia
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        (placeholder) Estude 25 minutos + registre 1 tarefa concluída.
                    </p>
                </div>

                <div className="rounded-2xl border p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2 font-semibold">
                        <CheckCircle2 size={18} /> Metas da semana
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        (placeholder) 4 sessões de estudo + 2 revisões agendadas.
                    </p>
                </div>

                <div className="rounded-2xl border p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2 font-semibold">
                        <Trophy size={18} /> Recompensas
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        (placeholder) Badges e níveis aparecem aqui.
                    </p>
                </div>
            </div>
        </div>
    );
}
