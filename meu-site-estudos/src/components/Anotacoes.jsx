import React, { useEffect, useMemo, useState } from "react";
import { BookPlus, FilePlus2, Trash2 } from "lucide-react";

const criarCadernoInicial = () => ({
  id: crypto.randomUUID(),
  titulo: "Meu caderno",
  notas: [
    {
      id: crypto.randomUUID(),
      titulo: "Primeira anotação",
      conteudo:
        "# Bem-vindo(a)!\n\nUse este espaço como um Notion pessoal para organizar seus estudos.\n\n- Crie cadernos por matéria\n- Separe notas por tema\n- Monte checklists com [ ] tarefas",
      atualizadoEm: new Date().toISOString(),
    },
  ],
});

function Anotacoes({ user }) {
  const storageKey = `planner-anotacoes-${user.id}`;
  const [cadernos, setCadernos] = useState([]);
  const [cadernoId, setCadernoId] = useState("");
  const [notaId, setNotaId] = useState("");

  useEffect(() => {
    const salvo = localStorage.getItem(storageKey);
    if (salvo) {
      const dados = JSON.parse(salvo);
      setCadernos(dados);
      setCadernoId(dados[0]?.id || "");
      setNotaId(dados[0]?.notas?.[0]?.id || "");
      return;
    }

    const inicial = [criarCadernoInicial()];
    setCadernos(inicial);
    setCadernoId(inicial[0].id);
    setNotaId(inicial[0].notas[0].id);
  }, [storageKey]);

  useEffect(() => {
    if (!cadernos.length) {
      localStorage.removeItem(storageKey);
      return;
    }
    localStorage.setItem(storageKey, JSON.stringify(cadernos));
  }, [cadernos, storageKey]);

  const cadernoAtual = useMemo(
    () => cadernos.find((c) => c.id === cadernoId),
    [cadernos, cadernoId]
  );

  const notaAtual = useMemo(
    () => cadernoAtual?.notas.find((n) => n.id === notaId),
    [cadernoAtual, notaId]
  );

  const criarCaderno = () => {
    const novo = {
      id: crypto.randomUUID(),
      titulo: `Novo caderno ${cadernos.length + 1}`,
      notas: [],
    };
    setCadernos((prev) => [...prev, novo]);
    setCadernoId(novo.id);
    setNotaId("");
  };

  const atualizarTituloCaderno = (valor) => {
    if (!cadernoAtual) return;
    setCadernos((prev) =>
      prev.map((c) => (c.id === cadernoAtual.id ? { ...c, titulo: valor } : c))
    );
  };

  const excluirCaderno = () => {
    if (!cadernoAtual) return;
    const restantes = cadernos.filter((c) => c.id !== cadernoAtual.id);
    setCadernos(restantes);
    setCadernoId(restantes[0]?.id || "");
    setNotaId(restantes[0]?.notas?.[0]?.id || "");
  };

  const criarNota = () => {
    if (!cadernoAtual) return;
    const nova = {
      id: crypto.randomUUID(),
      titulo: `Nova nota ${cadernoAtual.notas.length + 1}`,
      conteudo: "",
      atualizadoEm: new Date().toISOString(),
    };

    setCadernos((prev) =>
      prev.map((c) =>
        c.id === cadernoAtual.id ? { ...c, notas: [nova, ...c.notas] } : c
      )
    );
    setNotaId(nova.id);
  };

  const atualizarNota = (campo, valor) => {
    if (!cadernoAtual || !notaAtual) return;
    setCadernos((prev) =>
      prev.map((c) => {
        if (c.id !== cadernoAtual.id) return c;
        return {
          ...c,
          notas: c.notas.map((n) =>
            n.id === notaAtual.id
              ? {
                  ...n,
                  [campo]: valor,
                  atualizadoEm: new Date().toISOString(),
                }
              : n
          ),
        };
      })
    );
  };

  const excluirNota = () => {
    if (!cadernoAtual || !notaAtual) return;

    const restantes = cadernoAtual.notas.filter((n) => n.id !== notaAtual);
    setCadernos((prev) =>
      prev.map((c) => (c.id === cadernoAtual.id ? { ...c, notas: restantes } : c))
    );
    setNotaId(restantes[0]?.id || "");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[230px_270px_1fr] gap-4 h-[65vh]">
      <aside className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/40">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Cadernos</h3>
          <button
            onClick={criarCaderno}
            className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            title="Novo caderno"
          >
            <BookPlus size={18} />
          </button>
        </div>

        {cadernoAtual && (
          <div className="flex gap-2 mb-3">
            <input
              value={cadernoAtual.titulo}
              onChange={(e) => atualizarTituloCaderno(e.target.value)}
              placeholder="Nome do caderno"
              className="w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 outline-none focus:border-cyan-500"
            />
            <button
              onClick={excluirCaderno}
              className="px-3 rounded-lg border border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
              title="Excluir caderno"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}

        <div className="space-y-2 overflow-y-auto max-h-[52vh] pr-1">
          {cadernos.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setCadernoId(c.id);
                setNotaId(c.notas[0]?.id || "");
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm cursor-pointer ${
                cadernoId === c.id
                  ? "bg-cyan-600 text-white"
                  : "hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <p className="font-medium truncate">{c.titulo || "Sem nome"}</p>
              <p className="text-xs opacity-75">{c.notas.length} nota(s)</p>
            </button>
          ))}
          {!cadernos.length && (
            <p className="text-sm text-slate-500">Crie um caderno para começar.</p>
          )}
        </div>
      </aside>

      <aside className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/40">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Notas</h3>
          <button
            onClick={criarNota}
            disabled={!cadernoAtual}
            className="p-2 rounded-lg hover:bg-slate-200 disabled:opacity-40 dark:hover:bg-slate-700 cursor-pointer"
            title="Nova nota"
          >
            <FilePlus2 size={18} />
          </button>
        </div>

        <div className="space-y-2 overflow-y-auto max-h-[56vh] pr-1">
          {cadernoAtual?.notas.map((n) => (
            <button
              key={n.id}
              onClick={() => setNotaId(n.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm cursor-pointer ${
                notaId === n.id
                  ? "bg-cyan-600 text-white"
                  : "hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <p className="font-medium truncate">{n.titulo || "Sem título"}</p>
              <p className="text-xs opacity-75">
                {new Date(n.atualizadoEm).toLocaleDateString("pt-BR")}
              </p>
            </button>
          ))}
          {!!cadernoAtual && !cadernoAtual.notas.length && (
            <p className="text-sm text-slate-500">Crie a primeira nota deste caderno.</p>
          )}
        </div>
      </aside>

      <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
        {!notaAtual ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            Selecione ou crie uma nota para começar.
          </div>
        ) : (
          <div className="h-full flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                value={notaAtual.titulo}
                onChange={(e) => atualizarNota("titulo", e.target.value)}
                placeholder="Título da nota"
                className="w-full rounded-xl border px-4 py-2 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none focus:border-cyan-500"
              />
              <button
                onClick={excluirNota}
                className="px-3 rounded-xl border border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                title="Excluir nota"
              >
                <Trash2 size={18} />
              </button>
            </div>

            <textarea
              value={notaAtual.conteudo}
              onChange={(e) => atualizarNota("conteudo", e.target.value)}
              placeholder="Digite sua anotação..."
              className="flex-1 rounded-xl border px-4 py-3 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none focus:border-cyan-500 resize-none leading-relaxed"
            />
            <p className="text-xs text-slate-500">
              Dica: use títulos, listas e checklists no estilo Notion para organizar cada tema.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default Anotacoes;
