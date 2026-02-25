import React, { useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { Save, Tag as TagIcon, Loader2, Wand2, X } from "lucide-react";

function safeSplitTags(text) {
    return String(text || "")
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 24);
}

function classNames(...arr) {
    return arr.filter(Boolean).join(" ");
}

export default function ManualCreate({ deckId, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [tipo, setTipo] = useState("normal"); // normal | cloze
    const [formData, setFormData] = useState({
        pergunta: "",
        resposta: "",
        cloze_text: "",
        cloze_answer: "",
        tags: "",
    });

    const clozeRef = useRef(null);

    const canSave = useMemo(() => {
        if (!deckId) return false;
        if (tipo === "normal") return formData.pergunta.trim() && formData.resposta.trim();
        return formData.cloze_text.trim() && formData.cloze_answer.trim();
    }, [deckId, tipo, formData]);

    const handleChange = (e) => {
        setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));
    };

    // ✅ Cloze por seleção: pega o trecho selecionado e substitui por ____,
    // e a resposta vira o trecho selecionado.
    const handleClozeFromSelection = () => {
        const el = clozeRef.current;
        if (!el) return;

        const value = el.value || "";
        const start = el.selectionStart ?? 0;
        const end = el.selectionEnd ?? 0;

        if (start === end) {
            alert("Selecione a palavra/trecho que você quer ocultar.");
            return;
        }

        const selected = value.slice(start, end).trim();
        if (!selected) {
            alert("Seleção inválida.");
            return;
        }

        const before = value.slice(0, start);
        const after = value.slice(end);

        // substitui a seleção por ____ mantendo o texto
        const nextText = `${before}____${after}`;

        setFormData((p) => ({
            ...p,
            cloze_text: nextText,
            cloze_answer: selected,
        }));

        // reposiciona cursor depois
        setTimeout(() => {
            el.focus();
            el.setSelectionRange(start, start + 4);
        }, 0);
    };

    const clearCloze = () => {
        setFormData((p) => ({ ...p, cloze_answer: "" }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!deckId) {
            alert("Selecione um deck antes de criar cards.");
            return;
        }

        setLoading(true);
        try {
            const { data: { user }, error: uErr } = await supabase.auth.getUser();
            if (uErr) throw uErr;
            if (!user?.id) throw new Error("Usuário não autenticado.");

            const nowIso = new Date().toISOString();

            const newCard = {
                user_id: user.id,
                deck_id: deckId,
                tipo,
                pergunta:
                    tipo === "normal"
                        ? formData.pergunta.trim()
                        : (formData.cloze_text.trim().slice(0, 70) + (formData.cloze_text.trim().length > 70 ? "..." : "")),
                resposta: tipo === "normal" ? formData.resposta.trim() : formData.cloze_answer.trim(),
                cloze_text: tipo === "cloze" ? formData.cloze_text.trim() : null,
                cloze_answer: tipo === "cloze" ? formData.cloze_answer.trim() : null,
                tags: safeSplitTags(formData.tags),
                // SM-2 defaults
                ease: 2.5,
                repetitions: 0,
                interval_days: 0,
                next_review_at: nowIso,
                last_review_at: null,
                created_at: nowIso,
            };

            const { error } = await supabase.from("flash_cards").insert([newCard]);
            if (error) throw error;

            // limpa
            setFormData({
                pergunta: "",
                resposta: "",
                cloze_text: "",
                cloze_answer: "",
                tags: "",
            });

            alert("Flashcard criado com sucesso!");
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error(err);
            alert("Erro ao salvar o card: " + (err?.message || "desconhecido"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto">
            <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-black text-white">Criar card (manual)</h3>
                        <p className="text-sm text-slate-300/70 font-medium mt-1">
                            {tipo === "cloze"
                                ? "Escreva o texto, selecione a palavra e clique em “Ocultar seleção”."
                                : "Pergunta na frente, resposta atrás."}
                        </p>
                    </div>

                    <div className="flex gap-2 bg-white/5 border border-white/10 rounded-2xl p-1 w-fit">
                        <button
                            type="button"
                            onClick={() => setTipo("normal")}
                            className={classNames(
                                "px-4 py-2 rounded-xl font-black text-sm transition",
                                tipo === "normal" ? "bg-indigo-600" : "hover:bg-white/10"
                            )}
                        >
                            Normal
                        </button>
                        <button
                            type="button"
                            onClick={() => setTipo("cloze")}
                            className={classNames(
                                "px-4 py-2 rounded-xl font-black text-sm transition",
                                tipo === "cloze" ? "bg-indigo-600" : "hover:bg-white/10"
                            )}
                        >
                            Cloze
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                    {tipo === "normal" ? (
                        <>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    Pergunta
                                </label>
                                <textarea
                                    name="pergunta"
                                    required
                                    value={formData.pergunta}
                                    onChange={handleChange}
                                    placeholder="Ex: Qual a capital da França?"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500/40 outline-none min-h-[110px] resize-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    Resposta
                                </label>
                                <textarea
                                    name="resposta"
                                    required
                                    value={formData.resposta}
                                    onChange={handleChange}
                                    placeholder="Ex: Paris"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 focus:ring-2 focus:ring-emerald-500/40 outline-none min-h-[110px] resize-none"
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    Texto (selecione o trecho que quer ocultar)
                                </label>
                                <textarea
                                    ref={clozeRef}
                                    name="cloze_text"
                                    required
                                    value={formData.cloze_text}
                                    onChange={handleChange}
                                    placeholder="Ex: A capital da França é Paris."
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500/40 outline-none min-h-[120px] resize-none"
                                />

                                <div className="flex flex-col md:flex-row gap-2">
                                    <button
                                        type="button"
                                        onClick={handleClozeFromSelection}
                                        className="px-4 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-black flex items-center justify-center gap-2"
                                    >
                                        <Wand2 size={18} />
                                        Ocultar seleção
                                    </button>

                                    <button
                                        type="button"
                                        onClick={clearCloze}
                                        className="px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 font-black flex items-center justify-center gap-2"
                                    >
                                        <X size={18} />
                                        Limpar resposta
                                    </button>
                                </div>

                                <p className="text-xs text-slate-300/70 font-medium">
                                    Dica: após ocultar, a resposta vira automaticamente o trecho selecionado.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    Resposta (trecho oculto)
                                </label>
                                <input
                                    name="cloze_answer"
                                    required
                                    value={formData.cloze_answer}
                                    onChange={handleChange}
                                    placeholder="Ex: Paris"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 focus:ring-2 focus:ring-emerald-500/40 outline-none"
                                />
                            </div>
                        </>
                    )}

                    <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <TagIcon size={12} /> Tags (separadas por vírgula)
                        </label>
                        <input
                            name="tags"
                            value={formData.tags}
                            onChange={handleChange}
                            placeholder="historia, geografia, capitais"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500/40 outline-none"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={!canSave || loading}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-2xl font-black flex items-center justify-center gap-2 transition active:scale-[0.98]"
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        SALVAR FLASHCARD
                    </button>
                </form>
            </div>
        </div>
    );
}
