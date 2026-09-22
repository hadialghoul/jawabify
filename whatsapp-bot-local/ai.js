const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('./config');
const { getActiveKnowledge } = require('./database');
const { orderToolDefinition, executeOrderTool } = require('./tools/orderTool');

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

const BASE_SYSTEM_PROMPT = `You are a WhatsApp assistant. Keep every reply to ONE short sentence. Never use more than 15 words unless the customer explicitly asks for details. No filler, no greetings, no over-explaining.

CRITICAL: NEVER make up, assume, or auto-fill ANY customer information (name, address, products). You MUST ask the customer for each detail. Do NOT use placeholder names like "John Doe". Only call create_order when the customer has explicitly provided ALL required details themselves.

## Stock Replies — NEVER State Quantity
When a customer asks about stock, availability, or how many you have, NEVER tell them the exact quantity. Only say "in stock" or "out of stock". Do not reveal inventory numbers like "12 left" or "only 3 available".

When processing orders: ask for name, address, and all items. Only create the order after the customer provides everything. Keep confirmations short. All orders include a $3.00 delivery fee. When confirming, show the total including delivery: "Order #1234 placed! Total: $XX.XX (includes $3 delivery)".`;

function buildSystemPrompt() {
  let prompt = BASE_SYSTEM_PROMPT;

  // Add knowledge base entries
  const knowledge = getActiveKnowledge();
  if (knowledge.length > 0) {
    prompt += '\n\n--- BUSINESS INFORMATION ---\n';
    prompt += 'Use this information to answer customer questions:\n\n';
    knowledge.forEach((entry) => {
      prompt += `### ${entry.title}\n${entry.content}\n\n`;
    });
  }

  return prompt;
}

function formatConversationHistory(history) {
  return history.map((msg) => ({
    role: msg.sender === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));
}

async function generateResponse(contactId, conversationHistory, userMessage) {
  const model = genAI.getGenerativeModel({
    model: config.model,
    tools: [{ functionDeclarations: [orderToolDefinition] }],
  });

  const systemPrompt = buildSystemPrompt();

  // Format history for Gemini
  const formattedHistory = formatConversationHistory(conversationHistory);

  // Start chat with history
  const chat = model.startChat({
    history: formattedHistory,
    systemInstruction: systemPrompt,
  });

  // Send the user message
  let result = await chat.sendMessage(userMessage);
  let response = result.response;

  // Check if the model wants to call a function
  const functionCall = response.functionCalls()?.[0];

  if (functionCall && functionCall.name === 'create_order') {
    console.log('🛠️ AI calling create_order tool:', JSON.stringify(functionCall.args));

    // Execute the order tool
    const toolResult = executeOrderTool(contactId, functionCall.args);

    // Send the tool result back to the model to get final response
    result = await chat.sendMessage([
      {
        functionResponse: {
          name: 'create_order',
          response: toolResult,
        },
      },
    ]);

    response = result.response;
  }

  return response.text();
}

module.exports = {
  generateResponse,
};
