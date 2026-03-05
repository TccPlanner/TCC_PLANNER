import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BookPlus,
  FilePlus2,
  Pencil,
  Bold,
  Italic,
  Underline,
  Highlighter,
  Heading1,
  List,
  Trash2,
  Edit3,
  X,
} from "lucide-react";

const textoInicial = `<h1>Bem-vindo(a)!</h1><p>Use este espaço como um Notion pessoal para organizar seus estudos.</p><ul><li>Crie cadernos por matéria</li><li>Separe notas por tema</li><li>Monte checklists com [ ] tarefas</li></ul>`;

const criarCadernoInicial = () => ({
  id: crypto.randomUUID(),
  titulo: "Meu caderno",
  notas: [
    {
      id: crypto.randomUUID(),
      titulo: "Primeira anotação",
      conteudo: textoInicial,
      atualizadoEm: new Date().toISOString(),
    },
  ],
});

const htmlSeguro = (conteudo = "") => {
  const texto = conteudo.trim();
  if (!texto) return "";

  // Se parece ser HTML, usa como está; se não, escapa e transforma quebras de linha em <br>
  if (/<\/?[a-z][\s\S]*>/i.test(texto)) return texto;

  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
};

const COR_GRIFO = "#facc15";
const COR_TEXTO_GRIFO = "#111827";

const encontrarElemento = (node) => {
  if (!node) return null;
  return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
};

const removerGrifoDoSpan = (span) => {
  const pai = span.parentNode;
  if (!pai) return;

  while (span.firstChild) {
    pai.insertBefore(span.firstChild, span);
  }
  pai.removeChild(span);
};

const normalizarCadernos = (dados) => {
  if (!Array.isArray(dados) || !dados.length) return [criarCadernoInicial()];

  const cadernosNormalizados = dados.map((caderno, index) => {
    const notasOriginais = Array.isArray(caderno?.notas) ? caderno.notas : [];
    return {
      id: caderno?.id || crypto.randomUUID(),
      titulo: caderno?.titulo?.trim() || `Caderno ${index + 1}`,
      notas: notasOriginais.map((nota, notaIndex) => ({
        id: nota?.id || crypto.randomUUID(),
        titulo: nota?.titulo?.trim() || `Nota ${notaIndex + 1}`,
        conteudo: nota?.conteudo || "",
        atualizadoEm: nota?.atualizadoEm || new Date().toISOString(),
      })),
    };
  });

  return cadernosNormalizados.length ? cadernosNormalizados : [criarCadernoInicial()];
};

