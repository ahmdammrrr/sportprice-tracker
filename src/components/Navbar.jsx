import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Bell, User, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useCurrency } from '../CurrencyContext';

const Navbar = ({ user }) => { // Terima 'user' sebagai props
  const { currency, setCurrency } = useCurrency();
  const navigate = useNavigate();

  const handleLogout = () => {
    signOut(auth);
    alert("Logged out successfully. See you again!");
    navigate("/");
  };

  return (
    <nav className="glass-nav" style={navStyle}>
      <Link to="/" style={logoStyle} className="hover-lift">
        <ShoppingBag color="#2563eb" size={28} />
        <span style={{ fontWeight: '800', fontSize: '1.4rem', color: '#1e293b', letterSpacing: '-0.5px' }}>SportPrice</span>
      </Link>
      
      <div style={menuStyle}>
        <Link to="/" style={linkStyle} className="hover-lift">Home</Link>
        {user && <Link to="/dashboard" style={linkStyle} className="hover-lift">Dashboard</Link>}
        {user && <Link to="/watchlist" style={linkStyle} className="hover-lift">Watchlist</Link>}
        {user && (user.email === 'admin@sportprice.com' || user.email === 'ahmadammar0601@gmail.com') && (
          <Link to="/admin" style={{ ...linkStyle, color: '#ef4444', fontWeight: '700' }} className="hover-lift">Admin Panel</Link>
        )}
        
        {/* Currency Dropdown */}
        <select 
          value={currency} 
          onChange={(e) => setCurrency(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'pointer', outline: 'none', backgroundColor: '#f8fafc', fontWeight: '600', color: '#1e293b' }}
        >
          <option value="MYR">🇲🇾 MYR</option>
          <option value="USD">🇺🇸 USD</option>
          <option value="SGD">🇸🇬 SGD</option>
          <option value="IDR">🇮🇩 IDR</option>
        </select>
        <Link to="/price-alerts" style={{ color: '#1e293b', display: 'flex' }} className="hover-lift">
          <Bell size={22} style={{ cursor: 'pointer' }} />
        </Link>
        
        {/* Jika user ada, tunjuk butang Logout. Jika takda, tunjuk ikon Login */}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ fontSize: '0.9rem', color: '#2563eb', fontWeight: '600' }}>{user.displayName || user.email}</span>
            <LogOut size={22} onClick={handleLogout} style={{ cursor: 'pointer', color: '#ef4444' }} className="hover-lift" />
          </div>
        ) : (
          <Link to="/login" style={linkStyle} className="hover-lift">
            <User size={22} />
          </Link>
        )}
      </div>
    </nav>
  );
};

// Style ringkas (CSS-in-JS) supaya tak perlu pening fail CSS lain dulu
const navStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '1.2rem 5%',
  color: '#333'
};

const logoStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  cursor: 'pointer',
  textDecoration: 'none'
};

const menuStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '25px'
};

const linkStyle = {
  textDecoration: 'none',
  color: '#475569',
  fontWeight: '600',
  transition: 'color 0.2s ease'
};

export default Navbar;