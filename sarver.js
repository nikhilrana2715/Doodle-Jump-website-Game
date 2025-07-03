const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/doodlejump', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Mongoose schema
const playerSchema = new mongoose.Schema({
    name: String,
    score: Number,
    character: String // optional: custom skin
});

const Player = mongoose.model('Player', playerSchema);

// API to post score
app.post('/submit-score', async (req, res) => {
    const { name, score, character } = req.body;

    try {
        const newPlayer = new Player({ name, score, character });
        await newPlayer.save();
        res.status(200).send("Score submitted!");
    } catch (error) {
        res.status(500).send("Error saving score");
    }
});

// API to get leaderboard
app.get('/leaderboard', async (req, res) => {
    try {
        const topScores = await Player.find().sort({ score: -1 }).limit(10);
        res.json(topScores);
    } catch (error) {
        res.status(500).send("Error fetching leaderboard");
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
