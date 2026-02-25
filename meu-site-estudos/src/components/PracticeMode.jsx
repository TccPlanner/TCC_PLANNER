import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { Eye, RefreshCw, Star, StarOff } from "lucide-react";

function classNames(...arr) {
    return arr.filter(Boolean).join(" ");
}

function maskCloze(text) {
    if (!text) return "";
    if (text.includes("____")) return text;
    return text;
}

export default function PracticeMode({ refreshKey, filters }) {
    const deckId = filters?.deckId;
    const onlyDue = filters?.onlyDue ?? true;
    const onlyFavorites = filters?.onlyFavorites ?? false;

    const [loading, setLoading] = useState(true);
    const [cards, setCards] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showAnswer, setShowAnswer] = useState(false);

    const [favSet, setFavSet] = useState(new Set());
    const currentCard = useMemo(() => cards[currentIndex], [cards, currentIndex]);

    useEffect(() => {
        if (!deckId) {
            setCards([]);
            setLoading(false);
            return;
        }
        fetchDueCards();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deckId, onlyDue, onlyFavorites, refreshKey]);

    async function fetchDueCards() {
        setLoading(true);
        setShowAnswer(false);
        setCurrentIndex(0);

        try {
            const { data: { user }, error: uErr } = await supabase.auth.getUser();
            if (uErr) throw uErr;
            if (!user?.id) throw new Error("Usuário não autenticado.");

            // favoritos
            const { data: favData, error: favErr } = await supabase
                .from("flash_card_favorites")
                .select("card_id")
                .eq("user_id", user.id);

            if (favErr) throw favErr;

            const nextFavSet = new Set((favData || []).map((r) => r.card_id));
            setFavSet(nextFavSet);

            // cards do deck
            let q = supabase
                .from("flash_cards")
                .select("*")
                .eq("user_id", user.id)
                .eq("deck_id", deckId);

            if (onlyDue) q = q.lte("next_review_at", new Date().toISOString());

            if (onlyFavorites) {
                const ids = Array.from(nextFavSet);
                if (ids.length === 0) {
                    setCards([]);
                    setLoading(false);
                    return;
                }
                q = q.in("id", ids);
            }

            const { data, error } = await q.order("next_review_at", { ascending: true });
            if (error) throw error;

            setCards(data || []);
        } catch (err) {
            console.error(err);
            alert("Erro ao carregar prática: " + (err?.message || "desconhecido"));
            setCards([]);
        } finally {
            setLoading(false);
        }
    }

    async function toggleFavorite(card) {
        try {
            const { data: { user }, error: uErr } = await supabase.auth.getUser();
            if (uErr) throw uErr;
            if (!user?.id) throw new Error("Usuário não autenticado.");

            const isFav = favSet.has(card.id);

            if (isFav) {
                const { error } = await supabase
                    .from("flash_card_favorites")
                    .delete()
                    .eq("user_id", user.id)
                    .eq("card_id", card.id);
                if (error) throw error;

                setFavSet((prev) => {
                    const n = new Set(prev);
                    n.delete(card.id);
                    return n;
                });
            } else {
                const { error } = await supabase
                    .from("flash_card_favorites")
                    .insert([{ user_id: user.id, card_id: card.id }]);
                if (error) throw error;

                setFavSet((prev) => new Set(prev).add(card.id));
            }
        } catch (err) {
            console.error(err);
            alert("Erro ao favoritar: " + (err?.message || "desconhecido"));
        }
    }

    async function sendToErrorDeck(card) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) return;

        // descobre o topic_id do deck atual
        const { data: deckData, error: dErr } = await supabase
            .from("fc_decks")
            .select("id, topic_id")
            .eq("id", deckId)
            .single();

        if (dErr) throw dErr;

        const topic_id = deckData.topic_id;

        // acha ou cria o deck "🚨 Meus Erros" no mesmo topic
        const { data: existing, error: exErr } = await supabase
            .from("fc_decks")
            .select("id, name")
            .eq("user_id", user.id)
            .eq("topic_id", topic_id)
            .eq("name", "🚨 Meus Erros")
            .maybeSingle();

        if (exErr) throw exErr;

        let errorDeckId = existing?.id;

        if (!errorDeckId) {
            const { data: created, error: crErr } = await supabase
                .from("fc_decks")
                .insert([{ user_id: user.id, topic_id, name: "🚨 Meus Erros" }])
                .select("id")
                .single();

            if (crErr) throw crErr;
            errorDeckId = created.id;
        }

        // evita duplicar infinitamente (mesmo source_card_id no deck de erros)
        const { data: already, error: alErr } = await supabase
            .from("flash_cards")
            .select("id")
            .eq("user_id", user.id)
            .eq("deck_id", errorDeckId)
            .eq("source_card_id", card.id)
            .maybeSingle();

        if (alErr) throw alErr;
        if (already?.id) return;

        // copia o card
        const payload = {
            user_id: user.id,
            deck_id: errorDeckId,
            tipo: card.tipo,
            pergunta: card.pergunta,
            resposta: card.resposta,
            cloze_text: card.cloze_text,
            cloze_answer: card.cloze_answer,
            tags: card.tags,
            // reset revisão para cair como "novo"
            repetitions: 0,
            ease: 2.5,
            interval_days: 0,
            next_review_at: new Date().toISOString(),
            last_review_at: null,
            wrong_streak: 0,
            wrong_total: 0,
            source_card_id: card.id,
        };

        const { error: insErr } = await supabase.from("flash_cards").insert([payload]);
        if (insErr) throw insErr;
    }

    // SM-2 + streak de erros
    async function handleRate(grade) {
        const card = cards[currentIndex];
        if (!card) return;

        try {
            let ease = Number(card.ease ?? 2.5);
            let repetitions = Number(card.repetitions ?? 0);
            let interval_days = Number(card.interval_days ?? 0);

            let wrong_streak = Number(card.wrong_streak ?? 0);
            let wrong_total = Number(card.wrong_total ?? 0);

            const isCorrect = grade >= 3;

            if (isCorrect) {
                wrong_streak = 0;
                if (repetitions === 0) interval_days = 1;
                else if (repetitions === 1) interval_days = 4;
                else interval_days = Math.max(1, Math.round(interval_days * ease));
                repetitions += 1;
            } else {
                wrong_streak += 1;
                wrong_total += 1;
                repetitions = 0;
                interval_days = 0;
                ease = Math.max(1.3, ease - 0.2);
            }

            const nextReview = new Date();
            nextReview.setDate(nextReview.getDate() + interval_days);

            const payload = {
                repetitions,
                ease,
                interval_days,
                next_review_at: nextReview.toISOString(),
                last_review_at: new Date().toISOString(),
                wrong_streak,
                wrong_total,
            };

            const { error } = await supabase.from("flash_cards").update(payload).eq("id", card.id);
            if (error) throw error;

            // ação motivacional + deck de erros
            if (!isCorrect && wrong_streak >= 3) {
                alert("🔥 Relaxa: errar faz parte. Eu mandei esse card pro seu deck '🚨 Meus Erros' pra você dominar ele depois.");
                await sendToErrorDeck(card);
            }

            setShowAnswer(false);
            setCurrentIndex((prev) => prev + 1);
        } catch (err) {
            console.error(err);
            alert("Erro ao salvar revisão: " + (err?.message || "desconhecido"));
        }
    }

    if (!deckId) {
        return (
            <div className="rounded-3xl bg-white/5 border border-white/10 p-8 text-slate-300">
                Selecione um deck para começar a praticar.
            </div>
        );
    }

    if (loading) {
        return (
            <div className="p-10 text-center">
                <RefreshCw className="animate-spin mx-auto" />
            </div>
        );
    }

    if (!cards.length) {
        return (
            <div className="rounded-3xl bg-white/5 border border-white/10 p-8 text-center">
                <div className="text-white font-black text-lg">Nada para praticar agora</div>
                <p className="text-slate-300/70 mt-2 font-medium">
                    {onlyDue ? "Você não tem cards vencidos nesse deck." : "Não há cards nesse deck (ou no filtro atual)."}
                </p>

                <button
                    onClick={fetchDueCards}
                    className="mt-4 px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 font-black inline-flex items-center gap-2"
                >
                    <RefreshCw size={16} />
                    Recarregar
                </button>
            </div>
        );
    }

    if (currentIndex >= cards.length) {
        return (
            <div className="rounded-3xl bg-white/5 border border-white/10 p-8 text-center">
                <div className="text-white font-black text-lg">🎉 Tudo revisado por hoje!</div>
                <p className="text-slate-300/70 mt-2 font-medium">Você concluiu os cards do filtro atual.</p>

                <button
                    onClick={fetchDueCards}
                    className="mt-4 px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 font-black inline-flex items-center gap-2"
                >
                    <RefreshCw size={16} />
                    Buscar mais
                </button>
            </div>
        );
    }

    const isFav = favSet.has(currentCard.id);

    return (
        <div className="max-w-5xl mx-auto space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-slate-300/70 font-black">
                    Card {currentIndex + 1} / {cards.length}
                </div>

                <button
                    onClick={() => toggleFavorite(currentCard)}
                    className={classNames(
                        "px-4 py-3 rounded-2xl border font-black flex items-center gap-2 transition",
                        isFav
                            ? "bg-amber-500/15 border-amber-500/30 text-amber-200"
                            : "bg-white/5 hover:bg-white/10 border-white/10 text-slate-100"
                    )}
                    title={isFav ? "Desfavoritar" : "Favoritar"}
                >
                    {isFav ? <Star size={16} /> : <StarOff size={16} />}
                    {isFav ? "Favorito" : "Favoritar"}
                </button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8 shadow-2xl min-h-[280px] flex flex-col justify-center text-center">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 block">
                    {currentCard.tipo === "cloze" ? "Complete a lacuna" : "Pergunta"}
                </span>

                <h3 className="text-xl md:text-2xl font-semibold text-white">
                    {currentCard.tipo === "cloze"
                        ? maskCloze(String(currentCard.cloze_text || "").replace(/____/g, "____"))
                        : currentCard.pergunta}
                </h3>

                {showAnswer && (
                    <div className="mt-6 pt-6 border-t border-white/10 animate-in fade-in slide-in-from-top-2">
                        <p className="text-xl text-emerald-300 font-black">
                            {currentCard.tipo === "cloze" ? currentCard.cloze_answer : currentCard.resposta}
                        </p>
                    </div>
                )}
            </div>

            <div className="flex gap-3">
                {!showAnswer ? (
                    <button
                        onClick={() => setShowAnswer(true)}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black flex items-center justify-center gap-2 transition active:scale-[0.98]"
                    >
                        <Eye size={18} /> MOSTRAR RESPOSTA
                    </button>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full">
                        <button
                            onClick={() => handleRate(1)}
                            className="py-4 rounded-2xl font-black text-xs md:text-sm bg-red-500/10 hover:bg-red-500 text-red-300 hover:text-white transition"
                        >
                            DE NOVO
                        </button>
                        <button
                            onClick={() => handleRate(2)}
                            className="py-4 rounded-2xl font-black text-xs md:text-sm bg-orange-500/10 hover:bg-orange-500 text-orange-300 hover:text-white transition"
                        >
                            DIFÍCIL
                        </button>
                        <button
                            onClick={() => handleRate(3)}
                            className="py-4 rounded-2xl font-black text-xs md:text-sm bg-emerald-500/10 hover:bg-emerald-500 text-emerald-300 hover:text-white transition"
                        >
                            BOM
                        </button>
                        <button
                            onClick={() => handleRate(4)}
                            className="py-4 rounded-2xl font-black text-xs md:text-sm bg-blue-500/10 hover:bg-blue-500 text-blue-300 hover:text-white transition"
                        >
                            FÁCIL
                        </button>
                    </div>
                )}
            </div>

            <div className="text-xs text-slate-300/60 font-medium text-center">
                Dica: “De novo” reforça — e se você errar 3x, vai pro deck “🚨 Meus Erros”.
            </div>
        </div>
    );
}
