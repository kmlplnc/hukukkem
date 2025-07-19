const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'hukuk',
  user: process.env.DB_USER || 'postgres',
  password: String(process.env.DB_PASSWORD) || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Veritabanı bağlantısını test et ve tabloları oluştur
async function initializeDatabase() {
  try {
    console.log('✅ PostgreSQL veritabanına bağlandı');
    
    // Conversations tablosunu oluştur
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        title VARCHAR(200),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Messages tablosunu oluştur
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id VARCHAR(100) REFERENCES conversations(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        message_order INTEGER NOT NULL
      )
    `);

    // İndeksler oluştur
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)
    `);

    // Trigger fonksiyonu oluştur
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_conversation_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE conversations 
        SET updated_at = NOW()
        WHERE id = NEW.conversation_id;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Trigger oluştur
    await pool.query(`
      DROP TRIGGER IF EXISTS update_conversation_updated_at_trigger ON messages;
      CREATE TRIGGER update_conversation_updated_at_trigger
      AFTER INSERT ON messages
      FOR EACH ROW
      EXECUTE FUNCTION update_conversation_updated_at();
    `);

    console.log('✅ Conversations ve messages tabloları oluşturuldu');

  } catch (error) {
    console.error('❌ Veritabanı başlatma hatası:', error);
  }
}

// Başlangıçta tabloları oluştur
initializeDatabase();

module.exports = pool; 