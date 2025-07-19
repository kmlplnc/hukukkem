-- HukukKem AI Chat Database Schema

-- Kullanıcılar tablosu
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Mahkeme kararları tablosu
CREATE TABLE IF NOT EXISTS mahkeme_kararlari (
    id SERIAL PRIMARY KEY,
    mahkeme_adi VARCHAR(200) NOT NULL,
    dosya_no VARCHAR(100),
    karar_tarihi DATE,
    karar_metni TEXT NOT NULL,
    karar_ozeti TEXT,
    hukuk_alani VARCHAR(100),
    anahtar_kelimeler TEXT[],
    embedding_vector TEXT, -- OpenAI embedding boyutu (JSON string olarak saklanacak)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Chat mesajları tablosu
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    conversation_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Konuşmalar tablosu
CREATE TABLE IF NOT EXISTS conversations (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    title VARCHAR(200),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_mahkeme_kararlari_mahkeme_adi ON mahkeme_kararlari(mahkeme_adi);
CREATE INDEX IF NOT EXISTS idx_mahkeme_kararlari_karar_tarihi ON mahkeme_kararlari(karar_tarihi);
CREATE INDEX IF NOT EXISTS idx_mahkeme_kararlari_hukuk_alani ON mahkeme_kararlari(hukuk_alani);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- Full-text search için indeks
CREATE INDEX IF NOT EXISTS idx_mahkeme_kararlari_karar_metni_gin ON mahkeme_kararlari USING gin(to_tsvector('turkish', karar_metni));

-- Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mahkeme_kararlari_updated_at BEFORE UPDATE ON mahkeme_kararlari
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Örnek veri ekleme (test için)
INSERT INTO users (username, email, password, full_name) VALUES 
('test_user', 'test@hukukkem.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2.', 'Test Kullanıcı')
ON CONFLICT (username) DO NOTHING;

-- Mahkeme kararları için örnek veri
INSERT INTO mahkeme_kararlari (mahkeme_adi, dosya_no, karar_tarihi, karar_metni, hukuk_alani) VALUES 
('Yargıtay 1. Hukuk Dairesi', '2023/1234', '2023-06-15', 'İşçi işveren ilişkisinde işçinin haklı fesih hakkı bulunmaktadır. İşverenin ağır kusuru nedeniyle işçi iş sözleşmesini feshedebilir.', 'İş Hukuku'),
('Yargıtay 2. Hukuk Dairesi', '2023/5678', '2023-07-20', 'Kira sözleşmesinde kiracının ödeme yükümlülüğü ve ev sahibinin tahliye hakkı konularında karar verilmiştir.', 'Borçlar Hukuku'),
('Yargıtay 3. Hukuk Dairesi', '2023/9012', '2023-08-10', 'Ticari işletme devri konusunda alacaklıların hakları ve devralanın sorumluluğu hakkında karar.', 'Ticaret Hukuku')
ON CONFLICT DO NOTHING; 