// No seu componente de Calendário
const buscarEventos = async () => {
    const { data } = await supabase
        .from('revisoes_agendadas')
        .select('*')
        .eq('user_id', user.id);

    // Converte os dados do banco para o formato do seu componente de calendário
    const eventosFormatados = data.map(rev => ({
        title: rev.titulo,
        start: rev.data_revisao,
        allDay: true
    }));
    setEventos(eventosFormatados);
};