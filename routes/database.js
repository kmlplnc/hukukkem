const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Tüm kararları listele
router.get('/kararlar', async (req, res) => {
  try {
    const { limit = 50, offset = 0, mahkeme, baslik } = req.query;
    
    let query = `
      SELECT 
        id, karar_tarihi, basvuru_no, rg_tarih_sayi, mahkeme, 
        üyeler, raportor, basvurucu, karar_ozeti, degerlendirme, 
        giderim, hüküm, baslik, url
      FROM kararlar 
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (mahkeme) {
      query += ` AND mahkeme ILIKE $${paramIndex}`;
      params.push(`%${mahkeme}%`);
      paramIndex++;
    }
    
    if (baslik) {
      query += ` AND baslik ILIKE $${paramIndex}`;
      params.push(`%${baslik}%`);
      paramIndex++;
    }
    
    query += ` ORDER BY karar_tarihi DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      kararlar: result.rows,
      total: result.rows.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    console.error('Kararlar listesi hatası:', error);
    res.status(500).json({ error: 'Kararlar yüklenemedi' });
  }
});

// Belirli bir kararı getir
router.get('/kararlar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        k.*,
        array_agg(kc.chunk_text ORDER BY kc.chunk_index) as chunks
      FROM kararlar k
      LEFT JOIN karar_chunk kc ON k.id = kc.karar_id
      WHERE k.id = $1
      GROUP BY k.id
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Karar bulunamadı' });
    }
    
    res.json({
      success: true,
      karar: result.rows[0]
    });
    
  } catch (error) {
    console.error('Karar getirme hatası:', error);
    res.status(500).json({ error: 'Karar yüklenemedi' });
  }
});

// Karar chunk'larını getir
router.get('/kararlar/:id/chunks', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        chunk_index, section, chunk_text, embedding
      FROM karar_chunk 
      WHERE karar_id = $1 
      ORDER BY chunk_index
    `;
    
    const result = await pool.query(query, [id]);
    
    res.json({
      success: true,
      chunks: result.rows
    });
    
  } catch (error) {
    console.error('Chunk getirme hatası:', error);
    res.status(500).json({ error: 'Chunk\'lar yüklenemedi' });
  }
});

// Mahkeme listesini getir
router.get('/mahkemeler', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT mahkeme, COUNT(*) as karar_sayisi
      FROM kararlar 
      WHERE mahkeme IS NOT NULL 
      GROUP BY mahkeme 
      ORDER BY karar_sayisi DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      mahkemeler: result.rows
    });
    
  } catch (error) {
    console.error('Mahkeme listesi hatası:', error);
    res.status(500).json({ error: 'Mahkemeler yüklenemedi' });
  }
});

// İstatistikler
router.get('/stats', async (req, res) => {
  console.log('📊 İstatistikler isteniyor');
  
  try {
    // Debug: Database connection test
    console.log('🔍 Database route - Database connection test');
    try {
      const testResult = await pool.query('SELECT current_database(), current_user');
      console.log('🔍 Database route connected to:', testResult.rows[0]);
    } catch (error) {
      console.error('❌ Database route database error:', error);
    }

    // Mahkeme kararları istatistikleri
    const kararlarResult = await pool.query('SELECT COUNT(*) as total FROM kararlar');
    const chunksResult = await pool.query('SELECT COUNT(*) as total FROM karar_chunk');
    
    // Sohbet istatistikleri
    const conversationsResult = await pool.query('SELECT COUNT(*) as total FROM conversations WHERE is_active = true');
    const messagesResult = await pool.query('SELECT COUNT(*) as total FROM messages');
    
    // Son 24 saat aktivite
    const recentActivityResult = await pool.query(`
      SELECT COUNT(*) as total 
      FROM messages 
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);
    
    // Ortalama yanıt süresi (simüle edilmiş)
    const averageResponseTime = 1200; // ms

    const stats = {
      totalCases: parseInt(kararlarResult.rows[0].total),
      totalChunks: parseInt(chunksResult.rows[0].total),
      totalConversations: parseInt(conversationsResult.rows[0].total),
      totalMessages: parseInt(messagesResult.rows[0].total),
      recentActivity: parseInt(recentActivityResult.rows[0].total),
      averageResponseTime: averageResponseTime
    };

    console.log('✅ İstatistikler hazırlandı:', stats);

    res.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    console.error('❌ İstatistik hatası:', error);
    res.status(500).json({ 
      success: false, 
      error: 'İstatistikler alınamadı' 
    });
  }
});

