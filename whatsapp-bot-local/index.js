const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const config = require('./config');
const { initDatabase, addKnowledge, getActiveKnowledge } = require('./database');
const { handleMessage } = require('./handlers/messageHandler');

// Validate configuration
if (!config.geminiApiKey) {
  console.error('❌ GEMINI_API_KEY is not set. Please add it to your .env file.');
  process.exit(1);
}

// Initialize database
initDatabase();

// Add some default knowledge if none exists
const knowledge = getActiveKnowledge();
if (knowledge.length === 0) {
  console.log('📚 Adding default knowledge base entries...');
  addKnowledge(
    'Business Hours',
    'We are open Monday to Friday from 9 AM to 6 PM. Closed on weekends and holidays.'
  );
  addKnowledge(
    'Delivery Information',
    'We deliver within the city limits. Standard delivery takes 2-3 business days. Express delivery (same day) is available for an additional fee.'
  );
  addKnowledge(
    'Payment Methods',
    'We accept cash on delivery, credit cards, and bank transfers.'
  );
}

// Create WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

// QR Code event
client.on('qr', (qr) => {
  console.log('\n📱 Scan this QR code with WhatsApp:\n');
  qrcode.generate(qr, { small: true });
});

// Ready event
client.on('ready', () => {
  console.log('\n✅ WhatsApp bot is ready!');
  console.log(`🤖 Bot enabled: ${config.botEnabled}`);
  console.log(`📝 Using model: ${config.model}`);
  console.log(`💬 Max conversation history: ${config.maxConversationHistory} messages`);
  console.log(`⏱️ Reply delay: ${config.minReplyDelay / 1000}s - ${config.maxReplyDelay / 1000}s`);
  console.log('\n👂 Listening for messages...\n');
});

// Authentication event
client.on('authenticated', () => {
  console.log('🔐 Authenticated successfully');
});

// Authentication failure event
client.on('auth_failure', (msg) => {
  console.error('❌ Authentication failed:', msg);
});

// Disconnected event
client.on('disconnected', (reason) => {
  console.log('📴 Client disconnected:', reason);
});

// Message event
client.on('message', handleMessage);

// Start the client
console.log('🚀 Starting WhatsApp bot...');
client.initialize();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down...');
  await client.destroy();
  process.exit(0);
});
