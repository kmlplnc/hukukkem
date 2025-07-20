const { Pool } = require('pg');
const axios = require('axios');

// Windows PostgreSQL bağlantısı
const windowsPool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'hukuk',
  user: 'postgres',
  password: 'your-windows-password'
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
      WHERE created_at >= $1
      ORDER BY created_at DESC
    `, [yesterday]);
    
    // Yeni messages
    const messagesResult = await windowsPool.query(`
      SELECT id, conversation_id, role, content, created_at
      FROM messages 
      WHERE created_at >= $1
      ORDER BY created_at DESC
    `, [yesterday]);
    
    // Yeni kararlar (son 7 gün)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const kararlarResult = await windowsPool.query(`
      SELECT id, karar_tarihi, basvuru_no, rg_tarih_sayi, mahkeme, 
             üyeler, raportor, basvurucu, karar_ozeti, degerlendirme, 
             giderim, hüküm, baslik, url
      FROM kararlar 
      WHERE created_at >= $1
      ORDER BY karar_tarihi DESC
    `, [weekAgo]);
    
    const syncData = {
      conversations: conversationsResult.rows,
      messages: messagesResult.rows,
      kararlar: kararlarResult.rows
    };
    
    console.log(`📊 Senkronizasyon verileri:`);
    console.log(`   - Conversations: ${syncData.conversations.length}`);
    console.log(`   - Messages: ${syncData.messages.length}`);
    console.log(`   - Kararlar: ${syncData.kararlar.length}`);
    
    if (syncData.conversations.length === 0 && 
        syncData.messages.length === 0 && 
        syncData.kararlar.length === 0) {
      console.log('✅ Yeni veri yok, senkronizasyon gerekli değil');
      return;
    }
    
    // Ubuntu'ya gönder
    const response = await axios.post(UBUNTU_API_URL, {
      sourceData: syncData
    }, {
      timeout: 30000, // 30 saniye timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.success) {
      console.log('✅ Senkronizasyon başarılı!');
      console.log('📈 Sonuçlar:', response.data.results);
    } else {
      console.error('❌ Senkronizasyon başarısız:', response.data.error);
    }
    
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