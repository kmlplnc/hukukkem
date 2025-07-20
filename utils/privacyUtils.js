// Privacy Utils - Disabled
// All functions now return the original text without any sanitization

function sanitizeNames(text) {
  return text;
}

function sanitizeEmails(text) {
  return text;
}

function sanitizePhoneNumbers(text) {
  return text;
}

function sanitizeTCKN(text) {
  return text;
}

function sanitizeAddresses(text) {
  return text;
}

function sanitizeAllPersonalData(text) {
  return text;
}

function sanitizeObject(obj) {
  return obj;
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