const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const bcrypt = require('bcrypt');

async function resetDatabase() {
  try {
    // Open database connection
    const db = await open({
      filename: './marketplace.db',
      driver: sqlite3.Database
    });

    // Drop existing tables if they exist
    await db.exec(`
      DROP TABLE IF EXISTS messages;
      DROP TABLE IF EXISTS chats;
      DROP TABLE IF EXISTS products;
      DROP TABLE IF EXISTS users;
    `);

    // Create users table
    await db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create products table
    await db.exec(`
      CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        details TEXT NOT NULL,
        price REAL NOT NULL,
        condition TEXT NOT NULL,
        category TEXT NOT NULL,
        image_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (seller_id) REFERENCES users (id)
      )
    `);

    // Create chats table
    await db.exec(`
      CREATE TABLE chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        buyer_id INTEGER NOT NULL,
        seller_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (id),
        FOREIGN KEY (buyer_id) REFERENCES users (id),
        FOREIGN KEY (seller_id) REFERENCES users (id)
      )
    `);

    // Create messages table
    await db.exec(`
      CREATE TABLE messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats (id),
        FOREIGN KEY (sender_id) REFERENCES users (id)
      )
    `);

    // Create test users
    const hashedPassword = await bcrypt.hash('password123', 10);
    await db.exec(`
      INSERT INTO users (username, email, password) VALUES 
      ('testuser1', 'test1@example.com', '${hashedPassword}'),
      ('testuser2', 'test2@example.com', '${hashedPassword}')
    `);

    console.log('Database reset successful!');
    await db.close();
  } catch (error) {
    console.error('Error resetting database:', error);
  }
}

resetDatabase(); 