#!/bin/bash

echo "🚀 HukukKem AI Chat Deployment Script"
echo "======================================"

# Environment variables kontrolü
if [ -z "$GEMINI_API_KEY" ]; then
    echo "❌ GEMINI_API_KEY environment variable gerekli!"
    echo "export GEMINI_API_KEY=your_api_key_here"
    exit 1
fi

# Docker ve Docker Compose kontrolü
if ! command -v docker &> /dev/null; then
    echo "❌ Docker yüklü değil!"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose yüklü değil!"
    exit 1
fi

echo "✅ Docker ve Docker Compose mevcut"

# Eski container'ları durdur ve sil
echo "🧹 Eski container'lar temizleniyor..."
docker-compose down -v

# Image'ları yeniden build et
echo "🔨 Docker image'ları build ediliyor..."
docker-compose build --no-cache

# Container'ları başlat
echo "🚀 Container'lar başlatılıyor..."
docker-compose up -d

# Health check
echo "🏥 Health check yapılıyor..."
sleep 30

if curl -f http://localhost/api/health; then
    echo "✅ Deployment başarılı!"
    echo "🌐 Site: http://localhost"
    echo "🔧 API: http://localhost/api"
else
    echo "❌ Deployment başarısız!"
    docker-compose logs
    exit 1
fi

echo "📊 Container durumları:"
docker-compose ps 