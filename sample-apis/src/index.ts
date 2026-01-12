import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// In-memory data store
let items: Array<{ id: number; name: string; value: number }> = [
  { id: 1, name: 'Item 1', value: 10 },
  { id: 2, name: 'Item 2', value: 20 },
];

let nextId = 3;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all items
app.get('/api/items', (req, res) => {
  res.json({ items });
});

// Get item by ID
app.get('/api/items/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = items.find((i) => i.id === id);
  
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  
  res.json(item);
});

// Create item
app.post('/api/items', (req, res) => {
  const { name, value } = req.body;
  
  if (!name || value === undefined) {
    return res.status(400).json({ error: 'Name and value are required' });
  }
  
  const newItem = {
    id: nextId++,
    name,
    value: Number(value),
  };
  
  items.push(newItem);
  res.status(201).json(newItem);
});

// Update item
app.put('/api/items/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const itemIndex = items.findIndex((i) => i.id === id);
  
  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }
  
  const { name, value } = req.body;
  if (name) items[itemIndex].name = name;
  if (value !== undefined) items[itemIndex].value = Number(value);
  
  res.json(items[itemIndex]);
});

// Delete item
app.delete('/api/items/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const itemIndex = items.findIndex((i) => i.id === id);
  
  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }
  
  items.splice(itemIndex, 1);
  res.status(204).send();
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Sample API Server',
    version: '0.1.0',
    endpoints: {
      health: '/health',
      items: '/api/items',
      itemById: '/api/items/:id',
    },
  });
});

app.listen(PORT, () => {
  console.log(`Sample API server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Items API: http://localhost:${PORT}/api/items`);
});
