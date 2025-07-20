const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../config/database');
const embeddingService = require('./embeddingService');

class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  // Mahkeme kararlarını benzerlik bazında arama
  async searchSimilarCases(query, limit = 5) {
    try {
      // Full-text search ve keyword arama kombinasyonu
      const searchQuery = `
        SELECT 
          k.id,
          k.baslik,
          k.mahkeme,
          k.karar_tarihi,
          k.basvuru_no,
          k.karar_ozeti,
          k.basvurucu,
          k.tum_metin,
          ts_rank(to_tsvector('turkish', k.tum_metin), plainto_tsquery('turkish', $1)) as rank
        FROM kararlar k
        WHERE 
          to_tsvector('turkish', k.tum_metin) @@ plainto_tsquery('turkish', $1)
          OR k.baslik ILIKE $2
          OR k.karar_ozeti ILIKE $2
          OR k.basvurucu ILIKE $2
          OR k.mahkeme ILIKE $2
        ORDER BY rank DESC, k.karar_tarihi DESC
        LIMIT $3
      `;
      
      const searchTerm = `%${query}%`;
      const result = await db.query(searchQuery, [query, searchTerm, limit]);
      
      return result.rows;
    } catch (error) {
      console.error('Mahkeme kararı arama hatası:', error);
      console.log('⚠️  Veritabanı arama yapılamıyor, boş sonuç döndürülüyor');
      return [];
    }
  }

  // Anayasa maddelerini arama
  async searchAnayasaMaddeleri(query, limit = 3) {
    try {
      const searchQuery = `
        SELECT 
          id,
          madde_no,
          baslik,
          icerik,
          gerekce
        FROM anayasa_maddeleri
        WHERE 
          icerik ILIKE $1
          OR baslik ILIKE $1
          OR gerekce ILIKE $1
        ORDER BY madde_no
        LIMIT $2
      `;
      
      const searchTerm = `%${query}%`;
      const result = await db.query(searchQuery, [searchTerm, limit]);
      
      return result.rows;
    } catch (error) {
      console.error('Anayasa maddesi arama hatası:', error);
      return [];
    }
  }

  // Ceza kanunu maddelerini arama
  async searchCezaKanunu(query, limit = 3) {
    try {
      const searchQuery = `
        SELECT 
          id,
          madde_no,
          baslik,
          icerik
        FROM ceza_kanunu_madde
        WHERE 
          icerik ILIKE $1
          OR baslik ILIKE $1
        ORDER BY madde_no
        LIMIT $2
      `;
      
      const searchTerm = `%${query}%`;
      const result = await db.query(searchQuery, [searchTerm, limit]);
      
      return result.rows;
    } catch (error) {
      console.error('Ceza kanunu arama hatası:', error);
      return [];
    }
  }

  // Context'i hazırla
  async prepareContext(query) {
    try {
      console.log('🔍 Context hazırlanıyor:', query);
      
      // Önce embedding tablosundan arama yap
      const context = await embeddingService.prepareContextFromEmbeddings(query);
      if (context && context.length > 50) { // En az 50 karakter olmalı
        console.log('✅ Embedding context hazırlandı, uzunluk:', context.length);
        return context;
      } else {
        console.log('❌ Embedding context çok kısa veya boş, text search kullanılıyor');
      }
    } catch (error) {
      console.log('❌ Embedding search başarısız, text search kullanılıyor...', error.message);
    }
    
    // Fallback olarak text search kullan
    const similarCases = await this.searchSimilarCases(query);
    const anayasaMaddeleri = await this.searchAnayasaMaddeleri(query);
    const cezaKanunu = await this.searchCezaKanunu(query);
    
    let context = "";
    
    // Mahkeme kararları
    if (similarCases.length > 0) {
      context += "İlgili mahkeme kararları:\n\n";
      similarCases.forEach((case_, index) => {
        context += `${index + 1}. Başlık: ${case_.baslik}\n`;
        context += `   Mahkeme: ${case_.mahkeme}\n`;
        context += `   Başvuru No: ${case_.basvuru_no}\n`;
        context += `   Tarih: ${case_.karar_tarihi}\n`;
        context += `   Başvurucu: ${case_.basvurucu}\n`;
        context += `   Özet: ${case_.karar_ozeti}\n`;
        context += `   Karar Metni: ${case_.tum_metin.substring(0, 800)}...\n\n`;
      });
    }
    
    // Anayasa maddeleri
    if (anayasaMaddeleri.length > 0) {
      context += "İlgili anayasa maddeleri:\n\n";
      anayasaMaddeleri.forEach((madde, index) => {
        context += `${index + 1}. Madde ${madde.madde_no}: ${madde.baslik}\n`;
        context += `   İçerik: ${madde.icerik}\n`;
        if (madde.gerekce) {
          context += `   Gerekçe: ${madde.gerekce}\n`;
        }
        context += '\n';
      });
    }
    
    // Ceza kanunu maddeleri
    if (cezaKanunu.length > 0) {
      context += "İlgili ceza kanunu maddeleri:\n\n";
      cezaKanunu.forEach((madde, index) => {
        context += `${index + 1}. Madde ${madde.madde_no}: ${madde.baslik}\n`;
        context += `   İçerik: ${madde.icerik}\n\n`;
      });
    }
    
    return context;
  }

  // Chat completion
  async generateResponse(userMessage, conversationHistory = []) {
    try {
      console.log('🤖 AI yanıtı hazırlanıyor...');
      
      // Context hazırla
      const context = await this.prepareContext(userMessage);
      console.log('📝 Context hazırlandı, uzunluk:', context.length);
      
      // System prompt
      const systemPrompt = `Sen Türk hukuk sistemi konusunda uzman bir AI asistanısın. 
      Mahkeme kararları ve hukuki mevzuat konusunda hukukçulara yardımcı oluyorsun.
      
      Yanıt formatını şu şekilde düzenle:
      
      1. **MEVCUT DURUM ANALİZİ**: Sorunun hukuki çerçevesini çiz
      2. **İLGİLİ MAHKEME KARARLARI**: Veritabanından bulunan kararları analiz et
      3. **HUKUKİ DEĞERLENDİRME**: Kararların ışığında durumu değerlendir
      4. **PRATİK TAVSİYELER**: Somut öneriler ve stratejiler sun
      5. **RİSK ANALİZİ**: Olası sonuçları ve riskleri belirt
      6. **ALTERNATİF ÇÖZÜMLER**: Farklı yaklaşımları değerlendir
      
      Önemli kurallar:
      - Türk hukuk sistemi odaklı ol
      - Mahkeme kararlarını detaylı analiz et
      - Pratik ve uygulanabilir tavsiyeler ver
      - Risk ve fırsatları dengeli değerlendir
      - Türkçe yanıtla
      - Profesyonel ve anlaşılır ol
      
      İlgili mahkeme kararları:
      ${context}
      
      Kullanıcı sorusu: ${userMessage}`;
      
      console.log('📝 System prompt hazırlandı, uzunluk:', systemPrompt.length);

      // Conversation history'yi hazırla
      const chatHistory = conversationHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      // Chat başlat
      console.log('💬 Chat başlatılıyor...');
      const chat = this.model.startChat({
        history: chatHistory,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.7,
        },
      });
      console.log('✅ Chat başlatıldı');

      // Response al
      console.log('📤 Gemini AI\'ya mesaj gönderiliyor...');
      let text;
      try {
        const result = await chat.sendMessage(systemPrompt);
        console.log('📥 Gemini AI yanıtı alındı');
        const response = await result.response;
        console.log('📄 Response objesi alındı');
        text = response.text();
        console.log('✅ AI yanıtı alındı, uzunluk:', text.length);
      } catch (sendError) {
        console.error('❌ Gemini AI mesaj gönderme hatası:', sendError);
        throw sendError;
      }

      return {
        success: true,
        response: text,
        context: context
      };

    } catch (error) {
      console.error('❌ Gemini API hatası:', error);
      console.error('❌ Hata detayı:', error.message);
      return {
        success: false,
        error: 'AI servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
        details: error.message
      };
    }
  }

  // Basit soru-cevap (context olmadan)
  async simpleResponse(userMessage) {
    try {
      const prompt = `Sen Türk hukuk sistemi konusunda uzman bir AI asistanısın. 
      Hukukçulara yardımcı oluyorsun. Sadece Türkçe yanıtla ve hukuki tavsiye verme, sadece bilgi ver.
      
      Kullanıcı sorusu: ${userMessage}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return {
        success: true,
        response: text
      };

    } catch (error) {
      console.error('Gemini API hatası:', error);
      return {
        success: false,
        error: 'AI servisi şu anda kullanılamıyor.',
        details: error.message
      };
    }
  }
}

module.exports = new GeminiService(); 