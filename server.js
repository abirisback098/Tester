import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 10000;
const appUrl = process.env.APP_URL || 'https://routine-planner-qyj2.onrender.com';

app.get('/config.js', (_req, res) => {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || '';
  res.set('Cache-Control', 'no-store');
  res.type('application/javascript').send(
    `window.__SUPABASE_CONFIG__=${JSON.stringify({ url, key, appUrl })};`
  );
});

// The root URL is the public entry point. Always send it to the dedicated login page.
app.get('/', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.redirect(302, '/login.html');
});

// Authentication pages must not be cached by the browser/proxy.
app.get(['/login.html', '/dashboard.html'], (_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.listen(port, '0.0.0.0', () => console.log(`Routine Planner listening on ${port}`));
