# WhatsApp AI Chatbot (Local)

A standalone WhatsApp chatbot using `whatsapp-web.js` and Google Gemini AI, with order creation capabilities and conversation memory.

## Features

- 🤖 AI-powered responses using Google Gemini
- 📦 Order creation with tool calling
- 💾 SQLite database for persistence
- 💬 Conversation history (last 10 messages per contact)
- 📚 Knowledge base for business information
- ⏱️ Random reply delays (anti-detection)
- 🔄 Duplicate order prevention

## Setup

### 1. Install Dependencies

```bash
cd whatsapp-bot-local
npm install
```

### 2. Configure Environment

Copy the example environment file and add your Gemini API key:

```bash
cp .env.example .env
```

Edit `.env`:
```
GEMINI_API_KEY=your_gemini_api_key_here
BOT_ENABLED=true
```

Get your Gemini API key from: https://makersuite.google.com/app/apikey

### 3. Run the Bot

```bash
npm start
```

### 4. Scan QR Code

When the bot starts, a QR code will appear in the terminal. Scan it with WhatsApp on your phone:
1. Open WhatsApp on your phone
2. Go to Settings > Linked Devices
3. Tap "Link a Device"
4. Scan the QR code

## Configuration

Edit `config.js` to customize:

| Setting | Default | Description |
|---------|---------|-------------|
| `model` | `gemini-1.5-flash` | Gemini model to use |
| `maxConversationHistory` | `10` | Messages to include as context |
| `minReplyDelay` | `10000` | Minimum reply delay (ms) |
| `maxReplyDelay` | `40000` | Maximum reply delay (ms) |
| `duplicateOrderWindow` | `300000` | Duplicate order check window (5 min) |

## Database

The bot uses SQLite (`bot.db`) with these tables:

- **contacts** - Customer phone numbers and names
- **messages** - All conversation history
- **orders** - Created orders
- **knowledge** - Business information for AI context

## Knowledge Base

Add business information that the AI will use to answer questions:

```javascript
const { addKnowledge } = require('./database');

addKnowledge('Products', 'We sell pizzas, burgers, and drinks...');
addKnowledge('Pricing', 'Pizza: $10, Burger: $8, Drinks: $3...');
```

## Order Creation

When a customer wants to place an order, the AI will:

1. Collect customer name
2. Collect delivery address
3. Collect all items (product name + quantity)
4. Confirm details with customer
5. Create the order using the `create_order` tool

The order tool supports multiple items in a single order.

## Limitations

⚠️ **Important considerations:**

- Uses WhatsApp Web, not official API
- Requires keeping the Node.js process running 24/7
- WhatsApp may ban accounts that appear bot-like
- No official support - could break with WhatsApp updates
- Not recommended for production/commercial use

## File Structure

```
whatsapp-bot-local/
├── index.js           # Main entry point
├── config.js          # Configuration
├── database.js        # SQLite database setup
├── ai.js              # Gemini AI integration
├── handlers/
│   └── messageHandler.js   # Message processing
├── tools/
│   └── orderTool.js        # Order creation tool
├── .env               # Environment variables
├── bot.db             # SQLite database (created on first run)
└── package.json
```

## Troubleshooting

### QR code not appearing
- Make sure no other WhatsApp Web session is active
- Delete `.wwebjs_auth` folder and restart

### Bot not responding
- Check `BOT_ENABLED=true` in `.env`
- Check console for errors
- Verify Gemini API key is valid

### Authentication issues
- Delete `.wwebjs_auth` folder
- Restart and scan QR code again
