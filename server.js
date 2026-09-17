import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 10000;

app.get('/config.js', (_req, res) => {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || '';
  res.type('application/javascript').send(`window.__SUPABASE_CONFIG__=${JSON.stringify({url,key})};`);
});

// The root URL is the public entry point. Always send it to the dedicated login page.
app.get('/', (_req, res) => res.redirect(302, '/login.html'));

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use((_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(port, '0.0.0.0', () => console.log(`Routine Planner listening on ${port}`));
