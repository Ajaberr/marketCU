import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import '../App.css';

function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="home-page">
      <div className="hero-section">
        <h1>Welcome to Columbia Marketplace</h1>
        <p>A dedicated platform for Columbia University students to buy and sell items within the community</p>
        <div className="cta-buttons">
          <Link to="/market" className="cta-button">Browse Items</Link>
          <Link to="/create-product" className="cta-button cta-secondary">Sell Something</Link>
        </div>
      </div>

      <div className="features-section">
        <h2>How It Works</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🔍</div>
            <h3>Browse</h3>
            <p>Explore items posted by Columbia students. Filter by categories, price, and condition.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">💬</div>
            <h3>Connect</h3>
            <p>Chat with sellers directly through our secure messaging system.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🛒</div>
            <h3>Buy & Sell</h3>
            <p>List your items for sale or purchase items from fellow students.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>Secure</h3>
            <p>Columbia email verification ensures you're dealing with community members.</p>
          </div>
        </div>
      </div>

      <div className="get-started-section">
        <h2>Get Started Today</h2>
        <p>Join the Columbia Marketplace community and find great deals on textbooks, furniture, electronics, and more!</p>
        <Link to="/market" className="cta-button">Explore the Marketplace</Link>
      </div>
    </div>
  );
}

export default HomePage; 