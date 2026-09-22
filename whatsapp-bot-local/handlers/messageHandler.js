const config = require('../config');
const { getOrCreateContact, saveMessage, getConversationHistory } = require('../database');
const { generateResponse } = require('../ai');

// Random delay to appear more human-like
function getRandomDelay() {
  return Math.floor(
    Math.random() * (config.maxReplyDelay - config.minReplyDelay) + config.minReplyDelay
  );
}

async function handleMessage(message) {
  // Ignore messages from groups or status updates
  if (message.from.includes('@g.us') || message.from === 'status@broadcast') {
    return;
  }

  // Ignore messages sent by ourselves
  if (message.fromMe) {
    return;
  }

  const phoneNumber = message.from.replace('@c.us', '');
  const messageContent = message.body;
  const contactName = message._data?.notifyName || null;

  console.log(`📨 Message from ${phoneNumber}: ${messageContent}`);

  // Check if bot is enabled
  if (!config.botEnabled) {
    console.log('⏸️ Bot is disabled, skipping reply');
    return;
  }

  try {
    // Get or create contact
    const contact = getOrCreateContact(phoneNumber, contactName);

    // Save incoming message
    saveMessage(contact.id, messageContent, 'user');

    // Get conversation history
    const history = getConversationHistory(contact.id, config.maxConversationHistory);

    // Generate AI response
    console.log('🤖 Generating AI response...');
    const aiResponse = await generateResponse(contact.id, history, messageContent);

    // Random delay before replying (anti-detection)
    const delay = getRandomDelay();
    console.log(`⏳ Waiting ${delay / 1000} seconds before replying...`);
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Send reply
    await message.reply(aiResponse);
    console.log(`✉️ Sent reply: ${aiResponse.substring(0, 100)}...`);

    // Save outgoing message
    saveMessage(contact.id, aiResponse, 'assistant');
  } catch (error) {
    console.error('❌ Error handling message:', error);
  }
}

module.exports = {
  handleMessage,
};
