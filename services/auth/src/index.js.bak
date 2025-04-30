// services/auth/src/index.js
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Auth Service is running');
});

app.listen(PORT, () => {
  console.log(`Auth service listening on port ${PORT}`);
});
