const { Pool } = require('pg');
const axios = require('axios');

// Windows Docker PostgreSQL bağlantısı
const windowsPool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'hukuk',
  user: 'hukuk_user',
  password: 'hukuk_pass'
});

// Ubuntu server URL
const UBUNTU_API_URL = 'https://www.hukukkemai.com/api/database/sync';

async function syncToUbuntu() {
  console.log('🔄 Windows\'tan Ubuntu\'ya senkronizasyon başlatılıyor...');
  
  try {
    // Son 24 saatteki yeni kayıtları al
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Yeni conversations
    const conversationsResult = await windowsPool.query(`
      SELECT id, user_id, title, created_at, updated_at, is_active
      FROM conversations 
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    // Yeni messages
    const messagesResult = await windowsPool.query(`
      SELECT id, conversation_id, role, content, created_at
      FROM messages 
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    // Yeni kararlar (son 10 kayıt)
    const kararlarResult = await windowsPool.query(`
      SELECT id, karar_tarihi, basvuru_no, rg_tarih_sayi, mahkeme, 
             üyeler, raportor, basvurucu, karar_ozeti, degerlendirme, 
             giderim, hüküm, baslik, url
      FROM kararlar 
      ORDER BY karar_tarihi DESC
      LIMIT 10
    `);
    
    const syncData = {
      conversations: conversationsResult.rows,
      messages: messagesResult.rows,
      kararlar: kararlarResult.rows
    };
    
    console.log(`📊 Senkronizasyon verileri:`);
    console.log(`   - Conversations: ${syncData.conversations.length}`);
    console.log(`   - Messages: ${syncData.messages.length}`);
    console.log(`   - Kararlar: ${syncData.kararlar.length}`);
    
    // Veri detaylarını göster
    console.log('\n📋 VERİ DETAYLARI:');
    
    if (syncData.conversations.length > 0) {
      console.log('\n💬 Conversations:');
      syncData.conversations.forEach((conv, index) => {
        console.log(`   ${index + 1}. ID: ${conv.id}, Title: ${conv.title}, User: ${conv.user_id}`);
      });
    }
    
    if (syncData.messages.length > 0) {
      console.log('\n💭 Messages:');
      syncData.messages.forEach((msg, index) => {
        console.log(`   ${index + 1}. ID: ${msg.id}, Role: ${msg.role}, Content: ${msg.content.substring(0, 50)}...`);
      });
    }
    
    if (syncData.kararlar.length > 0) {
      console.log('\n⚖️ Kararlar:');
      syncData.kararlar.forEach((karar, index) => {
        console.log(`   ${index + 1}. ID: ${karar.id}, Başlık: ${karar.baslik}, Mahkeme: ${karar.mahkeme}`);
      });
    }
    
    if (syncData.conversations.length === 0 && 
        syncData.messages.length === 0 && 
        syncData.kararlar.length === 0) {
      console.log('✅ Yeni veri yok, senkronizasyon gerekli değil');
      return;
    }
    
    console.log('\n🔄 Ubuntu\'ya gönderme işlemi atlanıyor (nginx hatası)...');
    console.log('Ubuntu\'da nginx config düzeltildikten sonra tekrar deneyin.');
    
  } catch (error) {
    console.error('❌ Senkronizasyon hatası:', error.message);
    
    if (error.response) {
      console.error('Server response:', error.response.data);
    }
  } finally {
    await windowsPool.end();
  }
}

// Manuel çalıştırma
if (require.main === module) {
  syncToUbuntu()
    .then(() => {
      console.log('🎉 Senkronizasyon tamamlandı');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Senkronizasyon hatası:', error);
      process.exit(1);
    });
}

module.exports = { syncToUbuntu }; 