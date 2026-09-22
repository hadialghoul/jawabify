const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'bot.db'));

// Initialize database schema
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT UNIQUE NOT NULL,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      sender TEXT NOT NULL CHECK(sender IN ('user', 'assistant')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contact_id) REFERENCES contacts(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL,
      customer_name TEXT NOT NULL,
      customer_address TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contact_id) REFERENCES contacts(id)
    );

    CREATE TABLE IF NOT EXISTS knowledge (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id);
    CREATE INDEX IF NOT EXISTS idx_orders_contact ON orders(contact_id);
  `);

  console.log('✅ Database initialized');
}

// Contact functions
function getOrCreateContact(phoneNumber, name = null) {
  let contact = db.prepare('SELECT * FROM contacts WHERE phone_number = ?').get(phoneNumber);
  
  if (!contact) {
    const result = db.prepare('INSERT INTO contacts (phone_number, name) VALUES (?, ?)').run(phoneNumber, name);
    contact = { id: result.lastInsertRowid, phone_number: phoneNumber, name };
    console.log(`📱 New contact created: ${phoneNumber}`);
  } else if (name && !contact.name) {
    db.prepare('UPDATE contacts SET name = ? WHERE id = ?').run(name, contact.id);
    contact.name = name;
  }
  
  return contact;
}

// Message functions
function saveMessage(contactId, content, sender) {
  const result = db.prepare(
    'INSERT INTO messages (contact_id, content, sender) VALUES (?, ?, ?)'
  ).run(contactId, content, sender);
  return result.lastInsertRowid;
}

function getConversationHistory(contactId, limit = 10) {
  return db.prepare(`
    SELECT content, sender, created_at 
    FROM messages 
    WHERE contact_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `).all(contactId, limit).reverse();
}

// Order functions
function createOrder(contactId, customerName, customerAddress, productName, quantity) {
  const result = db.prepare(`
    INSERT INTO orders (contact_id, customer_name, customer_address, product_name, quantity)
    VALUES (?, ?, ?, ?, ?)
  `).run(contactId, customerName, customerAddress, productName, quantity);
  
  console.log(`📦 Order created: ID ${result.lastInsertRowid}`);
  return result.lastInsertRowid;
}

function getRecentOrders(contactId, windowMs) {
  const cutoffTime = new Date(Date.now() - windowMs).toISOString();
  return db.prepare(`
    SELECT id, product_name, created_at 
    FROM orders 
    WHERE contact_id = ? AND created_at >= ?
    ORDER BY created_at DESC
  `).all(contactId, cutoffTime);
}

// Knowledge base functions
function getActiveKnowledge() {
  return db.prepare('SELECT title, content FROM knowledge WHERE is_active = 1').all();
}

function addKnowledge(title, content) {
  const result = db.prepare(
    'INSERT INTO knowledge (title, content) VALUES (?, ?)'
  ).run(title, content);
  return result.lastInsertRowid;
}

module.exports = {
  db,
  initDatabase,
  getOrCreateContact,
  saveMessage,
  getConversationHistory,
  createOrder,
  getRecentOrders,
  getActiveKnowledge,
  addKnowledge,
};
