import { useState, useContext, createContext, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Route, Routes, Link, Navigate, useParams, useNavigate } from 'react-router-dom';
import './App.css';
import './Chat.css';
import logo from './assets/Collegiate Logo.png';
import axios from 'axios';
import { io } from 'socket.io-client';

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
    const storedUser = JSON.parse(localStorage.getItem('user'));
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setCurrentUser(storedUser);
    }
    
    setLoading(false);
  }, []);

  const login = async (usernameOrEmail, password) => {
    try {
      const response = await axios.post('http://localhost:3001/api/login', {
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
      const response = await axios.post('http://localhost:3001/api/register', {
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

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setCurrentUser(null);
  };

  // Create axios instance with auth headers
  const authAxios = axios.create({
    baseURL: 'http://localhost:3001/api'
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
        <Link to="/" className="nav-link">HOME</Link>
        <Link to="/market" className="nav-link">MARKET</Link>
        {isAuthenticated && <Link to="/create-product" className="nav-link">SELL ITEM</Link>}
        {isAuthenticated && <Link to="/chats" className="nav-link">MESSAGES</Link>}
      </div>
      <div className="rightside">
        {!isAuthenticated ? (
          <Link to="/" className="sign-in-btn">Sign in</Link>
        ) : (
          <>
            <span className="username">{currentUser.username}</span>
            <button onClick={logout} className="sign-in-btn">Logout</button>
          </>
        )}
        <span className="profile-icon">👤</span>
      </div>
    </div>
  );
}

function HomePage() {
  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isSignIn, setIsSignIn] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    keepSignedIn: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/market');
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    try {
      if (isSignIn) {
        // Login
        await login(formData.username, formData.password);
      } else {
        // Register
        if (!formData.username || !formData.email || !formData.password) {
          setError('All fields are required');
          return;
        }
        await register(formData.username, formData.email, formData.password);
      }
      navigate('/market');
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed. Please try again.');
      console.error('Auth error:', err);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleAuthMode = () => {
    setIsSignIn(!isSignIn);
    setError(null);
  };

  return (
    <div className='body'>
      <HeadBar />
      <div className="sign-in-container">
        <h1 className="sign-in-title">
          {isSignIn ? 'Sign in to your account' : 'Create a new account'}
        </h1>

        <div className="form-container">
          <p className="required-field-note">* indicates required field</p>
          
          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            {!isSignIn && (
              <div className="form-field">
                <label htmlFor="username" className="sr-only">Username</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  placeholder="* Username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  className="form-input"
                />
              </div>
            )}

            <div className="form-field">
              <label htmlFor="username" className="sr-only">
                {isSignIn ? 'Username or email address' : 'Email address'}
              </label>
              <input
                type={isSignIn ? "text" : "email"}
                id={isSignIn ? "usernameOrEmail" : "email"}
                name={isSignIn ? "username" : "email"}
                placeholder={isSignIn ? "* Username or email address" : "* Email address"}
                value={isSignIn ? formData.username : formData.email}
                onChange={handleChange}
                required
                className="form-input"
              />
            </div>

            <div className="form-field password-field">
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                placeholder="* Password"
                value={formData.password}
                onChange={handleChange}
                required
                className="form-input"
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <svg viewBox="0 0 24 24" width="24" height="24" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  {showPassword ? (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>

            {isSignIn && (
              <div className="form-field checkbox-field">
                <input
                  type="checkbox"
                  id="keepSignedIn"
                  name="keepSignedIn"
                  checked={formData.keepSignedIn}
                  onChange={handleChange}
                  className="checkbox-input"
                />
                <label htmlFor="keepSignedIn" className="checkbox-label">
                  Keep me signed in.
                </label>
              </div>
            )}

            <div className="auth-toggle">
              {isSignIn ? (
                <p>Don't have an account? <button type="button" onClick={toggleAuthMode} className="toggle-auth-btn">Create Account</button></p>
              ) : (
                <p>Already have an account? <button type="button" onClick={toggleAuthMode} className="toggle-auth-btn">Sign In</button></p>
              )}
            </div>

            {isSignIn && (
              <div className="forgotten-links">
                <a href="#forgot-username" className="forgot-link">Forgot your username?</a>
                <a href="#forgot-password" className="forgot-link">Forgot your password?</a>
              </div>
            )}

            <div className="form-actions">
              <button type="submit" className="sign-in-button">
                {isSignIn ? 'Sign in' : 'Create Account'}
              </button>
            </div>
          </form>
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

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await axios.get('http://localhost:3001/api/products');
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

  // Filter products based on selected filters
  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(product.category);
    const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];
    return matchesCategory && matchesPrice;
  });

  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'price-asc') return a.price - b.price;
    if (sortBy === 'price-desc') return b.price - a.price;
    return 0; // Default: featured
  });

  if (loading) return (
    <div className="market-page">
      <HeadBar />
      <div className="loading">Loading products...</div>
    </div>
  );

  if (error) return (
    <div className="market-page">
      <HeadBar />
      <div className="error">{error}</div>
    </div>
  );

  // Render the market page with products
  return (
    <div className="market-page">
      <HeadBar />
      
      <div className="market-container">
        <div className="market-header">
          <div className="market-title">
            <h1>Columbia Marketplace</h1>
            <p>The ultimate every day collection with the cheapest and best student utilities.</p>
          </div>
          
          <div className="watch-categories">
            <Link to="#" className="category-link">Laptops & Accessories</Link>
            <Link to="#" className="category-link">Textbooks & Study Guides</Link>
            <Link to="#" className="category-link">Dorm & Apartment Essentials</Link>
            <Link to="#" className="category-link">Bicycles & Scooters</Link>
            <Link to="#" className="category-link">Electronics & Gadgets</Link>
            <Link to="#" className="category-link">Furniture & Storage</Link>
            <Link to="#" className="category-link">Clothing & Fashion</Link>
            <Link to="#" className="category-link">School Supplies</Link>
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
                <button className="toggle-btn">−</button>
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
                <button className="toggle-btn">−</button>
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
        const response = await axios.get(`http://localhost:3001/api/products/${id}`);
        setProduct(response.data);
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
      // Create or get chat for this product
      const response = await authAxios.post('/chats', {
        product_id: product.id
      });
      
      // Navigate to the chat
      navigate(`/chats/${response.data.chat.id}`);
    } catch (err) {
      console.error('Error creating chat:', err);
      alert('Failed to contact seller. Please try again.');
    }
  };

  if (loading) return (
    <div className="product-detail-page">
      <HeadBar />
      <div className="loading">Loading product details...</div>
    </div>
  );

  if (error || !product) return (
    <div className="product-detail-page">
      <HeadBar />
      <div className="error">{error || 'Product not found'}</div>
    </div>
  );

  const isOwner = isAuthenticated && currentUser.id === product.seller_id;

  return (
    <div className="product-detail-page">
      <HeadBar />
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
            <p>Seller: {product.seller_name}</p>
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
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setImageError('');

    try {
      // Validate image URL if provided
      if (formData.image_path) {
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
      <HeadBar />
      <div className="create-product-container">
        <h1>Sell an Item</h1>
        <form onSubmit={handleSubmit} className="create-product-form">
          <div className="form-group">
            <label htmlFor="name">Product Name *</label>
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
            <label htmlFor="details">Details *</label>
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
            <label htmlFor="condition">Condition *</label>
            <select
              id="condition"
              name="condition"
              value={formData.condition}
              onChange={handleChange}
              required
            >
              <option value="New">New</option>
              <option value="Like new">Like new</option>
              <option value="Good condition">Good condition</option>
              <option value="Fair condition">Fair condition</option>
              <option value="Poor condition">Poor condition</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="price">Price ($) *</label>
            <input
              type="number"
              id="price"
              name="price"
              value={formData.price}
              onChange={handleChange}
              required
              min="0.01"
              step="0.01"
              placeholder="e.g., 99.99"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="category">Category *</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
            >
              <option value="">Select a category</option>
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
            <label htmlFor="image_path">Image URL</label>
            <input
              type="text"
              id="image_path"
              name="image_path"
              value={formData.image_path}
              onChange={handleChange}
              placeholder="Enter an image URL or leave blank for placeholder"
            />
            {imageError && <div className="error-message">{imageError}</div>}
          </div>
          
          <button 
            type="submit" 
            className="create-product-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Listing'}
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
        const response = await authAxios.get('/chats');
        setChats(response.data);
      } catch (err) {
        console.error('Error fetching chats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChats();
  }, [authAxios, isAuthenticated, navigate]);

  if (loading) return <div className="loading">Loading chats...</div>;

  return (
    <div className="chats-page">
      <HeadBar />
      <div className="chats-container">
        <h1>Your Messages</h1>
        
        {chats.length === 0 ? (
          <div className="no-chats">
            <p>You don't have any messages yet.</p>
            <p>Browse the <Link to="/market">marketplace</Link> and contact sellers to start chatting!</p>
          </div>
        ) : (
          <div className="chats-list">
            {chats.map(chat => (
              <Link to={`/chats/${chat.id}`} key={chat.id} className="chat-item">
                <div className="chat-item-image">
                  <img 
                    src={chat.product_image || "/api/placeholder/100/100"} 
                    alt={chat.product_name} 
                  />
                </div>
                <div className="chat-item-details">
                  <h3>{chat.product_name}</h3>
                  <p className="chat-item-price">${chat.product_price.toLocaleString()}</p>
                  <p className="chat-partner">
                    {chat.buyer_name === chat.seller_name ? 'You' : chat.buyer_name} • {chat.seller_name === chat.buyer_name ? 'You' : chat.seller_name}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
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
  const messagesEndRef = useRef(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    // Initialize socket.io client with auth token
    const newSocket = io('http://localhost:3001', {
      auth: {
        token: localStorage.getItem('token')
      }
    });

    newSocket.on('connect', () => {
      console.log('Connected to socket server');
    });

    newSocket.on('connect_error', (error) => {
      // Just log the error, don't show alert since messages still work through HTTP
      console.error('Socket connection error:', error);
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!socket) return;

    // Join the chat room
    socket.emit('join_chat', id);

    // Listen for new messages
    socket.on('new_message', (message) => {
      setMessages(prevMessages => {
        // Avoid duplicate messages
        if (prevMessages.some(m => m.id === message.id)) {
          return prevMessages;
        }
        return [...prevMessages, message];
      });
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });

    // Listen for errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
      alert('Error: ' + error);
    });

    // Cleanup
    return () => {
      socket.emit('leave_chat', id);
      socket.off('new_message');
      socket.off('error');
    };
  }, [socket, id]);

  useEffect(() => {
    const fetchChatAndMessages = async () => {
      try {
        // Get chat details
        const chatResponse = await authAxios.get(`/chats/${id}`);
        setChat(chatResponse.data);
        
        // Get messages
        const messagesResponse = await authAxios.get(`/chats/${id}/messages`);
        setMessages(messagesResponse.data);
        
        // Scroll to bottom after loading messages
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } catch (err) {
        console.error('Error fetching chat data:', err);
        navigate('/chats');
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchChatAndMessages();
    }
  }, [authAxios, id, isAuthenticated, navigate]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim()) return;
    
    try {
      // Send message to server
      const response = await authAxios.post(`/chats/${id}/messages`, {
        message: newMessage.trim()
      });

      // Clear input immediately for better UX
      setNewMessage('');

      // Add message to local state
      setMessages(prevMessages => [...prevMessages, response.data.data]);
      
      // Scroll to bottom
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      console.error('Error sending message:', err);
      alert('Failed to send message. Please try again.');
    }
  };

  if (loading) return (
    <div className="chat-page">
      <HeadBar />
      <div className="loading">Loading chat...</div>
    </div>
  );

  return (
    <div className="chat-page">
      <HeadBar />
      <div className="chat-container">
        <div className="chat-header">
          <Link to="/chats" className="back-button">← Back to Messages</Link>
          <div className="chat-header-info">
            <h2>{chat?.product_name}</h2>
            <p className="chat-header-price">${chat?.product_price?.toLocaleString()}</p>
          </div>
        </div>
        
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="no-messages">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map(message => (
              <div 
                key={message.id} 
                className={`message ${message.sender_id === currentUser.id ? 'sent' : 'received'}`}
              >
                <div className="message-content">
                  <p>{message.message}</p>
                  <span className="message-time">
                    {new Date(message.created_at).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: true 
                    })}
                  </span>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <form onSubmit={handleSendMessage} className="message-form">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="message-input"
            autoComplete="off"
          />
          <button type="submit" className="send-button">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/" />;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/market" element={<MarketPage />} />
          <Route path="/product/:id" element={<ProductDetailPage />} />
          <Route 
            path="/create-product" 
            element={
              <ProtectedRoute>
                <CreateProductPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/chats" 
            element={
              <ProtectedRoute>
                <ChatsListPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/chats/:id" 
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
