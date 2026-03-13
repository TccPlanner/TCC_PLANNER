import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function Friendships() {
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [myInviteCode, setMyInviteCode] = useState("");
  const [myName, setMyName] = useState("");
  const [myUserId, setMyUserId] = useState(null);

  const [pendingRequests, setPendingRequests] = useState([]);
  const [ranking, setRanking] = useState([]);

  const [loadingPending, setLoadingPending] = useState(false);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);

  const copiarCodigo = async (codigo) => {
    if (!codigo) return;

    try {
      await navigator.clipboard.writeText(codigo);
      alert(`Código ${codigo} copiado!`);
    } catch {
      alert(`Código: ${codigo}`);
    }
  };

  const medalhaOuPosicao = (row) => {
    if (row?.medalha) return row.medalha;
    if (row?.ranking_pos) return `#${row.ranking_pos}`;
    return "-";
  };

  const loadMyInviteCode = async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("Não logado");
    }

    setMyUserId(user.id);

    let { data, error } = await supabase
      .from("perfis")
      .select("invite_code, nome")
      .eq("id", user.id)
      .single();

    if (
      error &&
      (error.code === "PGRST116" ||
        String(error.message || "").includes("0 rows"))
    ) {
      const { error: upsertError } = await supabase.from("perfis").upsert(
        {
          id: user.id,
          nome:
            user.user_metadata?.name ??
            user.user_metadata?.nome ??
            user.email ??
            "Usuário",
        },
        { onConflict: "id" }
      );

      if (upsertError) {
        throw upsertError;
      }

      const res = await supabase
        .from("perfis")
        .select("invite_code, nome")
        .eq("id", user.id)
        .single();

      data = res.data;
      error = res.error;
    }

    if (error) {
      throw error;
    }

    setMyInviteCode(data?.invite_code ?? "");
    setMyName(data?.nome ?? "");
  };

  const loadIncomingRequests = async () => {
    setLoadingPending(true);

    const { data, error } = await supabase
      .from("v_incoming_friend_requests")
      .select(
        "id, requester_id, requester_nome, requester_avatar_url, status, created_at"
      )
      .order("created_at", { ascending: false });

    setLoadingPending(false);

    if (error) {
      throw error;
    }

    setPendingRequests(data ?? []);
  };

  const loadFriendsRanking = async () => {
    setLoadingRanking(true);

    const { data, error } = await supabase
      .from("v_me_and_friends_ranking")
      .select(
        "ranking_pos, medalha, user_id, nome, avatar_url, invite_code, level, title, xp_total, last_activity_at"
      )
      .order("ranking_pos", { ascending: true })
      .order("xp_total", { ascending: false });

    setLoadingRanking(false);

    if (error) {
      throw error;
    }

    setRanking(data ?? []);
  };

  const sendFriendRequestByCode = async (inviteCode) => {
    const code = inviteCode.trim().toUpperCase().replace(/\s+/g, "");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("Não logado");
    }

    const { data: friendId, error: rpcError } = await supabase.rpc(
      "resolve_invite_code",
      { code }
    );

    if (rpcError || !friendId) {
      throw new Error("Código inválido.");
    }

    if (friendId === user.id) {
      throw new Error("Você não pode adicionar você mesma.");
    }

    const { error: sendError } = await supabase.rpc("send_friend_request", {
      p_addressee_id: friendId,
    });

    if (sendError) {
      throw new Error(sendError.message || "Não foi possível enviar o convite.");
    }

    return true;
  };

  const acceptRequest = async (requestId) => {
    const { error } = await supabase.rpc("respond_friend_request", {
      p_friendship_id: requestId,
      p_status: "accepted",
    });

    if (error) {
      throw error;
    }

    return true;
  };

  const bootstrap = async () => {
    try {
      await loadMyInviteCode();
    } catch (error) {
      alert(error.message || "Erro ao carregar seu perfil.");
      return;
    }

    try {
      await Promise.all([loadIncomingRequests(), loadFriendsRanking()]);
    } catch (error) {
      alert(error.message || "Erro ao carregar amizades.");
    }
  };

  useEffect(() => {
    bootstrap();
  }, []);

  const enviarPedido = async (e) => {
    e.preventDefault();

    try {
      setSendingInvite(true);
      await sendFriendRequestByCode(inviteCodeInput);
      setInviteCodeInput("");
      alert("Convite enviado com sucesso.");
      await Promise.all([loadIncomingRequests(), loadFriendsRanking()]);
    } catch (error) {
      alert(error.message || "Não foi possível enviar o convite.");
    } finally {
      setSendingInvite(false);
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

        <button
          type="button"
          onClick={() => copiarCodigo(myInviteCode)}
          className="text-sm mb-4 text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
        >
          Clique para copiar seu código
        </button>

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
            disabled={sendingInvite}
            className="px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold cursor-pointer"
          >
            {sendingInvite ? "Enviando..." : "Enviar convite"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-slate-50 dark:bg-slate-950/40">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Solicitações pendentes</h2>

          <button
            onClick={loadIncomingRequests}
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
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="font-medium">
                    Solicitante: {request.requester_nome ?? request.requester_id}
                  </p>
                  <p className="text-sm text-slate-500">
                    {new Date(request.created_at).toLocaleString()}
                  </p>
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
            onClick={loadFriendsRanking}
            className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
          >
            Atualizar
          </button>
        </div>

        {loadingRanking ? (
          <p className="text-slate-500">Carregando...</p>
        ) : ranking.length === 0 ? (
          <p className="text-slate-500">
            Sem dados no ranking ainda.
          </p>
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
                  <th className="py-2 pr-4 font-semibold">Código</th>
                </tr>
              </thead>

              <tbody>
                {ranking.map((row) => {
                  const isMe = myUserId && row.user_id === myUserId;

                  return (
                    <tr
                      key={row.user_id}
                      className={[
                        "border-b border-slate-100 dark:border-slate-900",
                        isMe ? "bg-cyan-50 dark:bg-cyan-950/30" : "",
                      ].join(" ")}
                    >
                      <td className="py-2 pr-4 text-sm font-semibold">
                        {medalhaOuPosicao(row)}
                      </td>

                      <td className="py-2 pr-4 text-sm">
                        {row.nome ?? "-"} {isMe ? "(você)" : ""}
                      </td>

                      <td className="py-2 pr-4 text-sm">{row.xp_total ?? 0}</td>
                      <td className="py-2 pr-4 text-sm">{row.level ?? "-"}</td>
                      <td className="py-2 pr-4 text-sm">{row.title ?? "-"}</td>

                      <td className="py-2 pr-4 text-sm">
                        {row.invite_code ? (
                          <button
                            type="button"
                            onClick={() => copiarCodigo(row.invite_code)}
                            className="text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                          >
                            {row.invite_code}
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default Friendships;