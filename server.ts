import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Telegraf } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';
import admin from 'firebase-admin';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const firebaseConfigPath = path.join(__dirname, 'firebase-applet-config.json');
let firebaseConfig: any = {};
if (fs.existsSync(firebaseConfigPath)) {
  firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
}

if (firebaseConfig.projectId) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const PORT = 3000;
const BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '8787060107:AAE2EjjPAD19vvbbRR_CKQeq6_wNQTMGROY').trim();
const APP_URL = process.env.APP_URL || 'https://ais-dev-25bqz7e2437tes27l2jqrz-275957310232.europe-west2.run.app';

// In-memory store for auth codes (for non-mini-app login)
const authCodes = new Map<string, { telegramId: string; used: boolean }>();

let botUsername = '';

async function startServer() {
  const app = express();
  
  if (!BOT_TOKEN) {
    console.error('CRITICAL: TELEGRAM_BOT_TOKEN is missing!');
    return;
  }

  const bot = new Telegraf(BOT_TOKEN);

  // Bot Logic
  bot.start((ctx) => {
    const startPayload = ctx.payload;
    if (startPayload && startPayload.startsWith('auth_')) {
      const code = startPayload.replace('auth_', '');
      if (authCodes.has(code)) {
        authCodes.set(code, { telegramId: ctx.from.id.toString(), used: false });
        ctx.reply('✅ Аккаунт подтвержден! Вернитесь в приложение для входа.');
        return;
      }
    }

    ctx.reply(`Добро пожаловать в HelperHub! 🏠\n\nЯ помогу вам найти помощника по дому или найти работу клинером.\n\n🔗 Открыть приложение: ${APP_URL}`, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🚀 Запустить HelperHub',
              web_app: { url: APP_URL }
            }
          ],
          [
            {
              text: '🌐 Открыть в браузере',
              url: APP_URL
            }
          ]
        ]
      }
    });
  });

  bot.help((ctx) => ctx.reply(`Используйте кнопку ниже или перейдите по ссылке, чтобы открыть приложение:\n\n🔗 ${APP_URL}`, {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🚀 Запустить HelperHub',
            web_app: { url: APP_URL }
          }
        ]
      ]
    }
  }));
  
  bot.on('message', (ctx) => ctx.reply(`Чтобы воспользоваться сервисом HelperHub, откройте приложение по кнопке ниже или по ссылке:\n\n🔗 ${APP_URL}`, {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🚀 Запустить HelperHub',
            web_app: { url: APP_URL }
          }
        ]
      ]
    }
  }));

  // Launch bot with cleanup
  const launchBot = async () => {
    try {
      console.log('Cleaning up existing Telegram hooks...');
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      
      console.log('Launching Telegram Bot...');
      await bot.launch();
      const botInfo = await bot.telegram.getMe();
      botUsername = botInfo.username;
      console.log(`Telegram Bot @${botUsername} is running successfully.`);

      // Set Menu Button
      await bot.telegram.setChatMenuButton({
        menuButton: {
          type: 'web_app',
          text: 'HelperHub',
          web_app: { url: APP_URL }
        }
      });
    } catch (err: any) {
      if (err.response?.error_code === 404) {
        console.error('CRITICAL: Telegram Bot Token is invalid (404 Not Found). Please check your token.');
      } else if (err.response?.error_code === 409) {
        console.warn('Telegram Bot Conflict (409): Another instance is running. Retrying in 5s...');
        setTimeout(launchBot, 5000);
      } else {
        console.error('Bot launch error:', err);
      }
    }
  };

  launchBot();

  // API Routes
  app.use(express.json());
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Telegram Auth Verification (Mini App)
  app.post('/api/auth/telegram', async (req, res) => {
    const { initData } = req.body;
    if (!initData) return res.status(400).json({ error: 'Missing initData' });

    try {
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');
      urlParams.delete('hash');

      const dataCheckString = Array.from(urlParams.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
      const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

      if (hmac !== hash) {
        return res.status(401).json({ error: 'Invalid hash' });
      }

      const userStr = urlParams.get('user');
      if (!userStr) return res.status(400).json({ error: 'Missing user data' });
      
      const user = JSON.parse(userStr);
      const telegramId = user.id.toString();

      // Create Firebase Custom Token
      const customToken = await admin.auth().createCustomToken(`telegram:${telegramId}`, {
        telegramId,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
      });

      res.json({ customToken, user });
    } catch (err: any) {
      console.error('Telegram auth error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Generate Auth Code (for non-mini-app login)
  app.post('/api/auth/generate-code', (req, res) => {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    authCodes.set(code, { telegramId: '', used: false });
    res.json({ code, botUsername });
  });

  // Check Auth Code
  app.post('/api/auth/check-code', async (req, res) => {
    const { code } = req.body;
    const authData = authCodes.get(code);
    if (authData && authData.telegramId) {
      const customToken = await admin.auth().createCustomToken(`telegram:${authData.telegramId}`, {
        telegramId: authData.telegramId,
      });
      authCodes.delete(code);
      res.json({ customToken });
    } else {
      res.status(404).json({ error: 'Code not found or not yet confirmed' });
    }
  });

  app.post('/api/notify', async (req, res) => {
    const { telegramId, message } = req.body;
    if (!telegramId || !message) return res.status(400).json({ error: 'Missing telegramId or message' });
    try {
      await bot.telegram.sendMessage(telegramId, message);
      res.json({ success: true });
    } catch (err: any) {
      console.error('Notification error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

startServer();
