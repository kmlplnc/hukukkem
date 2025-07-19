import React, { useState, useEffect } from 'react';
import { Database, FileText, MessageSquare, Users, TrendingUp, Clock, Search, BarChart3 } from 'lucide-react';
import axios from 'axios';

function DatabaseViewer() {
  const [stats, setStats] = useState({
    totalCases: 0,
    totalChunks: 0,
    totalConversations: 0,
    totalMessages: 0,
    recentActivity: 0,
    averageResponseTime: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/database/stats');
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('İstatistikler yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, title, value, subtitle, color = 'blue' }) => (
    <div className={`bg-gradient-to-br from-${color}-500 to-${color}-600 rounded-xl p-6 text-white shadow-lg`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm opacity-90">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs opacity-75 mt-1">{subtitle}</p>}
        </div>
        <div className={`bg-${color}-400 bg-opacity-30 p-3 rounded-lg`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">İstatistikler yükleniyor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">HukukKem AI İstatistikleri</h1>
        </div>
        <p className="text-gray-400">Sistem performansı ve kullanım verileri</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard
          icon={FileText}
          title="Toplam Mahkeme Kararı"
          value={stats.totalCases.toLocaleString()}
          subtitle="Veritabanındaki karar sayısı"
          color="blue"
        />
        
        <StatCard
          icon={Database}
          title="Toplam Chunk"
          value={stats.totalChunks.toLocaleString()}
          subtitle="AI analizi için parçalanmış metin"
          color="green"
        />
        
        <StatCard
          icon={MessageSquare}
          title="Toplam Konuşma"
          value={stats.totalConversations.toLocaleString()}
          subtitle="Kullanıcı sohbetleri"
          color="purple"
        />
        
        <StatCard
          icon={Users}
          title="Toplam Mesaj"
          value={stats.totalMessages.toLocaleString()}
          subtitle="Gönderilen mesaj sayısı"
          color="orange"
        />
        
        <StatCard
          icon={TrendingUp}
          title="Günlük Aktivite"
          value={stats.recentActivity.toLocaleString()}
          subtitle="Son 24 saatteki işlem"
          color="red"
        />
        
        <StatCard
          icon={Clock}
          title="Ortalama Yanıt Süresi"
          value={`${stats.averageResponseTime}ms`}
          subtitle="AI yanıt süresi"
          color="indigo"
        />
      </div>

      {/* System Info */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Sistem Bilgileri</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-gray-300">Veritabanı Bağlantısı: Aktif</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-gray-300">AI Servisi: Çalışıyor</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-gray-300">Embedding Servisi: Hazır</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-gray-300">RAG Sistemi: Aktif</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DatabaseViewer; 