import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Bell, Trash2, TrendingDown, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { useCurrency } from '../CurrencyContext';

const PriceAlerts = ({ user }) => {
  const { formatPrice } = useCurrency();
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchAlerts = async () => {
      setIsLoading(true);
      try {
        const q = query(
          collection(db, "price_alerts"), 
          where("userId", "==", user.uid)
        );
        const querySnapshot = await getDocs(q);
        const alertsData = [];
        querySnapshot.forEach((doc) => {
          alertsData.push({ id: doc.id, ...doc.data() });
        });
        setAlerts(alertsData);
      } catch (error) {
        console.error("Error fetching alerts:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlerts();
  }, [user, navigate]);

  const handleRemove = async (id) => {
    if (window.confirm("Delete this price alert?")) {
      try {
        await deleteDoc(doc(db, "price_alerts", id));
        setAlerts(alerts.filter(a => a.id !== id));
      } catch {
        alert("Failed to delete.");
      }
    }
  };

  if (isLoading) {
    return (
      <div style={loadingContainer}>
        <Loader2 className="spin" size={40} color="#2563eb" />
        <p>Checking your price alerts...</p>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={iconBox}><Bell size={28} color="#fff" /></div>
          <div>
            <h1 style={titleStyle}>Price Alerts</h1>
            <p style={subtitleStyle}>Monitor price drops for your favorite products automatically.</p>
          </div>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div style={emptyCard}>
          <TrendingDown size={60} color="#cbd5e1" />
          <h3>No Price Alerts</h3>
          <p>You haven't set any price alerts. Go to a product details page to start tracking.</p>
          <button onClick={() => navigate('/')} style={primaryBtn}>Search Products</button>
        </div>
      ) : (
        <div style={listStyle}>
          {alerts.map((alert) => (
            <div key={alert.id} style={alertCard}>
              <img 
                src={alert.image} 
                alt={alert.productName} 
                style={{ ...alertImg, cursor: 'pointer' }} 
                onClick={() => navigate(`/product-details?name=${encodeURIComponent(alert.productName)}&price=${encodeURIComponent(alert.currentPrice)}&image=${encodeURIComponent(alert.image)}&source=${encodeURIComponent(alert.source)}&link=${encodeURIComponent(alert.link)}`)}
              />
              
              <div style={alertMain}>
                <h3 
                  style={{ ...productName, cursor: 'pointer' }} 
                  onClick={() => navigate(`/product-details?name=${encodeURIComponent(alert.productName)}&price=${encodeURIComponent(alert.currentPrice)}&image=${encodeURIComponent(alert.image)}&source=${encodeURIComponent(alert.source)}&link=${encodeURIComponent(alert.link)}`)}
                >
                  {alert.productName}
                </h3>
                <div style={statusBadge(alert.status)}>
                  {alert.status === 'triggered' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                  {alert.status === 'triggered' ? 'Price Dropped!' : 'Monitoring...'}
                </div>
              </div>

              <div style={priceInfo}>
                <div style={priceBox}>
                  <span style={priceLabel}>Target Price</span>
                  <span style={targetPriceVal}>{formatPrice(`RM${alert.targetPrice}`)}</span>
                </div>
                <div style={priceBox}>
                  <span style={priceLabel}>Current Price</span>
                  <span style={currentPriceVal}>{formatPrice(alert.currentPrice)}</span>
                </div>
              </div>

              <div style={actions}>
                <button 
                  onClick={() => navigate(`/product-details?name=${encodeURIComponent(alert.productName)}&price=${encodeURIComponent(alert.currentPrice)}&image=${encodeURIComponent(alert.image)}&source=${encodeURIComponent(alert.source)}&link=${encodeURIComponent(alert.link)}`)} 
                  style={compareBtn}
                >
                  Compare Price
                </button>
                <button onClick={() => handleRemove(alert.id)} style={deleteBtn}>
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- STYLING ---
const containerStyle = { padding: '40px 5%', maxWidth: '1000px', margin: '0 auto', minHeight: '100vh' };
const headerStyle = { marginBottom: '40px' };
const iconBox = { backgroundColor: '#2563eb', padding: '12px', borderRadius: '12px', display: 'flex' };
const titleStyle = { fontSize: '1.8rem', fontWeight: '800', color: '#1e293b', margin: 0 };
const subtitleStyle = { color: '#64748b', margin: '5px 0 0 0' };

const loadingContainer = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '15px' };
const emptyCard = { backgroundColor: '#fff', borderRadius: '20px', padding: '60px', textAlign: 'center', border: '2px dashed #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' };
const primaryBtn = { backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' };

const listStyle = { display: 'flex', flexDirection: 'column', gap: '20px' };
const alertCard = { backgroundColor: '#fff', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '25px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' };
const alertImg = { width: '80px', height: '80px', objectFit: 'contain', backgroundColor: '#f8fafc', borderRadius: '12px', padding: '10px' };

const alertMain = { flex: 1 };
const productName = { fontSize: '1rem', fontWeight: '700', color: '#1e293b', margin: '0 0 8px 0' };
const statusBadge = (status) => ({ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '600', padding: '4px 10px', borderRadius: '20px', backgroundColor: status === 'triggered' ? '#dcfce7' : '#f1f5f9', color: status === 'triggered' ? '#166534' : '#475569' });

const priceInfo = { display: 'flex', gap: '30px', textAlign: 'center' };
const priceBox = { display: 'flex', flexDirection: 'column' };
const priceLabel = { fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' };
const targetPriceVal = { fontSize: '1.1rem', fontWeight: '800', color: '#ef4444' };
const currentPriceVal = { fontSize: '1.1rem', fontWeight: '800', color: '#2563eb' };

const actions = { display: 'flex', gap: '10px', alignItems: 'center' };
const compareBtn = { backgroundColor: '#0f172a', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem' };
const deleteBtn = { backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', display: 'flex' };

export default PriceAlerts;
