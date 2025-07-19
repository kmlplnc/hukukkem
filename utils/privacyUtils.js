// KVKK Gereği Kişisel Veri Sansürleme Utility'leri

/**
 * Türkçe isimleri sansürler
 * @param {string} text - Sansürlenecek metin
 * @returns {string} - Sansürlenmiş metin
 */
function sanitizeNames(text) {
  if (!text || typeof text !== 'string') return text;

  // Türkçe isim kalıpları (regex patterns)
  const namePatterns = [
    // "Ahmet Yılmaz" gibi tam isimler
    /\b([A-ZÇĞIİÖŞÜ][a-zçğıiöşü]+)\s+([A-ZÇĞIİÖŞÜ][a-zçğıiöşü]+)\b/g,
    // "Ahmet Bey", "Ayşe Hanım" gibi hitap şekilleri
    /\b([A-ZÇĞIİÖŞÜ][a-zçğıiöşü]+)\s+(Bey|Hanım|Efendi)\b/g,
    // "Av. Ahmet Yılmaz" gibi unvanlı isimler
    /\b(Av\.|Dr\.|Prof\.|Doç\.|Yrd\. Doç\.)\s+([A-ZÇĞIİÖŞÜ][a-zçğıiöşü]+)\s+([A-ZÇĞIİÖŞÜ][a-zçğıiöşü]+)\b/g,
    // "Sayın Ahmet Yılmaz" gibi saygı ifadeleri
    /\b(Sayın|Değerli)\s+([A-ZÇĞIİÖŞÜ][a-zçğıiöşü]+)\s+([A-ZÇĞIİÖŞÜ][a-zçğıiöşü]+)\b/g,
    // "A. Yılmaz" gibi kısaltılmış isimler
    /\b([A-ZÇĞIİÖŞÜ])\.\s+([A-ZÇĞIİÖŞÜ][a-zçğıiöşü]+)\b/g
  ];

  let sanitizedText = text;

  // Her pattern için sansürleme uygula
  namePatterns.forEach((pattern, index) => {
    sanitizedText = sanitizedText.replace(pattern, (match, ...groups) => {
      switch (index) {
        case 0: // "Ahmet Yılmaz" -> "A*** Y****"
          return `${groups[0][0]}*** ${groups[1][0]}****`;
        case 1: // "Ahmet Bey" -> "A*** Bey"
          return `${groups[0][0]}*** ${groups[1]}`;
        case 2: // "Av. Ahmet Yılmaz" -> "Av. A*** Y****"
          return `${groups[0]} ${groups[1][0]}*** ${groups[2][0]}****`;
        case 3: // "Sayın Ahmet Yılmaz" -> "Sayın A*** Y****"
          return `${groups[0]} ${groups[1][0]}*** ${groups[2][0]}****`;
        case 4: // "A. Yılmaz" -> "A. Y****"
          return `${groups[0]}. ${groups[1][0]}****`;
        default:
          return match;
      }
    });
  });

  return sanitizedText;
}

/**
 * Email adreslerini sansürler
 * @param {string} text - Sansürlenecek metin
 * @returns {string} - Sansürlenmiş metin
 */
