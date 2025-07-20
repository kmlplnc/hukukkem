const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const embeddingService = require('../services/embeddingService');
const geminiService = require('../services/geminiService');
const pool = require('../config/database');
const { sanitizeAllPersonalData } = require('../utils/privacyUtils');

// Admin IP adresleri (güvenli)
const ADMIN_IPS = [
  '127.0.0.1',           // Localhost
  '::1',                 // IPv6 localhost
  '172.27.208.1',        // Kemal'in IP adresi
  'fe80::6a3f:628b:95bf:e21f%26'  // Kemal'in IPv6 adresi
];

// IP adresini al
function getClientIP(req) {
  // Proxy arkasındaysa gerçek IP'yi al
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0] : req.connection.remoteAddress;
  
  // IPv6 formatındaysa IPv4'e çevir
  if (ip && ip.includes('::ffff:')) {
    return ip.replace('::ffff:', '');
  }
  
  return ip || 'unknown';
}

// Admin kontrolü
function isAdmin(ip) {
  return ADMIN_IPS.includes(ip);
}

// Günlük kullanım sayısını kontrol et (silinen konuşmalar dahil)
async function checkDailyUsage(userId) {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD formatı
    
    // Silinen konuşmalar dahil tüm mesajları say
    // Kullanıcı konuşmayı silsede günlük hakkı gitmesin
    const result = await pool.query(
      `SELECT COUNT(*) as count 
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE c.user_id = $1 AND DATE(m.created_at) = $2`,
      [userId, today]
    );
    
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error('Günlük kullanım kontrolü hatası:', error);
    return 0;
  }
}

// Kullanıcı ID'sini oluştur (IP + User-Agent + UUID)
function generateUserId(req) {
  const ip = getClientIP(req);
  const userAgent = req.headers['user-agent'] || '';
  
  // Frontend'den gelen kullanıcı ID'sini kontrol et
  const clientUserId = req.headers['x-user-id'];
  
  if (clientUserId) {
    // Frontend'den gelen ID'yi kullan, ancak IP ile birleştir
    const shortUuid = clientUserId.split('_').pop() || 'unknown';
    return `user_${ip.replace(/[^a-zA-Z0-9]/g, '')}_${shortUuid}`;
  }
  
  // Fallback: UUID oluştur
  const uuid = uuidv4();
  
  // IP + User-Agent + UUID kombinasyonu ile hash oluştur
  let hash = 0;
  const str = ip + userAgent + uuid;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32 bit integer'a çevir
  }
  
  // UUID'nin ilk 8 karakterini kullanarak benzersiz ID oluştur
  const shortUuid = uuid.replace(/-/g, '').substring(0, 8);
  
  return `user_${Math.abs(hash)}_${shortUuid}`;
}

// AI yanıtını formatla
function formatAIResponse(response) {
  try {
    // JSON formatında geliyorsa parse et
    if (typeof response === 'string' && response.trim().startsWith('{')) {
      const parsed = JSON.parse(response);
      if (parsed.response) {
        response = parsed.response;
      }
    }
    
    // Çok fazla yıldızı kaldır (3 veya daha fazla yıldızı 2 yıldıza çevir)
    response = response.replace(/\*{3,}/g, '**');
    
    // Tek yıldızları kaldır (sadece çift yıldız kalsın)
    response = response.replace(/(?<!\*)\*(?!\*)/g, '');
    
    // Başlık formatını düzenle - sadece sayılı başlıkları
    response = response.replace(/\*\*(\d+\.\s*[A-ZĞÜŞİÖÇ\s]+:?)\*\*/g, '\n\n**$1**\n');
    
    // Alt başlıkları düzenle - sadece büyük harfli başlıkları
    response = response.replace(/\*\*([A-ZĞÜŞİÖÇ\s]{3,}:?)\*\*/g, '\n\n**$1**\n');
    
    // Fazla boşlukları temizle
    response = response.replace(/\n{3,}/g, '\n\n');
    
    // Başında ve sonunda fazla boşlukları temizle
    response = response.trim();
    
    return response;
  } catch (error) {
    console.log('⚠️ AI yanıtı formatlanamadı, orijinal yanıt döndürülüyor');
    return response;
  }
}

