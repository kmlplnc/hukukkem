const { Pool } = require('pg');
require('dotenv').config();

console.log('🔍 Environment Variables Debug:');
console.log('  DB_HOST:', process.env.DB_HOST);
console.log('  DB_PORT:', process.env.DB_PORT);
console.log('  DB_NAME:', process.env.DB_NAME);
console.log('  DB_USER:', process.env.DB_USER);
console.log('  DB_PASSWORD:', process.env.DB_PASSWORD ? '***SET***' : 'NOT SET');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5433,
  database: process.env.DB_NAME || 'hukuk',
  user: process.env.DB_USER || 'hukuk_user',
  password: process.env.DB_PASSWORD || 'hukuk_pass',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

console.log('🔧 Pool Configuration:');
console.log('  Host:', pool.options.host);
console.log('  Port:', pool.options.port);
console.log('  Database:', pool.options.database);
console.log('  User:', pool.options.user);

// Veritabanı bağlantısını test et
async function initializeDatabase() {
  try {
    console.log('✅ PostgreSQL veritabanına bağlandı');
    
    // Hangi veritabanına bağlandığını kontrol et
    const dbResult = await pool.query('SELECT current_database(), current_user');
    console.log('🔍 Connected to database:', dbResult.rows[0]);
    
    // Mevcut tabloları kontrol et
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('✅ Mevcut tablolar: conversations, kararlar, messages, karar_chunk, anayasa_chunk, anayasa_maddeleri, ceza_kanunu_chunk, ceza_kanunu_madde');

  } catch (error) {
    console.error('❌ Veritabanı başlatma hatası:', error);
  }
}

// Başlangıçta tabloları kontrol et
initializeDatabase();

module.exports = pool; 