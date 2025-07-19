const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../config/database');

class EmbeddingService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.embeddingModel = this.genAI.getGenerativeModel({ model: 'embedding-001' });
  }

  // Metni embedding'e çevir
  async getEmbedding(text) {
    try {
      const result = await this.embeddingModel.embedContent(text);
      const embedding = await result.embedding;
      return embedding.values;
    } catch (error) {
      console.error('Embedding oluşturma hatası:', error);
      return null;
    }
  }

  // Vector similarity search
  async searchByEmbedding(query, limit = 5) {
    try {
      console.log('🔍 Embedding search başlatılıyor:', query);
      
      // Önce query'yi embedding'e çevir
      const queryEmbedding = await this.getEmbedding(query);
      
      if (!queryEmbedding) {
        console.log('❌ Embedding oluşturulamadı, fallback kullanılıyor');
        // Embedding başarısız olursa fallback olarak text search kullan
        return await this.fallbackTextSearch(query, limit);
      }
      
      console.log('✅ Embedding oluşturuldu, boyut:', queryEmbedding.length);

      // Vector similarity search (pgvector kullanarak)
      const searchQuery = `
        SELECT 
          kc.karar_id,
          kc.chunk_index,
          kc.section,
          kc.chunk_text,
          k.baslik,
          k.mahkeme,
          k.karar_tarihi,
          k.basvuru_no,
          k.basvurucu,
          k.karar_ozeti,
          kc.embedding <=> $1::vector as distance
        FROM karar_chunk kc
        JOIN kararlar k ON kc.karar_id = k.id
        ORDER BY kc.embedding <=> $1::vector
        LIMIT $2
      `;

      // Embedding'i PostgreSQL vector formatına çevir
      const vectorString = `[${queryEmbedding.join(',')}]`;
      console.log('🔍 Vector search sorgusu çalıştırılıyor...');
      const result = await db.query(searchQuery, [vectorString, limit]);
      
      console.log('✅ Vector search sonucu:', result.rows.length, 'sonuç bulundu');
      return result.rows;
    } catch (error) {
      console.error('❌ Vector search hatası:', error);
      console.log('🔄 Fallback text search kullanılıyor...');
      // Fallback olarak text search kullan
      return await this.fallbackTextSearch(query, limit);
    }
  }

  // Fallback text search
  async fallbackTextSearch(query, limit = 5) {
    try {
      console.log('🔍 Fallback text search başlatılıyor...');
      
      const searchQuery = `
        SELECT 
          k.id as karar_id,
          0 as chunk_index,
          'tum_metin' as section,
          k.tum_metin as chunk_text,
          k.baslik,
          k.mahkeme,
          k.karar_tarihi,
          k.basvuru_no,
          k.basvurucu,
          k.karar_ozeti,
          1 as distance
        FROM kararlar k
        WHERE 
          k.baslik ILIKE $1
          OR k.karar_ozeti ILIKE $1
        ORDER BY k.karar_tarihi DESC
        LIMIT $2
      `;

      const searchTerm = `%${query}%`;
      console.log('🔍 Çok basit text search sorgusu çalıştırılıyor...');
      const result = await db.query(searchQuery, [searchTerm, limit]);
      console.log('✅ Text search sonucu:', result.rows.length, 'sonuç bulundu');
      
      return result.rows;
    } catch (error) {
      console.error('❌ Fallback search hatası:', error);
      return [];
    }
  }

  // Hybrid search (hem embedding hem text)
  async hybridSearch(query, limit = 5) {
    try {
      console.log('🔍 Hybrid search başlatılıyor...');
      
      // Embedding search
      const embeddingResults = await this.searchByEmbedding(query, Math.ceil(limit / 2));
      console.log('✅ Embedding search tamamlandı, sonuç:', embeddingResults.length);
      
      // Text search
      const textResults = await this.fallbackTextSearch(query, Math.ceil(limit / 2));
      console.log('✅ Text search tamamlandı, sonuç:', textResults.length);
      
      // Sonuçları birleştir ve deduplicate et
      const allResults = [...embeddingResults, ...textResults];
      const uniqueResults = this.deduplicateResults(allResults);
      console.log('✅ Sonuçlar birleştirildi, toplam:', uniqueResults.length);
      
      return uniqueResults.slice(0, limit);
    } catch (error) {
      console.error('❌ Hybrid search hatası:', error);
      return await this.fallbackTextSearch(query, limit);
    }
  }

  // Sonuçları deduplicate et
  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(result => {
      const key = `${result.karar_id}-${result.chunk_index}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // Context'i hazırla
  async prepareContextFromEmbeddings(query) {
    console.log('🔍 prepareContextFromEmbeddings başlatılıyor...');
    
    const similarCases = await this.hybridSearch(query, 5); // 3'ten 5'e çıkardık
    console.log('✅ Hybrid search tamamlandı, sonuç sayısı:', similarCases.length);
    
    let context = "İlgili mahkeme kararları:\n\n";
    
    similarCases.forEach((case_, index) => {
      console.log(`📄 Karar ${index + 1}: ${case_.baslik}`);
      context += `${index + 1}. Başlık: ${case_.baslik}\n`;
      context += `   Mahkeme: ${case_.mahkeme}\n`;
      context += `   Başvuru No: ${case_.basvuru_no}\n`;
      context += `   Tarih: ${case_.karar_tarihi}\n`;
      context += `   Başvurucu: ${case_.basvurucu}\n`;
      context += `   Bölüm: ${case_.section}\n`;
      context += `   İlgili Metin: ${case_.chunk_text.substring(0, 600)}...\n\n`;
    });
    
    console.log('✅ Context hazırlandı, uzunluk:', context.length);
    return context;
  }
}

module.exports = new EmbeddingService(); 