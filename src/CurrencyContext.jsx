import { createContext, useState, useEffect, useContext } from 'react';

const CurrencyContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useCurrency = () => useContext(CurrencyContext);

export const CurrencyProvider = ({ children }) => {
  const [currency, setCurrency] = useState('MYR');
  const [rates, setRates] = useState({ MYR: 1, USD: 0.21, SGD: 0.29, IDR: 3500 }); // Fallback sementara
  
  useEffect(() => {
    // Dapatkan kadar tukaran mata wang secara live!
    const fetchRates = async () => {
      try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/MYR');
        const data = await response.json();
        setRates(data.rates);
      } catch (error) {
        console.error("Gagal mendapatkan API tukaran wang:", error);
      }
    };
    fetchRates();
  }, []);

  // Helper function untuk menukar teks harga (cth: "RM 129.00" -> "$ 27.50")
  const formatPrice = (priceStr) => {
    if (!priceStr) return '';
    
    // Cari nombor dari string (contoh: RM 1,299.00 -> 1299.00)
    const match = priceStr.toString().match(/[\d,.]+/);
    if (!match) return priceStr;
    
    const amount = parseFloat(match[0].replace(/,/g, ''));
    if (isNaN(amount)) return priceStr;
    
    const converted = amount * (rates[currency] || 1);
    const symbols = { MYR: 'RM', USD: 'USD', SGD: 'SGD', IDR: 'Rp' };
    
    if (currency === 'IDR') {
       return `${symbols[currency]} ${Math.round(converted).toLocaleString()}`;
    }
    return `${symbols[currency]} ${converted.toFixed(2)}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
};
