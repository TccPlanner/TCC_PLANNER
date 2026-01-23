import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import {
    Plus, Trash2, CheckCircle, Circle, Trophy, Calendar,
    Paperclip, RefreshCw, UploadCloud, FileText, Download,
    ExternalLink, X, ListTree, Link as LinkIcon, Edit3
} from 'lucide-react';

const BUCKET_ANEXOS = 'tarefas_anexos';

const GerenciadorTarefas = ({ user }) => {
    const [tarefas, setTarefas] = useState([]);
    const [novaTarefa, setNovaTarefa] = useState('');
    const [loading, setLoading] = useState(false);

    // Estados do Formulário de Criação
    const [mostrarOpcoes, setMostrarOpcoes] = useState(false);
    const [categoria, setCategoria] = useState('Geral');
    const [prioridade, setPrioridade] = useState('1');
    const [dataVencimento, setDataVencimento] = useState(new Date().toISOString().split('T')[0]);
    const [notas, setNotas] = useState('');
    const [recorrente, setRecorrente] = useState(false);
    const [lembrete, setLembrete] = useState(false);
    const [urlAnexo, setUrlAnexo] = useState('');
    const [arquivoUpload, setArquivoUpload] = useState(null);

    // Estados de Edição
    const [editandoId, setEditandoId] = useState(null);
    const [editandoCampos, setEditandoCampos] = useState({});

    // Anexos adicionais dentro da edição
    const [editNovoUrl, setEditNovoUrl] = useState('');
    const [editNovoArquivo, setEditNovoArquivo] = useState(null);

    // UI Geral
    const [expandida, setExpandida] = useState(null);
    const [novaSubtarefa, setNovaSubtarefa] = useState('');

    useEffect(() => { if (user) buscarTarefas(); }, [user]);

    const buscarTarefas = async () => {
        const { data } = await supabase
            .from('tarefas')
            .select('*')
            .eq('user_id', user.id)
            .order('prioridade', { ascending: false });

        if (data) setTarefas(data);
    };

    const uploadParaStorage = async (file) => {
        const safeName = file.name.replace(/\s/g, '_');
        const fileName = `${Date.now()}_${safeName}`;
        const filePath = `${user.id}/${fileName}`;

        const { error } = await supabase.storage.from(BUCKET_ANEXOS).upload(filePath, file);
        if (error) throw error;

        const { data } = supabase.storage.from(BUCKET_ANEXOS).getPublicUrl(filePath);

        return {
            nome: file.name,
            url: data.publicUrl,
            tipo: 'upload',
            path: filePath,
        };
    };

    // ✅ DOWNLOAD REAL do upload (não abre o link em nova aba)
    const baixarUpload = async (anexo) => {
        try {
            if (!anexo?.path) {
                alert("Esse anexo não tem 'path' salvo. (precisa salvar o path no upload)");
                return;
            }

            const { data, error } = await supabase.storage.from(BUCKET_ANEXOS).download(anexo.path);
            if (error) throw error;

            const blobUrl = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = anexo.nome || 'arquivo';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(blobUrl);
        } catch (err) {
            alert("Falha ao baixar: " + err.message);
        }
    };

    const adicionarTarefa = async (e) => {
        if (e) e.preventDefault();
        if (!novaTarefa.trim()) return;

        setLoading(true);
        try {
            let anexosIniciais = [];

            if (urlAnexo.trim()) {
                anexosIniciais.push({
                    nome: "Link Externo",
                    url: urlAnexo.trim(),
                    tipo: 'url',
                });
            }

            if (arquivoUpload) {
                const res = await uploadParaStorage(arquivoUpload);
                anexosIniciais.push(res);
            }

            const { data, error } = await supabase.from('tarefas').insert([{
                texto: novaTarefa,
                concluida: false,
                user_id: user.id,
                categoria,
                prioridade: parseInt(prioridade),
                data_vencimento: dataVencimento,
                notas,
                recorrente,
                lembrete,
                anexos: anexosIniciais,
                subtarefas: []
            }]).select();

            if (!error) {
                setTarefas([data[0], ...tarefas]);
                resetForm();
            }
        } catch (err) {
            alert("Falha ao criar: " + err.message);
        }
        setLoading(false);
    };

    const resetForm = () => {
        setNovaTarefa('');
        setNotas('');
        setArquivoUpload(null);
        setUrlAnexo('');
        setMostrarOpcoes(false);
        setRecorrente(false);
        setLembrete(false);
    };

    // --- Edição ---
    const iniciarEdicao = (tarefa) => {
        setEditandoId(tarefa.id);
        setEditandoCampos({ ...tarefa });
        setEditNovoUrl('');
        setEditNovoArquivo(null);
    };

    const salvarEdicao = async (id) => {
        setLoading(true);
        try {
            const { error } = await supabase.from('tarefas').update({
                texto: editandoCampos.texto,
                prioridade: parseInt(editandoCampos.prioridade),
                categoria: editandoCampos.categoria,
                data_vencimento: editandoCampos.data_vencimento,
                notas: editandoCampos.notas,
                anexos: editandoCampos.anexos
            }).eq('id', id);

            if (!error) {
                setTarefas(tarefas.map(t => t.id === id ? { ...editandoCampos } : t));
                setEditandoId(null);
            }
        } catch (err) {
            alert(err.message);
        }
        setLoading(false);
    };

    const deletarTarefa = async (id) => {
        if (window.confirm("Apagar esta tarefa permanentemente?")) {
            await supabase.from('tarefas').delete().eq('id', id);
            setTarefas(tarefas.filter(t => t.id !== id));
        }
    };

    const progresso = tarefas.length > 0
        ? Math.round((tarefas.filter(t => t.concluida).length / tarefas.length) * 100)
        : 0;

    // ✅ adicionar anexo na edição (URL)
    const addAnexoUrlEdicao = () => {
        if (!editNovoUrl.trim()) return;
        const novos = [
            ...(editandoCampos.anexos || []),
            { nome: "Link Externo", url: editNovoUrl.trim(), tipo: "url" }
        ];
        setEditandoCampos({ ...editandoCampos, anexos: novos });
        setEditNovoUrl('');
    };

    // ✅ adicionar anexo na edição (UPLOAD)
    const addAnexoUploadEdicao = async () => {
        if (!editNovoArquivo) return;
        setLoading(true);
        try {
            const res = await uploadParaStorage(editNovoArquivo);
            const novos = [...(editandoCampos.anexos || []), res];
            setEditandoCampos({ ...editandoCampos, anexos: novos });
            setEditNovoArquivo(null);
        } catch (err) {
            alert("Falha no upload: " + err.message);
        }
        setLoading(false);
    };

    // ✅ substituir um upload existente (re-upload e troca no idx)
    const substituirUploadEdicao = async (idx, file) => {
        if (!file) return;
        setLoading(true);
        try {
            const res = await uploadParaStorage(file);
            const novos = [...(editandoCampos.anexos || [])];
            novos[idx] = res;
            setEditandoCampos({ ...editandoCampos, anexos: novos });
        } catch (err) {
            alert("Falha ao substituir: " + err.message);
        }
        setLoading(false);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 p-2 pb-20 font-sans text-slate-900 dark:text-slate-100">

            {/* Header de Progresso */}
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-2">
                        Produtividade <Trophy className="text-amber-500" size={24} />
                    </h2>
                    <span className="text-5xl font-black text-indigo-600 italic">{progresso}%</span>
                </div>
                <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${progresso}%` }} />
                </div>
            </div>

            {/* Form de Criação */}
            <form onSubmit={adicionarTarefa} className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden transition-all">
                <div className="p-4 flex items-center gap-3 relative">
                    <input
                        type="text"
                        placeholder="O que vamos realizar agora?"
                        value={novaTarefa}
                        onFocus={() => setMostrarOpcoes(true)}
                        onChange={(e) => setNovaTarefa(e.target.value)}
                        className="flex-1 bg-transparent p-4 outline-none font-bold text-xl dark:text-white"
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 shadow-md mr-2 shrink-0 active:scale-90 transition-all"
                    >
                        {loading ? <RefreshCw className="animate-spin" size={24} /> : <Plus size={28} />}
                    </button>
                </div>

                {mostrarOpcoes && (
                    <div className="px-8 pb-8 space-y-4 animate-in slide-in-from-top-4 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b dark:border-slate-800 pb-6">
                            <select value={categoria} onChange={e => setCategoria(e.target.value)} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 font-bold text-sm">
                                <option value="Geral">📂 Geral</option>
                                <option value="Estudo">📚 Estudo</option>
                            </select>
                            <select value={prioridade} onChange={e => setPrioridade(e.target.value)} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 font-bold text-sm">
                                <option value="1">Prioridade Baixa</option>
                                <option value="2">Prioridade Média</option>
                                <option value="3">Alta 🔥</option>
                            </select>
                            <input type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 font-bold text-sm" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                                type="url"
                                value={urlAnexo}
                                onChange={e => setUrlAnexo(e.target.value)}
                                placeholder="Link URL..."
                                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm font-medium outline-none border border-transparent focus:border-indigo-500"
                            />
                            <label className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border-2 border-dashed border-indigo-200 dark:border-indigo-800 cursor-pointer">
                                <UploadCloud size={18} className="text-indigo-600" />
                                <span className="text-xs font-bold text-indigo-600 truncate">
                                    {arquivoUpload ? arquivoUpload.name : "Upload de Arquivo"}
                                </span>
                                <input type="file" className="hidden" onChange={e => setArquivoUpload(e.target.files?.[0] || null)} />
                            </label>
                        </div>

                        <textarea
                            value={notas}
                            onChange={e => setNotas(e.target.value)}
                            placeholder="Notas extras..."
                            className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none outline-none font-medium text-sm min-h-[80px]"
                        />
                    </div>
                )}
            </form>

            {/* Lista de Tarefas */}
            <div className="space-y-4">
                {tarefas.map(t => (
                    <div key={t.id} className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all">

                        {/* Corpo da Tarefa */}
                        <div className="p-6 flex items-center justify-between gap-4">
                            <button
                                type="button"
                                onClick={async () => {
                                    const status = !t.concluida;
                                    await supabase.from('tarefas').update({ concluida: status }).eq('id', t.id);
                                    buscarTarefas();
                                }}
                                className="shrink-0"
                            >
                                {t.concluida
                                    ? <CheckCircle className="text-emerald-500" size={30} />
                                    : <Circle className="text-slate-200 dark:text-slate-800" size={30} />
                                }
                            </button>

                            <div className="flex-1 min-w-0">
                                {editandoId === t.id ? (
                                    <div className="space-y-4 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-indigo-500/20">

                                        <input
                                            value={editandoCampos.texto || ""}
                                            onChange={e => setEditandoCampos({ ...editandoCampos, texto: e.target.value })}
                                            className="w-full bg-transparent p-2 font-black text-xl border-b-2 border-indigo-500 outline-none"
                                        />

                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                            <select
                                                value={editandoCampos.categoria || "Geral"}
                                                onChange={e => setEditandoCampos({ ...editandoCampos, categoria: e.target.value })}
                                                className="p-2 rounded-lg bg-white dark:bg-slate-800 text-xs font-bold"
                                            >
                                                <option value="Geral">📂 Geral</option>
                                                <option value="Estudo">📚 Estudo</option>
                                            </select>

                                            <select
                                                value={editandoCampos.prioridade || "1"}
                                                onChange={e => setEditandoCampos({ ...editandoCampos, prioridade: e.target.value })}
                                                className="p-2 rounded-lg bg-white dark:bg-slate-800 text-xs font-bold"
                                            >
                                                <option value="1">Baixa</option>
                                                <option value="2">Média</option>
                                                <option value="3">Alta</option>
                                            </select>

                                            <input
                                                type="date"
                                                value={editandoCampos.data_vencimento || dataVencimento}
                                                onChange={e => setEditandoCampos({ ...editandoCampos, data_vencimento: e.target.value })}
                                                className="p-2 rounded-lg bg-white dark:bg-slate-800 text-xs font-bold"
                                            />
                                        </div>

                                        {/* ✅ Edição de Anexos (URL e Upload separados) */}
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-slate-400 uppercase">Gerenciar Anexos</p>

                                            <div className="space-y-2">
                                                {(editandoCampos.anexos || []).map((anexo, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2"
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                {anexo.tipo === 'upload'
                                                                    ? <FileText size={16} className="text-indigo-500 shrink-0" />
                                                                    : <LinkIcon size={16} className="text-cyan-500 shrink-0" />
                                                                }
                                                                <span className="text-[10px] font-black uppercase text-slate-400 truncate">
                                                                    {anexo.tipo === 'upload' ? 'Arquivo Upload' : 'URL Externa'}
                                                                </span>
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const novos = (editandoCampos.anexos || []).filter((_, i) => i !== idx);
                                                                    setEditandoCampos({ ...editandoCampos, anexos: novos });
                                                                }}
                                                                className="text-red-500 hover:scale-110 transition-transform"
                                                                title="Remover"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </div>

                                                        {/* URL editável */}
                                                        {anexo.tipo === 'url' && (
                                                            <input
                                                                value={anexo.url || ""}
                                                                onChange={(e) => {
                                                                    const novos = [...(editandoCampos.anexos || [])];
                                                                    novos[idx] = { ...novos[idx], url: e.target.value };
                                                                    setEditandoCampos({ ...editandoCampos, anexos: novos });
                                                                }}
                                                                placeholder="https://..."
                                                                className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs font-bold outline-none border border-transparent focus:border-cyan-500"
                                                            />
                                                        )}

                                                        {/* Upload editável (nome + substituir) */}
                                                        {anexo.tipo === 'upload' && (
                                                            <div className="space-y-2">
                                                                <input
                                                                    value={anexo.nome || ""}
                                                                    onChange={(e) => {
                                                                        const novos = [...(editandoCampos.anexos || [])];
                                                                        novos[idx] = { ...novos[idx], nome: e.target.value };
                                                                        setEditandoCampos({ ...editandoCampos, anexos: novos });
                                                                    }}
                                                                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs font-bold outline-none border border-transparent focus:border-indigo-500"
                                                                    placeholder="Nome do arquivo"
                                                                />

                                                                <div className="flex flex-wrap gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => baixarUpload(anexo)}
                                                                        className="flex items-center gap-i.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase hover:bg-indigo-700"
                                                                    >
                                                                        <Download size={14} /> Baixar
                                                                    </button>

                                                                    <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase cursor-pointer hover:opacity-90">
                                                                        <UploadCloud size={14} /> Substituir
                                                                        <input
                                                                            type="file"
                                                                            className="hidden"
                                                                            onChange={(e) => substituirUploadEdicao(idx, e.target.files?.[0] || null)}
                                                                        />
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* ✅ ADICIONAR novos anexos na edição */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                                                <div className="flex gap-2">
                                                    <input
                                                        type="url"
                                                        value={editNovoUrl}
                                                        onChange={(e) => setEditNovoUrl(e.target.value)}
                                                        placeholder="Adicionar URL..."
                                                        className="flex-1 p-2 rounded-xl bg-white dark:bg-slate-800 text-xs font-bold outline-none border border-transparent focus:border-cyan-500"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={addAnexoUrlEdicao}
                                                        className="px-3 rounded-xl bg-cyan-600 text-white text-[10px] font-black uppercase hover:bg-cyan-700"
                                                    >
                                                        Add
                                                    </button>
                                                </div>

                                                <div className="flex gap-2">
                                                    <label className="flex-1 flex items-center gap-2 p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border-2 border-dashed border-indigo-200 dark:border-indigo-800 cursor-pointer">
                                                        <UploadCloud size={16} className="text-indigo-600" />
                                                        <span className="text-[10px] font-black text-indigo-600 truncate">
                                                            {editNovoArquivo ? editNovoArquivo.name : "Adicionar Upload"}
                                                        </span>
                                                        <input
                                                            type="file"
                                                            className="hidden"
                                                            onChange={(e) => setEditNovoArquivo(e.target.files?.[0] || null)}
                                                        />
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={addAnexoUploadEdicao}
                                                        className="px-3 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase hover:bg-indigo-700"
                                                    >
                                                        Add
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <textarea
                                            value={editandoCampos.notas || ""}
                                            onChange={e => setEditandoCampos({ ...editandoCampos, notas: e.target.value })}
                                            className="w-full p-3 bg-white dark:bg-slate-800 rounded-xl text-xs"
                                            placeholder="Notas..."
                                        />

                                        <div className="flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setEditandoId(null)}
                                                className="text-[10px] font-black uppercase text-slate-400 p-2"
                                            >
                                                Sair
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => salvarEdicao(t.id)}
                                                className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-xs font-black"
                                            >
                                                SALVAR ALTERAÇÕES
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div onClick={() => setExpandida(expandida === t.id ? null : t.id)} className="cursor-pointer">
                                        <h3 className={`text-xl font-black truncate dark:text-white ${t.concluida ? 'line-through opacity-40' : ''}`}>
                                            {t.texto}
                                        </h3>
                                        <div className="flex gap-4 mt-1 items-center">
                                            <span className="text-[10px] font-black px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded uppercase tracking-widest text-slate-500">
                                                {t.categoria}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                                <Calendar size={12} /> {new Date(t.data_vencimento).toLocaleDateString()}
                                            </span>
                                            {t.anexos?.length > 0 && (
                                                <span className="text-[10px] font-bold text-indigo-500 flex items-center gap-1">
                                                    <Paperclip size={12} /> {t.anexos.length} anexo(s)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {!editandoId && (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setExpandida(expandida === t.id ? null : t.id)}
                                        className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                                    >
                                        <ListTree size={20} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => iniciarEdicao(t)}
                                        className="p-2 text-slate-300 hover:text-amber-500 transition-colors"
                                    >
                                        <Edit3 size={20} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => deletarTarefa(t.id)}
                                        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Expansão de Detalhes */}
                        {expandida === t.id && !editandoId && (
                            <div className="px-16 pb-8 space-y-6 animate-in slide-in-from-top-2 duration-300">

                                {/* ✅ Anexos Visíveis: URL abre / Upload baixa */}
                                {t.anexos?.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {t.anexos.map((anexo, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border dark:border-slate-800 group/anexo"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    {anexo.tipo === 'upload'
                                                        ? <FileText className="text-indigo-500 shrink-0" size={20} />
                                                        : <LinkIcon className="text-cyan-500 shrink-0" size={20} />
                                                    }
                                                    <div className="truncate">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                                            {anexo.tipo === 'upload' ? 'Arquivo' : 'URL Externa'}
                                                        </p>
                                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                                                            {anexo.nome}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* ✅ URL: abre / Upload: baixa */}
                                                {anexo.tipo === 'url' ? (
                                                    <a
                                                        href={anexo.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="p-2 bg-white dark:bg-slate-700 rounded-xl shadow-sm hover:scale-110 transition-transform"
                                                        title="Abrir Link"
                                                    >
                                                        <ExternalLink size={16} className="text-cyan-600" />
                                                    </a>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => baixarUpload(anexo)}
                                                        className="p-2 bg-white dark:bg-slate-700 rounded-xl shadow-sm hover:scale-110 transition-transform"
                                                        title="Baixar arquivo"
                                                    >
                                                        <Download size={16} className="text-indigo-600" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {t.notas && (
                                    <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border-l-4 border-amber-400 text-sm italic text-slate-600 dark:text-slate-300 rounded-r-2xl">
                                        "{t.notas}"
                                    </div>
                                )}

                                {/* Subtarefas */}
                                <div className="border-l-2 border-slate-100 dark:border-slate-800 ml-2 pl-6 space-y-3">
                                    {t.subtarefas?.map(sub => (
                                        <div key={sub.id} className="flex items-center justify-between group/sub">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        const novas = t.subtarefas.map(s => s.id === sub.id ? { ...s, concluida: !s.concluida } : s);
                                                        await supabase.from('tarefas').update({ subtarefas: novas }).eq('id', t.id);
                                                        buscarTarefas();
                                                    }}
                                                >
                                                    {sub.concluida ? <CheckCircle size={18} className="text-emerald-500" /> : <Circle size={18} className="text-slate-300" />}
                                                </button>
                                                <span className={`text-sm font-bold ${sub.concluida ? 'line-through text-slate-400' : 'text-slate-600 dark:text-slate-300'}`}>
                                                    {sub.texto}
                                                </span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    const novas = t.subtarefas.filter(s => s.id !== sub.id);
                                                    await supabase.from('tarefas').update({ subtarefas: novas }).eq('id', t.id);
                                                    buscarTarefas();
                                                }}
                                                className="opacity-0 group-hover/sub:opacity-100 text-rose-300 hover:text-rose-600 transition-all p-1"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}

                                    <div className="flex gap-2 mt-4">
                                        <input
                                            type="text"
                                            value={novaSubtarefa}
                                            onChange={e => setNovaSubtarefa(e.target.value)}
                                            placeholder="Nova etapa..."
                                            className="flex-1 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl text-xs font-bold outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (!novaSubtarefa.trim()) return;
                                                const novas = [...(t.subtarefas || []), { id: Date.now(), texto: novaSubtarefa, concluida: false }];
                                                await supabase.from('tarefas').update({ subtarefas: novas }).eq('id', t.id);
                                                setNovaSubtarefa('');
                                                buscarTarefas();
                                            }}
                                            className="bg-slate-900 text-white px-4 rounded-xl text-[10px] font-black uppercase"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>

                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GerenciadorTarefas;
