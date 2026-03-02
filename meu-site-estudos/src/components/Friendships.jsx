import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function Friendships() {
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [myInviteCode, setMyInviteCode] = useState("");
  const [myName, setMyName] = useState("");
  const [pendingRequests, setPendingRequests] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [loadingRanking, setLoadingRanking] = useState(false);

  const loadMyInviteCode = async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) throw new Error("Não logado");

    const { data, error } = await supabase
      .from("perfis")
      .select("invite_code, nome")
      .eq("id", user.id)
      .single();

    if (error) throw error;

    setMyInviteCode(data?.invite_code ?? "");
    setMyName(data?.nome ?? "");
  };

  const loadIncomingRequests = async () => {
    setLoadingPending(true);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setLoadingPending(false);
      throw new Error("Não logado");
    }

    const { data, error } = await supabase
      .from("friendships")
      .select("id, requester_id, status, created_at")
      .eq("addressee_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    setLoadingPending(false);

    if (error) throw error;

    setPendingRequests(data ?? []);
  };

  const loadFriendsRanking = async () => {
    setLoadingRanking(true);

    const { data, error } = await supabase
      .from("v_friend_ranking")
      .select("user_id, nome, level, title, xp_total");

    setLoadingRanking(false);

    if (error) throw error;

    setRanking(data ?? []);
  };

  const sendFriendRequestByCode = async (inviteCode) => {
    const code = inviteCode.trim();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) throw new Error("Não logado");

    const { data: rpcData, error: rpcErr } = await supabase.rpc("resolve_invite_code", {
      code,
    });

    if (rpcErr) throw rpcErr;

    let friendId = null;

    if (Array.isArray(rpcData)) {
      const first = rpcData[0];
      friendId =
        (first && typeof first === "object"
          ? first.id ?? first.user_id ?? first.friend_id ?? first.resolve_invite_code
          : first) ?? null;
    } else if (rpcData && typeof rpcData === "object") {
      friendId = rpcData.id ?? rpcData.user_id ?? rpcData.friend_id ?? rpcData.resolve_invite_code ?? null;
    } else {
      friendId = rpcData;
    }

    if (!friendId) throw new Error("Código inválido.");

    if (friendId === user.id) {
      throw new Error("Você não pode adicionar você mesma.");
    }

    const { error: insErr } = await supabase.from("friendships").insert({
      requester_id: user.id,
      addressee_id: friendId,
      status: "pending",
    });

    if (insErr) throw new Error(insErr.message);

    return true;
  };

  const acceptRequest = async (requestId) => {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", requestId);

    if (error) throw error;

    return true;
  };

  const bootstrap = async () => {
    try {
      await Promise.all([loadMyInviteCode(), loadIncomingRequests(), loadFriendsRanking()]);
    } catch (error) {
      alert(error.message || "Erro ao carregar dados de amizades.");
    }
  };

  useEffect(() => {
    bootstrap();
  }, []);

  const enviarPedido = async (e) => {
    e.preventDefault();

    try {
      await sendFriendRequestByCode(inviteCodeInput);
      setInviteCodeInput("");
      alert("Convite enviado com sucesso.");
      await loadIncomingRequests();
    } catch (error) {
      alert(error.message || "Não foi possível enviar o convite.");
    }
  };

  const aceitarPedido = async (requestId) => {
    try {
      await acceptRequest(requestId);
      alert("Pedido aceito!");
      await Promise.all([loadIncomingRequests(), loadFriendsRanking()]);
    } catch (error) {
      alert(error.message || "Não foi possível aceitar o pedido.");
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-slate-50 dark:bg-slate-950/40">
        <h2 className="text-xl font-bold mb-1">Adicionar amigo</h2>
        <p className="text-sm text-slate-500 mb-4">
          Seu código: <strong>{myInviteCode || "-"}</strong>
          {myName ? ` (${myName})` : ""}
        </p>

        <form onSubmit={enviarPedido} className="flex flex-col sm:flex-row gap-3">
          <input
            value={inviteCodeInput}
            onChange={(e) => setInviteCodeInput(e.target.value)}
            placeholder="Digite o código do amigo"
            className="flex-1 p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-cyan-500"
            required
          />
          <button
            type="submit"
            className="px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold cursor-pointer"
          >
            Enviar convite
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-slate-50 dark:bg-slate-950/40">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Solicitações pendentes</h2>
          <button
            onClick={async () => {
              try {
                await loadIncomingRequests();
              } catch (error) {
                alert(error.message || "Erro ao atualizar solicitações.");
              }
            }}
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
                  <p className="font-medium">Solicitante: {request.requester_id}</p>
                  <p className="text-sm text-slate-500">{new Date(request.created_at).toLocaleString()}</p>
                </div>
                <button
                  onClick={() => aceitarPedido(request.id)}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold cursor-pointer"
                >
                  Aceitar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-slate-50 dark:bg-slate-950/40">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Ranking</h2>
          <button
            onClick={async () => {
              try {
                await loadFriendsRanking();
              } catch (error) {
                alert(error.message || "Erro ao atualizar ranking.");
              }
            }}
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
                  <th className="py-2 pr-4 font-semibold">Posição</th>
                  <th className="py-2 pr-4 font-semibold">Nome</th>
                  <th className="py-2 pr-4 font-semibold">XP Total</th>
                  <th className="py-2 pr-4 font-semibold">Level</th>
                  <th className="py-2 pr-4 font-semibold">Título</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((row, index) => (
                  <tr key={row.user_id} className="border-b border-slate-100 dark:border-slate-900">
                    <td className="py-2 pr-4 text-sm font-semibold">#{index + 1}</td>
                    <td className="py-2 pr-4 text-sm">{row.nome ?? "-"}</td>
                    <td className="py-2 pr-4 text-sm">{row.xp_total ?? 0}</td>
                    <td className="py-2 pr-4 text-sm">{row.level ?? "-"}</td>
                    <td className="py-2 pr-4 text-sm">{row.title ?? "-"}</td>
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
