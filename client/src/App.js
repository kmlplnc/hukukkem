import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader2, MessageSquare, Plus, Trash2, Database, Clock, ChevronLeft } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import DatabaseViewer from './components/DatabaseViewer';

// KVKK Sansürleme Fonksiyonları
const sanitizeNames = (text) => {
  if (!text || typeof text !== 'string') return text;
  
  const namePatterns = [
    /\b([A-ZÇĞIİÖŞÜ][a-zçğıiöşü]+)\s+([A-ZÇĞIİÖŞÜ][a-zçğıiöşü]+)\b/g,
    /\b([A-ZÇĞIİÖŞÜ][a-zçğıiöşü]+)\s+(Bey|Hanım|Efendi)\b/g,
    /\b(Av\.|Dr\.|Prof\.|Doç\.|Yrd\. Doç\.)\s+([A-ZÇĞIİÖŞÜ][a-zçğıiöşü]+)\s+([A-ZÇĞIİÖŞÜ][a-zçğıiöşü]+)\b/g,
    /\b(Sayın|Değerli)\s+([A-ZÇĞIİÖŞÜ][a-zçğıiöşü]+)\s+([A-ZÇĞIİÖŞÜ][a-zçğıiöşü]+)\b/g,
    /\b([A-ZÇĞIİÖŞÜ])\.\s+([A-ZÇĞIİÖŞÜ][a-zçğıiöşü]+)\b/g
  ];

  let sanitizedText = text;
  namePatterns.forEach((pattern, index) => {
    sanitizedText = sanitizedText.replace(pattern, (match, ...groups) => {
      switch (index) {
        case 0: return `${groups[0][0]}*** ${groups[1][0]}****`;
        case 1: return `${groups[0][0]}*** ${groups[1]}`;
        case 2: return `${groups[0]} ${groups[1][0]}*** ${groups[2][0]}****`;
        case 3: return `${groups[0]} ${groups[1][0]}*** ${groups[2][0]}****`;
        case 4: return `${groups[0]}. ${groups[1][0]}****`;
        default: return match;
      }
    });
  });
  return sanitizedText;
};

