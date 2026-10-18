import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/contexts/AuthContextSupabase';
import type {
  TradingSession,
  TradingSessionInsert,
  TradingSessionUpdate,
} from '@/types/database';
import { format } from 'date-fns';

export function useTradingSessions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get all sessions for the user
  const sessionsQuery = useQuery({
    queryKey: ['trading-sessions', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('trading_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('session_date', { ascending: false });

      if (error) throw error;
      return data as TradingSession[];
    },
    enabled: !!user,
  });

  // Get today's session
  const todaySessionQuery = useQuery({
    queryKey: ['trading-session-today', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const today = format(new Date(), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('trading_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_date', today)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      return data as TradingSession | null;
    },
    enabled: !!user,
  });

  // Get a specific session by ID
  const getSession = async (sessionId: string) => {
    const { data, error } = await supabase
      .from('trading_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) throw error;
    return data as TradingSession;
  };

  // Create or get today's session
  const createOrGetTodaySession = useMutation({
    mutationFn: async (premarket?: Partial<TradingSessionInsert>) => {
      if (!user) throw new Error('Not authenticated');

      const today = format(new Date(), 'yyyy-MM-dd');

      // Try to get existing session
      const { data: existing } = await supabase
        .from('trading_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_date', today)
        .single();

      if (existing) {
        return existing as TradingSession;
      }

      // Create new session
      const { data, error } = await supabase
        .from('trading_sessions')
        .insert({
          user_id: user.id,
          session_date: today,
          started_at: new Date().toISOString(),
          ...premarket,
        })
        .select()
        .single();

      if (error) throw error;
      return data as TradingSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trading-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['trading-session-today'] });
    },
  });

  // Update a session
  const updateSession = useMutation({
    mutationFn: async ({
      sessionId,
      updates,
    }: {
      sessionId: string;
      updates: TradingSessionUpdate;
    }) => {
      const { data, error } = await supabase
        .from('trading_sessions')
        .update(updates)
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return data as TradingSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trading-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['trading-session-today'] });
    },
  });

  // Save premarket notes
  const savePremarketNotes = useMutation({
    mutationFn: async (notes: {
      premarket_notes?: string;
      market_bias?: TradingSession['market_bias'];
      key_levels?: string;
      planned_instruments?: string[];
    }) => {
      const session = await createOrGetTodaySession.mutateAsync(notes);
      return session;
    },
  });

  // Save post-session review
  const savePostSessionReview = useMutation({
    mutationFn: async ({
      sessionId,
      review,
    }: {
      sessionId: string;
      review: {
        session_notes?: string;
        lessons_learned?: string;
        emotional_state?: TradingSession['emotional_state'];
        followed_plan?: boolean;
      };
    }) => {
      return updateSession.mutateAsync({
        sessionId,
        updates: {
          ...review,
          ended_at: new Date().toISOString(),
        },
      });
    },
  });

  return {
    // Queries
    sessions: sessionsQuery.data ?? [],
    todaySession: todaySessionQuery.data,
    isLoading: sessionsQuery.isLoading || todaySessionQuery.isLoading,
    error: sessionsQuery.error || todaySessionQuery.error,

    // Mutations
    createOrGetTodaySession,
    updateSession,
    savePremarketNotes,
    savePostSessionReview,
    getSession,

    // Helpers
    refetch: () => {
      sessionsQuery.refetch();
      todaySessionQuery.refetch();
    },
  };
}
