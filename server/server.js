const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const JWT_SECRET = 'your_jwt_secret';
let db;

// Database setup
async function initDatabase() {
  db = await open({
    filename: './marketplace.db',
    driver: sqlite3.Database
  });

  // Create users table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create products table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      details TEXT,
      condition TEXT,
      material TEXT,
      price REAL NOT NULL,
      category TEXT,
      image_path TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (seller_id) REFERENCES users (id)
    )
  `);

  // Create chats table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      buyer_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products (id),
      FOREIGN KEY (buyer_id) REFERENCES users (id),
      FOREIGN KEY (seller_id) REFERENCES users (id)
    )
  `);

  // Create messages table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES chats (id),
      FOREIGN KEY (sender_id) REFERENCES users (id)
    )
  `);

  console.log('Database initialized');
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Auth routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existingUser) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert user
    const result = await db.run(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );
    
    const token = jwt.sign({ id: result.lastID, username }, JWT_SECRET, { expiresIn: '24h' });
    
    res.status(201).json({ 
      message: 'User registered successfully',
      token,
      user: { id: result.lastID, username, email }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;
    
    // Find user
    const user = await db.get(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [usernameOrEmail, usernameOrEmail]
    );
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Product routes
app.get('/api/products', async (req, res) => {
  try {
    const products = await db.all(`
      SELECT p.*, u.username as seller_name 
      FROM products p 
      JOIN users u ON p.seller_id = u.id
      ORDER BY p.created_at DESC
    `);
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await db.get(`
      SELECT p.*, u.username as seller_name, u.email as seller_email 
      FROM products p 
      JOIN users u ON p.seller_id = u.id 
      WHERE p.id = ?
    `, [req.params.id]);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const { name, details, condition, price, category, image_path } = req.body;
    
    const result = await db.run(
      `INSERT INTO products (seller_id, name, details, condition, price, category, image_path) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, name, details, condition, price, category, image_path]
    );
    
    const newProduct = await db.get('SELECT * FROM products WHERE id = ?', [result.lastID]);
    
    res.status(201).json({
      message: 'Product created successfully',
      product: newProduct
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Chat routes
app.post('/api/chats', authenticateToken, async (req, res) => {
  try {
    const { product_id } = req.body;
    const buyer_id = req.user.id;

    // Get product details including seller
    const product = await db.get('SELECT * FROM products WHERE id = ?', [product_id]);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if chat already exists
    let chat = await db.get(
      'SELECT * FROM chats WHERE product_id = ? AND buyer_id = ?',
      [product_id, buyer_id]
    );

    if (!chat) {
      // Create new chat
      const result = await db.run(
        'INSERT INTO chats (product_id, buyer_id, seller_id) VALUES (?, ?, ?)',
        [product_id, buyer_id, product.seller_id]
      );
      
      chat = await db.get('SELECT * FROM chats WHERE id = ?', [result.lastID]);
    }

    // Get full chat details
    const chatDetails = await db.get(`
      SELECT 
        c.*,
        p.name as product_name,
        p.price as product_price,
        p.image_path as product_image,
        buyer.username as buyer_name,
        seller.username as seller_name
      FROM chats c
      JOIN products p ON c.product_id = p.id
      JOIN users buyer ON c.buyer_id = buyer.id
      JOIN users seller ON c.seller_id = seller.id
      WHERE c.id = ?
    `, [chat.id]);

    res.json({ chat: chatDetails });
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

app.get('/api/chats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const chats = await db.all(`
      SELECT 
        c.*,
        p.name as product_name,
        p.price as product_price,
        p.image_path as product_image,
        buyer.username as buyer_name,
        seller.username as seller_name
      FROM chats c
      JOIN products p ON c.product_id = p.id
      JOIN users buyer ON c.buyer_id = buyer.id
      JOIN users seller ON c.seller_id = seller.id
      WHERE c.buyer_id = ? OR c.seller_id = ?
      ORDER BY c.created_at DESC
    `, [userId, userId]);

    res.json(chats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

app.get('/api/chats/:id', authenticateToken, async (req, res) => {
  try {
    const chatId = req.params.id;
    const userId = req.user.id;

    const chat = await db.get(`
      SELECT 
        c.*,
        p.name as product_name,
        p.price as product_price,
        p.image_path as product_image,
        buyer.username as buyer_name,
        seller.username as seller_name
      FROM chats c
      JOIN products p ON c.product_id = p.id
      JOIN users buyer ON c.buyer_id = buyer.id
      JOIN users seller ON c.seller_id = seller.id
      WHERE c.id = ? AND (c.buyer_id = ? OR c.seller_id = ?)
    `, [chatId, userId, userId]);

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json(chat);
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

app.get('/api/chats/:id/messages', authenticateToken, async (req, res) => {
  try {
    const chatId = req.params.id;
    const userId = req.user.id;

    // Verify user is part of this chat
    const chat = await db.get(
      'SELECT * FROM chats WHERE id = ? AND (buyer_id = ? OR seller_id = ?)',
      [chatId, userId, userId]
    );

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const messages = await db.all(`
      SELECT m.*, u.username as sender_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.chat_id = ?
      ORDER BY m.created_at ASC
    `, [chatId]);

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.post('/api/chats/:id/messages', authenticateToken, async (req, res) => {
  try {
    const chatId = req.params.id;
    const userId = req.user.id;
    const { message } = req.body;

    // Verify user is part of this chat
    const chat = await db.get(
      'SELECT * FROM chats WHERE id = ? AND (buyer_id = ? OR seller_id = ?)',
      [chatId, userId, userId]
    );

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const result = await db.run(
      'INSERT INTO messages (chat_id, sender_id, message) VALUES (?, ?, ?)',
      [chatId, userId, message]
    );

    const newMessage = await db.get(`
      SELECT m.*, u.username as sender_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `, [result.lastID]);

    // Emit message to all users in the chat
    io.to(`chat_${chatId}`).emit('new_message', newMessage);

    res.json({ data: newMessage });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Socket.IO setup
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication error'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.user.username);

  socket.on('join_chat', async (chatId) => {
    try {
      // Verify user is part of this chat
      const chat = await db.get(
        'SELECT * FROM chats WHERE id = ? AND (buyer_id = ? OR seller_id = ?)',
        [chatId, socket.user.id, socket.user.id]
      );

      if (!chat) {
        socket.emit('error', 'Access denied');
        return;
      }

      socket.join(`chat_${chatId}`);
      console.log(`User ${socket.user.username} joined chat: ${chatId}`);
    } catch (error) {
      console.error('Error joining chat:', error);
      socket.emit('error', 'Failed to join chat');
    }
  });

  socket.on('leave_chat', (chatId) => {
    socket.leave(`chat_${chatId}`);
    console.log(`User ${socket.user.username} left chat: ${chatId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.user.username);
  });
});

// Initialize and start server
async function start() {
  try {
    await initDatabase();
    
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
  }
}

start(); 