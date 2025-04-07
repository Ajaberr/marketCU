require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Define product categories for consistency
const PRODUCT_CATEGORIES = [
  "Laptops & Accessories",
  "Textbooks & Study Guides",
  "Dorm & Apartment Essentials",
  "Bicycles & Scooters",
  "Electronics & Gadgets",
  "Furniture & Storage",
  "Clothing & Fashion",
  "School Supplies"
];

async function resetDatabase() {
  try {
    console.log('Starting database reset...');

    // First, make sure tables exist - run this SQL in Supabase SQL Editor if you haven't already
    console.log('Checking if tables exist and creating them if needed...');
    try {
      await supabase.rpc('reset_tables', {}, { 
        count: 'exact'
      });
    } catch (err) {
      console.log('Could not reset tables via RPC, make sure to create them manually if needed');
      console.log('Run this SQL in the Supabase SQL Editor:');
      console.log(`
-- Create tables in this order:
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  verification_code TEXT,
  code_expires TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  details TEXT NOT NULL,
  price DECIMAL NOT NULL,
  condition TEXT NOT NULL,
  category TEXT NOT NULL,
  image_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  buyer_id UUID NOT NULL REFERENCES users(id),
  seller_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id),
  sender_id UUID NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
      `);
    }

    // Delete all data from tables in reverse order of dependencies
    console.log('Deleting existing data...');
    
    try {
      // Messages table
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000');
      
      if (messagesError) {
        console.error('Error deleting messages:', messagesError);
      } else {
        console.log('Messages deleted');
      }
      
      // Chats table
      const { error: chatsError } = await supabase
        .from('chats')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000');
      
      if (chatsError) {
        console.error('Error deleting chats:', chatsError);
      } else {
        console.log('Chats deleted');
      }
      
      // Products table
      const { error: productsError } = await supabase
        .from('products')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000');
      
      if (productsError) {
        console.error('Error deleting products:', productsError);
      } else {
        console.log('Products deleted');
      }
      
      // Users table
      const { error: usersError } = await supabase
        .from('users')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000');
      
      if (usersError) {
        console.error('Error deleting users:', usersError);
      } else {
        console.log('Users deleted');
      }
    } catch (error) {
      console.error('Error during delete operations:', error);
    }

    console.log('Creating test users...');
    // Create test users with Columbia emails only
    const { data: users, error: userError } = await supabase
      .from('users')
      .insert([
        {
          email: 'test1@columbia.edu',
          email_verified: true,
          verification_code: null,
          code_expires: null
        },
        {
          email: 'test2@columbia.edu',
          email_verified: true,
          verification_code: null,
          code_expires: null
        }
      ])
      .select();

    if (userError) {
      console.error('Error creating test users:', userError);
      throw userError;
    }

    console.log('Test users created:', users.map(u => u.email).join(', '));

    // Create sample products (one for each category)
    if (users && users.length >= 2) {
      console.log('Creating sample products (one for each category)...');
      
      const sampleProducts = PRODUCT_CATEGORIES.map((category, index) => {
        // Alternate between the two test users as sellers
        const sellerId = users[index % 2].id;
        
        return {
          name: `Sample ${category}`,
          details: `This is a sample product in the ${category} category.`,
          price: (50 + index * 25),
          condition: index % 2 === 0 ? 'New' : 'Good condition',
          category: category,
          seller_id: sellerId,
          image_path: `https://picsum.photos/id/${(index + 1) * 10}/300/200`
        };
      });
      
      const { data: products, error: productError } = await supabase
        .from('products')
        .insert(sampleProducts)
        .select();
        
      if (productError) {
        console.error('Error creating sample products:', productError);
      } else {
        console.log(`Created ${products.length} sample products`);
      }
    }

    // Create JWT tokens for testing
    const user1Token = jwt.sign(
      { userId: users[0].id, email: users[0].email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const user2Token = jwt.sign(
      { userId: users[1].id, email: users[1].email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('\nTest User Tokens (for manual testing):\n');
    console.log(`User 1 (${users[0].email}): ${user1Token}`);
    console.log(`User 2 (${users[1].email}): ${user2Token}`);

    console.log('\nDatabase reset complete!');
    console.log('You can use these test users and tokens for testing your application.');
    console.log('Send a verification email to authenticate as these users through the normal flow.');

  } catch (error) {
    console.error('Error resetting database:', error);
  }
}

resetDatabase(); 