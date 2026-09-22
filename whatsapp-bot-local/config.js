require('dotenv').config();

module.exports = {
  geminiApiKey: process.env.GEMINI_API_KEY,
  botEnabled: process.env.BOT_ENABLED === 'true',
  
  // AI settings
  model: 'gemini-1.5-flash',
  maxConversationHistory: 10,
  
  // Anti-detection delays (milliseconds)
  minReplyDelay: 10000, // 10 seconds
  maxReplyDelay: 40000, // 40 seconds
  
  // Order duplicate detection window (milliseconds)
  duplicateOrderWindow: 5 * 60 * 1000, // 5 minutes
};