const sanitizeAllPersonalData = (text) => {
  if (!text || typeof text !== 'string') return text;
  
  // Email sansürleme
  text = text.replace(/\b([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g, (match, username, domain) => {
    const maskedUsername = username.length > 2 
      ? username[0] + '*'.repeat(username.length - 2) + username[username.length - 1]
      : username[0] + '*';
    return `${maskedUsername}@${domain}`;
  });
  
  // Telefon sansürleme
  text = text.replace(/\b(05\d{2})\s*(\d{3})\s*(\d{2})\s*(\d{2})\b/g, '$1 *** ** $4');
  text = text.replace(/\b(\+90)\s*(5\d{2})\s*(\d{3})\s*(\d{2})\s*(\d{2})\b/g, '$1 $2 *** ** $5');
  
  // TC Kimlik sansürleme
  text = text.replace(/\b(\d{3})(\d{3})(\d{3})(\d{2})\b/g, '$1 *** *** $4');
  
  // İsim sansürleme
  text = sanitizeNames(text);
  
  return text;
};

function App() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeView, setActiveView] = useState('chat'); // 'chat' veya 'database'
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [showLegalWarning, setShowLegalWarning] = useState(false);
  const [dailyUsage, setDailyUsage] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(10);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState(null);
  const messagesEndRef = useRef(null);

  // Kullanıcı ID oluştur
  const generateUserId = () => {
    const uuid = uuidv4();
    const shortUuid = uuid.replace(/-/g, '').substring(0, 8);
    const timestamp = Date.now();
    return `client_${timestamp}_${shortUuid}`;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Kullanıcı ID'sini başlangıçta oluştur
  useEffect(() => {
    const existingUserId = localStorage.getItem('userId');
    if (existingUserId) {
      setUserId(existingUserId);
    } else {
      const newUserId = generateUserId();
      localStorage.setItem('userId', newUserId);
      setUserId(newUserId);
    }
  }, []);

  // Hukuki uyarı kontrolü
  useEffect(() => {
    const hasAcceptedWarning = localStorage.getItem('legalWarningAccepted');
    if (!hasAcceptedWarning) {
      setShowLegalWarning(true);
    }
  }, []);

  // Konuşmaları yükle
  useEffect(() => {
    if (activeView === 'chat') {
      loadConversations();
    }
  }, [activeView]);

  const loadConversations = async () => {
    setLoadingConversations(true);
    try {
      const response = await axios.get('/api/chat/conversations', {
        headers: {
          'X-User-ID': userId
        }
      });
      if (response.data.success) {
        setConversations(response.data.conversations);
        setDailyUsage(response.data.dailyUsage || 0);
        setDailyLimit(response.data.dailyLimit || 10);
        setIsAdmin(response.data.isAdmin || false);
      }
    } catch (error) {
      console.error('Konuşmalar yüklenemedi:', error);
    } finally {
      setLoadingConversations(false);
    }
  };

  // Konuşma seç
  const selectConversation = async (conversationId) => {
    try {
      const response = await axios.get(`/api/chat/conversation/${conversationId}`, {
        headers: {
          'X-User-ID': userId
        }
      });
      if (response.data.success) {
        setConversationId(conversationId);
        setMessages(response.data.messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.created_at)
        })));
      }
    } catch (error) {
      console.error('Konuşma yüklenemedi:', error);
    }
  };

  // Yeni konuşma başlat
  const startNewConversation = async () => {
    try {
      const response = await axios.post('/api/chat/conversation', {}, {
        headers: {
          'X-User-ID': userId
        }
      });
      
      setConversationId(response.data.conversationId);
      setMessages([]);
      loadConversations(); // Konuşma listesini yenile
    } catch (error) {
      console.error('Konuşma başlatma hatası:', error);
    }
  };

  // Mesaj gönder
  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await axios.post('/api/chat/send', {
        message: inputMessage,
        conversationId: conversationId || 'temp_' + Date.now()
      }, {
        headers: {
          'X-User-ID': userId
        }
      });

      if (response.data.success) {
        const aiMessage = {
          id: response.data.messageId,
          role: 'assistant',
          content: response.data.message,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, aiMessage]);
        
        if (!conversationId) {
          setConversationId(response.data.conversationId);
        }
        
        // Kullanım sayısını güncelle
        setDailyUsage(prev => prev + 1);
        
        // Konuşma listesini yenile
        loadConversations();
      }
    } catch (error) {
      console.error('Mesaj gönderme hatası:', error);
      
      // Kullanım sınırı hatası kontrolü
      if (error.response && error.response.status === 429) {
        const errorMessage = {
          id: Date.now(),
          role: 'assistant',
          content: error.response.data.error,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
        setDailyUsage(error.response.data.dailyUsage);
        setDailyLimit(error.response.data.dailyLimit);
      } else {
        const errorMessage = {
          id: Date.now(),
          role: 'assistant',
          content: 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Enter tuşu ile gönder
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Konuşmayı sil
  const deleteConversation = async () => {
    if (!conversationId) return;

    try {
      await axios.delete(`/api/chat/conversation/${conversationId}`, {
        headers: {
          'X-User-ID': userId
        }
      });
      setMessages([]);
      setConversationId(null);
      loadConversations(); // Konuşma listesini yenile
    } catch (error) {
      console.error('Konuşma silme hatası:', error);
    }
  };

  // Hukuki uyarıyı kabul et
  const acceptLegalWarning = () => {
    localStorage.setItem('legalWarningAccepted', 'true');
    setShowLegalWarning(false);
  };

  // Hukuki uyarıyı reddet
  const rejectLegalWarning = () => {
    setShowLegalWarning(false);
    // Sayfayı kapat veya ana sayfaya yönlendir
    window.close();
    // Eğer window.close() çalışmazsa, kullanıcıyı uyar
    alert('Bu uygulamayı kullanmak için hukuki uyarıyı kabul etmeniz gerekmektedir.');
  };



  return (
    <div className="h-screen bg-gray-900 flex flex-col overflow-hidden">
      {/* Hukuki Uyarı Modal */}
      {showLegalWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-600 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-yellow-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-lg">⚠️</span>
                </div>
                <h2 className="text-xl font-semibold text-white">Hukuki Uyarı ve Kullanım Şartları</h2>
              </div>
              
              <div className="text-gray-300 space-y-4 mb-6">
                <p className="text-sm leading-relaxed">
                  Bu sistem yalnızca bilgilendirme amacıyla tasarlanmış bir beta uygulamasıdır. Bu sistem tarafından verilen yanıtlar, profesyonel hukuk danışmanlığı veya avukatlık hizmeti niteliği taşımaz.
                </p>
                
                <p className="text-sm font-medium text-yellow-400">
                  Kullanmadan önce lütfen aşağıdaki uyarıları dikkate alın:
                </p>
                
                <ul className="text-sm space-y-2 list-disc list-inside">
                  <li>Sorularınızı gerçek kimliğinizden arındırarak, anonim olarak iletiniz.</li>
                  <li>Gerçek isim, kurum, dosya numarası, TC kimlik numarası veya hassas kişisel veri paylaşmayınız.</li>
                  <li>Bu sistem tarafından verilen cevaplar, genel hukuk bilgilerine dayalıdır ve bireysel durumlarınızı yansıtmayabilir.</li>
                  <li>Bu platformu kullanmanız, bu koşulları okuduğunuzu ve kabul ettiğinizi ifade eder.</li>
                </ul>
                
                <div className="bg-red-900 border border-red-700 rounded-lg p-3">
                  <p className="text-red-300 text-sm font-medium">
                    ❗ Sistem hukuki sorumluluk kabul etmez.
                  </p>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={acceptLegalWarning}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Kabul Ediyorum ve Devam Ediyorum
                </button>
                <button
                  onClick={rejectLegalWarning}
                  className="flex-1 bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 transition-colors font-medium"
                >
                  Kabul Etmiyorum
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Header - Sabit Üst */}
      <header className="bg-gray-800 border-b border-gray-700 h-16 flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
            <img 
              src="/logo.png" 
              alt="HukukKem Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-xl font-semibold text-white">HukukKem AI Chat</h1>
        </div>
        <div className="flex items-center space-x-4">
          {/* Kullanım Bilgisi */}
          <div className="text-sm text-gray-300">
            {isAdmin ? (
              <span className="flex items-center space-x-1">
                <span className="text-yellow-400">👑</span>
                <span>Admin - Sınırsız</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1">
                <span className="text-blue-400">📊</span>
                <span>Günlük: {dailyUsage}/{dailyLimit}</span>
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveView('chat')}
              className={`px-3 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
                activeView === 'chat' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Chat</span>
            </button>
            <button
              onClick={() => setActiveView('database')}
              className={`px-3 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
                activeView === 'database' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Veritabanı</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      {activeView === 'chat' ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Eski Sohbetler - Sabit */}
          <div className={`bg-gray-800 border-r border-gray-700 transition-all duration-300 flex-shrink-0 ${
            sidebarOpen ? 'w-80' : 'w-0'
          } overflow-hidden`} style={{ height: 'calc(100vh - 64px)' }}>
            <div className="p-4 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h2 className="text-lg font-semibold text-white">Eski Sohbetler</h2>
                <button
                  onClick={startNewConversation}
                  className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              {/* Gerçek eski sohbetler - Scroll */}
              <div className="flex-1 overflow-y-auto space-y-2 sidebar-scroll pr-2" style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#4B5563 #1F2937'
              }}>
                {loadingConversations ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    <span className="text-gray-400 text-sm ml-2">Yükleniyor...</span>
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="text-center text-gray-400 py-4">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                    <p className="text-sm">Henüz sohbet yok</p>
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => selectConversation(conv.id)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        conversationId === conv.id 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-700 hover:bg-gray-600 text-white'
                      }`}
                    >
                      <div className="font-medium text-sm truncate">{sanitizeAllPersonalData(conv.title)}</div>
                      <div className="flex items-center justify-between mt-1">
                        <div className={`text-xs ${
                          conversationId === conv.id ? 'text-blue-200' : 'text-gray-400'
                        }`}>
                          {new Date(conv.updated_at).toLocaleDateString('tr-TR')}
                        </div>
                        <div className={`text-xs ${
                          conversationId === conv.id ? 'text-blue-200' : 'text-gray-400'
                        }`}>
                          {conv.message_count} mesaj
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden relative" style={{ height: 'calc(100vh - 64px)' }}>
            {/* Background Logo */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
              <img 
                src="/background-logo.png" 
                alt="HukukKem Logo" 
                className="opacity-5 max-w-md max-h-md object-contain"
              />
            </div>
            {/* Chat Header - Sabit */}
            <div className="bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between flex-shrink-0 relative z-10">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <ChevronLeft className={`w-4 h-4 transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
                </button>
                <div>
                  <h3 className="text-white font-medium">
                    {conversationId ? 'Mevcut Konuşma' : 'Yeni Konuşma'}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {messages.length} mesaj
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={startNewConversation}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Yeni</span>
                </button>

                {conversationId && (
                  <button
                    onClick={deleteConversation}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Sil</span>
                  </button>
                )}
              </div>
            </div>

            {/* Messages - Sadece Bu Kısım Scroll */}
            <div className="flex-1 overflow-y-auto p-6 pb-24 space-y-4 messages-scroll relative z-10" style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#4B5563 #111827'
            }}>
              {messages.length === 0 ? (
                <div className="text-center text-gray-400 mt-20">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                  <h3 className="text-xl font-medium mb-2 text-white">HukukKem AI'a Hoş Geldiniz</h3>
                  <p className="text-gray-400">
                    Mahkeme kararları ve hukuki konularda sorularınızı sorabilirsiniz.
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-3xl ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                      <div className={`flex items-start space-x-3 ${
                        message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                      }`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          message.role === 'user' ? 'bg-blue-600' : 'bg-gray-600'
                        }`}>
                          {message.role === 'user' ? (
                            <User className="w-4 h-4 text-white" />
                          ) : (
                            <Bot className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <div className={`rounded-lg px-4 py-3 ${
                          message.role === 'user' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-700 text-white'
                        }`}>
                          <div className="text-sm whitespace-pre-wrap">
                            {sanitizeAllPersonalData(message.content)}
                          </div>
                          <div className={`text-xs mt-2 ${
                            message.role === 'user' ? 'text-blue-200' : 'text-gray-400'
                          }`}>
                            {message.timestamp.toLocaleTimeString('tr-TR')}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-3xl">
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-gray-700 rounded-lg px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                          <span className="text-sm text-gray-400">Yanıt hazırlanıyor...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input - Viewport'a Sabit Alt */}
            <div className="bg-gray-800 border-t border-gray-700 p-3 flex-shrink-0" style={{ height: '80px', minHeight: '80px', maxHeight: '80px', position: 'fixed', bottom: 0, left: sidebarOpen ? '320px' : '0', right: 0, zIndex: 60 }}>
              <div className="flex space-x-4 h-full">
                <div className="flex-1 h-full">
                  <textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Hukuki sorunuzu buraya yazın..."
                    className="w-full h-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    disabled={isLoading}
                  />
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  className="bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2 flex-shrink-0"
                  style={{ width: '80px' }}
                >
                  <Send className="w-3 h-3" />
                  <span className="text-sm">Gönder</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1">
          <DatabaseViewer />
        </div>
      )}
    </div>
  );
}

export default App; 