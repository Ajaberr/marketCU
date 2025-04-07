import { useState, useContext, createContext, useEffect, useRef, Fragment } from 'react';
import { BrowserRouter as Router, Route, Routes, Link, Navigate, useParams, useNavigate } from 'react-router-dom';
import './App.css';
import './Chat.css';
import logo from './assets/Collegiate Logo.png';
import axios from 'axios';
import { io } from 'socket.io-client';
import LoginPage from './components/LoginPage';
import HomePage from './components/HomePage';

// API Base URL Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

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

// Create Auth Context
const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    // Check if we have a token in localStorage
    const storedToken = localStorage.getItem('token');
    
    // Support both old and new user data formats
    let storedUser;
    try {
      storedUser = JSON.parse(localStorage.getItem('user'));
    } catch (e) {
      // Ignore parsing errors
    }
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setCurrentUser(storedUser);
    }
    
    setLoading(false);
  }, []);

  // Keeping the old login methods for backward compatibility
  const login = async (usernameOrEmail, password) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/login`, {
        usernameOrEmail,
        password
      });
      
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      setToken(token);
      setCurrentUser(user);
      
      return user;
    } catch (error) {
      console.error('Login error:', error.response?.data || error.message);
      throw error;
    }
  };

  const register = async (username, email, password) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/register`, {
        username,
        email,
        password
      });
      
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      setToken(token);
      setCurrentUser(user);
      
      return user;
    } catch (error) {
      console.error('Registration error:', error.response?.data || error.message);
      throw error;
    }
  };

  // Method for email verification login
  const verifyEmailLogin = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    
    setToken(token);
    setCurrentUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setCurrentUser(null);
  };

  // Create axios instance with auth headers
  const authAxios = axios.create({
    baseURL: API_BASE_URL
  });
  
  authAxios.interceptors.request.use(
    (config) => {
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  const value = {
    currentUser,
    login,
    register,
    verifyEmailLogin,
    logout,
    authAxios,
    isAuthenticated: !!currentUser
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function HeadBar() {
  const { currentUser, logout, isAuthenticated } = useAuth();
  
  return (
    <div className="header">
      <div className="leftside">
        <img src={logo} alt="Collegiate Logo" className="logo" />
        <Link to="/home" className="nav-link">HOME</Link>
        <Link to="/market" className="nav-link">MARKET</Link>
        {isAuthenticated && <Link to="/create-product" className="nav-link">SELL ITEM</Link>}
        {isAuthenticated && <Link to="/chats" className="nav-link">MESSAGES</Link>}
      </div>
      <div className="rightside">
        {!isAuthenticated ? (
          <Link to="/" className="sign-in-btn">Sign in</Link>
        ) : (
          <>
            <span className="username">{currentUser?.email || 'User'}</span>
            <button onClick={logout} className="sign-in-btn">Logout</button>
          </>
        )}
        <span className="profile-icon">👤</span>
      </div>
    </div>
  );
}

function SignInPage() {
  const { verifyEmailLogin, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [codeSent, setCodeSent] = useState(false);
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/home');
    }
  }, [isAuthenticated, navigate]);

  const handleSendCode = async (e) => {
    e.preventDefault();
    
    if (!email.endsWith('@columbia.edu')) {
      setError('Only Columbia University emails are allowed');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/verify-email`, { email });
      setCodeSent(true);
      
      // For development, auto-fill the code if returned in response
      if (response.data.code) {
        setVerificationCode(response.data.code);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send verification code');
      console.error('Email verification error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/verify-code`, { 
        email, 
        code: verificationCode 
      });
      
      // Use the authContext method instead of manually setting localStorage
      verifyEmailLogin(response.data.token, { id: response.data.userId, email });
      
      // Navigate to home
      navigate('/home');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired verification code');
      console.error('Code verification error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='body'>
      <div className="sign-in-container">
        <h1 className="sign-in-title">
          Columbia Marketplace
        </h1>

        <div className="form-container">
          {!codeSent ? (
            <form onSubmit={handleSendCode}>
              <p className="required-field-note">* indicates required field</p>
              
              {error && <div className="auth-error">{error}</div>}

              <div className="form-field">
                <label htmlFor="email" className="sr-only">Columbia Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="* Columbia Email (@columbia.edu)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="form-input"
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="sign-in-button" disabled={loading}>
                  {loading ? 'Sending...' : 'Send Verification Code'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode}>
              <p className="required-field-note">A verification code has been sent to your email</p>
              
              {error && <div className="auth-error">{error}</div>}

              <div className="form-field">
                <label htmlFor="verificationCode" className="sr-only">Verification Code</label>
                <input
                  type="text"
                  id="verificationCode"
                  name="verificationCode"
                  placeholder="* Verification Code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  required
                  className="form-input"
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="sign-in-button" disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify Code'}
                </button>
              </div>
              
              <div className="auth-toggle">
                <button 
                  type="button" 
                  className="toggle-auth-btn"
                  onClick={() => setCodeSent(false)}
                >
                  Try a different email
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function MarketPage() {
  const [priceRange, setPriceRange] = useState([10, 100000]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [sortBy, setSortBy] = useState('featured');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [maxPrice, setMaxPrice] = useState(1000); // Default max price
  const [searchQuery, setSearchQuery] = useState(''); // Add search query state

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/products`);
        // Sort products by creation date, newest first
        const sortedProducts = response.data.sort((a, b) => 
          new Date(b.created_at) - new Date(a.created_at)
        );
        setProducts(sortedProducts);

        // Find the highest price among products
        const highestPrice = Math.max(...sortedProducts.map(p => p.price));
        setMaxPrice(Math.ceil(highestPrice)); // Round up to nearest integer
        setPriceRange([0, Math.ceil(highestPrice)]); // Update price range
      } catch (err) {
        console.error('Error fetching products:', err);
        setError('Failed to load products. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
    const interval = setInterval(fetchProducts, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filter functions
  const handleCategoryChange = (category) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter(c => c !== category));
    } else {
      setSelectedCategories([...selectedCategories, category]);
    }
  };

  const handlePriceChange = (event) => {
    setPriceRange([Number(event.target.value), priceRange[1]]);
  };

  const handleMaxPriceChange = (event) => {
    setPriceRange([priceRange[0], Number(event.target.value)]);
  };

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };

  // Filter products based on selected filters and search
  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(product.category);
    const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];
    const matchesSearch = searchQuery === '' || 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesPrice && matchesSearch;
  });

  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'price-asc') return a.price - b.price;
    if (sortBy === 'price-desc') return b.price - a.price;
    return 0; // Default: featured
  });

  if (loading) return (
    <div className="market-page">
      <div className="loading">Loading products...</div>
    </div>
  );

  if (error) return (
    <div className="market-page">
      <div className="error">{error}</div>
    </div>
  );

  // Render the market page with products
  return (
    <div className="market-page">
      <div className="market-container">
        <div className="market-header">
          <div className="market-title">
            <h1>Columbia Marketplace</h1>
            <p>The ultimate every day collection with the cheapest and best student utilities.</p>
          </div>
          
          <div className="search-container">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="search-input"
            />
          </div>
        </div>

        <div className="market-content">
          <div className="filters-sidebar">
            <div className="product-count">
              <span>{filteredProducts.length} products</span>
            </div>
            
            <div className="filter-section">
              <div className="filter-header">
                <h3>Price</h3>
              </div>
              <div className="price-range">
                <div className="range-slider">
                  <input
                    type="range"
                    min="0"
                    max={maxPrice}
                    value={priceRange[0]}
                    onChange={handlePriceChange}
                    className="slider"
                  />
                </div>
                <div className="price-inputs">
                  <div>From ${priceRange[0]}</div>
                  <div>to ${priceRange[1]}</div>
                </div>
              </div>
            </div>
            
            <div className="filter-section">
              <div className="filter-header">
                <h3>Categories</h3>
              </div>
              <div className="gender-options">
                <div className="filter-option">
                  <input
                    type="checkbox"
                    id="laptops"
                    checked={selectedCategories.includes("Laptops & Accessories")}
                    onChange={() => handleCategoryChange("Laptops & Accessories")}
                  />
                  <label htmlFor="laptops">Laptops & Accessories</label>
                </div>
                <div className="filter-option">
                  <input
                    type="checkbox"
                    id="textbooks"
                    checked={selectedCategories.includes("Textbooks & Study Guides")}
                    onChange={() => handleCategoryChange("Textbooks & Study Guides")}
                  />
                  <label htmlFor="textbooks">Textbooks & Study Guides</label>
                </div>
                <div className="filter-option">
                  <input
                    type="checkbox"
                    id="dorm"
                    checked={selectedCategories.includes("Dorm & Apartment Essentials")}
                    onChange={() => handleCategoryChange("Dorm & Apartment Essentials")}
                  />
                  <label htmlFor="dorm">Dorm & Apartment Essentials</label>
                </div>
                <div className="filter-option">
                  <input
                    type="checkbox"
                    id="bicycles"
                    checked={selectedCategories.includes("Bicycles & Scooters")}
                    onChange={() => handleCategoryChange("Bicycles & Scooters")}
                  />
                  <label htmlFor="bicycles">Bicycles & Scooters</label>
                </div>
                <div className="filter-option">
                  <input
                    type="checkbox"
                    id="electronics"
                    checked={selectedCategories.includes("Electronics & Gadgets")}
                    onChange={() => handleCategoryChange("Electronics & Gadgets")}
                  />
                  <label htmlFor="electronics">Electronics & Gadgets</label>
                </div>
                <div className="filter-option">
                  <input
                    type="checkbox"
                    id="furniture"
                    checked={selectedCategories.includes("Furniture & Storage")}
                    onChange={() => handleCategoryChange("Furniture & Storage")}
                  />
                  <label htmlFor="furniture">Furniture & Storage</label>
                </div>
                <div className="filter-option">
                  <input
                    type="checkbox"
                    id="clothing"
                    checked={selectedCategories.includes("Clothing & Fashion")}
                    onChange={() => handleCategoryChange("Clothing & Fashion")}
                  />
                  <label htmlFor="clothing">Clothing & Fashion</label>
                </div>
                <div className="filter-option">
                  <input
                    type="checkbox"
                    id="supplies"
                    checked={selectedCategories.includes("School Supplies")}
                    onChange={() => handleCategoryChange("School Supplies")}
                  />
                  <label htmlFor="supplies">School Supplies</label>
                </div>
              </div>
            </div>
          </div>
          
          <div className="products-grid">
            <div className="sort-options">
              <label>Sort by</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="featured">Featured</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </div>
            
            <div className="products-list">
              {sortedProducts.length > 0 ? (
                sortedProducts.map((product) => (
                  <Link key={product.id} to={`/product/${product.id}`} className="product-card-link">
                    <div className="product-card">
                      <div className="product-image">
                        <img src={product.image_path || "/api/placeholder/300/300"} alt={product.name} />
                      </div>
                      <div className="product-details">
                        <div className="product-title">{product.name}</div>
                        <div className="product-specs">
                          <div>{product.details}</div>
                          <div>{product.category}</div>
                          <div>{product.condition}</div>
                        </div>
                        <div className="product-price">${product.price.toLocaleString()}</div>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="no-products">
                  <p>No products found matching your criteria.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { authAxios, currentUser, isAuthenticated } = useAuth();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        console.log(`Fetching product details for ID: ${id}`);
        const response = await axios.get(`${API_BASE_URL}/products/${id}`);
        setProduct(response.data);
        console.log("Product data received:", response.data);
      } catch (err) {
        console.error('Error fetching product details:', err);
        setError('Failed to load product details. Product may not exist.');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const handleContactSeller = async () => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    try {
      console.log(`Creating chat for product: ${product.id} with seller: ${product.seller_id}`);
      
      // Create or get chat for this product
      const response = await authAxios.post('/chats', {
        product_id: product.id,
        seller_id: product.seller_id
      });
      
      console.log("Chat created/retrieved:", response.data);
      
      // Navigate to the chat
      navigate(`/chats/${response.data.id}`);
    } catch (err) {
      console.error('Error creating chat:', err.response?.data || err.message);
      alert('Failed to contact seller. Please try again.');
    }
  };

  if (loading) return (
    <div className="product-detail-page">
      <div className="loading">Loading product details...</div>
    </div>
  );

  if (error || !product) return (
    <div className="product-detail-page">
      <div className="error">{error || 'Product not found'}</div>
    </div>
  );

  const isOwner = isAuthenticated && currentUser.id === product.seller_id;

  return (
    <div className="product-detail-page">
      <div className="product-detail-container">
        <div className="product-detail-left">
          <img 
            src={product.image_path || "/api/placeholder/600/400"} 
            alt={product.name} 
            className="product-detail-image"
          />
        </div>
        <div className="product-detail-right">
          <h1 className="product-detail-title">{product.name}</h1>
          <div className="product-detail-price">${product.price.toLocaleString()}</div>
          
          <div className="product-detail-seller">
            <p>Seller: {product.seller?.email || 'Unknown'}</p>
          </div>
          
          <div className="product-detail-info">
            <p><strong>Category:</strong> {product.category}</p>
            <p><strong>Condition:</strong> {product.condition}</p>
            {product.material && <p><strong>Material:</strong> {product.material}</p>}
          </div>
          
          <div className="product-detail-description">
            <h3>Details</h3>
            <p>{product.details}</p>
          </div>
          
          {isOwner ? (
            <div className="owner-message">
              <p>This is your listing</p>
            </div>
          ) : isAuthenticated ? (
            <button onClick={handleContactSeller} className="contact-seller-button">
              Contact Seller
            </button>
          ) : (
            <Link to="/" className="contact-seller-button">
              Sign in to contact seller
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateProductPage() {
  const { authAxios } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    details: '',
    condition: 'New',
    price: '',
    category: '',
    image_path: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageError, setImageError] = useState('');
  const [previewImage, setPreviewImage] = useState('');
  const [uploadMethod, setUploadMethod] = useState('url'); // 'url' or 'file'

  const validateImageUrl = async (url) => {
    try {
      const response = await fetch(url);
      const contentType = response.headers.get('content-type');
      return contentType.startsWith('image/');
    } catch {
      return false;
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'price' ? (value === '' ? '' : parseFloat(value)) : value
    });

    // Clear image error when user starts typing new URL
    if (name === 'image_path') {
      setImageError('');
      if (value) {
        setPreviewImage(value);
      } else {
        setPreviewImage('');
      }
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setImageError('Please upload a valid image file');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Image = event.target.result;
        setPreviewImage(base64Image);
        setFormData({
          ...formData,
          image_path: base64Image
        });
        setImageError('');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setImageError('');

    try {
      // Validate image URL if provided and using URL method
      if (uploadMethod === 'url' && formData.image_path) {
        const isValidImage = await validateImageUrl(formData.image_path);
        if (!isValidImage) {
          setImageError('Please provide a valid image URL');
          setIsSubmitting(false);
          return;
        }
      }

      const response = await authAxios.post('/products', formData);
      alert('Product created successfully!');
      navigate(`/product/${response.data.product.id}`);
    } catch (error) {
      console.error('Error creating product:', error);
      alert('Failed to create product. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="create-product-page">
      <div className="create-product-container">
        <div className="columbia-header">
          <div className="columbia-logo">
            <img src={logo} alt="Columbia University" />
          </div>
          <h1>Student Marketplace</h1>
        </div>
        
        <form onSubmit={handleSubmit} className="create-product-form">
          <div className="form-group">
            <label htmlFor="name">Product Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="e.g., MacBook Pro 2023"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="price">Price ($)</label>
            <input
              type="number"
              id="price"
              name="price"
              value={formData.price}
              onChange={handleChange}
              required
              min="0.01"
              step="0.01"
              placeholder="e.g., 999.99"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="condition">Condition</label>
            <select
              id="condition"
              name="condition"
              value={formData.condition}
              onChange={handleChange}
              required
            >
              <option value="">Select</option>
              <option value="New">New</option>
              <option value="Like new">Like new</option>
              <option value="Good condition">Good condition</option>
              <option value="Fair condition">Fair condition</option>
              <option value="Poor condition">Poor condition</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
            >
              <option value="">Select</option>
              <option value="Laptops & Accessories">Laptops & Accessories</option>
              <option value="Textbooks & Study Guides">Textbooks & Study Guides</option>
              <option value="Dorm & Apartment Essentials">Dorm & Apartment Essentials</option>
              <option value="Bicycles & Scooters">Bicycles & Scooters</option>
              <option value="Electronics & Gadgets">Electronics & Gadgets</option>
              <option value="Furniture & Storage">Furniture & Storage</option>
              <option value="Clothing & Fashion">Clothing & Fashion</option>
              <option value="School Supplies">School Supplies</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="details">Details</label>
            <textarea
              id="details"
              name="details"
              value={formData.details}
              onChange={handleChange}
              required
              placeholder="Describe your item, including features and any defects"
            />
          </div>
          
          <div className="form-group">
            <label>Product Image</label>
            
            <div className="upload-options">
              <button 
                type="button" 
                className={`upload-option-btn ${uploadMethod === 'url' ? 'active' : ''}`}
                onClick={() => setUploadMethod('url')}
              >
                Use URL
              </button>
              <button 
                type="button" 
                className={`upload-option-btn ${uploadMethod === 'file' ? 'active' : ''}`}
                onClick={() => setUploadMethod('file')}
              >
                Upload File
              </button>
            </div>
            
            {uploadMethod === 'url' ? (
              <input
                type="text"
                id="image_path"
                name="image_path"
                value={formData.image_path}
                onChange={handleChange}
                placeholder="Enter an image URL"
              />
            ) : (
              <div className="file-upload-container">
                <input
                  type="file"
                  id="image_file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="file-upload-input"
                />
                <label htmlFor="image_file" className="file-upload-label">
                  Choose a file
                </label>
              </div>
            )}
            
            {imageError && <div className="error-message">{imageError}</div>}
            
            {previewImage ? (
              <div className="image-preview">
                <img src={previewImage} alt="Product preview" />
              </div>
            ) : (
              <div className="image-preview empty">
                <span>No Image preview available</span>
              </div>
            )}
          </div>
          
          <button 
            type="submit" 
            className="create-product-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'List Item for Sale'}
          </button>
        </form>
      </div>
    </div>
  );
}

function ChatsListPage() {
  const { authAxios, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    const fetchChats = async () => {
      try {
        console.log('Fetching chats for user');
        const response = await authAxios.get('/chats');
        console.log('Chats received:', response.data);
        setChats(response.data);
      } catch (err) {
        console.error('Error fetching chats:', err.response?.data || err.message);
        alert('Failed to load chats. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchChats();
  }, [authAxios, isAuthenticated, navigate]);

  if (loading) return (
    <div className="chats-list-page">
      <div className="loading">Loading chats...</div>
    </div>
  );

  return (
    <div className="chats-list-page">
      <h1>Messages</h1>
      
      {chats.length === 0 ? (
        <div className="no-chats">
          <p>You don't have any messages yet.</p>
          <Link to="/market" className="browse-button">Browse Products</Link>
        </div>
      ) : (
        <div className="chats-list">
          {chats.map(chat => (
            <Link to={`/chats/${chat.id}`} key={chat.id} className="chat-item">
              <div className="chat-item-image">
                <img 
                  src={chat.product?.image_path || "/api/placeholder/150/150"} 
                  alt={chat.product?.name || "Product"} 
                />
              </div>
              <div className="chat-item-details">
                <h3 className="chat-item-title">{chat.product?.name || "Unknown Product"}</h3>
                <p className="chat-item-price">${chat.product?.price?.toLocaleString() || "0"}</p>
                <p className="chat-contact">
                  {chat.buyer?.email === authAxios.defaults.headers.common['Authorization'] 
                    ? `Seller: ${chat.seller?.email}` 
                    : `Buyer: ${chat.buyer?.email}`}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatPage() {
  const { id } = useParams();
  const { authAxios, currentUser, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const [socket, setSocket] = useState(null);

  // Initialize socket connection
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    console.log('Initializing socket connection...');
    // Initialize socket.io client with auth token
    const token = localStorage.getItem('token');
    console.log('Using token for socket auth:', token ? 'Token exists' : 'No token');

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'], // Try both websocket and polling
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    newSocket.on('connect', () => {
      console.log('Socket connected successfully!', newSocket.id);
      setSocketConnected(true);
      
      // Join the chat room once connected
      console.log(`Joining chat room: ${id}`);
      newSocket.emit('join_chat', id);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      // Try to reconnect automatically
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setSocketConnected(false);
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    setSocket(newSocket);

    // Cleanup function
    return () => {
      console.log('Cleaning up socket connection');
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [isAuthenticated, navigate, id]);

  // Listen for new messages and other events
  useEffect(() => {
    if (!socket) return;

    console.log('Setting up message listeners');

    // Listen for new messages from other users
    socket.on('new_message', (message) => {
      console.log('Received new message via socket:', message);
      
      // Only add messages from others, not from ourselves (to prevent duplicates)
      if (message.sender_id !== currentUser.id) {
        setMessages(prevMessages => {
          // Avoid duplicate messages
          if (prevMessages.some(m => m.id === message.id)) {
            return prevMessages;
          }
          // Use a safe immutable update
          return [...prevMessages, message];
        });
      }
    });
    
    // Cleanup on unmount
    return () => {
      console.log('Removing socket listeners');
      socket.off('new_message');
    };
  }, [socket, currentUser.id]);
  
  // Scroll to bottom when messages change - in separate effect to prevent render issues
  useEffect(() => {
    if (messagesEndRef.current) {
      try {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      } catch (err) {
        console.error('Error scrolling to bottom:', err);
      }
    }
  }, [messages]);

  // Fetch chat and message data
  useEffect(() => {
    const fetchChatAndMessages = async () => {
      console.log(`Fetching chat and messages for chat ID: ${id}`);
      try {
        // Get chat details
        const chatResponse = await authAxios.get(`/chats/${id}`);
        console.log('Chat data received:', chatResponse.data);
        setChat(chatResponse.data);
        
        // Get messages
        const messagesResponse = await authAxios.get(`/chats/${id}/messages`);
        console.log('Messages received:', messagesResponse.data.length);
        setMessages(messagesResponse.data);
        
        // Initial scroll to bottom after loading messages
        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
          }
        }, 100);
      } catch (err) {
        console.error('Error fetching chat data:', err.response?.data || err.message);
        alert(`Failed to load chat: ${err.response?.data?.error || err.message}`);
        navigate('/chats');
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated && id) {
      fetchChatAndMessages();
    }
  }, [authAxios, id, isAuthenticated, navigate]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    const messageText = newMessage.trim();
    if (!messageText || sending) return;
    
    setSending(true);
    console.log(`Sending message in chat ${id}: ${messageText}`);
    
    // Clear input immediately for better UX
    setNewMessage('');
    
    // Add optimistic message (temporary)
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      chat_id: id,
      sender_id: currentUser.id,
      message: messageText,
      created_at: new Date().toISOString(),
      sender: { email: currentUser.email },
      temporary: true
    };
    
    // Add to state with immutable update pattern
    setMessages(prev => [...prev, optimisticMessage]);
    
    try {
      let finalMessageId = tempId;
      
      // Always use REST API for reliable message persistence
      console.log('Sending via REST API');
      const response = await authAxios.post(`/chats/${id}/messages`, {
        message: messageText
      });
      
      console.log('Message sent successfully via REST API:', response.data);
      finalMessageId = response.data.id;
      
      // Replace optimistic message with real one
      setMessages(prev => prev.map(msg => 
        msg.id === tempId ? {...response.data, id: response.data.id} : msg
      ));
      
      // Also send through socket for real-time delivery to other users if connected
      if (socket && socketConnected) {
        console.log('Also notifying via socket');
        socket.emit('new_message_notification', {
          chat_id: id,
          message_id: finalMessageId
        });
      }
    } catch (err) {
      console.error('Error sending message:', err.response?.data || err.message);
      
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      
      // Put the text back in the input field
      setNewMessage(messageText);
      
      // Show error with timeout to prevent UI issues
      setTimeout(() => {
        alert(`Failed to send message: ${err.response?.data?.error || err.message}`);
      }, 100);
    } finally {
      setSending(false);
    }
  };

  const formatMessageTime = (timestamp) => {
    const messageDate = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Check if message is from today
    if (messageDate.toDateString() === today.toDateString()) {
      return messageDate.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    }
    
    // Check if message is from yesterday
    if (messageDate.toDateString() === yesterday.toDateString()) {
      return `Yesterday ${messageDate.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      })}`;
    }
    
    // Otherwise show date and time
    return messageDate.toLocaleDateString([], {
      month: 'short',
      day: 'numeric'
    }) + ' ' + messageDate.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  if (loading) return (
    <div className="chat-page">
      <div className="loading">Loading chat...</div>
    </div>
  );

  return (
    <div className="chat-page">
      <div className="chat-container">
        <div className="chat-header">
          <Link to="/chats" className="back-button">← Back to Messages</Link>
          <div className="chat-header-info">
            <h2>{chat?.product?.name || "Unknown Product"}</h2>
            <p className="chat-header-price">${chat?.product?.price?.toLocaleString() || "0"}</p>
            <p className="chat-header-users">
              {currentUser.id === chat?.seller_id 
                ? `Chatting with buyer: ${chat?.buyer?.email}` 
                : `Chatting with seller: ${chat?.seller?.email}`}
            </p>
          </div>
        </div>
        
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="no-messages">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            <>
              {messages.map((message, index) => {
                // Skip rendering invalid messages
                if (!message || !message.id) {
                  console.warn('Skipping invalid message:', message);
                  return null;
                }
                
                try {
                  // Determine if this is the first message of the day
                  const showDate = index === 0 || 
                    new Date(message.created_at).toDateString() !== 
                    new Date(messages[index - 1].created_at).toDateString();
                  
                  // Determine if the previous message was from the same sender
                  const sameSenderAsPrevious = index > 0 && 
                    message.sender_id === messages[index - 1].sender_id;
                  
                  return (
                    <Fragment key={message.id}>
                      {showDate && (
                        <div className="message-date-separator">
                          <span>{new Date(message.created_at).toLocaleDateString([], {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric'
                          })}</span>
                        </div>
                      )}
                      <div 
                        className={`message ${message.sender_id === currentUser.id ? 'sent' : 'received'} ${sameSenderAsPrevious ? 'grouped' : ''} ${message.temporary ? 'pending' : ''}`}
                      >
                        <div className="message-content">
                          <p>{message.message}</p>
                          <span className="message-time">
                            {formatMessageTime(message.created_at)}
                            {message.temporary && <span className="message-status">Sending...</span>}
                          </span>
                        </div>
                      </div>
                    </Fragment>
                  );
                } catch (err) {
                  console.error('Error rendering message:', err, message);
                  return null;
                }
              })}
            </>
          )}
          <div ref={messagesEndRef} className="messages-end-ref" />
        </div>
        
        <form onSubmit={handleSendMessage} className="message-form">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="message-input"
            autoComplete="off"
            disabled={sending}
            onKeyDown={(e) => {
              // Submit on Enter (without Shift)
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
          />
          <button type="submit" className="send-button" disabled={sending || !newMessage.trim()}>
            {sending ? 'Sending...' : 'Send'}
          </button>
        </form>
        
        {!socketConnected && (
          <div className="socket-status">
            <p>Not connected to real-time service. Messages may be delayed.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/" />;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));

  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

function AppContent() {
  const { isAuthenticated } = useAuth();
  
  return (
    <>
      {isAuthenticated && <HeadBar />}
      <Routes>
        <Route 
          path="/" 
          element={isAuthenticated ? <Navigate to="/home" /> : <SignInPage />} 
        />
        <Route 
          path="/home" 
          element={isAuthenticated ? <HomePage /> : <Navigate to="/" />} 
        />
        <Route 
          path="/market" 
          element={isAuthenticated ? <MarketPage /> : <Navigate to="/" />} 
        />
        <Route 
          path="/product/:id" 
          element={isAuthenticated ? <ProductDetailPage /> : <Navigate to="/" />} 
        />
        <Route 
          path="/create-product" 
          element={isAuthenticated ? <CreateProductPage /> : <Navigate to="/" />} 
        />
        <Route 
          path="/chats" 
          element={isAuthenticated ? <ChatsListPage /> : <Navigate to="/" />} 
        />
        <Route 
          path="/chats/:id" 
          element={isAuthenticated ? <ChatPage /> : <Navigate to="/" />} 
        />
      </Routes>
    </>
  );
}

export default App;
