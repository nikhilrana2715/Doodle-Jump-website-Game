// Nova Hop — optional server: serves the game + a MongoDB-backed leaderboard.
// The game works without it (open index.html or host the folder statically);
// the leaderboard panel only appears when /api/leaderboard responds.
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/novahop';

app.use(cors());
app.use(express.json({ limit: '4kb' }));

let dbReady = false;
mongoose.connect(MONGO_URL)
  .then(() => { dbReady = true; console.log('MongoDB connected'); })
  .catch((err) => console.warn('MongoDB unavailable — leaderboard disabled:', err.message));

const Player = mongoose.model('Player', new mongoose.Schema({
  name: { type: String, maxlength: 16, required: true },
  score: { type: Number, min: 0, required: true },
  character: { type: String, maxlength: 16, default: 'nova' },
  createdAt: { type: Date, default: Date.now },
}));

const requireDb = (req, res, next) => (dbReady ? next() : res.status(503).json({ error: 'leaderboard offline' }));

async function submitScore(req, res) {
  const name = String(req.body?.name || '').trim().slice(0, 16);
  const score = Math.floor(Number(req.body?.score));
  const character = String(req.body?.character || 'nova').slice(0, 16);
  if (!name || !Number.isFinite(score) || score < 0 || score > 10_000_000) {
    return res.status(400).json({ error: 'invalid score' });
  }
  try {
    await Player.create({ name, score, character });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Error saving score' });
  }
}

async function leaderboard(req, res) {
  try {
    const top = await Player.find({}, { _id: 0, name: 1, score: 1, character: 1 }).sort({ score: -1 }).limit(10).lean();
    res.json(top);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching leaderboard' });
  }
}

app.post('/api/submit-score', requireDb, submitScore);
app.get('/api/leaderboard', requireDb, leaderboard);
// legacy routes kept for old clients
app.post('/submit-score', requireDb, submitScore);
app.get('/leaderboard', requireDb, leaderboard);

// Don't expose server/project files; serve only the game.
const blocked = /^\/(sarver\.js|package.*|legacy|node_modules|CLAUDE\.md)/i;
app.use((req, res, next) => (blocked.test(req.path) ? res.status(404).end() : next()));
app.use(express.static(__dirname, { dotfiles: 'ignore', index: 'index.html' }));

app.listen(PORT, () => console.log(`Nova Hop running at http://localhost:${PORT}`));
