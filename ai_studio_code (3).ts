import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { db } from './server/db.js';
import { seedInitialUsers } from './server/auth.js';
import { apiRouter } from './server/routes.js';
import { TelegramService, TelegramPollingManager } from './server/telegram.js';
import { CronService } from './server/cron.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isDev = process.env.NODE_ENV !== 'production';

// Initialize Database & Seeds
db.init();
seedInitialUsers();
CronService.start();

// Standard middlewares
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(cookieParser());

// Direct download route for complete project source archive
app.get('/api/download-project', (_req: Request, res: Response) => {
  const zipPath = path.join(process.cwd(), 'public', 'telesell-full-source.zip');
  if (fs.existsSync(zipPath)) {
    res.setHeader('Content-Disposition', 'attachment; filename="telesell-full-source.zip"');
    res.setHeader('Content-Type', 'application/zip');
    return res.sendFile(zipPath);
  }
  return res.status(404).json({ error: 'Zip file not generated yet' });
});

// Mount main API router
app.use('/api', apiRouter);

// Development with Vite vs Production Static Hosting
async function setupServer() {
  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(`🚀 TeleSell SaaS Engine running on port ${PORT}`);
    console.log(`🌐 Live URL: http://0.0.0.0:${PORT}`);
    console.log(`=========================================`);

    // Start 24/7 background Long-Polling workers for all connected Telegram bots
    TelegramPollingManager.startAll();
  });
}

setupServer().catch(err => {
  console.error('Fatal startup error:', err);
});