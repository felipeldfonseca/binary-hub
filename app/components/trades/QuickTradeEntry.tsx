'use client';

import { useState } from 'react';
import { useTradesSupabase } from '@/hooks/useTradesSupabase';
import { useWatchlist } from '@/hooks/useWatchlist';
import { useTradingSessions } from '@/hooks/useTradingSessions';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

type TradeType = 'binary' | 'futures';
type Direction = 'call' | 'put' | 'long' | 'short';
type Result = 'win' | 'loss';

interface QuickTradeEntryProps {
  onTradeAdded?: () => void;
}

export function QuickTradeEntry({ onTradeAdded }: QuickTradeEntryProps) {
  const { primaryInstruments } = useWatchlist();
  const { todaySession } = useTradingSessions();
  const { quickAddBinaryTrade, quickAddFuturesTrade } = useTradesSupabase();

  const [tradeType, setTradeType] = useState<TradeType>('binary');
  const [symbol, setSymbol] = useState(primaryInstruments[0]?.symbol ?? 'BTC');
  const [direction, setDirection] = useState<Direction>('call');
  const [result, setResult] = useState<Result | null>(null);

  // Binary options fields
  const [stakeAmount, setStakeAmount] = useState('10');
  const [payoutPercent, setPayoutPercent] = useState('85');

  // Futures fields
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [quantity, setQuantity] = useState('1');

  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!result) return;

    setIsSubmitting(true);
    try {
      if (tradeType === 'binary') {
        await quickAddBinaryTrade.mutateAsync({
          symbol,
          direction: direction as 'call' | 'put',
          result,
          stake_amount: parseFloat(stakeAmount),
          payout_percent: parseFloat(payoutPercent),
          session_id: todaySession?.id,
          notes: notes || undefined,
        });
      } else {
        await quickAddFuturesTrade.mutateAsync({
          symbol,
          direction: direction as 'long' | 'short',
          entry_price: parseFloat(entryPrice),
          exit_price: parseFloat(exitPrice),
          quantity: parseFloat(quantity),
          session_id: todaySession?.id,
          notes: notes || undefined,
        });
      }

      // Reset form
      setResult(null);
      setNotes('');
      setEntryPrice('');
      setExitPrice('');
      onTradeAdded?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDirectionOptions = () => {
    if (tradeType === 'binary') {
      return [
        { value: 'call', label: 'CALL', icon: ArrowUpIcon, color: 'text-green-400' },
        { value: 'put', label: 'PUT', icon: ArrowDownIcon, color: 'text-red-400' },
      ];
    }
    return [
      { value: 'long', label: 'LONG', icon: ArrowUpIcon, color: 'text-green-400' },
      { value: 'short', label: 'SHORT', icon: ArrowDownIcon, color: 'text-red-400' },
    ];
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-4">Quick Trade Entry</h2>

      {/* Trade Type Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => {
            setTradeType('binary');
            setDirection('call');
          }}
          className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
            tradeType === 'binary' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          Binary Options
        </button>
        <button
          onClick={() => {
            setTradeType('futures');
            setDirection('long');
          }}
          className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
            tradeType === 'futures' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          Futures
        </button>
      </div>

      {/* Symbol Selection */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">Symbol</label>
        <div className="flex flex-wrap gap-2">
          {primaryInstruments.map((item) => (
            <button
              key={item.id}
              onClick={() => setSymbol(item.symbol)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                symbol === item.symbol
                  ? 'bg-blue-600'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {item.symbol}
            </button>
          ))}
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="px-3 py-1.5 bg-gray-700 rounded-lg text-sm w-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Other"
          />
        </div>
      </div>

      {/* Direction */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">Direction</label>
        <div className="flex gap-2">
          {getDirectionOptions().map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDirection(opt.value as Direction)}
              className={`flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                direction === opt.value
                  ? opt.value.includes('call') || opt.value === 'long'
                    ? 'bg-green-600'
                    : 'bg-red-600'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <opt.icon className="h-5 w-5" />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trade-specific fields */}
      {tradeType === 'binary' ? (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Stake ($)</label>
            <input
              type="number"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Payout (%)</label>
            <input
              type="number"
              value={payoutPercent}
              onChange={(e) => setPayoutPercent(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Entry</label>
            <input
              type="number"
              step="0.01"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="5100.00"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Exit</label>
            <input
              type="number"
              step="0.01"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="5105.00"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Qty</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Result */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">Result</label>
        <div className="flex gap-2">
          <button
            onClick={() => setResult('win')}
            className={`flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
              result === 'win' ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <CheckIcon className="h-5 w-5" />
            WIN
          </button>
          <button
            onClick={() => setResult('loss')}
            className={`flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
              result === 'loss' ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <XMarkIcon className="h-5 w-5" />
            LOSS
          </button>
        </div>
      </div>

      {/* Notes (optional) */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Quick note about this trade..."
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!result || isSubmitting || (tradeType === 'futures' && (!entryPrice || !exitPrice))}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
      >
        {isSubmitting ? 'Saving...' : 'Log Trade'}
      </button>

      {/* P&L Preview */}
      {result && (
        <div className="mt-4 p-3 bg-gray-700/50 rounded-lg text-center">
          <span className="text-sm text-gray-400">Estimated P&L: </span>
          <span
            className={`font-mono font-bold ${
              result === 'win' ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {tradeType === 'binary'
              ? result === 'win'
                ? `+$${(parseFloat(stakeAmount) * parseFloat(payoutPercent) / 100).toFixed(2)}`
                : `-$${parseFloat(stakeAmount).toFixed(2)}`
              : entryPrice && exitPrice
              ? (() => {
                  const multiplier = symbol === 'ES' ? 50 : symbol === 'NQ' ? 20 : 1;
                  const qty = parseFloat(quantity) || 1;
                  const dir = direction === 'long' ? 1 : -1;
                  const pnl = (parseFloat(exitPrice) - parseFloat(entryPrice)) * dir * multiplier * qty;
                  return pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
                })()
              : '--'}
          </span>
        </div>
      )}
    </div>
  );
}
