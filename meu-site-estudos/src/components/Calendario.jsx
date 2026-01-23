import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

// FullCalendar
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid"; // mês
import timeGridPlugin from "@fullcalendar/timegrid"; // semana/dia
import interactionPlugin from "@fullcalendar/interaction"; // clique
import ptBrLocale from "@fullcalendar/core/locales/pt-br";

const Calendario = ({ user }) => {
    const [eventos, setEventos] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal simples de detalhes (sem libs)
    const [modalAberto, setModalAberto] = useState(false);
    const [eventoSelecionado, setEventoSelecionado] = useState(null);

    useEffect(() => {
        if (user?.id) buscarEventos();
        // eslint-disable-next-line
    }, [user?.id]);

    const buscarEventos = async () => {
        setLoading(true);

        try {
            // 1) Revisões agendadas
            const { data: revisoes, error: errRev } = await supabase
                .from("revisoes_agendadas")
                .select("*")
                .eq("user_id", user.id);

            // 2) Sessões de estudo (manual + cronometro)
            const { data: sessoes, error: errSes } = await supabase
                .from("sessoes_estudo")
                .select("*")
                .eq("user_id", user.id);

            if (errRev) console.log("Erro revisões:", errRev.message);
            if (errSes) console.log("Erro sessões:", errSes.message);

            // Revisões viram eventos de dia inteiro
            const eventosRevisoes = (revisoes || []).map((rev) => ({
                id: `rev-${rev.id}`,
                title: `🔁 ${rev.titulo}`,
                start: rev.data_revisao, // date "YYYY-MM-DD"
                allDay: true,
                extendedProps: {
                    tipo: "revisao",
                    titulo: rev.titulo,
                    dataRevisao: rev.data_revisao,
                },
            }));

            // Sessões viram eventos com horário real
            const eventosSessoes = (sessoes || []).map((s) => {
                const inicio = s.inicio_em; // timestamptz
                const dur = Number(s.duracao_segundos || 0);

                const fim = dur > 0 ? new Date(new Date(inicio).getTime() + dur * 1000).toISOString() : null;

                return {
                    id: `ses-${s.id}`,
                    title: `📚 ${s.materia} (${Math.round(dur / 60)}m)`,
                    start: inicio,
                    end: fim || undefined,
                    allDay: false,
                    extendedProps: {
                        tipo: "sessao",
                        materia: s.materia,
                        conteudo: s.conteudo,
                        tipoEstudo: s.tipo_estudo,
                        duracaoSegundos: dur,
                        anotacao: s.anotacao,
                        modo: s.modo,
                        questoes: {
                            feitas: s.questoes_feitas || 0,
                            acertos: s.questoes_acertos || 0,
                            erros: s.questoes_erros || 0,
                        },
                    },
                };
            });

            setEventos([...eventosRevisoes, ...eventosSessoes]);
        } finally {
            setLoading(false);
        }
    };

    const aoClicarEvento = (info) => {
        // info.event é o evento do FullCalendar
        const ev = info.event;

        setEventoSelecionado({
            title: ev.title,
            start: ev.start,
            end: ev.end,
            allDay: ev.allDay,
            ...ev.extendedProps,
        });

        setModalAberto(true);
    };

    const fecharModal = () => {
        setModalAberto(false);
        setEventoSelecionado(null);
    };

    return (
        <div className="w-full">
            {/* Top bar */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                        Calendário
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Revisões + sessões registradas no banco
                    </p>
                </div>

                <button
                    onClick={buscarEventos}
                    className="px-4 py-2 rounded-xl font-bold text-sm transition-all active:scale-95
          bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                >
                    Atualizar
                </button>
            </div>

            {/* Loading */}
            {loading ? (
                <div className="p-10 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
                    <p className="text-slate-500 dark:text-slate-400 animate-pulse">
                        Sincronizando eventos...
                    </p>
                </div>
            ) : (
                <div className="p-4 md:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
                    {/* FullCalendar */}
                    <FullCalendar
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                        initialView="dayGridMonth"
                        locales={[ptBrLocale]}
                        locale="pt-br"
                        headerToolbar={{
                            left: "prev,next today",
                            center: "title",
                            right: "dayGridMonth,timeGridWeek,timeGridDay",
                        }}
                        events={eventos}
                        eventClick={aoClicarEvento}
                        height="auto"
                        nowIndicator={true}
                        editable={false}
                        selectable={false}
                        dayMaxEvents={true}
                    />

                    {/* Legenda */}
                    <div className="mt-6 flex flex-wrap gap-3 text-sm">
                        <span className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                            🔁 Revisões
                        </span>
                        <span className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                            📚 Sessões de estudo
                        </span>
                    </div>
                </div>
            )}

            {/* Modal de detalhes */}
            {modalAberto && eventoSelecionado && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50"
                    onClick={fecharModal}
                >
                    <div
                        className="w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-800
            bg-white dark:bg-slate-900 shadow-2xl p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                                    {eventoSelecionado.title}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    {eventoSelecionado.start
                                        ? new Date(eventoSelecionado.start).toLocaleString()
                                        : "Sem data"}
                                </p>
                            </div>

                            <button
                                onClick={fecharModal}
                                className="px-3 py-2 rounded-xl font-bold text-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 cursor-pointer"
                            >
                                Fechar
                            </button>
                        </div>

                        <div className="mt-5 space-y-3">
                            {eventoSelecionado.tipo === "sessao" && (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <InfoBox label="Matéria" value={eventoSelecionado.materia} />
                                        <InfoBox label="Tipo de estudo" value={eventoSelecionado.tipoEstudo} />
                                        <InfoBox label="Conteúdo" value={eventoSelecionado.conteudo || "-"} />
                                        <InfoBox
                                            label="Duração"
                                            value={`${Math.round(
                                                (eventoSelecionado.duracaoSegundos || 0) / 60
                                            )} min`}
                                        />
                                    </div>

                                    {eventoSelecionado.tipoEstudo === "Exercícios" && (
                                        <div className="grid grid-cols-3 gap-3">
                                            <MiniBox label="Feitas" value={eventoSelecionado.questoes?.feitas ?? 0} />
                                            <MiniBox label="Acertos" value={eventoSelecionado.questoes?.acertos ?? 0} />
                                            <MiniBox label="Erros" value={eventoSelecionado.questoes?.erros ?? 0} />
                                        </div>
                                    )}

                                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4">
                                        <p className="text-xs font-black text-slate-400 mb-1">
                                            Anotações
                                        </p>
                                        <p className="text-sm text-slate-700 dark:text-slate-200">
                                            {eventoSelecionado.anotacao || "—"}
                                        </p>
                                    </div>
                                </>
                            )}

                            {eventoSelecionado.tipo === "revisao" && (
                                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4">
                                    <p className="text-xs font-black text-slate-400 mb-1">
                                        Revisão agendada
                                    </p>
                                    <p className="text-sm text-slate-700 dark:text-slate-200">
                                        {eventoSelecionado.titulo}
                                    </p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                                        Data: {eventoSelecionado.dataRevisao}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Componentes simples pra UI ficar consistente
const InfoBox = ({ label, value }) => (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4">
        <p className="text-xs font-black text-slate-400">{label}</p>
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-1">
            {value}
        </p>
    </div>
);

const MiniBox = ({ label, value }) => (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center">
        <p className="text-xs font-black text-slate-400">{label}</p>
        <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {value}
        </p>
    </div>
);

export default Calendario;
