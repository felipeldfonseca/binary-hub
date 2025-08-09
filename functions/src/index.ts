import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { generateInsight } from './services/openai';
import tradesRouter from './routes/trades';
import importRouter from './routes/import';
import analyticsRouter from './routes/analytics';
import authRouter from './routes/auth';
import dashboardRouter from './routes/dashboard';
import rulesRouter from './routes/rules';
import insightsRouter from './routes/insights';
import legacyTradesRouter from './routes/legacy-trades';

// Extend Express Request to include user property
interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    [key: string]: any;
  };
}

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();
const auth = getAuth();
const storage = getStorage();

// Create Express app
const app = express();

// Configure middleware
app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting - Disabled in development
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
//   message: 'Too many requests from this IP, please try again later.',
// });
// app.use(limiter);

// Health check endpoints
app.get('/_ah/warmup', (_, res) => {
  res.status(200).send('OK');
});

app.get('/_health', (_, res) => {
  res.status(200).send('OK');
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Authentication middleware
const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // For development, accept mock tokens
    if (token === 'mock-token-for-testing') {
      req.user = { uid: 'test-user-123', email: 'test@example.com' };
      return next();
    }

    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Mount route handlers
app.use('/auth', authenticate, authRouter);
app.use('/dashboard', authenticate, dashboardRouter);
app.use('/rules', authenticate, rulesRouter);
app.use('/insights', authenticate, insightsRouter);
app.use('/trades', authenticate, legacyTradesRouter);









// API v1 Routes
app.use('/v1/trades', authenticate, tradesRouter);
app.use('/v1/import', authenticate, importRouter);
app.use('/v1/analytics', authenticate, analyticsRouter);

// Export the API
// Configure HTTPS function with options
export const api = onRequest({
  secrets: ['OPENAI_API_KEY']
}, app);

// Background functions
export const processCSVUpload = onDocumentCreated({
  document: 'uploads/{userId}/files/{fileId}',
  memory: '1GiB',
  timeoutSeconds: 540,
  region: 'us-central1',
},
  async (event) => {
    const { userId, fileId } = event.params;
    const data = event.data?.data();
    
    if (!data || data.type !== 'csv') {
      logger.log('Not a CSV file, skipping processing');
      return;
    }

    try {
      logger.log(`Processing CSV upload for user ${userId}, file ${fileId}`);
      
      // Update status to processing
      await db.collection('uploads').doc(userId).collection('files').doc(fileId).update({
        status: 'processing',
        updatedAt: new Date().toISOString()
      });

      // Process CSV file using the import service
      try {
        // Get file data from storage
        const bucket = storage.bucket();
        const file = bucket.file(`uploads/${userId}/${fileId}`);
        
        // Check if file exists
        const [exists] = await file.exists();
        if (!exists) {
          throw new Error('File not found in storage');
        }

        // Download file content
        const [fileBuffer] = await file.download();
        
        // Get original filename from document data
        const originalFileName = data.fileName || 'unknown.csv';
        
        // Process CSV using import service
        const { importService } = await import('./services/importService');
        const result = await importService.processCsvUpload(userId, fileBuffer, originalFileName);
        
        // Update status with detailed results
        await db.collection('uploads').doc(userId).collection('files').doc(fileId).update({
          status: result.status,
          totalRows: result.totalRows,
          importedRows: result.importedRows,
          duplicateRows: result.duplicateRows,
          errors: result.errors,
          processingTime: result.processingTime,
          processedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          importId: result.importId
        });
        
        logger.log(`CSV processing completed for user ${userId}: ${result.importedRows} trades imported, ${result.duplicateRows} duplicates skipped`);
        
      } catch (processingError) {
        logger.error('CSV processing failed:', processingError);
        throw processingError; // Re-throw to trigger the catch block below
      }

      // Update status to completed
      await db.collection('uploads').doc(userId).collection('files').doc(fileId).update({
        status: 'completed',
        processedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      logger.log(`CSV processing completed for user ${userId}, file ${fileId}`);
    } catch (error) {
      logger.error('CSV processing error:', error);
      
      // Update status to failed
      await db.collection('uploads').doc(userId).collection('files').doc(fileId).update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date().toISOString()
      });
    }
  }
);

// Scheduled function to generate weekly insights
export const generateWeeklyInsights = onSchedule({
  schedule: '0 8 * * 1',
  memory: '1GiB',
  timeoutSeconds: 540,
  region: 'us-central1',
  retryCount: 3,
  secrets: ['OPENAI_API_KEY']
}, async () => {
  logger.log('Generating weekly insights for all users');
  
  try {
    // Get all users with recent trades
    const usersSnapshot = await db.collection('trades').listDocuments();
    
    for (const userDoc of usersSnapshot) {
      const userId = userDoc.id;
      
      // Get user profile for firstName
      const userProfileSnapshot = await db.collection('users').doc(userId).get();
      const userProfile = userProfileSnapshot.data();
      
      // Get last week's trades
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const tradesSnapshot = await db.collection('trades').doc(userId).collection('trades')
        .where('timestamp', '>=', weekAgo.toISOString())
        .get();
      
      if (tradesSnapshot.empty) {
        continue;
      }
      
      const trades = tradesSnapshot.docs.map(doc => doc.data());
      
      // Calculate KPIs
      const winTrades = trades.filter(t => t.result === 'WIN');
      const lossTrades = trades.filter(t => t.result === 'LOSS');
      const winRate = Math.round((winTrades.length / trades.length) * 100);
      const avgStake = trades.reduce((sum, t) => sum + (t.stake || 0), 0) / trades.length;
      
      // Calculate loss streak
      let currentStreak = 0;
      let maxLossStreak = 0;
      for (const trade of trades.reverse()) {
        if (trade.result === 'LOSS') {
          currentStreak++;
          maxLossStreak = Math.max(maxLossStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      }
      
      // Get user's broken rules (if any)
      const rulesSnapshot = await db.collection('rules').doc(userId).collection('rules')
        .where('active', '==', true)
        .get();
      
      let ruleBrokenMost = 'Nenhuma regra quebrada identificada';
      if (!rulesSnapshot.empty) {
        const rules = rulesSnapshot.docs.map(doc => doc.data());
        const brokenRule = rules.find(r => r.violations && r.violations > 0);
        if (brokenRule) {
          ruleBrokenMost = brokenRule.description || brokenRule.name || 'Regra não especificada';
        }
      }
      
      // Generate AI insight
      const aiInsight = await generateInsight({
        uid: userId,
        firstName: userProfile?.firstName || 'Trader',
        kpi: {
          winRate,
          avgStake,
          lossStreak: maxLossStreak
        },
        ruleBrokenMost
      });
      
      // Create insight document
      const insight = {
        type: 'weekly_summary',
        title: 'Análise Semanal Inteligente',
        content: aiInsight.insight,
        action: aiInsight.acao,
        timestamp: new Date().toISOString(),
        metadata: {
          totalTrades: trades.length,
          winRate: winRate / 100,
          avgStake,
          lossStreak: maxLossStreak,
          aiGenerated: true,
          kpi: aiInsight.kpi
        }
      };
      
      await db.collection('insights').doc(userId).collection('insights').add(insight);
      logger.log(`Generated AI insight for user ${userId}`);
    }
    
    logger.log('Weekly insights generation completed');
  } catch (error) {
    logger.error('Weekly insights generation error:', error);
  }
});

// Cleanup function for old data
export const cleanupOldData = onSchedule({
  schedule: '0 2 * * *',
  memory: '1GiB',
  timeoutSeconds: 540,
  region: 'us-central1',
  retryCount: 3
}, async () => {
  logger.log('Running daily cleanup');
  
  try {
    // Clean up old uploads (older than 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const uploadsSnapshot = await db.collectionGroup('files')
      .where('createdAt', '<', thirtyDaysAgo.toISOString())
      .get();
    
    const batch = db.batch();
    uploadsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    logger.log(`Cleaned up ${uploadsSnapshot.size} old upload records`);
  } catch (error) {
    logger.error('Cleanup error:', error);
  }
}); 