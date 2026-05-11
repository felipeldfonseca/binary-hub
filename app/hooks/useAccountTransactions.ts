import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { createDataClient } from '@/lib/supabase';
import { useAuth } from '@/lib/contexts/AuthContextSupabase';

export interface AccountTransaction {
  id: string;
  user_id: string;
  market_type: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  transaction_date: string;
  notes: string | null;
  created_at: string;
}

export interface AccountTransactionInsert {
  type: 'deposit' | 'withdrawal';
  amount: number;
  transaction_date: string;
  notes?: string | null;
  market_type?: string;
}

const QUERY_KEY = ['account-transactions'] as const;

export function useAccountTransactions(marketType?: string) {
  const { user, session } = useAuth();
  const db = useMemo(() => createDataClient(session?.access_token ?? null), [session?.access_token]);
  const queryClient = useQueryClient();

  const transactionsQuery = useQuery({
    queryKey: [...QUERY_KEY, user?.id, marketType],
    queryFn: async (): Promise<AccountTransaction[]> => {
      if (!user) throw new Error('Not authenticated');

      let query = db
        .from('account_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false });

      if (marketType) {
        query = query.eq('market_type', marketType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AccountTransaction[];
    },
    enabled: !!user,
  });

  const addTransaction = useMutation({
    mutationFn: async (payload: AccountTransactionInsert): Promise<AccountTransaction> => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await db
        .from('account_transactions')
        .insert({
          user_id: user.id,
          market_type: payload.market_type ?? 'binary',
          type: payload.type,
          amount: payload.amount,
          transaction_date: payload.transaction_date,
          notes: payload.notes ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as AccountTransaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const deleteTransaction = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await db
        .from('account_transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  return {
    transactions: transactionsQuery.data ?? [],
    isLoading: transactionsQuery.isLoading,
    error: transactionsQuery.error,
    addTransaction,
    deleteTransaction,
    refetch: transactionsQuery.refetch,
  };
}
