require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');

const app = express();

const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Webhook route registered BEFORE express.json() since it needs the raw body
app.use('/api', require('./routes/webhook'));

app.use(express.json());
app.use('/api', require('./routes/upload'));
app.use('/api', require('./routes/search'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Cloudinary AI media pipeline running on :${PORT}`));
});