function sanitizeEmails(text) {
  if (!text || typeof text !== 'string') return text;

  // Email pattern'i
  const emailPattern = /\b([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;
  
  return text.replace(emailPattern, (match, username, domain) => {
    const maskedUsername = username.length > 2 
      ? username[0] + '*'.repeat(username.length - 2) + username[username.length - 1]
      : username[0] + '*';
    return `${maskedUsername}@${domain}`;
  });
}

/**
 * Telefon numaralarını sansürler
 * @param {string} text - Sansürlenecek metin
 * @returns {string} - Sansürlenmiş metin
 */
function sanitizePhoneNumbers(text) {
  if (!text || typeof text !== 'string') return text;

  // Türk telefon numarası pattern'leri
  const phonePatterns = [
    // 05XX XXX XX XX
    /\b(05\d{2})\s*(\d{3})\s*(\d{2})\s*(\d{2})\b/g,
    // +90 5XX XXX XX XX
    /\b(\+90)\s*(5\d{2})\s*(\d{3})\s*(\d{2})\s*(\d{2})\b/g,
    // 5XX XXX XX XX
    /\b(5\d{2})\s*(\d{3})\s*(\d{2})\s*(\d{2})\b/g
  ];

  let sanitizedText = text;

  phonePatterns.forEach((pattern, index) => {
    sanitizedText = sanitizedText.replace(pattern, (match, ...groups) => {
      switch (index) {
        case 0: // 05XX XXX XX XX -> 05XX *** ** XX
          return `${groups[0]} *** ** ${groups[3]}`;
        case 1: // +90 5XX XXX XX XX -> +90 5XX *** ** XX
          return `${groups[0]} ${groups[1]} *** ** ${groups[4]}`;
        case 2: // 5XX XXX XX XX -> 5XX *** ** XX
          return `${groups[0]} *** ** ${groups[3]}`;
        default:
          return match;
      }
    });
  });

  return sanitizedText;
}

/**
 * TC Kimlik numaralarını sansürler
 * @param {string} text - Sansürlenecek metin
 * @returns {string} - Sansürlenmiş metin
 */
function sanitizeTCKN(text) {
  if (!text || typeof text !== 'string') return text;

  // TC Kimlik No pattern'i (11 haneli)
  const tcknPattern = /\b(\d{3})(\d{3})(\d{3})(\d{2})\b/g;
  
  return text.replace(tcknPattern, (match, group1, group2, group3, group4) => {
    return `${group1} *** *** ${group4}`;
  });
}

/**
 * Adres bilgilerini sansürler
 * @param {string} text - Sansürlenecek metin
 * @returns {string} - Sansürlenmiş metin
 */
function sanitizeAddresses(text) {
  if (!text || typeof text !== 'string') return text;

  // Adres kalıpları
  const addressPatterns = [
    // Sokak/Cadde isimleri
    /\b([A-ZÇĞIİÖŞÜ][a-zçğıiöşü]+)\s+(Sokak|Sokağı|Cadde|Caddesi|Mahalle|Mahallesi)\b/g,
    // Kapı numaraları
    /\b(No:|No\s*:?\s*)(\d+)\b/g,
    // Posta kodları
    /\b(\d{5})\b/g
  ];

  let sanitizedText = text;

  addressPatterns.forEach((pattern, index) => {
    sanitizedText = sanitizedText.replace(pattern, (match, ...groups) => {
      switch (index) {
        case 0: // Sokak isimleri -> İlk harf + ***
          return `${groups[0][0]}*** ${groups[1]}`;
        case 1: // Kapı numaraları -> No: ***
          return `${groups[0]} ***`;
        case 2: // Posta kodları -> İlk 2 hane + ***
          return `${groups[0].substring(0, 2)}***`;
        default:
          return match;
      }
    });
  });

  return sanitizedText;
}

/**
 * Tüm kişisel verileri sansürler
 * @param {string} text - Sansürlenecek metin
 * @returns {string} - Tamamen sansürlenmiş metin
 */
function sanitizeAllPersonalData(text) {
  if (!text || typeof text !== 'string') return text;

  let sanitizedText = text;

  // Sırayla tüm sansürleme işlemlerini uygula
  sanitizedText = sanitizeNames(sanitizedText);
  sanitizedText = sanitizeEmails(sanitizedText);
  sanitizedText = sanitizePhoneNumbers(sanitizedText);
  sanitizedText = sanitizeTCKN(sanitizedText);
  sanitizedText = sanitizeAddresses(sanitizedText);

  return sanitizedText;
}

/**
 * Obje içindeki kişisel verileri sansürler
 * @param {Object} obj - Sansürlenecek obje
 * @returns {Object} - Sansürlenmiş obje
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = { ...obj };

  // Kişisel veri içerebilecek alan isimleri
  const personalDataFields = [
    'name', 'fullName', 'full_name', 'firstName', 'first_name', 
    'lastName', 'last_name', 'username', 'user_name',
    'email', 'phone', 'telephone', 'mobile', 'gsm',
    'address', 'adres', 'street', 'sokak', 'cadde',
    'tckn', 'tc', 'kimlik', 'identity', 'passport',
    'basvurucu', 'davaci', 'davali', 'müvekkil', 'avukat',
    'raportor', 'üye', 'hakim', 'savci'
  ];

  // Obje içindeki her alanı kontrol et
  Object.keys(sanitized).forEach(key => {
    const lowerKey = key.toLowerCase();
    
    // Kişisel veri alanı mı kontrol et
    const isPersonalData = personalDataFields.some(field => 
      lowerKey.includes(field) || field.includes(lowerKey)
    );

    if (isPersonalData && typeof sanitized[key] === 'string') {
      sanitized[key] = sanitizeAllPersonalData(sanitized[key]);
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      // Nested objeler için recursive çağrı
      sanitized[key] = sanitizeObject(sanitized[key]);
    }
  });

  return sanitized;
}

module.exports = {
  sanitizeNames,
  sanitizeEmails,
  sanitizePhoneNumbers,
  sanitizeTCKN,
  sanitizeAddresses,
  sanitizeAllPersonalData,
  sanitizeObject
}; 