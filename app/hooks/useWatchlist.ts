import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/contexts/AuthContextSupabase';
import type {
  WatchlistItem,
  WatchlistItemInsert,
  WatchlistItemUpdate,
} from '@/types/database';

export function useWatchlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get user's watchlist
  const watchlistQuery = useQuery({
    queryKey: ['watchlist', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('watchlist_items')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as WatchlistItem[];
    },
    enabled: !!user,
  });

  // Get primary instruments (what user mainly trades)
  const primaryInstruments = watchlistQuery.data?.filter((item) => item.is_primary) ?? [];

  // Add item to watchlist
  const addToWatchlist = useMutation({
    mutationFn: async (
      item: Omit<WatchlistItemInsert, 'user_id'>
    ) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('watchlist_items')
        .insert({
          ...item,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as WatchlistItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });

  // Update watchlist item
  const updateWatchlistItem = useMutation({
    mutationFn: async ({
      itemId,
      updates,
    }: {
      itemId: string;
      updates: WatchlistItemUpdate;
    }) => {
      const { data, error } = await supabase
        .from('watchlist_items')
        .update(updates)
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;
      return data as WatchlistItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });

  // Remove from watchlist
  const removeFromWatchlist = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('watchlist_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });

  // Toggle primary status
  const togglePrimary = useMutation({
    mutationFn: async (itemId: string) => {
      const item = watchlistQuery.data?.find((i) => i.id === itemId);
      if (!item) throw new Error('Item not found');

      return updateWatchlistItem.mutateAsync({
        itemId,
        updates: { is_primary: !item.is_primary },
      });
    },
  });

  // Reorder watchlist
  const reorderWatchlist = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) => ({
        id,
        sort_order: index,
      }));

      // Update each item's sort order
      for (const update of updates) {
        const { error } = await supabase
          .from('watchlist_items')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });

  // Quick add common instruments
  const addCommonInstruments = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const commonInstruments = [
        { symbol: 'ES', asset_type: 'futures' as const, display_name: 'S&P 500 E-mini', is_primary: true },
        { symbol: 'NQ', asset_type: 'futures' as const, display_name: 'NASDAQ-100 E-mini', is_primary: true },
        { symbol: 'BTC', asset_type: 'crypto' as const, display_name: 'Bitcoin', is_primary: true },
        { symbol: 'ETH', asset_type: 'crypto' as const, display_name: 'Ethereum', is_primary: true },
        { symbol: 'SOL', asset_type: 'crypto' as const, display_name: 'Solana', is_primary: false },
        { symbol: 'AAPL', asset_type: 'stock' as const, display_name: 'Apple Inc.', is_primary: false },
        { symbol: 'NVDA', asset_type: 'stock' as const, display_name: 'NVIDIA', is_primary: false },
        { symbol: 'MSFT', asset_type: 'stock' as const, display_name: 'Microsoft', is_primary: false },
        { symbol: 'GOOGL', asset_type: 'stock' as const, display_name: 'Alphabet', is_primary: false },
        { symbol: 'AMZN', asset_type: 'stock' as const, display_name: 'Amazon', is_primary: false },
        { symbol: 'GC', asset_type: 'metal' as const, display_name: 'Gold Futures', is_primary: false },
        { symbol: 'SI', asset_type: 'metal' as const, display_name: 'Silver Futures', is_primary: false },
      ];

      const existingSymbols = watchlistQuery.data?.map((i) => i.symbol) ?? [];
      const newInstruments = commonInstruments.filter(
        (i) => !existingSymbols.includes(i.symbol)
      );

      if (newInstruments.length === 0) return [];

      const { data, error } = await supabase
        .from('watchlist_items')
        .insert(
          newInstruments.map((item, index) => ({
            ...item,
            user_id: user.id,
            sort_order: (watchlistQuery.data?.length ?? 0) + index,
          }))
        )
        .select();

      if (error) throw error;
      return data as WatchlistItem[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });

  return {
    // Data
    watchlist: watchlistQuery.data ?? [],
    primaryInstruments,
    isLoading: watchlistQuery.isLoading,
    error: watchlistQuery.error,

    // Mutations
    addToWatchlist,
    updateWatchlistItem,
    removeFromWatchlist,
    togglePrimary,
    reorderWatchlist,
    addCommonInstruments,

    // Helpers
    refetch: watchlistQuery.refetch,
  };
}