// Mesaj gönder
router.post('/send', async (req, res) => {
  console.log('📨 /api/chat/send endpoint çağrıldı');
  
  const { message, conversationId } = req.body;
  const userId = generateUserId(req);
  const clientIP = getClientIP(req);
  
  console.log('👤 Kullanıcı ID:', userId, 'IP:', clientIP);
  
  if (!message) {
    return res.status(400).json({ success: false, error: 'Mesaj gerekli' });
  }

  // Admin kontrolü
  const isAdminUser = isAdmin(clientIP);
  
  // Admin değilse günlük kullanım sınırını kontrol et
  if (!isAdminUser) {
    const dailyUsage = await checkDailyUsage(userId);
    const DAILY_LIMIT = 10; // Günlük 10 mesaj sınırı
    
    if (dailyUsage >= DAILY_LIMIT) {
      return res.status(429).json({ 
        success: false, 
        error: 'Günlük kullanım sınırına ulaştınız. Yarın tekrar deneyiniz.',
        dailyUsage: dailyUsage,
        dailyLimit: DAILY_LIMIT
      });
    }
    
    console.log('📊 Günlük kullanım:', dailyUsage + 1, '/', DAILY_LIMIT);
  } else {
    console.log('👑 Admin kullanıcı - sınırsız erişim');
  }

      try {
      console.log('🔍 AI yanıtı hazırlanıyor...');
      const aiResponse = await geminiService.generateResponse(message);
      
      if (!aiResponse || !aiResponse.success) {
        throw new Error(aiResponse?.error || 'AI yanıtı alınamadı');
      }

      console.log('✅ AI yanıtı başarıyla alındı');

      // AI yanıtını formatla ve kişisel verileri sansürle
      const formattedResponse = formatAIResponse(aiResponse.response);
      const sanitizedResponse = sanitizeAllPersonalData(formattedResponse);

    // Konuşma ID'si yoksa yeni konuşma oluştur (sansürlenmiş başlıkla)
    let currentConversationId = conversationId;
    if (!currentConversationId || currentConversationId.toString().startsWith('temp_')) {
      const sanitizedTitle = sanitizeAllPersonalData(message.substring(0, 50) + '...');
      const conversationResult = await pool.query(
        'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id',
        [userId, sanitizedTitle]
      );
      currentConversationId = conversationResult.rows[0].id;
    }

    // Kullanıcı mesajını kaydet (sansürlenmiş)
    const sanitizedUserMessage = sanitizeAllPersonalData(message);
    const userMessageResult = await pool.query(
      'INSERT INTO messages (conversation_id, role, content, message_order) VALUES ($1, $2, $3, $4) RETURNING id',
      [parseInt(currentConversationId), 'user', sanitizedUserMessage, 1]
    );

    // AI yanıtını kaydet (sansürlenmiş)
    const aiMessageResult = await pool.query(
      'INSERT INTO messages (conversation_id, role, content, message_order) VALUES ($1, $2, $3, $4) RETURNING id',
      [parseInt(currentConversationId), 'assistant', sanitizedResponse, 2]
    );

    // Konuşma başlığını güncelle (sansürlenmiş)
    if (!conversationId || conversationId.toString().startsWith('temp_')) {
      const sanitizedTitle = sanitizeAllPersonalData(message.substring(0, 50) + '...');
      await pool.query(
        'UPDATE conversations SET title = $1 WHERE id = $2',
        [sanitizedTitle, parseInt(currentConversationId)]
      );
    }

    console.log('✅ Mesajlar veritabanına kaydedildi');

    res.json({
      success: true,
      message: sanitizedResponse,
      messageId: aiMessageResult.rows[0].id,
      conversationId: currentConversationId
    });

  } catch (error) {
    console.error('❌ Mesaj gönderme hatası:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Mesaj gönderilemedi',
      details: error.message 
    });
  }
});