// Arama endpoint'i
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Arama terimi gerekli' });
    }
    
    const query = `
      SELECT 
        k.id, k.baslik, k.mahkeme, k.karar_tarihi, k.basvuru_no,
        k.karar_ozeti, k.basvurucu,
        ts_rank(to_tsvector('turkish', k.tum_metin), plainto_tsquery('turkish', $1)) as rank
      FROM kararlar k
      WHERE 
        to_tsvector('turkish', k.tum_metin) @@ plainto_tsquery('turkish', $1)
        OR k.baslik ILIKE $2
        OR k.karar_ozeti ILIKE $2
        OR k.basvurucu ILIKE $2
      ORDER BY rank DESC
      LIMIT $3
    `;
    
    const searchTerm = `%${q}%`;
    const result = await pool.query(query, [q, searchTerm, limit]);
    
    res.json({
      success: true,
      results: result.rows,
      query: q,
      total: result.rows.length
    });
    
  } catch (error) {
    console.error('Arama hatası:', error);
    res.status(500).json({ error: 'Arama yapılamadı' });
  }
});

// Otomatik Database Senkronizasyonu
router.post('/sync', async (req, res) => {
  console.log('🔄 Database senkronizasyonu başlatılıyor');
  
  try {
    const { sourceData } = req.body;
    
    if (!sourceData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Kaynak veri gerekli' 
      });
    }

    let syncResults = {
      conversations: { added: 0, updated: 0, errors: 0 },
      messages: { added: 0, updated: 0, errors: 0 },
      kararlar: { added: 0, updated: 0, errors: 0 },
      kararChunk: { added: 0, updated: 0, errors: 0 },
      yeniTablolar: { added: 0, updated: 0, errors: 0 }
    };

    // Conversations senkronizasyonu
    if (sourceData.conversations && sourceData.conversations.length > 0) {
      for (const conv of sourceData.conversations) {
        try {
          const existingConv = await pool.query(
            'SELECT id FROM conversations WHERE id = $1',
            [conv.id]
          );

          if (existingConv.rows.length === 0) {
            // Yeni conversation ekle
            await pool.query(`
              INSERT INTO conversations (id, user_id, title, created_at, updated_at, is_active)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [conv.id, conv.user_id, conv.title, conv.created_at, conv.updated_at, conv.is_active]);
            syncResults.conversations.added++;
          } else {
            // Mevcut conversation güncelle
            await pool.query(`
              UPDATE conversations 
              SET title = $2, updated_at = $3, is_active = $4
              WHERE id = $1
            `, [conv.id, conv.title, conv.updated_at, conv.is_active]);
            syncResults.conversations.updated++;
          }
        } catch (error) {
          console.error('Conversation sync error:', error);
          syncResults.conversations.errors++;
        }
      }
    }

    // Messages senkronizasyonu
    if (sourceData.messages && sourceData.messages.length > 0) {
      for (const msg of sourceData.messages) {
        try {
          const existingMsg = await pool.query(
            'SELECT id FROM messages WHERE id = $1',
            [msg.id]
          );

          if (existingMsg.rows.length === 0) {
            // Yeni message ekle
            await pool.query(`
              INSERT INTO messages (id, conversation_id, role, content, created_at)
              VALUES ($1, $2, $3, $4, $5)
            `, [msg.id, msg.conversation_id, msg.role, msg.content, msg.created_at]);
            syncResults.messages.added++;
          }
        } catch (error) {
          console.error('Message sync error:', error);
          syncResults.messages.errors++;
        }
      }
    }

    // Kararlar senkronizasyonu (sadece yeni kayıtlar)
    if (sourceData.kararlar && sourceData.kararlar.length > 0) {
      for (const karar of sourceData.kararlar) {
        try {
          const existingKarar = await pool.query(
            'SELECT id FROM kararlar WHERE id = $1',
            [karar.id]
          );

          if (existingKarar.rows.length === 0) {
            // Yeni karar ekle
            await pool.query(`
              INSERT INTO kararlar (id, karar_tarihi, basvuru_no, rg_tarih_sayi, mahkeme, 
                üyeler, raportor, basvurucu, karar_ozeti, degerlendirme, giderim, hüküm, baslik, url)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            `, [karar.id, karar.karar_tarihi, karar.basvuru_no, karar.rg_tarih_sayi, karar.mahkeme,
                karar.üyeler, karar.raportor, karar.basvurucu, karar.karar_ozeti, karar.degerlendirme,
                karar.giderim, karar.hüküm, karar.baslik, karar.url]);
            syncResults.kararlar.added++;
          }
        } catch (error) {
          console.error('Karar sync error:', error);
          syncResults.kararlar.errors++;
        }
      }
    }

    // Karar chunk'ları senkronizasyonu
    if (sourceData.kararChunk && sourceData.kararChunk.length > 0) {
      for (const chunk of sourceData.kararChunk) {
        try {
          const existingChunk = await pool.query(
            'SELECT karar_id, chunk_index FROM karar_chunk WHERE karar_id = $1 AND chunk_index = $2',
            [chunk.karar_id, chunk.chunk_index]
          );

          if (existingChunk.rows.length === 0) {
            // Yeni chunk ekle
            await pool.query(`
              INSERT INTO karar_chunk (karar_id, chunk_index, section, chunk_text)
              VALUES ($1, $2, $3, $4)
            `, [chunk.karar_id, chunk.chunk_index, chunk.section, chunk.chunk_text]);
            syncResults.kararChunk.added++;
          }
        } catch (error) {
          console.error('Karar chunk sync error:', error);
          syncResults.kararChunk.errors++;
        }
      }
    }

    // Yeni tabloları kontrol et ve bildir
    if (sourceData.yeniTablolar && sourceData.yeniTablolar.length > 0) {
      console.log('🆕 Yeni tablolar tespit edildi:', sourceData.yeniTablolar.map(t => t.table_name));
      
      for (const tablo of sourceData.yeniTablolar) {
        try {
          // Yeni tablo bilgisini logla
          console.log(`📋 Yeni tablo: ${tablo.table_name}`);
          syncResults.yeniTablolar.added++;
        } catch (error) {
          console.error('Yeni tablo sync error:', error);
          syncResults.yeniTablolar.errors++;
        }
      }
    }

    console.log('✅ Senkronizasyon tamamlandı:', syncResults);

    res.json({
      success: true,
      message: 'Database senkronizasyonu tamamlandı',
      results: syncResults
    });

  } catch (error) {
    console.error('❌ Senkronizasyon hatası:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Senkronizasyon başarısız' 
    });
  }
});

// Senkronizasyon durumu kontrolü
router.get('/sync/status', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM conversations) as conversations_count,
        (SELECT COUNT(*) FROM messages) as messages_count,
        (SELECT COUNT(*) FROM kararlar) as kararlar_count,
        (SELECT COUNT(*) FROM karar_chunk) as karar_chunk_count,
        (SELECT MAX(created_at) FROM conversations) as last_conversation,
        (SELECT MAX(created_at) FROM messages) as last_message
    `);

    res.json({
      success: true,
      status: stats.rows[0]
    });

  } catch (error) {
    console.error('❌ Sync status error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Durum alınamadı' 
    });
  }
});

module.exports = router; 