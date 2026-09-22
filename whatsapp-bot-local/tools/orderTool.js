const { createOrder, getRecentOrders } = require('../database');
const config = require('../config');

// Tool definition for Gemini function calling
const orderToolDefinition = {
  name: 'create_order',
  description: 'Create a new order when a customer confirms they want to place an order. Use this ONLY after collecting and confirming: customer name, delivery address, and all items they want to order.',
  parameters: {
    type: 'object',
    properties: {
      customer_name: {
        type: 'string',
        description: 'Full name of the customer placing the order',
      },
      customer_address: {
        type: 'string',
        description: 'Complete delivery address for the order',
      },
      items: {
        type: 'array',
        description: 'Array of all items in this order',
        items: {
          type: 'object',
          properties: {
            product_name: {
              type: 'string',
              description: 'Name of the product',
            },
            quantity: {
              type: 'number',
              description: 'Quantity of this product',
            },
          },
          required: ['product_name', 'quantity'],
        },
      },
    },
    required: ['customer_name', 'customer_address', 'items'],
  },
};

// Execute the order creation
function executeOrderTool(contactId, args) {
  const { customer_name, customer_address, items } = args;

  // Combine all items into a single product summary
  const productSummary = items
    .map((item) => `${item.quantity}x ${item.product_name}`)
    .join(', ');

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  // Check for duplicate orders
  const recentOrders = getRecentOrders(contactId, config.duplicateOrderWindow);

  if (recentOrders.length > 0) {
    const normalizeProducts = (str) =>
      str
        .toLowerCase()
        .replace(/\d+x\s*/g, '')
        .split(',')
        .map((s) => s.trim())
        .sort()
        .join(',');

    const existingOrder = recentOrders.find(
      (order) => normalizeProducts(order.product_name) === normalizeProducts(productSummary)
    );

    if (existingOrder) {
      console.log(`⚠️ Duplicate order detected, returning existing: ${existingOrder.id}`);
      return {
        success: true,
        orderId: existingOrder.id,
        isDuplicate: true,
        message: `This order already exists (Order ID: ${existingOrder.id}). The customer already placed this order recently. Items: ${productSummary}. DO NOT say you're creating a new order - just acknowledge their existing order or answer their question.`,
      };
    }
  }

  // Create the order
  const orderId = createOrder(
    contactId,
    customer_name,
    customer_address,
    productSummary,
    totalQuantity
  );

  const itemsSummary = items.map((i) => `${i.quantity}x ${i.product_name}`).join(', ');

  return {
    success: true,
    orderId,
    isDuplicate: false,
    message: `Order created successfully! Order ID: ${orderId}. Items: ${itemsSummary} for ${customer_name} at ${customer_address}.`,
  };
}

module.exports = {
  orderToolDefinition,
  executeOrderTool,
};
