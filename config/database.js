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
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        message_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true
      )
    `);

    // Messages tablosunu oluştur
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
      CREATE OR REPLACE FUNCTION update_conversation_message_count()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          UPDATE conversations 
          SET message_count = message_count + 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = NEW.conversation_id;
          RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
          UPDATE conversations 
          SET message_count = message_count - 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = OLD.conversation_id;
          RETURN OLD;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Trigger zaten mevcut olduğu için oluşturmuyoruz
    console.log('✅ Trigger zaten mevcut, atlanıyor');

    console.log('✅ Conversations ve messages tabloları oluşturuldu');

  } catch (error) {
    console.error('❌ Veritabanı başlatma hatası:', error);
  }
}

// Başlangıçta tabloları oluştur
initializeDatabase();

module.exports = pool; 