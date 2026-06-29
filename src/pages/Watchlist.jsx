import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { Trash2, ArrowRight, Loader2, Heart, ShoppingCart } from 'lucide-react';
import { useCurrency } from '../CurrencyContext';

const Watchlist = ({ user }) => {
  const { formatPrice } = useCurrency();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchWatchlist = async () => {
      setIsLoading(true);
      try {
        const q = query(
          collection(db, "watchlist"), 
          where("userId", "==", user.uid)
        );
        const querySnapshot = await getDocs(q);
        const watchlistData = [];
        querySnapshot.forEach((doc) => {
          watchlistData.push({ id: doc.id, ...doc.data() });
        });
        setItems(watchlistData);
      } catch (error) {
        console.error("Error fetching watchlist:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWatchlist();
  }, [user, navigate]);

  const handleRemove = async (id) => {
    if (window.confirm("Are you sure you want to remove this product from Watchlist?")) {
      try {
        await deleteDoc(doc(db, "watchlist", id));
        setItems(items.filter(item => item.id !== id));
      } catch {
        alert("Failed to remove product.");
      }
    }
  };

  if (isLoading) {
    return (
      <div style={emptyContainer}>
        <Loader2 className="spin" size={40} color="#2563eb" />
        <p>Loading your Watchlist...</p>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>My Watchlist</h1>
          <p style={subtitleStyle}>You are tracking {items.length} items.</p>
        </div>
        <Link to="/" style={addMoreBtn}>+ Search More</Link>
      </div>

      {items.length === 0 ? (
        <div style={emptyCard}>
          <Heart size={60} color="#cbd5e1" />
          <h3>Your Watchlist is empty</h3>
          <p>Start searching and save items to track their prices.</p>
          <button onClick={() => navigate('/')} style={startSearchBtn}>Start Searching Now</button>
        </div>
      ) : (
        <div style={gridStyle}>
          {items.map((item) => (
            <div key={item.id} style={cardStyle} className="hover-lift fade-in">
              <div style={imageWrapper}>
                <img src={item.image} alt={item.name} style={imageStyle} />
                <span style={sourceBadge(item.source)}>{item.source}</span>
              </div>
              
              <div style={contentStyle}>
                <h3 style={itemTitle}>{item.name}</h3>
                <p style={itemPrice}>{formatPrice(item.price)}</p>
                
                <div style={actionButtons}>
                  <button 
                    onClick={() => navigate(`/product-details?name=${encodeURIComponent(item.name)}&price=${encodeURIComponent(item.price)}&image=${encodeURIComponent(item.image)}&source=${encodeURIComponent(item.source)}&link=${encodeURIComponent(item.link)}`)}
                    style={compareBtn}
                  >
                    Compare Price <ArrowRight size={16} />
                  </button>
                  
                  <div style={bottomActions}>
                    <a href={item.link} target="_blank" rel="noreferrer" style={buyLink}>
                      <ShoppingCart size={16} /> Buy
                    </a>
                    <button onClick={() => handleRemove(item.id)} style={removeBtn} title="Remove">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- STYLING ---
const containerStyle = { padding: '40px 5%', maxWidth: '1200px', margin: '0 auto', minHeight: '100vh' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' };
const titleStyle = { fontSize: '2rem', fontWeight: '800', color: '#1e293b', margin: 0 };
const subtitleStyle = { color: '#64748b', margin: '5px 0 0 0' };
const addMoreBtn = { backgroundColor: '#2563eb', color: '#fff', textDecoration: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '600', fontSize: '0.9rem', transition: 'all 0.2s ease', boxShadow: 'var(--shadow-sm)' };

const emptyContainer = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '15px', color: '#64748b' };
const emptyCard = { backgroundColor: '#fff', borderRadius: '20px', padding: '60px', textAlign: 'center', border: '2px dashed #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' };
const startSearchBtn = { backgroundColor: '#0f172a', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', marginTop: '10px', transition: 'all 0.2s ease', boxShadow: 'var(--shadow-sm)' };

const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' };
const cardStyle = { backgroundColor: '#fff', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' };

const imageWrapper = { height: '200px', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative' };
const imageStyle = { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' };
const sourceBadge = (source) => ({ position: 'absolute', top: '15px', left: '15px', backgroundColor: source === 'Al-Ikhsan' ? '#10b981' : source === 'Sports Direct' ? '#ef4444' : '#6366f1', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '800' });

const contentStyle = { padding: '20px', display: 'flex', flexDirection: 'column', flexGrow: 1 };
const itemTitle = { fontSize: '1rem', fontWeight: '700', color: '#1e293b', marginBottom: '10px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.4' };
const itemPrice = { fontSize: '1.3rem', fontWeight: '800', color: '#2563eb', marginBottom: '20px' };

const actionButtons = { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: 'auto' };
const compareBtn = { width: '100%', backgroundColor: '#f1f5f9', border: 'none', padding: '10px', borderRadius: '8px', color: '#1e293b', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.9rem', transition: 'all 0.2s ease' };

const bottomActions = { display: 'flex', gap: '10px' };
const buyLink = { flexGrow: 1, backgroundColor: '#0f172a', color: '#fff', textDecoration: 'none', padding: '10px', borderRadius: '8px', textAlign: 'center', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s ease' };
const removeBtn = { backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' };

export default Watchlist;
