import { Request, Response } from 'express';

// Extend Express Request to include user data
export interface AuthenticatedRequest extends Request {
  user: {
    uid: string;
    email: string;
    email_verified: boolean;
    iss: string;
    aud: string;
    auth_time: number;
    user_id: string;
    sub: string;
    iat: number;
    exp: number;
  };
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Trade types
export interface TradeData {
  tradeId: string;
  timestamp: string;
  asset: string;
  timeframe: string;
  candleTime: string;
  direction: 'BUY' | 'SELL';
  stake: number;
  executedValue: number;
  openPrice?: number;
  closePrice?: number;
  result: 'WIN' | 'LOSS';
  pnl?: number;
  refund?: number;
  status?: 'OK' | 'ERROR';
  emotion?: string;
  tag?: string;
  source: 'manual' | 'csv';
  uploadId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TradeInput {
  asset: string;
  timeframe: string;
  candleTime: string;
  direction: 'BUY' | 'SELL';
  stake: number;
  executedValue: number;
  openPrice?: number;
  closePrice?: number;
  result: 'WIN' | 'LOSS';
  emotion?: string;
  tag?: string;
  timestamp?: string;
}

// KPI types
export interface KPIData {
  winRate: number;
  streakMax: number;
  streakCurrent: number;
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
  totalStake: number;
  totalPnl: number;
  avgPnl: number;
  calculatedAt: string;
}

// Rule types
export interface RuleData {
  ruleId: string;
  text: string;
  active: boolean;
  brokenCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RuleInput {
  text: string;
  active?: boolean;
}

// Insight types
export interface InsightData {
  insightId: string;
  createdAt: string;
  text: string;
  kpiReference?: string[];
  modelVersion?: string;
  userId?: string;
}

// Upload types
export interface UploadData {
  uploadId: string;
  fileName: string;
  mimeType: string;
  size: number;
  fileUrl: string;
  createdAt: string;
  processed: boolean;
  error?: string;
  totalRows?: number;
  importedRows?: number;
  skippedRows?: number;
  errorLines?: string[];
}

// CSV import types
export interface CSVImportResult {
  uploadId: string;
  totalRows: number;
  imported: number;
  skipped: number;
  errors: string[];
  duplicates: number;
  status: 'processing' | 'completed' | 'failed';
}

// Error types
export interface APIError {
  code: string;
  message: string;
  details?: any;
}

// Middleware types
export type AuthMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: () => void
) => void | Promise<void>;

export type RouteHandler = (
  req: AuthenticatedRequest,
  res: Response
) => void | Promise<void>;

// Firebase types
export interface FirebaseUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  emailVerified: boolean;
  disabled: boolean;
  metadata: {
    creationTime: string;
    lastSignInTime: string;
  };
  customClaims?: Record<string, any>;
}

// Query types
export interface QueryParams {
  start?: string;
  end?: string;
  limit?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

// Validation types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Scheduled task context
export interface ScheduledTaskContext {
  timestamp: string;
  resource: string;
  eventId: string;
  eventType: string;
} 