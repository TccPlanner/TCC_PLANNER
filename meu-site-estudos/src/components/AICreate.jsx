import React, { useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { UploadCloud, Sparkles, Loader2, FileCheck, FileText, X } from "lucide-react";

function classNames(...arr) {
    return arr.filter(Boolean).join(" ");
}

async function extractTextFromPDF(file) {
    const pdfjsLib = await import("pdfjs-dist/build/pdf");
    const pdfjsWorker = await import("pdfjs-dist/build/pdf.worker?url");
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker.default;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map((item) => item.str).join(" ") + " ";
    }
    return fullText;
}

async function readTextFile(file) {
    return await file.text();
}

export default function AICreate({ context, onSuccess }) {
    const level = context?.level; // root/course/discipline/topic/deck
    const deckId = context?.deck?.id || null;

    const [kind, setKind] = useState(deckId ? "cards" : "structure"); // cards | structure
    const [mode, setMode] = useState("text"); // text | file
    const [loading, setLoading] = useState(false);

    const [status, setStatus] = useState("");
    const [file, setFile] = useState(null);

    const [text, setText] = useState("");
    const [qtd, setQtd] = useState(15);

    // estrutura

    const { data, error } = await supabase.functions.invoke("generate-flash-structure", {
        body: {
            course_id: selectedCourseId,
            hint,
            dry_run: true,
            save: false,
            max_disciplines: 4,
            max_topics_per_discipline: 4,
            max_decks_per_topic: 4,
        }
    });

    const [structureHint, setStructureHint] = useState("");

    const canGenerate = useMemo(() => {
        if (kind === "cards") {
            if (!deckId) return false;
            if (mode === "text") return text.trim().length >= 20;
            return !!file;
        }
        // structure
        return structureHint.trim().length >= 8;
    }, [kind, deckId, mode, text, file, structureHint]);

    async function handleGenerate() {
        if (!canGenerate) return;
        setLoading(true);
        setStatus("");

        try {
            if (kind === "structure") {
                setStatus("IA montando sua estrutura (curso → disciplinas → assuntos → decks)...");


                if (error) throw error;

                alert("Estrutura criada com sucesso!");
                if (onSuccess) onSuccess(data);
                return;
            }

            // cards
            let finalText = "";

            if (mode === "text") {
                finalText = text.trim();
            } else {
                setStatus("Lendo arquivo...");
                const isPdf = file?.type === "application/pdf" || file?.name?.toLowerCase()?.endsWith(".pdf");

                if (isPdf) {
                    setStatus("Extraindo texto do PDF...");
                    finalText = await extractTextFromPDF(file);
                } else {
                    setStatus("Lendo texto do arquivo...");
                    finalText = await readTextFile(file);
                }
            }

            setStatus("IA gerando seus cards...");



            const { data, error } = await supabase.functions.invoke("generate-flashcards", {
                body: {
                    deck_id: deckId,
                    text: finalText.slice(0, 12000),
                    qtd: Number(qtd) || 15,
                    save: true,
                },
            });

            if (error) throw error;

            alert(`Sucesso! ${data?.saved ?? "Vários"} flashcards criados.`);
            if (onSuccess) onSuccess(data);
        } catch (err) {
            console.error(err);
            alert("Erro ao gerar: " + (err?.message || "desconhecido"));
        } finally {
            setLoading(false);
            setStatus("");
        }
    }

    return (
        <div className="max-w-5xl mx-auto space-y-4">
            <div className="rounded-3xl bg-white/5 border border-white/10 p-5">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-black text-white">Gerar com IA</h3>
                        <p className="text-sm text-slate-400 font-medium mt-1">
                            {deckId
                                ? "Você pode gerar cards para este deck, ou gerar estrutura rapidamente."
                                : "Gere sua estrutura (curso → disciplinas → assuntos → decks) em segundos."}
                        </p>
                    </div>

                    <div className="flex gap-2 bg-white/5 border border-white/10 rounded-2xl p-1">
                        <button
                            onClick={() => setKind("structure")}
                            className={classNames(
                                "px-4 py-2 rounded-xl font-black text-sm transition",
                                kind === "structure" ? "bg-indigo-600" : "hover:bg-white/10"
                            )}
                        >
                            Estrutura
                        </button>
                        <button
                            disabled={!deckId}
                            onClick={() => setKind("cards")}
                            className={classNames(
                                "px-4 py-2 rounded-xl font-black text-sm transition",
                                kind === "cards" ? "bg-indigo-600" : "hover:bg-white/10",
                                !deckId ? "opacity-40 cursor-not-allowed" : ""
                            )}
                            title={!deckId ? "Entre em um deck para gerar cards" : "Gerar cards"}
                        >
                            Cards
                        </button>
                    </div>
                </div>

                <div className="mt-4 flex flex-col md:flex-row gap-3 md:items-center">
                    {kind === "cards" ? (
                        <div className="flex-1">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                Quantidade de cards
                            </label>
                            <input
                                type="number"
                                value={qtd}
                                min={5}
                                max={50}
                                onChange={(e) => setQtd(e.target.value)}
                                className="w-full mt-2 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 outline-none focus:ring-2 focus:ring-indigo-500/40"
                            />
                        </div>
                    ) : (
                        <div className="flex-1">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                Tema / objetivo da estrutura
                            </label>
                            <input
                                value={structureHint}
                                onChange={(e) => setStructureHint(e.target.value)}
                                placeholder="Ex: Tec. da Informação para concurso — Banco de Dados, Redes, SO..."
                                className="w-full mt-2 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 outline-none focus:ring-2 focus:ring-indigo-500/40"
                            />
                        </div>
                    )}

                    <button
                        onClick={handleGenerate}
                        disabled={!canGenerate || loading}
                        className="md:w-80 w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-2xl font-black flex items-center justify-center gap-2 transition active:scale-[0.98]"
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                        GERAR AGORA
                    </button>
                </div>

                {status && (
                    <div className="mt-3 text-sm text-indigo-200 font-black flex items-center gap-2">
                        <Loader2 className="animate-spin" size={16} />
                        {status}
                    </div>
                )}
            </div>

            {kind === "cards" && (
                <>
                    <div className="rounded-3xl bg-white/5 border border-white/10 p-5">
                        <div className="flex gap-2 bg-white/5 border border-white/10 rounded-2xl p-1 w-fit">
                            <button
                                onClick={() => { setMode("text"); setFile(null); }}
                                className={classNames(
                                    "px-4 py-2 rounded-xl font-black text-sm transition",
                                    mode === "text" ? "bg-indigo-600" : "hover:bg-white/10"
                                )}
                            >
                                Texto
                            </button>
                            <button
                                onClick={() => { setMode("file"); setText(""); }}
                                className={classNames(
                                    "px-4 py-2 rounded-xl font-black text-sm transition",
                                    mode === "file" ? "bg-indigo-600" : "hover:bg-white/10"
                                )}
                            >
                                Arquivo
                            </button>
                        </div>
                    </div>

                    {mode === "text" ? (
                        <div className="rounded-3xl bg-white/5 border border-white/10 p-5">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                Cole o texto (resumo, apostila, tópicos)
                            </label>
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="Cole aqui um resumo, trecho da apostila, tópicos..."
                                className="w-full mt-2 min-h-[220px] resize-none px-4 py-4 rounded-2xl bg-white/5 border border-white/10 outline-none focus:ring-2 focus:ring-indigo-500/40"
                            />
                            <p className="text-xs text-slate-400 mt-2">
                                Dica: quanto mais em tópicos, melhor ficam os cards.
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-3xl bg-white/5 border border-white/10 p-5">
                            <div
                                className={classNames(
                                    "relative border-2 border-dashed rounded-[28px] p-10 text-center transition",
                                    file ? "border-emerald-500/50 bg-emerald-500/5" : "border-white/10 hover:border-indigo-500/40"
                                )}
                            >
                                <input
                                    type="file"
                                    id="fc-file"
                                    className="hidden"
                                    accept=".pdf,.txt"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                />

                                <label htmlFor="fc-file" className="cursor-pointer flex flex-col items-center">
                                    {file ? (
                                        <FileCheck size={44} className="text-emerald-300 mb-3" />
                                    ) : (
                                        <UploadCloud size={44} className="text-slate-400 mb-3" />
                                    )}

                                    <div className="text-white font-black">
                                        {file ? file.name : "Clique para enviar um PDF ou TXT"}
                                    </div>

                                    <div className="text-xs text-slate-400 mt-2">Formatos: PDF, TXT</div>
                                </label>

                                {file && (
                                    <button
                                        onClick={() => setFile(null)}
                                        className="absolute top-3 right-3 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
                                        title="Remover arquivo"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>

                            <div className="mt-3 text-xs text-slate-400 flex items-center gap-2">
                                <FileText size={14} />
                                <span>PDF será extraído no navegador. TXT será lido direto.</span>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
