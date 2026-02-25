import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

export function useFlashTree({ userId, courseId, disciplineId, topicId, deckId, paused }) {
  const [loading, setLoading] = useState(true);

  const [courses, setCourses] = useState([]);
  const [disciplines, setDisciplines] = useState([]);
  const [topics, setTopics] = useState([]);
  const [decks, setDecks] = useState([]);
  const [deckCardCount, setDeckCardCount] = useState(0);

  const level = useMemo(() => {
    if (deckId) return "deck";
    if (topicId) return "topic";
    if (disciplineId) return "discipline";
    if (courseId) return "course";
    return "root";
  }, [courseId, disciplineId, topicId, deckId]);

  const refetch = useCallback(async () => {
    if (!userId) return;
    if (paused) return; // ✅ trava refetch enquanto você digita no modal

    setLoading(true);
    try {
      const { data: cData, error: cErr } = await supabase
        .from("flash_courses")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (cErr) throw cErr;
      setCourses(cData || []);

      if (courseId) {
        const { data: dData, error: dErr } = await supabase
          .from("flash_disciplines")
          .select("*")
          .eq("user_id", userId)
          .eq("course_id", courseId)
          .order("created_at", { ascending: false });
        if (dErr) throw dErr;
        setDisciplines(dData || []);
      } else setDisciplines([]);

      if (disciplineId) {
        const { data: tData, error: tErr } = await supabase
          .from("flash_topics")
          .select("*")
          .eq("user_id", userId)
          .eq("discipline_id", disciplineId)
          .order("created_at", { ascending: false });
        if (tErr) throw tErr;
        setTopics(tData || []);
      } else setTopics([]);

      if (topicId) {
        const { data: dkData, error: dkErr } = await supabase
          .from("flash_decks")
          .select("*")
          .eq("user_id", userId)
          .eq("topic_id", topicId)
          .order("created_at", { ascending: false });
        if (dkErr) throw dkErr;
        setDecks(dkData || []);
      } else setDecks([]);

      if (deckId) {
        const { count, error: cntErr } = await supabase
          .from("flash_cards")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("deck_id", deckId);
        if (cntErr) throw cntErr;
        setDeckCardCount(count || 0);
      } else setDeckCardCount(0);
    } finally {
      setLoading(false);
    }
  }, [userId, courseId, disciplineId, topicId, deckId, paused]);

  useEffect(() => {
    if (paused) return;
    refetch();
  }, [refetch, paused]);

  return { loading, level, courses, disciplines, topics, decks, deckCardCount, refetch };
}
