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

module.exports = router; 