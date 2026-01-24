import React, { useEffect, useMemo, useState } from "react";
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

    // ✅ NOVO: Realtime para atualizar sozinho quando você clicar REVISEI
    useEffect(() => {
        if (!user?.id) return;

        const ch1 = supabase
            .channel("revisoes_agendadas_changes")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "revisoes_agendadas",
                    filter: `user_id=eq.${user.id}`,
                },
                () => buscarEventos()
            )
            .subscribe();

        const ch2 = supabase
            .channel("sessoes_estudo_changes")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "sessoes_estudo",
                    filter: `user_id=eq.${user.id}`,
                },
                () => buscarEventos()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(ch1);
            supabase.removeChannel(ch2);
        };
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

            // ✅ Revisões viram eventos de dia inteiro
            const eventosRevisoes = (revisoes || []).map((rev) => {
                const concluida = !!rev.executada;

                return {
                    id: `rev-${rev.id}`,
                    title: concluida ? `✅ ${rev.titulo}` : `🔁 ${rev.titulo}`,
                    start: rev.data_revisao, // date "YYYY-MM-DD"
                    allDay: true,

                    // ✅ visual bonito direto no evento (sem CSS extra)
                    backgroundColor: concluida ? "#10b981" : "#4f46e5",
                    borderColor: concluida ? "#10b981" : "#4f46e5",
                    textColor: "#ffffff",

                    extendedProps: {
                        tipo: "revisao",
                        titulo: rev.titulo,
                        conteudo: rev.conteudo,
                        tipoRevisao: rev.tipo_revisao,
                        dataRevisao: rev.data_revisao,
                        executada: concluida,
                        // desempenho
                        qtdFeitas: rev.qtd_feitas || 0,
                        qtdAcertos: rev.qtd_acertos || 0,
                        qtdErros: rev.qtd_erros || 0,
                        metaQuestoes: rev.meta_questoes || 0,
                        origem: rev.origem,
                    },
                };
            });

            // ✅ Sessões viram eventos com horário real
            const eventosSessoes = (sessoes || []).map((s) => {
                const inicio = s.inicio_em; // timestamptz
                const dur = Number(s.duracao_segundos || 0);

                const fim =
                    dur > 0
                        ? new Date(new Date(inicio).getTime() + dur * 1000).toISOString()
                        : null;

                const minutos = Math.round(dur / 60);

                return {
                    id: `ses-${s.id}`,
                    title: `📚 ${s.materia} (${minutos}m)`,
                    start: inicio,
                    end: fim || undefined,
                    allDay: false,

                    // ✅ design: sessões com azul suave
                    backgroundColor: "#0ea5e9",
                    borderColor: "#0ea5e9",
                    textColor: "#ffffff",

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

    const dataLegivel = (d) => {
        try {
            return d ? new Date(d).toLocaleString("pt-BR") : "Sem data";
        } catch {
            return "Sem data";
        }
    };

    const badgeRevisao = (executada) => {
        return executada ? (
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest
        bg-emerald-50 text-emerald-600 border border-emerald-100">
                ✅ Concluída
            </span>
        ) : (
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest
        bg-indigo-50 text-indigo-600 border border-indigo-100">
                🔁 Pendente
            </span>
        );
    };

    return (
        <div className="w-full">
            {/* Top bar (mais bonito) */}
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
                    className="px-4 py-2 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95
          bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_10px_25px_-10px_rgba(79,70,229,0.6)]"
                >
                    Atualizar
                </button>
            </div>

            {/* Loading */}
            {loading ? (
                <div className="p-10 rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
                    <p className="text-slate-500 dark:text-slate-400 animate-pulse font-bold">
                        Sincronizando eventos...
                    </p>
                </div>
            ) : (
                <div className="p-4 md:p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
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

                    {/* ✅ Legenda (mais clara e bonita) */}
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <LegendaItem
                            label="🔁 Revisão pendente"
                            bg="bg-indigo-50 dark:bg-indigo-950/40"
                            text="text-indigo-700 dark:text-indigo-200"
                            border="border-indigo-100 dark:border-indigo-900/30"
                        />
                        <LegendaItem
                            label="✅ Revisão concluída"
                            bg="bg-emerald-50 dark:bg-emerald-950/30"
                            text="text-emerald-700 dark:text-emerald-200"
                            border="border-emerald-100 dark:border-emerald-900/30"
                        />
                        <LegendaItem
                            label="📚 Sessão de estudo"
                            bg="bg-sky-50 dark:bg-sky-950/30"
                            text="text-sky-700 dark:text-sky-200"
                            border="border-sky-100 dark:border-sky-900/30"
                        />
                    </div>
                </div>
            )}

            {/* Modal de detalhes (mais friendly e completo) */}
            {modalAberto && eventoSelecionado && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={fecharModal}
                >
                    <div
                        className="w-full max-w-xl rounded-[36px] border border-slate-200 dark:border-slate-800
            bg-white dark:bg-slate-900 shadow-2xl p-7"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2">
                                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                                    {eventoSelecionado.title}
                                </h3>

                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest
                    bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200">
                                        {eventoSelecionado.tipo === "sessao" ? "Sessão" : "Revisão"}
                                    </span>

                                    {eventoSelecionado.tipo === "revisao" &&
                                        badgeRevisao(eventoSelecionado.executada)}
                                </div>

                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {dataLegivel(eventoSelecionado.start)}
                                </p>
                            </div>

                            <button
                                onClick={fecharModal}
                                className="px-4 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest
                bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 active:scale-95 transition-all"
                            >
                                Fechar
                            </button>
                        </div>

                        <div className="mt-6 space-y-4">
                            {eventoSelecionado.tipo === "sessao" && (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <InfoBox label="Matéria" value={eventoSelecionado.materia} />
                                        <InfoBox label="Tipo de estudo" value={eventoSelecionado.tipoEstudo} />
                                        <InfoBox label="Conteúdo" value={eventoSelecionado.conteudo || "—"} />
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

                                    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-5">
                                        <p className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">
                                            Anotações
                                        </p>
                                        <p className="text-sm text-slate-700 dark:text-slate-200 font-medium">
                                            {eventoSelecionado.anotacao || "—"}
                                        </p>
                                    </div>
                                </>
                            )}

                            {eventoSelecionado.tipo === "revisao" && (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <InfoBox label="Matéria" value={eventoSelecionado.titulo || "—"} />
                                        <InfoBox label="Tipo" value={eventoSelecionado.tipoRevisao || "—"} />
                                        <InfoBox label="Conteúdo" value={eventoSelecionado.conteudo || "—"} />
                                        <InfoBox label="Origem" value={eventoSelecionado.origem || "—"} />
                                    </div>

                                    {/* ✅ Se concluída e for questões/simulado, mostra desempenho */}
                                    {(eventoSelecionado.tipoRevisao === "Questões" ||
                                        eventoSelecionado.tipoRevisao === "Simulado") && (
                                            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                                                <p className="text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">
                                                    Desempenho
                                                </p>

                                                <div className="grid grid-cols-4 gap-3">
                                                    <MiniBox label="Meta" value={eventoSelecionado.metaQuestoes ?? 0} />
                                                    <MiniBox label="Feitas" value={eventoSelecionado.qtdFeitas ?? 0} />
                                                    <MiniBox label="Acertos" value={eventoSelecionado.qtdAcertos ?? 0} />
                                                    <MiniBox label="Erros" value={eventoSelecionado.qtdErros ?? 0} />
                                                </div>
                                            </div>
                                        )}

                                    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-5">
                                        <p className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">
                                            Data da revisão
                                        </p>
                                        <p className="text-sm text-slate-700 dark:text-slate-200 font-bold">
                                            {eventoSelecionado.dataRevisao}
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ✅ Itens auxiliares de UI
const LegendaItem = ({ label, bg, text, border }) => (
    <div className={`px-4 py-3 rounded-2xl border ${bg} ${text} ${border} font-black text-xs uppercase tracking-widest`}>
        {label}
    </div>
);

const InfoBox = ({ label, value }) => (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-5">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {label}
        </p>
        <p className="text-sm font-black text-slate-800 dark:text-slate-100 mt-1">
            {value}
        </p>
    </div>
);

const MiniBox = ({ label, value }) => (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {label}
        </p>
        <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {value}
        </p>
    </div>
);

export default Calendario;
