# 🚀 HukukKem AI Chat - Ubuntu Sunucu Deployment

## 📋 Gereksinimler

- Ubuntu 20.04+ 
- Docker
- Docker Compose
- Domain name (opsiyonel)

## 🔧 Kurulum Adımları

### 1. Sunucuya Bağlan
```bash
ssh root@your-server-ip
```

### 2. Docker Kurulumu
```bash
# Güncellemeleri yükle
apt update && apt upgrade -y

# Docker kurulumu
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Docker Compose kurulumu
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Docker servisini başlat
systemctl start docker
systemctl enable docker
```

### 3. Proje Dosyalarını Yükle
```bash
# Proje klasörü oluştur
mkdir /opt/hukukkem
cd /opt/hukukkem

# Dosyaları kopyala (GitHub'dan veya SCP ile)
git clone https://github.com/your-repo/hukukkem.git .
# VEYA
scp -r ./hukukkem/* root@your-server:/opt/hukukkem/
```

### 4. Environment Variables Ayarla
```bash
# Environment dosyasını düzenle
nano env.production

# GEMINI_API_KEY ekle
export GEMINI_API_KEY=your_actual_api_key_here
export DB_PASSWORD=your_secure_password_here
export CORS_ORIGIN=http://your-domain.com
```

### 5. Deployment Script'ini Çalıştır
```bash
# Script'i çalıştırılabilir yap
chmod +x deploy.sh

# Deployment'ı başlat
./deploy.sh
```

## 🌐 Domain Ayarları (Opsiyonel)

### Nginx Reverse Proxy
```bash
# SSL sertifikası (Let's Encrypt)
apt install certbot python3-certbot-nginx

# Domain için SSL
certbot --nginx -d your-domain.com
```

### DNS Ayarları
```
A Record: your-domain.com -> your-server-ip
CNAME: www.your-domain.com -> your-domain.com
```

## 📊 Monitoring

### Container Durumları
```bash
docker-compose ps
docker-compose logs -f
```

### Sistem Kaynakları
```bash
docker stats
htop
```

## 🔄 Güncelleme

### Yeni Versiyon Deploy
```bash
cd /opt/hukukkem
git pull
./deploy.sh
```

### Backup
```bash
# Database backup
docker-compose exec postgres pg_dump -U postgres hukukkem > backup.sql

# Restore
docker-compose exec -T postgres psql -U postgres hukukkem < backup.sql
```

## 🛠️ Troubleshooting

### Port Çakışması
```bash
# Port 80 kullanımda mı?
netstat -tulpn | grep :80

# Eski servisleri durdur
systemctl stop apache2 nginx
```

### Database Bağlantı Sorunu
```bash
# PostgreSQL logları
docker-compose logs postgres

# Database bağlantısını test et
docker-compose exec postgres psql -U postgres -d hukukkem
```

### Memory Sorunu
```bash
# Container memory limitleri
docker-compose down
docker system prune -a
docker-compose up -d
```

## 📞 Destek

Sorun yaşarsanız:
1. `docker-compose logs` çıktısını kontrol edin
2. Environment variables'ları doğrulayın
3. Port'ların açık olduğunu kontrol edin

## ✅ Başarılı Deployment

Deployment başarılı olduğunda:
- 🌐 Site: http://your-domain.com
- 🔧 API: http://your-domain.com/api
- 📊 Health: http://your-domain.com/api/health 