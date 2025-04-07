# Columbia University Marketplace

A platform for Columbia University students to buy and sell items within the university community.

## Setup Instructions

### Prerequisites
- Node.js v14 or higher
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/columbia-marketplace.git
cd columbia-marketplace
```

2. Install dependencies for frontend
```bash
npm install
```

3. Install dependencies for backend
```bash
cd server
npm install
cd ..
```

### Environment Variables

This project uses environment variables to manage sensitive information and configuration. You need to create `.env` files for both frontend and backend.

#### Frontend Environment (.env)

Create a `.env` file in the root directory:

```
VITE_API_BASE_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
```

#### Backend Environment (server/.env)

Create a `.env` file in the server directory:

```
# Supabase Configuration
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-supabase-service-key

# Security
JWT_SECRET=your-jwt-secret-key

# Email Service
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-email-app-password
RESEND_API_KEY=your-resend-api-key

# Server Configuration
PORT=3001
```

### Running the Application

1. Start the backend server
```bash
cd server
npm run dev
```

2. Start the frontend development server
```bash
# In another terminal, from the project root
npm run dev
```

3. Access the application
Open your browser and navigate to `http://localhost:5173`

## Security Note

- Never commit your `.env` files to version control
- The `.env.example` files are provided as templates
- Always use environment variables for sensitive information
