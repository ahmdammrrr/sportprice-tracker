import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { CurrencyProvider } from './CurrencyContext';

import Navbar from './components/Navbar';
import Home from './pages/Home';
import Auth from './pages/Auth';
import ProductDetails from './pages/ProductDetails';
import Watchlist from './pages/Watchlist';
import PriceAlerts from './pages/PriceAlerts';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Fungsi untuk perhati status login
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (isAuthLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Inter, system-ui, sans-serif', color: '#64748b' }}>
        Memuatkan sesi log masuk...
      </div>
    );
  }

  return (
    <CurrencyProvider>
      <Router>
        <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        {/* Kita hantar data 'user' ke Navbar */}
        <Navbar user={user} /> 
        <Routes>
          <Route path="/" element={<Home user={user} />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/product-details" element={<ProductDetails user={user} />} />
          <Route path="/watchlist" element={<Watchlist user={user} />} />
          <Route path="/price-alerts" element={<PriceAlerts user={user} />} />
          <Route path="/dashboard" element={<Dashboard user={user} />} />
          <Route path="/admin" element={<AdminDashboard user={user} />} />
        </Routes>
        </div>
      </Router>
    </CurrencyProvider>
  );
}

export default App;