import { useState, useEffect } from 'react';
import { Search, Loader2, Bookmark, ChevronRight } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useCurrency } from '../CurrencyContext';

const Home = ({ user }) => {
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const [trendingItems, setTrendingItems] = useState([]);

  // State untuk Penapis (Filters)
  const [selectedRetailers, setSelectedRetailers] = useState(['Sports Direct', 'Al-Ikhsan', 'Original Classic']);
  const [selectedCategories, setSelectedCategories] = useState(['Footwear', 'Apparel', 'Accessories', 'Others']);
  const [sortBy, setSortBy] = useState('lowest');

  // State untuk Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);

  const determineCategory = (item) => {
    const n = item.name.toLowerCase();
    const l = (item.link || '').toLowerCase();

    // 1. Semak Accessories dahulu (Elak "Shoe Bag" dikelaskan sebagai kasut)
    if (/\b(bag|backpack|cap|hat|ball|bottle|glove|racket|guard|cleaner|lace)\b/.test(n)) return 'Accessories';

    // 2. Semak Apparel
    if (/\b(jersey|shirt|tee|t-shirt|short|shorts|pant|pants|tight|tights|sock|socks|jacket|hoodie)\b/.test(n)) return 'Apparel';

    // 3. Semak Footwear (Selepas pasti ia bukan bag/aksesori)
    if (/\b(shoe|shoes|boot|boots|sneaker|sneakers|cleat|cleats|sandal|sandals|slide|slides|futsal)\b/.test(n)) return 'Footwear';

    // 4. Penyelamat (Fallback): Baca dari URL pautan (link) jika nama tak jelas
    if (/\b(footwear|shoes|sneakers)\b/.test(l)) return 'Footwear';
    if (/\b(clothing|apparel|wear)\b/.test(l)) return 'Apparel';
    if (/\b(accessories|equipment)\b/.test(l)) return 'Accessories';

    return 'Others';
  };

  // Ambil data trending dari Firestore semasa mula-mula buka page
  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const q = query(collection(db, "trending"), orderBy("createdAt", "desc"), limit(3));
        const querySnapshot = await getDocs(q);
        const items = [];
        querySnapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() });
        });
        if (items.length > 0) {
          setTrendingItems(items);
        }
      } catch (error) {
        console.error("Error fetching trending items:", error);
      }
    };
    fetchTrending();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!keyword.trim()) return;

    setIsLoading(true);
    setErrorMsg('');
    setResults([]);
    setCurrentPage(1);

    try {
      // Memanggil API backend kita dengan limit 10 untuk setiap kedai
      const response = await fetch(`${API_URL}/search?keyword=${encodeURIComponent(keyword)}&limit=5`);
      const data = await response.json();

      if (data.status === 'Success') {
        if (data.data.length === 0) {
          setErrorMsg('No items found for that keyword.');
        } else {
          // Proses 1: Letak kategori local dulu
          const initialResults = data.data.map(item => ({
            ...item,
            aiCategory: determineCategory(item)
          }));
          setResults(initialResults);

          // Proses 2: Lakukan AI request untuk item yang 'Others'
          initialResults.forEach(async (item, index) => {
            if (item.aiCategory === 'Others') {
              // Kemaskini state supaya jadi Analyzing
              setResults(prev => {
                const newRes = [...prev];
                if (newRes[index]) newRes[index] = { ...newRes[index], aiCategory: 'Analyzing AI...' };
                return newRes;
              });

              try {
                const aiRes = await fetch(`${API_URL}/api/categorize-image`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ imageUrl: item.image, productName: item.name })
                });
                const aiData = await aiRes.json();

                // Kemaskini dengan keputusan AI
                setResults(prev => {
                  const newRes = [...prev];
                  if (newRes[index]) newRes[index] = { ...newRes[index], aiCategory: aiData.category || 'Others' };
                  return newRes;
                });
              } catch (err) {
                console.error('AI Error:', err);
                setResults(prev => {
                  const newRes = [...prev];
                  if (newRes[index]) newRes[index] = { ...newRes[index], aiCategory: 'Others' };
                  return newRes;
                });
              }
            }
          });

          // SIMPAN KE TRENDING: Ambil produk pertama hasil carian untuk dijadikan trending
          saveToTrending(initialResults[0]);
        }
      } else {
        setErrorMsg(data.error || 'Failed to fetch data from the server.');
      }
    } catch {
      setErrorMsg(`Failed to connect to the server. Ensure the backend server is running on ${API_URL}.`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveToTrending = async (product) => {
    try {
      // Simpan ke koleksi trending
      await addDoc(collection(db, "trending"), {
        name: product.name,
        price: product.price,
        image: product.image,
        link: product.link,
        source: product.source,
        category: "Footwear", // Default category
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error saving trending hit:", error);
    }
  };

  const handleSaveWatchlist = async (item) => {
    if (!user) {
      alert("Please log in first to save to Watchlist!");
      navigate('/login');
      return;
    }

    try {
      // Semak jika sudah ada dalam watchlist untuk elak duplicate
      const q = query(
        collection(db, "watchlist"),
        where("userId", "==", user.uid),
        where("name", "==", item.name)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        alert("This item is already in your Watchlist!");
        return;
      }

      await addDoc(collection(db, "watchlist"), {
        userId: user.uid,
        name: item.name,
        price: item.price,
        image: item.image,
        link: item.link,
        source: item.source,
        addedAt: serverTimestamp()
      });

      alert(`"${item.name}" successfully saved to Watchlist!`);
    } catch (error) {
      console.error("Error saving to watchlist:", error);
      alert("Failed to save to Watchlist. Please try again.");
    }
  };

  // Logik Penapisan & Sorting Dinamik
  const filteredResults = results
    .filter(item => selectedRetailers.includes(item.source))
    .filter(item => selectedCategories.includes(item.aiCategory) || item.aiCategory === 'Analyzing AI...')
    .sort((a, b) => {
      const priceA = parseFloat(a.price.replace(/[^\d.]/g, '')) || 0;
      const priceB = parseFloat(b.price.replace(/[^\d.]/g, '')) || 0;
      return sortBy === 'lowest' ? priceA - priceB : priceB - priceA;
    });

  // Logik Pagination
  const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredResults.slice(indexOfFirstItem, indexOfLastItem);

  const toggleRetailer = (retailer) => {
    setCurrentPage(1);
    setSelectedRetailers(prev =>
      prev.includes(retailer) ? prev.filter(r => r !== retailer) : [...prev, retailer]
    );
  };

  const toggleCategory = (category) => {
    setCurrentPage(1);
    setSelectedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  const handleSortChange = (e) => {
    setCurrentPage(1);
    setSortBy(e.target.value);
  };

  const handleItemsPerPageChange = (e) => {
    setCurrentPage(1);
    setItemsPerPage(Number(e.target.value));
  };

  return (
    <div style={{ width: '100%', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Bahagian Atas (Hero & Search) */}
      <div style={heroContainer}>
        <h1 style={{ fontSize: '3.5rem', fontWeight: '800', marginBottom: '15px', letterSpacing: '-1px' }}>
          Find Sports Shoes, <br /><span className="gradient-text">Lowest Prices.</span>
        </h1>
        <p style={{ color: '#666', marginBottom: '30px' }}>
          Compare prices from Sports Direct, Al-Ikhsan & Original Classic simultaneously.
        </p>

        <form onSubmit={handleSearch} style={searchWrapper} className="glass-card hover-lift">
          <Search size={20} color="#999" />
          <input
            type="text"
            placeholder="Search shoes, jerseys, rackets..."
            style={inputStyle}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <button type="submit" style={buttonStyle} disabled={isLoading}>
            {isLoading ? <Loader2 size={20} className="spin" /> : 'Search'}
          </button>
        </form>
      </div>

      {/* Figure 9: Trending Now Section */}
      {!isLoading && results.length === 0 && !errorMsg && trendingItems.length > 0 && (
        <div style={trendingSection}>
          <div style={sectionHeader}>
            <div>
              <h2 style={sectionTitle}>Trending Now</h2>
              <p style={sectionSubtitle}>Popular items being tracked by others.</p>
            </div>

          </div>

          <div style={trendingGrid}>
            {trendingItems.map((item, idx) => (
              <div key={idx} style={trendingCard} className="hover-lift fade-in">
                <div style={bestPriceTag}>Best: {formatPrice(item.price)}</div>
                <div style={trendingImageWrapper}>
                  <img src={item.image} alt={item.name} style={imageStyle} />
                </div>
                <div style={trendingContent}>
                  <p style={categoryLabel}>{item.category}</p>
                  <h3 style={productTitle}>{item.name}</h3>
                  <div style={cardFooter}>
                    <span style={pricesFound}>3 Prices Found</span>
                    <button
                      style={compareBtn}
                      onClick={() => navigate(`/product-details?name=${encodeURIComponent(item.name)}&price=${encodeURIComponent(item.price)}&image=${encodeURIComponent(item.image)}&source=${encodeURIComponent(item.source)}&link=${encodeURIComponent(item.link)}`)}
                    >
                      Compare <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Paparan Mesej Ralat / Tiada Stok */}
      {errorMsg && (
        <div style={{ textAlign: 'center', color: '#ef4444', margin: '20px', padding: '20px', backgroundColor: '#fee2e2', borderRadius: '8px', maxWidth: '600px', marginInline: 'auto' }}>
          {errorMsg}
        </div>
      )}

      {/* Paparan Loading Spinner (Masa menunggu) */}
      {isLoading && (
        <div style={{ textAlign: 'center', marginTop: '50px', marginBottom: '100px' }}>
          <Loader2 size={40} className="spin" style={{ color: '#2563eb', margin: '0 auto' }} />
          <p style={{ marginTop: '15px', color: '#666', fontWeight: '500' }}>Searching across stores for the best prices...</p>
        </div>
      )}

      {/* Paparan Keputusan Carian dengan Sidebar (Figure 10) */}
      {!isLoading && results.length > 0 && (
        <div style={mainLayout}>
          {/* SIDEBAR FILTERS */}
          <aside style={sidebarStyle}>
            <h3 style={filterTitle}>Retailers</h3>
            <div style={filterGroup}>
              {['Sports Direct', 'Al-Ikhsan', 'Original Classic'].map(ret => (
                <label key={ret} style={checkboxLabel} onClick={() => toggleRetailer(ret)}>
                  <input type="checkbox" checked={selectedRetailers.includes(ret)} readOnly style={{ cursor: 'pointer' }} /> {ret}
                </label>
              ))}
            </div>

            <h3 style={filterTitle}>Categories</h3>
            <div style={filterGroup}>
              {['Footwear', 'Apparel', 'Accessories', 'Others'].map(cat => (
                <label key={cat} style={checkboxLabel} onClick={() => toggleCategory(cat)}>
                  <input type="checkbox" checked={selectedCategories.includes(cat)} readOnly style={{ cursor: 'pointer' }} /> {cat}
                </label>
              ))}
            </div>
          </aside>

          {/* RESULTS AREA */}
          <div style={{ flex: 1 }}>
            <div style={resultsHeader}>
              <h2 style={{ fontSize: '1.5rem', color: '#1e293b', margin: 0 }}>
                Search Results ({filteredResults.length})
              </h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <select
                  style={sortSelect}
                  value={itemsPerPage}
                  onChange={handleItemsPerPageChange}
                >
                  <option value={6}>Show: 6 items</option>
                  <option value={12}>Show: 12 items</option>
                  <option value={24}>Show: 24 items</option>
                </select>
                <select
                  style={sortSelect}
                  value={sortBy}
                  onChange={handleSortChange}
                >
                  <option value="lowest">Sort by: Lowest Price</option>
                  <option value="highest">Sort by: Highest Price</option>
                </select>
              </div>
            </div>

            <div style={resultsGrid}>
              {currentItems.map((item, index) => (
                <div key={index} style={cardStyle} className="hover-lift fade-in">
                  {/* Gambar Produk */}
                  <div style={imageWrapper}>
                    <img src={item.image} alt={item.name} style={imageStyle} />
                  </div>

                  {/* Info Produk */}
                  <div style={cardContent}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      <span style={{ ...badgeStyle(item.source), marginBottom: 0 }}>{item.source}</span>
                      {item.aiCategory && (
                        <span style={{
                          backgroundColor: item.aiCategory === 'Analyzing AI...' ? '#fef08a' : '#e0e7ff',
                          color: item.aiCategory === 'Analyzing AI...' ? '#854d0e' : '#3730a3',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          {item.aiCategory === 'Analyzing AI...' ? <Loader2 size={12} className="spin" /> : null}
                          {item.aiCategory}
                        </span>
                      )}
                    </div>
                    <h3 style={productTitle} title={item.name}>{item.name}</h3>
                    <p style={priceStyle}>{formatPrice(item.price)}</p>

                    {/* Butang Tindakan */}
                    <div style={actionButtons}>
                      <button
                        onClick={() => navigate(`/product-details?name=${encodeURIComponent(item.name)}&price=${encodeURIComponent(item.price)}&image=${encodeURIComponent(item.image)}&source=${encodeURIComponent(item.source)}&link=${encodeURIComponent(item.link)}`)}
                        style={compareActionBtn}
                      >
                        Compare Price
                      </button>
                      <a href={item.link} target="_blank" rel="noreferrer" style={buyButton}>
                        Buy
                      </a>
                      <button onClick={() => handleSaveWatchlist(item)} style={watchlistButton} title="Save to Watchlist">
                        <Bookmark size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* PAGINATION UI */}
            {totalPages > 1 && (
              <div style={paginationContainer}>
                <button
                  style={paginationBtn(currentPage === 1)}
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                >
                  &lt;
                </button>

                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    style={paginationBtn(false, currentPage === i + 1)}
                    onClick={() => setCurrentPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}

                <button
                  style={paginationBtn(currentPage === totalPages)}
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                >
                  &gt;
                </button>
              </div>
            )}

            {filteredResults.length === 0 && (
              <div style={{ textAlign: 'center', padding: '50px', color: '#64748b' }}>
                No products match the selected filters.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- STYLING (CSS-in-JS) ---
const heroContainer = {
  textAlign: 'center',
  padding: '80px 5% 60px',
  background: 'linear-gradient(to bottom, #eff6ff, #ffffff)',
  borderBottom: '1px solid #e2e8f0'
};

const searchWrapper = {
  display: 'flex',
  alignItems: 'center',
  backgroundColor: '#fff',
  padding: '10px 15px',
  borderRadius: '50px',
  maxWidth: '650px',
  margin: '0 auto',
  border: '1px solid #e2e8f0',
  gap: '10px',
  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
};

const inputStyle = {
  border: 'none',
  outline: 'none',
  backgroundColor: 'transparent',
  width: '100%',
  fontSize: '1rem',
  padding: '10px 0'
};

const buttonStyle = {
  backgroundColor: '#2563eb',
  color: '#fff',
  border: 'none',
  padding: '12px 30px',
  borderRadius: '30px',
  cursor: 'pointer',
  fontWeight: '700',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '100px',
  transition: 'all 0.2s ease',
  boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.4)'
};

const resultsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: '24px',
};

// NEW STYLES FOR FIGURE 10
const mainLayout = {
  display: 'flex',
  gap: '30px',
  padding: '40px 5%',
  maxWidth: '1400px',
  margin: '0 auto',
};

const sidebarStyle = {
  width: '250px',
  flexShrink: 0,
  textAlign: 'left',
};

const filterTitle = {
  fontSize: '1.1rem',
  fontWeight: '700',
  color: '#1e293b',
  marginBottom: '15px',
  marginTop: '30px',
  borderBottom: '2px solid #e2e8f0',
  paddingBottom: '8px'
};

const filterGroup = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px'
};

const checkboxLabel = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  fontSize: '0.95rem',
  color: '#475569',
  cursor: 'pointer'
};

const resultsHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '25px'
};

const sortSelect = {
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  backgroundColor: '#fff',
  fontSize: '0.9rem',
  color: '#475569',
  outline: 'none',
  cursor: 'pointer'
};

const cardStyle = {
  backgroundColor: '#fff',
  borderRadius: '12px',
  overflow: 'hidden',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  display: 'flex',
  flexDirection: 'column',
  border: '1px solid #f1f5f9',
  transition: 'transform 0.2s',
};

const imageWrapper = {
  height: '200px',
  backgroundColor: '#f8fafc',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  borderBottom: '1px solid #f1f5f9'
};

const imageStyle = {
  maxWidth: '100%',
  maxHeight: '100%',
  objectFit: 'contain'
};

const cardContent = {
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  flexGrow: 1
};

const badgeStyle = (source) => ({
  backgroundColor: source === 'Al-Ikhsan' ? '#10b981' : source === 'Sports Direct' ? '#ef4444' : '#6366f1',
  color: 'white',
  padding: '4px 10px',
  borderRadius: '20px',
  fontSize: '0.75rem',
  fontWeight: 'bold',
  alignSelf: 'flex-start',
  marginBottom: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
});

const productTitle = {
  fontSize: '1rem',
  marginBottom: '10px',
  color: '#0f172a',
  flexGrow: 1,
  lineHeight: '1.5',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden'
};

const priceStyle = {
  fontSize: '1.5rem',
  fontWeight: '800',
  color: '#2563eb',
  marginBottom: '20px'
};

const actionButtons = {
  display: 'flex',
  gap: '10px'
};

const compareActionBtn = {
  flexGrow: 1,
  backgroundColor: '#2563eb',
  color: 'white',
  textAlign: 'center',
  padding: '10px',
  borderRadius: '8px',
  border: 'none',
  fontWeight: '600',
  cursor: 'pointer',
  fontSize: '0.9rem'
};

const buyButton = {
  backgroundColor: '#0f172a',
  color: 'white',
  textAlign: 'center',
  padding: '10px 15px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontWeight: '600',
  fontSize: '0.9rem'
};

const watchlistButton = {
  backgroundColor: '#f1f5f9',
  border: 'none',
  padding: '10px',
  borderRadius: '8px',
  cursor: 'pointer',
  color: '#64748b',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background-color 0.2s'
};

// --- STYLING BARU UNTUK TRENDING SECTION (FIGURE 9) ---
const trendingSection = {
  padding: '60px 5%',
  maxWidth: '1200px',
  margin: '0 auto'
};

const sectionHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
  marginBottom: '30px'
};

const sectionTitle = {
  fontSize: '1.8rem',
  fontWeight: '800',
  color: '#1e293b',
  margin: 0
};

const sectionSubtitle = {
  color: '#64748b',
  margin: '5px 0 0 0'
};

const viewAllBtn = {
  backgroundColor: 'transparent',
  border: 'none',
  color: '#2563eb',
  fontWeight: '600',
  cursor: 'pointer',
  fontSize: '0.9rem'
};

const trendingGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '24px'
};

const trendingCard = {
  backgroundColor: '#fff',
  borderRadius: '16px',
  padding: '24px',
  position: 'relative',
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
};

const bestPriceTag = {
  position: 'absolute',
  top: '20px',
  right: '20px',
  backgroundColor: '#f0f9ff',
  color: '#0369a1',
  padding: '4px 12px',
  borderRadius: '6px',
  fontSize: '0.75rem',
  fontWeight: '700',
  zIndex: 1
};

const trendingImageWrapper = {
  height: '180px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '20px'
};

const trendingContent = {
  textAlign: 'left'
};

const categoryLabel = {
  fontSize: '0.7rem',
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  fontWeight: '700',
  marginBottom: '8px'
};

const cardFooter = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '20px',
  paddingTop: '15px',
  borderTop: '1px solid #f1f5f9'
};

const pricesFound = {
  fontSize: '0.8rem',
  color: '#64748b',
  backgroundColor: '#f8fafc',
  padding: '4px 10px',
  borderRadius: '4px'
};

const compareBtn = {
  backgroundColor: 'transparent',
  border: 'none',
  color: '#2563eb',
  fontWeight: '600',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  cursor: 'pointer',
  fontSize: '0.9rem'
};

const paginationContainer = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: '40px',
  gap: '8px'
};

const paginationBtn = (disabled, active = false) => ({
  backgroundColor: active ? '#2563eb' : '#fff',
  color: active ? '#fff' : (disabled ? '#cbd5e1' : '#475569'),
  border: `1px solid ${active ? '#2563eb' : '#e2e8f0'}`,
  borderRadius: '6px',
  padding: '8px 14px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontWeight: '600',
  fontSize: '0.9rem',
  transition: 'all 0.2s'
});

export default Home;