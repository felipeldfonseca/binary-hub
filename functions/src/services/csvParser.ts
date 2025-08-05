import { logger } from 'firebase-functions';
import { Trade } from './tradeService';

export interface ParsedTrade {
  tradeId: string;
  entryTime: Date;
  asset: string;
  timeframe: string;
  direction: 'call' | 'put';
  candleTime: string;
  entryPrice: number;
  exitPrice: number;
  amount: number;
  refunded: number;
  executed: number;
  status: 'WIN' | 'LOSE';
  profit: number;
  result: 'win' | 'loss' | 'tie';
  platform: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CsvValidationResult {
  isValid: boolean;
  expectedHeaders: string[];
  missingHeaders: string[];
  extraHeaders: string[];
  suggestions: string[];
}

export class CSVParserService {
  private readonly expectedHeaders = [
    'ID',
    'Data',
    'Ativo',
    'Tempo',
    'Previsão',
    'Vela',
    'P. ABRT',
    'P. FECH',
    'Valor',
    'Estornado',
    'Executado',
    'Status',
    'Resultado'
  ];

  /**
   * Parse Ebinex CSV format
   */
  parseEbinexCsv(csvContent: string): ParsedTrade[] {
    try {
      const lines = csvContent.trim().split('\n');
      
      if (lines.length < 2) {
        throw new Error('CSV file is empty or has no data rows');
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const validation = this.validateHeaders(headers);
      
      if (!validation.isValid) {
        throw new Error(`Invalid CSV format: ${validation.missingHeaders.join(', ')}`);
      }

      const trades: ParsedTrade[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines
        
        try {
          const trade = this.parseRow(line, headers);
          if (trade) {
            trades.push(trade);
          }
        } catch (error) {
          logger.warn(`Error parsing row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          // Continue processing other rows
        }
      }

      logger.info(`Successfully parsed ${trades.length} trades from CSV`);
      return trades;
    } catch (error) {
      logger.error('Error parsing CSV:', error);
      throw new Error(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate CSV headers
   */
  validateHeaders(headers: string[]): CsvValidationResult {
    const missingHeaders: string[] = [];
    const extraHeaders: string[] = [];
    const suggestions: string[] = [];

    // Check for missing headers
    for (const expected of this.expectedHeaders) {
      if (!headers.includes(expected)) {
        missingHeaders.push(expected);
      }
    }

    // Check for extra headers
    for (const header of headers) {
      if (!this.expectedHeaders.includes(header)) {
        extraHeaders.push(header);
      }
    }

    // Generate suggestions for common header variations
    const headerVariations: { [key: string]: string[] } = {
      'ID': ['id', 'Id', 'trade_id', 'tradeId'],
      'Data': ['data', 'Data', 'date', 'Date', 'timestamp'],
      'Ativo': ['ativo', 'Ativo', 'asset', 'Asset', 'symbol'],
      'Tempo': ['tempo', 'Tempo', 'time', 'Time', 'timeframe'],
      'Previsão': ['previsão', 'Previsão', 'previsao', 'Previsao', 'direction', 'Direction'],
      'Vela': ['vela', 'Vela', 'candle', 'Candle', 'candleTime'],
      'P. ABRT': ['p. abrt', 'P. ABRT', 'entry_price', 'Entry Price', 'open_price'],
      'P. FECH': ['p. fech', 'P. FECH', 'exit_price', 'Exit Price', 'close_price'],
      'Valor': ['valor', 'Valor', 'amount', 'Amount', 'stake'],
      'Estornado': ['estornado', 'Estornado', 'refunded', 'Refunded'],
      'Executado': ['executado', 'Executado', 'executed', 'Executed'],
      'Status': ['status', 'Status', 'result_status'],
      'Resultado': ['resultado', 'Resultado', 'profit', 'Profit', 'pnl']
    };

    for (const missing of missingHeaders) {
      const variations = headerVariations[missing] || [];
      suggestions.push(`Expected "${missing}", found variations: ${variations.join(', ')}`);
    }

    return {
      isValid: missingHeaders.length === 0,
      expectedHeaders: this.expectedHeaders,
      missingHeaders,
      extraHeaders,
      suggestions
    };
  }

  /**
   * Parse a single CSV row
   */
  parseRow(row: string, headers: string[]): ParsedTrade | null {
    try {
      const values = row.split(',').map(v => v.trim());
      
      if (values.length !== headers.length) {
        throw new Error(`Row has ${values.length} columns, expected ${headers.length}`);
      }

      // Create a map of header to value
      const rowData: { [key: string]: string } = {};
      headers.forEach((header, index) => {
        rowData[header] = values[index];
      });

      // Parse and validate required fields
      const tradeId = this.parseString(rowData['ID'], 'ID');
      const entryTime = this.parseDate(rowData['Data'], 'Data');
      const asset = this.parseString(rowData['Ativo'], 'Ativo');
      const timeframe = this.parseString(rowData['Tempo'], 'Tempo');
      const direction = this.parseDirection(rowData['Previsão'], 'Previsão');
      const candleTime = this.parseString(rowData['Vela'], 'Vela');
      const entryPrice = this.parsePrice(rowData['P. ABRT'], 'P. ABRT');
      const exitPrice = this.parsePrice(rowData['P. FECH'], 'P. FECH');
      const amount = this.parseAmount(rowData['Valor'], 'Valor');
      const refunded = this.parseAmount(rowData['Estornado'], 'Estornado');
      const executed = this.parseAmount(rowData['Executado'], 'Executado');
      const status = this.parseStatus(rowData['Status'], 'Status');
      const profit = this.parseAmount(rowData['Resultado'], 'Resultado');

      return {
        tradeId,
        entryTime,
        asset,
        timeframe,
        direction,
        candleTime,
        entryPrice,
        exitPrice,
        amount,
        refunded,
        executed,
        status,
        profit,
        result: status === 'WIN' ? 'win' : 'loss',
        platform: 'Ebinex'
      };
    } catch (error) {
      logger.warn(`Error parsing row: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Parse string value
   */
  private parseString(value: string, fieldName: string): string {
    if (!value || value.trim() === '') {
      throw new Error(`${fieldName} is required`);
    }
    return value.trim();
  }

  /**
   * Parse date value
   */
  private parseDate(value: string, fieldName: string): Date {
    const dateStr = this.parseString(value, fieldName);
    const date = new Date(dateStr);
    
    if (isNaN(date.getTime())) {
      throw new Error(`${fieldName} must be a valid date: ${dateStr}`);
    }
    
    return date;
  }

  /**
   * Parse direction value
   */
  private parseDirection(value: string, fieldName: string): 'call' | 'put' {
    const direction = this.parseString(value, fieldName).toUpperCase();
    
    if (direction === 'BULL') {
      return 'call';
    } else if (direction === 'BEAR') {
      return 'put';
    } else {
      throw new Error(`${fieldName} must be 'BULL' or 'BEAR', got: ${direction}`);
    }
  }

  /**
   * Parse price value
   */
  private parsePrice(value: string, fieldName: string): number {
    const priceStr = this.parseString(value, fieldName);
    const cleanPrice = priceStr.replace(/[$,]/g, '');
    const price = parseFloat(cleanPrice);
    
    if (isNaN(price) || price <= 0) {
      throw new Error(`${fieldName} must be a positive number: ${priceStr}`);
    }
    
    return price;
  }

  /**
   * Parse amount value
   */
  private parseAmount(value: string, fieldName: string): number {
    const amountStr = this.parseString(value, fieldName);
    const cleanAmount = amountStr.replace(/[$,]/g, '');
    const amount = parseFloat(cleanAmount);
    
    if (isNaN(amount) || amount < 0) {
      throw new Error(`${fieldName} must be a non-negative number: ${amountStr}`);
    }
    
    return amount;
  }

  /**
   * Parse status value
   */
  private parseStatus(value: string, fieldName: string): 'WIN' | 'LOSE' {
    const status = this.parseString(value, fieldName).toUpperCase();
    
    if (status === 'WIN' || status === 'LOSE') {
      return status;
    } else {
      throw new Error(`${fieldName} must be 'WIN' or 'LOSE', got: ${status}`);
    }
  }

  /**
   * Convert parsed trade to Trade model
   */
  convertToTradeModel(parsedTrade: ParsedTrade, userId: string): Partial<Trade> {
    return {
      userId,
      tradeId: parsedTrade.tradeId,
      asset: parsedTrade.asset,
      direction: parsedTrade.direction,
      amount: parsedTrade.amount,
      entryPrice: parsedTrade.entryPrice,
      exitPrice: parsedTrade.exitPrice,
      entryTime: parsedTrade.entryTime,
      exitTime: parsedTrade.entryTime, // Ebinex doesn't provide exit time, use entry time
      timeframe: parsedTrade.timeframe,
      candleTime: parsedTrade.candleTime,
      refunded: parsedTrade.refunded,
      executed: parsedTrade.executed,
      status: parsedTrade.status,
      result: parsedTrade.result,
      profit: parsedTrade.profit,
      payout: parsedTrade.profit / parsedTrade.amount * 100, // Calculate payout percentage
      platform: parsedTrade.platform,
      importedAt: new Date()
    };
  }
}

export const csvParserService = new CSVParserService(); 