// Yeni konuşma başlat
router.post('/conversation', async (req, res) => {
  console.log('🆕 Yeni konuşma başlatılıyor');
  
  const userId = generateUserId(req);
  
  console.log('👤 Kullanıcı ID:', userId, 'IP:', getClientIP(req));

  try {
    const result = await pool.query(
      'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id',
      [userId, 'Yeni Konuşma']
    );

    console.log('✅ Yeni konuşma oluşturuldu:', result.rows[0].id);

    res.json({
      success: true,
      conversationId: result.rows[0].id
    });

  } catch (error) {
    console.error('❌ Konuşma oluşturma hatası:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Konuşma oluşturulamadı' 
    });
  }
});

// Konuşmaları listele
router.get('/conversations', async (req, res) => {
  console.log('📋 Konuşmalar listeleniyor');
  
  const userId = generateUserId(req);
  const clientIP = getClientIP(req);
  const isAdminUser = isAdmin(clientIP);
  
  console.log('👤 Kullanıcı ID:', userId, 'IP:', clientIP, 'Admin:', isAdminUser);

  try {
    // Debug: Database connection test
    console.log('🔍 Chat route - Database connection test');
    try {
      const testResult = await pool.query('SELECT current_database(), current_user');
      console.log('🔍 Chat route connected to:', testResult.rows[0]);
    } catch (error) {
      console.error('❌ Chat route database error:', error);
    }

    const result = await pool.query(
      `SELECT id, title, created_at, updated_at, message_count 
       FROM conversations 
       WHERE user_id = $1 AND is_active = true 
       ORDER BY updated_at DESC`,
      [userId]
    );

    // Günlük kullanım sayısını al
    const dailyUsage = await checkDailyUsage(userId);

    console.log('✅ Konuşmalar listelendi:', result.rows.length);

    res.json({
      success: true,
      conversations: result.rows,
      dailyUsage: dailyUsage,
      dailyLimit: 10,
      isAdmin: isAdminUser
    });

  } catch (error) {
    console.error('❌ Konuşma listeleme hatası:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Konuşmalar listelenemedi' 
    });
  }
});

// Konuşma detayını al
router.get('/conversation/:id', async (req, res) => {
  console.log('📄 Konuşma detayı alınıyor:', req.params.id);
  
  const { id } = req.params;
  const userId = generateUserId(req);
  
  console.log('👤 Kullanıcı ID:', userId, 'IP:', getClientIP(req));

  try {
    // Konuşma bilgilerini al (sadece kullanıcının kendi konuşması)
    const conversationResult = await pool.query(
      'SELECT * FROM conversations WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (conversationResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Konuşma bulunamadı' 
      });
    }

    // Mesajları al
    const messagesResult = await pool.query(
      'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY message_order ASC',
      [id]
    );

    console.log('✅ Konuşma detayı alındı:', messagesResult.rows.length, 'mesaj');

    res.json({
      success: true,
      conversation: conversationResult.rows[0],
      messages: messagesResult.rows
    });

  } catch (error) {
    console.error('❌ Konuşma detayı alma hatası:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Konuşma detayı alınamadı' 
    });
  }
});

// Konuşmayı sil
router.delete('/conversation/:id', async (req, res) => {
  console.log('🗑️ Konuşma siliniyor:', req.params.id);
  
  const { id } = req.params;
  const userId = generateUserId(req);
  
  console.log('👤 Kullanıcı ID:', userId, 'IP:', getClientIP(req));

  try {
    // Soft delete - sadece kullanıcının kendi konuşmasını sil
    const result = await pool.query(
      'UPDATE conversations SET is_active = false WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Konuşma bulunamadı' 
      });
    }

    console.log('✅ Konuşma silindi');

    res.json({
      success: true,
      message: 'Konuşma başarıyla silindi'
    });

  } catch (error) {
    console.error('❌ Konuşma silme hatası:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Konuşma silinemedi' 
    });
  }
});



module.exports = router; 