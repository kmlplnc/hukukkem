const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/chat', require('./routes/chat'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/database', require('./routes/database'));

// Serve static files from React app
app.use(express.static(path.join(__dirname, 'client/build')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'HukukKem AI Chat Server is running' });
});

// Catch all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Bir hata oluştu',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Sunucu hatası'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 HukukKem AI Chat Server ${PORT} portunda çalışıyor`);
  console.log(`📱 Frontend: http://localhost:${process.env.CORS_ORIGIN?.split(':')[2] || 3000}`);
  console.log(`🔧 API: http://localhost:${PORT}/api`);
}); 