// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');
const nodemailer = require('nodemailer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Initialize Resend client with error handling
const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Create a nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Replace the email verification endpoint
app.post('/api/auth/verify-email', async (req, res) => {
  // Define verification code outside try block so it's accessible in catch
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  const codeExpiry = new Date(Date.now() + 15 * 60000); // 15 minutes
  
  try {
    const { email } = req.body;
    
    // Check if it's a Columbia University email
    if (!email.endsWith('@columbia.edu')) {
      return res.status(400).json({ error: 'Only Columbia University emails are allowed' });
    }
    
    // Create or update user
    try {
      // Check if user exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();
      
      if (existingUser) {
        // Update existing user
        await supabase
          .from('users')
          .update({
            verification_code: verificationCode,
            code_expires: codeExpiry.toISOString()
          })
          .eq('email', email);
      } else {
        // Create new user
        await supabase
          .from('users')
          .insert([{
            email,
            verification_code: verificationCode,
            code_expires: codeExpiry.toISOString(),
            email_verified: false
          }]);
      }
    } catch (dbError) {
      // If user doesn't exist, fail gracefully and continue
      console.error('Database error:', dbError);
      // Continue anyway - we'll send email even if database fails
    }
    
    // Send email with Nodemailer
    try {
      const info = await transporter.sendMail({
        from: '"Columbia Marketplace" <columbiauniversitymarketplace@gmail.com>',
        to: email,
        subject: 'Columbia Marketplace Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #1c4587;">Columbia Marketplace</h1>
            <p>Here is your verification code:</p>
            <div style="background-color: #f0f0f0; padding: 10px 20px; font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 5px;">
              ${verificationCode}
            </div>
            <p>This code will expire in 15 minutes.</p>
          </div>
        `
      });
      
      console.log('Email sent successfully:', info.messageId);
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      // Continue anyway - we'll return the code for testing
    }
    
    // Always return success with code for testing
    res.status(200).json({ 
      message: 'Verification code sent to email',
      code: verificationCode // Remove in production
    });
  } catch (error) {
    console.error('Verification process error:', error);
    // Even if there's an error, return the code for testing
    res.status(200).json({ 
      message: 'Error in verification process, but code generated',
      code: verificationCode // Remove in production
    });
  }
});

// Verify code and authenticate user
app.post('/api/auth/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    
    console.log(`Verifying code: ${code} for email: ${email}`);
    
    // First check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (userError || !user) {
      console.log('User not found:', userError);
      return res.status(400).json({ error: 'User not found with this email' });
    }
    
    console.log('User found:', user.id);
    console.log('Stored code:', user.verification_code);
    console.log('Submitted code:', code);
    
    // Check if the codes match (convert both to strings to ensure consistent comparison)
    if (String(user.verification_code) !== String(code)) {
      console.log('Code mismatch');
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    
    // Check if code is expired
    if (new Date() > new Date(user.code_expires)) {
      console.log('Code expired');
      return res.status(400).json({ error: 'Verification code expired' });
    }
    
    // Update user as verified
    const { error: updateError } = await supabase
      .from('users')
      .update({
        email_verified: true,
        verification_code: null
      })
      .eq('id', user.id);
    
    if (updateError) {
      console.log('Update error:', updateError);
      throw updateError;
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    console.log('Verification successful');
    res.status(200).json({
      message: 'Email verified successfully',
      token,
      userId: user.id
    });
  } catch (error) {
    console.error('Code verification error:', error);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Products API
app.get('/api/products', async (req, res) => {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        *,
        seller:seller_id (email)
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const { name, details, price, condition, category, image_path } = req.body;
    
    const { data, error } = await supabase
      .from('products')
      .insert([{
        seller_id: req.user.userId,
        name,
        details,
        price,
        condition,
        category,
        image_path
      }])
      .select();
    
    if (error) throw error;
    
    res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const { data: product, error } = await supabase
      .from('products')
      .select(`
        *,
        seller:seller_id (email)
      `)
      .eq('id', req.params.id)
      .single();
    
    if (error) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Chat and messages API
app.post('/api/chats', authenticateToken, async (req, res) => {
  try {
    const { product_id, seller_id } = req.body;
    const buyer_id = req.user.userId;
    
    console.log(`Creating chat for product: ${product_id}, seller: ${seller_id}, buyer: ${buyer_id}`);
    
    if (!product_id) {
      return res.status(400).json({ error: 'Product ID is required' });
    }
    
    // If no seller_id provided, fetch it from the product
    let finalSellerId = seller_id;
    if (!finalSellerId) {
      console.log('No seller_id provided, fetching from product');
      const { data: product } = await supabase
        .from('products')
        .select('seller_id')
        .eq('id', product_id)
        .single();
      
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      
      finalSellerId = product.seller_id;
      console.log(`Fetched seller_id: ${finalSellerId} from product`);
    }
    
    // Don't allow chats with yourself
    if (finalSellerId === buyer_id) {
      return res.status(400).json({ error: 'Cannot create chat with yourself' });
    }
    
    // Check if chat already exists
    console.log(`Checking for existing chat with product: ${product_id}, buyer: ${buyer_id}, seller: ${finalSellerId}`);
    const { data: existingChat, error: chatQueryError } = await supabase
      .from('chats')
      .select('*')
      .eq('product_id', product_id)
      .eq('buyer_id', buyer_id)
      .eq('seller_id', finalSellerId)
      .single();
    
    if (chatQueryError) {
      console.log('No existing chat found, creating new one');
    } else if (existingChat) {
      console.log('Existing chat found:', existingChat.id);
      return res.status(200).json(existingChat);
    }
    
    // Create new chat
    console.log('Creating new chat');
    const { data, error } = await supabase
      .from('chats')
      .insert([{
        product_id,
        buyer_id,
        seller_id: finalSellerId
      }])
      .select();
    
    if (error) {
      console.error('Error creating chat:', error);
      throw error;
    }
    
    console.log('New chat created:', data[0].id);
    res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

app.get('/api/chats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const { data: chats, error } = await supabase
      .from('chats')
      .select(`
        *,
        product:product_id (*),
        buyer:buyer_id (email),
        seller:seller_id (email)
      `)
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json(chats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

app.get('/api/chats/:id', authenticateToken, async (req, res) => {
  try {
    const { data: chat, error } = await supabase
      .from('chats')
      .select(`
        *,
        product:product_id (*),
        buyer:buyer_id (email),
        seller:seller_id (email)
      `)
      .eq('id', req.params.id)
      .single();
    
    if (error) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    // Ensure user is authorized to access this chat
    if (chat.buyer_id !== req.user.userId && chat.seller_id !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized access to chat' });
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
    
    // Verify user has access to chat
    const { data: chat } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chatId)
      .single();
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    // Ensure user is authorized to access this chat
    if (chat.buyer_id !== req.user.userId && chat.seller_id !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized access to messages' });
    }
    
    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:sender_id (email)
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.post('/api/chats/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;
    const chat_id = req.params.id;
    const sender_id = req.user.userId;
    
    // Verify chat exists and user has access
    const { data: chat } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chat_id)
      .single();
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    // Ensure user is authorized to send message in this chat
    if (chat.buyer_id !== sender_id && chat.seller_id !== sender_id) {
      return res.status(403).json({ error: 'Unauthorized to send message' });
    }
    
    // Create new message
    const { data, error } = await supabase
      .from('messages')
      .insert([{
        chat_id,
        sender_id,
        message
      }])
      .select(`
        *,
        sender:sender_id (email)
      `);
    
    if (error) throw error;
    
    const newMessage = data[0];
    
    // Emit new message event to socket
    io.to(chat_id.toString()).emit('new_message', newMessage);
    
    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    console.log('Socket connection rejected: No auth token provided');
    return next(new Error('Authentication required'));
  }
  
  try {
    // Verify the JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    console.log(`Socket authenticated for user ID: ${decoded.userId}`);
    next();
  } catch (err) {
    console.log('Socket connection rejected: Invalid token');
    next(new Error('Invalid authentication token'));
  }
});

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id} for user ${socket.user.userId}`);
  
  // Handle joining a chat room
  socket.on('join_chat', (chatId) => {
    const roomName = `chat-${chatId}`;
    console.log(`User ${socket.user.userId} joining room: ${roomName}`);
    socket.join(roomName);
  });
  
  // Handle sending a message
  socket.on('send_message', async (data) => {
    try {
      const { chat_id, message } = data;
      
      if (!chat_id || !message) {
        socket.emit('error', 'Chat ID and message are required');
        return;
      }
      
      console.log(`Message received from user ${socket.user.userId} in chat ${chat_id}: ${message}`);
      
      // Verify the user is a participant in this chat
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .select('*')
        .eq('id', chat_id)
        .single();
      
      if (chatError || !chat) {
        socket.emit('error', 'Chat not found');
        return;
      }
      
      // Check if user is authorized to send messages in this chat
      if (chat.buyer_id !== socket.user.userId && chat.seller_id !== socket.user.userId) {
        socket.emit('error', 'Unauthorized to send messages in this chat');
        return;
      }
      
      // Insert the message into the database
      const { data: newMessage, error: messageError } = await supabase
        .from('messages')
        .insert([{
          chat_id: chat_id,
          sender_id: socket.user.userId,
          message: message
        }])
        .select('*, sender:sender_id (id, email)')
        .single();
      
      if (messageError) {
        console.error('Error saving message:', messageError);
        socket.emit('error', 'Failed to save message');
        return;
      }
      
      // Format the message timestamp
      const formattedMessage = {
        ...newMessage,
        created_at: new Date().toISOString() // Use current time for immediate display
      };
      
      // Broadcast the message to all clients in the room
      const roomName = `chat-${chat_id}`;
      console.log(`Broadcasting message to room: ${roomName}`);
      io.to(roomName).emit('new_message', formattedMessage);
    } catch (error) {
      console.error('Error processing message:', error);
      socket.emit('error', 'Server error processing message');
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 