# 🏛️ HukukKem AI Chat

Modern hukukçular için AI destekli sohbet sistemi. KVKK uyumlu, güvenli ve kullanıcı dostu.

## ✨ Özellikler

### 🤖 AI Destekli Hukuki Danışmanlık
- **Gemini AI** entegrasyonu
- Türkçe hukuki sorulara yanıt
- Detaylı ve açıklayıcı cevaplar
- KVKK uyumlu kişisel veri sansürleme

### 🔒 Güvenlik ve Gizlilik
- **KVKK uyumlu** kişisel veri koruması
- **UUID tabanlı** anonim kullanıcı sistemi
- **IP tabanlı** admin yetkilendirme
- **Günlük kullanım limiti** (normal kullanıcılar: 10 mesaj)
- **Hukuki uyarı modalı**

### 👑 Admin Sistemi
- **IP tabanlı** admin yetkilendirme
- **Sınırsız kullanım** (admin kullanıcılar)
- **Özel rozet** ve arayüz
- **Gelişmiş yönetim** araçları

### 💬 Sohbet Özellikleri
- **Gerçek zamanlı** mesajlaşma
- **Konuşma geçmişi** saklama
- **Soft delete** (veri kaybı yok)
- **Responsive tasarım**

## 🚀 Kurulum

### Gereksinimler
- Node.js 18+
- PostgreSQL 15+
- Docker & Docker Compose (production)

### Local Development

```bash
# Repository'yi klonla
git clone https://github.com/kmlplnc/hukukkem.git
cd hukukkem

# Bağımlılıkları yükle
npm install
cd client && npm install && cd ..

# Environment variables ayarla
cp env.example .env
# .env dosyasını düzenle

# PostgreSQL'i başlat
# (PostgreSQL kurulu ve çalışır durumda olmalı)

# Backend'i başlat
npm run dev

# Frontend'i başlat (yeni terminal)
cd client && npm start
```

### Production Deployment

```bash
# Ubuntu sunucuda
git clone https://github.com/kmlplnc/hukukkem.git
cd hukukkem

# Environment variables ayarla
nano env.production

# Docker ile deploy et
chmod +x deploy.sh
./deploy.sh
```

## 🐳 Docker Deployment

### Hızlı Başlangıç
```bash
# Repository'yi klonla
git clone https://github.com/kmlplnc/hukukkem.git
cd hukukkem

# Environment variables ayarla
export GEMINI_API_KEY=your_api_key_here
export DB_PASSWORD=your_secure_password

# Deploy et
./deploy.sh
```

### Manuel Docker Compose
```bash
# Build ve başlat
docker-compose up -d

# Logları görüntüle
docker-compose logs -f

# Durdur
docker-compose down
```

## 🔧 Konfigürasyon

### Environment Variables

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hukukkem
DB_USER=postgres
DB_PASSWORD=your_password

# Application
NODE_ENV=production
PORT=3001
CORS_ORIGIN=http://your-domain.com

# API Keys
GEMINI_API_KEY=your_gemini_api_key

# Security
JWT_SECRET=your_jwt_secret
```

### Admin IP Ayarları

`routes/chat.js` dosyasında admin IP'lerini ayarlayın:

```javascript
const ADMIN_IPS = [
  '127.0.0.1',           // Localhost
  '::1',                 // IPv6 localhost
  'YOUR_IP_ADDRESS',     // Sizin IP adresiniz
];
```

## 📊 Sistem Mimarisi

### Frontend (React)
- **Modern UI** - Tailwind CSS
- **Responsive** tasarım
- **Real-time** mesajlaşma
- **LocalStorage** kullanıcı yönetimi

### Backend (Node.js + Express)
- **RESTful API** endpoints
- **PostgreSQL** veritabanı
- **UUID** kullanıcı tanımlama
- **Rate limiting** ve güvenlik

### Database (PostgreSQL)
- **Conversations** tablosu
- **Messages** tablosu
- **Triggers** ve **indexes**
- **Soft delete** desteği

## 🛡️ Güvenlik

### KVKK Uyumluluğu
- **Kişisel veri sansürleme** (isim, email, telefon, TC kimlik)
- **Anonim kullanıcı** sistemi
- **Veri minimizasyonu**
- **Hukuki uyarı** modalı

### Kullanıcı Yönetimi
- **UUID tabanlı** benzersiz tanımlama
- **IP tabanlı** admin sistemi
- **Günlük kullanım** limitleri
- **Session yönetimi**

## 📱 Kullanım

### Normal Kullanıcılar
1. **Siteye giriş** yapın
2. **Hukuki uyarıyı** kabul edin
3. **Sorunuzu yazın** (kişisel veri paylaşmayın)
4. **AI yanıtını** alın
5. **Günlük 10 mesaj** limiti

### Admin Kullanıcılar
1. **Admin IP'den** giriş yapın
2. **Sınırsız kullanım** hakkı
3. **Özel rozet** görünümü
4. **Gelişmiş** özellikler

## 🔄 Güncelleme

### Local Development
```bash
git pull origin main
npm install
cd client && npm install && cd ..
npm run dev
```

### Production
```bash
cd /opt/hukukkem
git pull origin main
./deploy.sh
```

## 📞 Destek

### Sorun Giderme
1. **Logları kontrol** edin: `docker-compose logs`
2. **Environment variables** doğrulayın
3. **Database bağlantısını** test edin
4. **Port'ların açık** olduğunu kontrol edin

### İletişim
- **GitHub Issues**: [HukukKem Issues](https://github.com/kmlplnc/hukukkem/issues)
- **Email**: [your-email@domain.com]

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 🤝 Katkıda Bulunma

1. **Fork** yapın
2. **Feature branch** oluşturun (`git checkout -b feature/amazing-feature`)
3. **Commit** yapın (`git commit -m 'Add amazing feature'`)
4. **Push** yapın (`git push origin feature/amazing-feature`)
5. **Pull Request** oluşturun

## 📈 Roadmap

- [ ] **Multi-language** desteği
- [ ] **Advanced AI** modelleri
- [ ] **Mobile app** geliştirme
- [ ] **Analytics** dashboard
- [ ] **API documentation** geliştirme

---

**HukukKem AI Chat** - Modern hukukçular için AI destekli sohbet sistemi ⚖️✨ 