import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function Friendships() {
  const [friendId, setFriendId] = useState("");
  const [pendingRequests, setPendingRequests] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [loadingRanking, setLoadingRanking] = useState(false);

  const carregarPendentes = async () => {
    setLoadingPending(true);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      alert("Não foi possível identificar o usuário.");
      setLoadingPending(false);
      return;
    }

    const { data, error } = await supabase
      .from("friendships")
      .select("id, requester_id, status")
      .eq("addressee_id", user.id)
      .eq("status", "pending")
      .order("id", { ascending: false });

    if (error) {
      alert("Erro ao carregar solicitações pendentes.");
      setLoadingPending(false);
      return;
    }

    setPendingRequests(data ?? []);
    setLoadingPending(false);
  };

  const carregarRanking = async () => {
    setLoadingRanking(true);
    const { data, error } = await supabase.from("v_friend_ranking").select("*");

    if (error) {
      alert("Erro ao carregar ranking dos amigos.");
      setLoadingRanking(false);
      return;
    }

    setRanking(data ?? []);
    setLoadingRanking(false);
  };

  useEffect(() => {
    carregarPendentes();
    carregarRanking();
  }, []);

  const enviarPedido = async (e) => {
    e.preventDefault();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      alert("Faça login para enviar pedido de amizade.");
      return;
    }

    const { error } = await supabase.from("friendships").insert({
      requester_id: user.id,
      addressee_id: friendId,
      status: "pending",
    });

    if (error) {
      alert("Não foi possível enviar o pedido de amizade.");
      return;
    }

    setFriendId("");
    alert("Pedido enviado com sucesso.");
    carregarPendentes();
  };

  const aceitarPedido = async (requestId) => {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", requestId);

    if (error) {
      alert("Não foi possível aceitar o pedido.");
      return;
    }

    alert("Pedido aceito!");
    carregarPendentes();
    carregarRanking();
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-slate-50 dark:bg-slate-950/40">
        <h2 className="text-xl font-bold mb-4">Adicionar amigo</h2>
        <form onSubmit={enviarPedido} className="flex flex-col sm:flex-row gap-3">
          <input
            value={friendId}
            onChange={(e) => setFriendId(e.target.value)}
            placeholder="Cole o user_id do amigo"
            className="flex-1 p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-cyan-500"
            required
          />
          <button
            type="submit"
            className="px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold cursor-pointer"
          >
            Enviar pedido
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-slate-50 dark:bg-slate-950/40">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Solicitações pendentes</h2>
          <button
            onClick={carregarPendentes}
            className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
          >
            Atualizar
          </button>
        </div>

        {loadingPending ? (
          <p className="text-slate-500">Carregando...</p>
        ) : pendingRequests.length === 0 ? (
          <p className="text-slate-500">Nenhuma solicitação pendente.</p>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium">Requester: {request.requester_id}</p>
                  <p className="text-sm text-slate-500">Status: {request.status}</p>
                </div>
                <button
                  onClick={() => aceitarPedido(request.id)}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold cursor-pointer"
                >
                  Aceitar pedido
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-slate-50 dark:bg-slate-950/40">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Ranking dos amigos</h2>
          <button
            onClick={carregarRanking}
            className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
          >
            Atualizar
          </button>
        </div>

        {loadingRanking ? (
          <p className="text-slate-500">Carregando...</p>
        ) : ranking.length === 0 ? (
          <p className="text-slate-500">Sem dados no ranking ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-sm text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  {Object.keys(ranking[0]).map((key) => (
                    <th key={key} className="py-2 pr-4 font-semibold">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranking.map((row, index) => (
                  <tr key={index} className="border-b border-slate-100 dark:border-slate-900">
                    {Object.values(row).map((value, valueIndex) => (
                      <td key={valueIndex} className="py-2 pr-4 text-sm">
                        {String(value ?? "-")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default Friendships;
