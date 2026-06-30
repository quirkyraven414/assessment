import express from 'express';
import path from 'path';
import cors from 'cors';

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

app.listen(PORT, () => {
  console.log(`📊 Dashboard server running at http://localhost:${PORT}`);
  console.log(`🌐 Open http://localhost:${PORT} in your browser`);
});