function Anotacoes({ user }) {
  const storageKey = `planner-anotacoes-${user.id}`;
  const [cadernos, setCadernos] = useState([]);
  const [cadernoId, setCadernoId] = useState("");
  const [notaId, setNotaId] = useState("");
  const [tamanhoFonte, setTamanhoFonte] = useState("3");
  const [modoEdicao, setModoEdicao] = useState(false);
  const [conteudoEdicao, setConteudoEdicao] = useState("");
  const editorRef = useRef(null);

  // Menus de ações (sem prompt de “renomear/apagar”)
  const [menuCadernoAberto, setMenuCadernoAberto] = useState(false);
  const [menuNotaAberto, setMenuNotaAberto] = useState(false);
  const menuCadernoRef = useRef(null);
  const menuNotaRef = useRef(null);

  useEffect(() => {
    const inicial = [criarCadernoInicial()];
    const salvarInicial = () => {
      setCadernos(inicial);
      setCadernoId(inicial[0].id);
      setNotaId(inicial[0].notas[0].id);
      setConteudoEdicao(inicial[0].notas[0].conteudo || "");
    };

    try {
      const salvo = localStorage.getItem(storageKey);
      if (!salvo) {
        salvarInicial();
        return;
      }

      const dados = normalizarCadernos(JSON.parse(salvo));
      const primeiroCadernoId = dados[0]?.id || "";
      const primeiraNotaId = dados[0]?.notas?.[0]?.id || "";

      setCadernos(dados);
      setCadernoId(primeiroCadernoId);
      setNotaId(primeiraNotaId);
      setConteudoEdicao(dados[0]?.notas?.find((n) => n.id === primeiraNotaId)?.conteudo || "");
    } catch {
      localStorage.removeItem(storageKey);
      salvarInicial();
    }
  }, [storageKey]);

  useEffect(() => {
    if (!cadernos.length) return;
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

  // Fecha menus clicando fora
  useEffect(() => {
    const onDown = (e) => {
      const alvo = e.target;

      if (menuCadernoAberto) {
        if (menuCadernoRef.current && !menuCadernoRef.current.contains(alvo)) {
          setMenuCadernoAberto(false);
        }
      }
      if (menuNotaAberto) {
        if (menuNotaRef.current && !menuNotaRef.current.contains(alvo)) {
          setMenuNotaAberto(false);
        }
      }
    };

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuCadernoAberto, menuNotaAberto]);

  const abrirNota = (proximoNotaId) => {
    setNotaId(proximoNotaId || "");
    setModoEdicao(false);
    setMenuNotaAberto(false);
    setConteudoEdicao(
      cadernoAtual?.notas?.find((n) => n.id === proximoNotaId)?.conteudo || ""
    );
  };

  const abrirCaderno = (proximoCadernoId, listaCadernos = cadernos) => {
    const caderno = listaCadernos.find((c) => c.id === proximoCadernoId);
    const primeiraNotaId = (caderno?.notas || [])[0]?.id || "";
    setCadernoId(proximoCadernoId || "");
    setNotaId(primeiraNotaId);
    setModoEdicao(false);
    setMenuCadernoAberto(false);
    setMenuNotaAberto(false);
    setConteudoEdicao(caderno?.notas?.find((n) => n.id === primeiraNotaId)?.conteudo || "");
  };

  const criarCaderno = () => {
    const titulo = window.prompt("Nome do novo caderno:")?.trim();
    if (!titulo) return;

    const novo = {
      id: crypto.randomUUID(),
      titulo,
      notas: [],
    };
    const novaLista = [...cadernos, novo];
    setCadernos(novaLista);
    abrirCaderno(novo.id, novaLista);
  };

  const renomearCadernoAtual = () => {
    if (!cadernoAtual) return;
    const titulo = window.prompt("Novo nome do caderno:", cadernoAtual.titulo)?.trim();
    if (!titulo) return;

    setCadernos((prev) =>
      prev.map((c) => (c.id === cadernoAtual.id ? { ...c, titulo } : c))
    );
  };

  const excluirCadernoAtual = () => {
    if (!cadernoAtual) return;

    const confirmou = window.confirm(
      `Excluir o caderno "${cadernoAtual.titulo}" e todas as notas dele?`
    );
    if (!confirmou) return;

    const restantes = cadernos.filter((c) => c.id !== cadernoAtual.id);
    setCadernos(restantes);
    abrirCaderno(restantes[0]?.id || "", restantes);
  };

  const criarNota = () => {
    if (!cadernoAtual) return;
    const titulo = window.prompt("Nome da nova nota:")?.trim();
    if (!titulo) return;

    const nova = {
      id: crypto.randomUUID(),
      titulo,
      conteudo: "",
      atualizadoEm: new Date().toISOString(),
    };

    setCadernos((prev) =>
      prev.map((c) =>
        c.id === cadernoAtual.id ? { ...c, notas: [nova, ...(c.notas || [])] } : c
      )
    );
    abrirNota(nova.id);
  };

  const atualizarNota = (campo, valor) => {
    if (!cadernoAtual || !notaAtual) return;
    setCadernos((prev) =>
      prev.map((c) => {
        if (c.id !== cadernoAtual.id) return c;
        return {
          ...c,
          notas: (c.notas || []).map((n) =>
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

  const renomearNotaAtual = () => {
    if (!notaAtual) return;
    const titulo = window.prompt("Novo nome da nota:", notaAtual.titulo)?.trim();
    if (!titulo) return;
    atualizarNota("titulo", titulo);
  };

  const excluirNotaAtual = () => {
    if (!cadernoAtual || !notaAtual) return;

    const confirmou = window.confirm(`Excluir a nota "${notaAtual.titulo}"?`);
    if (!confirmou) return;

    const restantes = cadernoAtual.notas.filter((n) => n.id !== notaAtual.id);
    setCadernos((prev) =>
      prev.map((c) => (c.id === cadernoAtual.id ? { ...c, notas: restantes } : c))
    );
    abrirNota(restantes[0]?.id || "");
  };

  const aplicarComando = (comando, valor = null) => {
    if (!notaAtual || !modoEdicao) return;
    editorRef.current?.focus();
    document.execCommand(comando, false, valor);
    setConteudoEdicao(editorRef.current?.innerHTML || "");
  };

  const aplicarTitulo = () => {
    const selecao = window.getSelection();
    if (!selecao || selecao.rangeCount === 0 || selecao.isCollapsed) return;

    const textoSelecionado = selecao.toString();
    if (!textoSelecionado.trim()) return;

    const html = `<span style="font-size:1.7em;font-weight:700;line-height:1.3;">${textoSelecionado}</span>`;
    aplicarComando("insertHTML", html);
  };

  const alternarGrifo = () => {
    if (!notaAtual || !modoEdicao) return;

    const selecao = window.getSelection();
    if (!selecao || selecao.rangeCount === 0 || selecao.isCollapsed) return;

    const range = selecao.getRangeAt(0);
    const inicio = encontrarElemento(range.startContainer);
    const fim = encontrarElemento(range.endContainer);

    const grifoInicio = inicio?.closest("span[data-grifado='true']");
    const grifoFim = fim?.closest("span[data-grifado='true']");

    const selecionado = selecao.toString().trim();
    if (
      selecionado &&
      grifoInicio &&
      grifoInicio === grifoFim &&
      grifoInicio.textContent?.trim() === selecionado
    ) {
      removerGrifoDoSpan(grifoInicio);
      setConteudoEdicao(editorRef.current?.innerHTML || "");
      return;
    }

    const conteudoSelecionado = range.extractContents();
    const span = document.createElement("span");
    span.dataset.grifado = "true";
    span.style.backgroundColor = COR_GRIFO;
    span.style.color = COR_TEXTO_GRIFO;
    span.appendChild(conteudoSelecionado);

    range.insertNode(span);
    selecao.removeAllRanges();

    const novoRange = document.createRange();
    novoRange.selectNodeContents(span);
    selecao.addRange(novoRange);

    setConteudoEdicao(editorRef.current?.innerHTML || "");
  };

  const iniciarEdicao = () => {
    if (!notaAtual) return;
    setConteudoEdicao(notaAtual.conteudo || "");
    setModoEdicao(true);
  };

  const cancelarEdicao = () => {
    setConteudoEdicao(notaAtual?.conteudo || "");
    setModoEdicao(false);
  };

  const salvarEdicao = () => {
    if (!notaAtual) return;
    atualizarNota("conteudo", conteudoEdicao);
    setModoEdicao(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[230px_270px_1fr] gap-4 h-[65vh]">
      {/* CADERNOS */}
      <aside className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/40">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Cadernos</h3>

          <div className="flex items-center gap-1 relative" ref={menuCadernoRef}>
            <button
              onClick={() => setMenuCadernoAberto((v) => !v)}
              disabled={!cadernoAtual}
              className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer disabled:opacity-40"
              title="Ações do caderno"
              aria-label="Ações do caderno"
            >
              <Pencil size={16} />
            </button>

            {menuCadernoAberto && cadernoAtual && (
              <div className="absolute right-0 top-10 z-20 w-40 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-2">
                <button
                  onClick={() => {
                    setMenuCadernoAberto(false);
                    renomearCadernoAtual();
                  }}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-sm"
                  title="Renomear"
                >
                  <Edit3 size={16} />
                  <span>Renomear</span>
                </button>

                <button
                  onClick={() => {
                    setMenuCadernoAberto(false);
                    excluirCadernoAtual();
                  }}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-sm text-red-600"
                  title="Excluir"
                >
                  <Trash2 size={16} />
                  <span>Excluir</span>
                </button>

                <button
                  onClick={() => setMenuCadernoAberto(false)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-sm opacity-80"
                  title="Fechar"
                >
                  <X size={16} />
                  <span>Fechar</span>
                </button>
              </div>
            )}

            <button
              onClick={criarCaderno}
              className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              title="Novo caderno"
              aria-label="Novo caderno"
            >
              <BookPlus size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-2 overflow-y-auto max-h-[56vh] pr-1">
          {cadernos.map((c) => (
            <button
              key={c.id}
              onClick={() => abrirCaderno(c.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm cursor-pointer ${cadernoId === c.id
                ? "bg-cyan-600 text-white"
                : "hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
            >
              <p className="font-medium truncate">{c.titulo}</p>
              <p className="text-xs opacity-75">{(c.notas || []).length} nota(s)</p>
            </button>
          ))}
        </div>
      </aside>

      {/* NOTAS */}
      <aside className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/40">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Notas</h3>

          <div className="flex items-center gap-1 relative" ref={menuNotaRef}>
            <button
              onClick={() => setMenuNotaAberto((v) => !v)}
              disabled={!notaAtual}
              className="p-2 rounded-lg hover:bg-slate-200 disabled:opacity-40 dark:hover:bg-slate-700 cursor-pointer"
              title="Ações da nota"
              aria-label="Ações da nota"
            >
              <Pencil size={16} />
            </button>

            {menuNotaAberto && notaAtual && (
              <div className="absolute right-0 top-10 z-20 w-40 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-2">
                <button
                  onClick={() => {
                    setMenuNotaAberto(false);
                    renomearNotaAtual();
                  }}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-sm"
                  title="Renomear"
                >
                  <Edit3 size={16} />
                  <span>Renomear</span>
                </button>

                <button
                  onClick={() => {
                    setMenuNotaAberto(false);
                    excluirNotaAtual();
                  }}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-sm text-red-600"
                  title="Excluir"
                >
                  <Trash2 size={16} />
                  <span>Excluir</span>
                </button>

                <button
                  onClick={() => setMenuNotaAberto(false)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-sm opacity-80"
                  title="Fechar"
                >
                  <X size={16} />
                  <span>Fechar</span>
                </button>
              </div>
            )}

            <button
              onClick={criarNota}
              disabled={!cadernoAtual}
              className="p-2 rounded-lg hover:bg-slate-200 disabled:opacity-40 dark:hover:bg-slate-700 cursor-pointer"
              title="Nova nota"
              aria-label="Nova nota"
            >
              <FilePlus2 size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-2 overflow-y-auto max-h-[56vh] pr-1">
          {cadernoAtual?.notas?.map((n) => (
            <button
              key={n.id}
              onClick={() => abrirNota(n.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm cursor-pointer ${notaId === n.id
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
          {!cadernoAtual?.notas.length && (
            <p className="text-sm text-slate-500">Crie a primeira nota deste caderno.</p>
          )}
        </div>
      </aside>

      {/* EDITOR */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
        {!notaAtual ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            Selecione ou crie uma nota para começar.
          </div>
        ) : (
          <div className="h-full flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h4 className="font-semibold text-lg truncate">{notaAtual.titulo}</h4>
              </div>

              {!modoEdicao ? (
                <button
                  onClick={iniciarEdicao}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-700"
                >
                  Editar
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={cancelarEdicao}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={salvarEdicao}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-700"
                  >
                    Salvar
                  </button>
                </div>
              )}
            </div>

            {modoEdicao && (
              <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                <button
                  onClick={aplicarTitulo}
                  className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Título no texto selecionado"
                >
                  <Heading1 size={16} />
                </button>
                <button
                  onClick={() => aplicarComando("bold")}
                  className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Negrito"
                >
                  <Bold size={16} />
                </button>
                <button
                  onClick={() => aplicarComando("italic")}
                  className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Itálico"
                >
                  <Italic size={16} />
                </button>
                <button
                  onClick={() => aplicarComando("underline")}
                  className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Sublinhado"
                >
                  <Underline size={16} />
                </button>
                <button
                  onClick={alternarGrifo}
                  className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Grifado"
                >
                  <Highlighter size={16} />
                </button>
                <button
                  onClick={() => aplicarComando("insertUnorderedList")}
                  className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Lista"
                >
                  <List size={16} />
                </button>

                <select
                  value={tamanhoFonte}
                  onChange={(e) => {
                    setTamanhoFonte(e.target.value);
                    aplicarComando("fontSize", e.target.value);
                  }}
                  className="ml-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
                  title="Tamanho da fonte"
                >
                  <option value="2">Pequena</option>
                  <option value="3">Normal</option>
                  <option value="4">Média</option>
                  <option value="5">Grande</option>
                  <option value="6">Muito grande</option>
                </select>
              </div>
            )}

            {modoEdicao ? (
              <div
                key={`${notaAtual.id}-edicao`}
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => setConteudoEdicao(e.currentTarget.innerHTML)}
                className="flex-1 rounded-xl border px-4 py-3 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none focus:border-cyan-500 overflow-y-auto leading-relaxed"
                dangerouslySetInnerHTML={{ __html: htmlSeguro(conteudoEdicao) }}
              />
            ) : (
              <div
                className="flex-1 rounded-xl border px-4 py-3 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 overflow-y-auto leading-relaxed"
                dangerouslySetInnerHTML={{ __html: htmlSeguro(notaAtual.conteudo) }}
              />
            )}

            <p className="text-xs text-slate-500">
              {modoEdicao
                ? "Dica: use a barra acima para formatar texto e salvar quando terminar."
                : "Nota em modo leitura. Clique em Editar para alterar o conteúdo."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default Anotacoes;