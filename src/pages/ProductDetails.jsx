import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ExternalLink, Bell, TrendingDown, TrendingUp, Clock, Loader2, Bookmark, Sparkles } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useCurrency } from '../CurrencyContext';

// Daftar modul Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Fungsi normalisasi productId (dikongsi dengan backend)
const normalizeProductId = (name) => {
  return name
    .toLowerCase()
    .replace(/black|white|blue|red|green|grey|yellow|orange|purple|pink/gi, '')
    .replace(/[A-Z]{2,}\d{3,}-\d+/gi, '')  // Buang kod produk (DV4343-402)
    .replace(/men's|women's|men|women|junior|kid's|kids/gi, '')
    .replace(/[^a-z0-9\s]/g, '')           // Buang aksara khas
    .replace(/\s+/g, '-')                   // Ganti ruang dengan dash
    .replace(/-+/g, '-')                    // Buang dash berganda
    .replace(/^-|-$/g, '')                  // Buang dash di hujung
    .trim();
};

const ProductDetails = ({ user }) => {
  const { formatPrice, currency } = useCurrency();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const productName = searchParams.get('name');
  const initialPrice = searchParams.get('price');
  const initialImage = searchParams.get('image');
  const initialSource = searchParams.get('source');
  const initialLink = searchParams.get('link');

  const [isLoading, setIsLoading] = useState(true);
  const [comparisonResults, setComparisonResults] = useState([]);
  const [targetPrice, setTargetPrice] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [isFetchingHistory, setIsFetchingHistory] = useState(true);
  const [alertMethod, setAlertMethod] = useState('email'); // 'email' atau 'telegram'
  const [originalSizes, setOriginalSizes] = useState([]);
  const [similarProducts, setSimilarProducts] = useState([]);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    // Semak jika produk ini sudah ada dalam watchlist
    const checkSaved = async () => {
      if (user && productName) {
        const q = query(collection(db, "watchlist"), where("userId", "==", user.uid), where("name", "==", productName));
        const snap = await getDocs(q);
        setIsSaved(!snap.empty);
      }
    };
    checkSaved();
  }, [user, productName]);

  // CONTENT-BASED RECOMMENDATION: Fetch similar products from trending
  useEffect(() => {
    if (!productName) return;

    const fetchSimilarProducts = async () => {
      try {
        const brands = ['nike', 'adidas', 'asics', 'puma', 'under armour', 'skechers', 'new balance', 'reebok', 'fila', 'mizuno'];
        const nameLower = productName.toLowerCase();
        const currentBrand = brands.find(b => nameLower.includes(b));

        // Determine current product's category
        const catKeywords = {
          Footwear: /\b(shoe|shoes|boot|boots|sneaker|sneakers|cleat|cleats|sandal|slide|futsal)\b/,
          Apparel: /\b(jersey|shirt|tee|t-shirt|short|shorts|pant|pants|tight|tights|sock|socks|jacket|hoodie)\b/,
          Accessories: /\b(bag|backpack|cap|hat|ball|bottle|glove|racket|guard)\b/
        };
        let currentCategory = 'Others';
        for (const [cat, regex] of Object.entries(catKeywords)) {
          if (regex.test(nameLower)) { currentCategory = cat; break; }
        }

        const currentPrice = parseFloat((initialPrice || '').toString().replace(/[^\\d.]/g, ''));

        // Fetch trending products
        const q = query(collection(db, "trending"), orderBy("createdAt", "desc"), limit(30));
        const snap = await getDocs(q);

        const scored = [];
        snap.forEach(doc => {
          const data = doc.data();
          const itemName = (data.name || '').toLowerCase();

          // Skip if same product
          if (itemName === nameLower) return;

          let score = 0;
          const reasons = [];

          // Brand match
          const itemBrand = brands.find(b => itemName.includes(b));
          if (currentBrand && itemBrand === currentBrand) {
            score += 4;
            reasons.push(`Same brand`);
          }

          // Category match
          let itemCat = 'Others';
          for (const [cat, regex] of Object.entries(catKeywords)) {
            if (regex.test(itemName)) { itemCat = cat; break; }
          }
          if (currentCategory !== 'Others' && itemCat === currentCategory) {
            score += 3;
            if (reasons.length === 0) reasons.push(`Similar ${itemCat.toLowerCase()}`);
          }

          // Price range match (within 50% of current price)
          const itemPrice = parseFloat((data.price || '').toString().replace(/[^\\d.]/g, ''));
          if (!isNaN(itemPrice) && !isNaN(currentPrice) && currentPrice > 0) {
            if (itemPrice >= currentPrice * 0.5 && itemPrice <= currentPrice * 1.5) {
              score += 1;
            }
          }

          if (score > 0) {
            scored.push({ ...data, score, reason: reasons[0] || 'Popular item' });
          }
        });

        // Sort by score and take top 4
        scored.sort((a, b) => b.score - a.score);
        setSimilarProducts(scored.slice(0, 4));

      } catch (error) {
        console.error('Error fetching similar products:', error);
      }
    };

    fetchSimilarProducts();
  }, [productName, initialPrice]);

  useEffect(() => {
    const fetchComparison = async () => {
      if (!productName) return;
      
      setIsLoading(true);
      try {
        // OPTIMASI: Kita "bersihkan" kata kunci carian
        // Kita buang perkataan yang spesifik sangat (seperti warna atau kod panjang) 
        // supaya enjin carian kedai tak pening.
        
        // Kata kunci sub-jenis yang WAJIB dikekalkan (membezakan jenis kasut)
        const subTypeKeywords = ['futsal', 'indoor', 'turf', 'firm ground', 'fg', 'tf', 'ic', 'sg', 'ag', 'running', 'basketball', 'training'];
        const nameLower = productName.toLowerCase();
        const detectedSubType = subTypeKeywords.find(st => nameLower.includes(st));

        const cleanedKeyword = productName
          .replace(/\b(black|white|blue|red|green|grey|yellow|orange|purple|pink)\b/gi, '') // Buang warna (dengan \b supaya 'red' dalam 'Predator' tidak terpadam)
          .replace(/[A-Z]{2,}\d{3,}-\d+/g, '') // Buang kod produk (cth: DV4343-402)
          .split(' ')
          .filter(w => w.trim().length > 0)
          .slice(0, 5) // Ambil 5 perkataan pertama (lebih banyak konteks)
          .join(' ')
          .trim();
        
        // Jika sub-jenis penting tidak ada dalam cleanedKeyword, tambah balik
        let finalKeyword = cleanedKeyword;
        if (detectedSubType && !cleanedKeyword.toLowerCase().includes(detectedSubType)) {
          finalKeyword = cleanedKeyword + ' ' + detectedSubType;
        }

        const response = await fetch(`${API_URL}/search?keyword=${encodeURIComponent(finalKeyword)}&limit=3&excludeStore=${encodeURIComponent(initialSource)}`);
        const data = await response.json();

        if (data.status === 'Success') {
          // LOGIK BARU: Tentukan kategori asal (Men, Women, Junior/Kids)
          // 1. EKSTRAK JENAMA (Nike, Adidas, Asics, Puma)
          const brands = ['nike', 'adidas', 'asics', 'puma', 'under armour', 'skechers', 'new balance'];
          const activeBrand = brands.find(b => productName.toLowerCase().includes(b));
          
          // 2. Ekstrak model produk dari cleanedKeyword (tanpa jenama) untuk padanan yang lebih tepat
          const modelKeywords = cleanedKeyword.toLowerCase()
            .replace(activeBrand || '', '')
            .trim()
            .split(' ')
            .filter(w => w.length > 1); // Buang huruf tunggal

          const versionNumbers = cleanedKeyword.match(/\b\d+\b/g) || [];

          const filtered = data.data.filter(item => {
            const itemName = item.name.toLowerCase();
            
            // Semakan Versi/Nombor: Jika kasut asal mempunyai nombor siri (cth: Pegasus "41"), 
            // kasut yang dijumpai WAJIB mempunyai nombor "41" juga. (Untuk elak Pegasus 40 masuk)
            const hasMatchingVersion = versionNumbers.every(num => new RegExp(`\\b${num}\\b`).test(itemName));
            if (!hasMatchingVersion) return false;
            
            // Semakan jenama: Pastikan jenama sepadan (atau model sepadan jika kedai tak letak prefix jenama)
            if (activeBrand && !itemName.includes(activeBrand)) {
              // Jika jenama tak ada, pastikan sekurang-kurangnya model produk sepadan
              // Bersihkan simbol ' (apostrophe) dari itemName untuk perbandingan adil (cth: "men's" vs "mens")
              const cleanItemName = itemName.replace(/['"]/g, '');
              const modelMatch = modelKeywords.length > 0 && modelKeywords.every(kw => {
                 const cleanKw = kw.replace(/['"]/g, '');
                 return cleanItemName.includes(cleanKw);
              });
              
              if (!modelMatch) return false;
            }

            // SEMAKAN MODEL WAJIB: Walaupun jenama ditemui, kita MESTI pastikan kata kunci model
            // yang kritikal turut sepadan (cth: "Elite" vs "League" vs "Club").
            // Tanpa semakan ini, sistem akan tersilap memilih model yang berbeza asalkan jenama sama.
            if (activeBrand && itemName.includes(activeBrand) && modelKeywords.length > 0) {
              const cleanItemName = itemName.replace(/['"]/g, '');
              const modelMatch = modelKeywords.every(kw => {
                const cleanKw = kw.replace(/['"]/g, '');
                return cleanItemName.includes(cleanKw);
              });
              if (!modelMatch) return false;
            }

            // Semakan sub-jenis kasut: Pastikan jenis kasut sepadan
            const indoorPattern = /\b(futsal|indoor|ic|in\s*hall)\b/;
            const outdoorPattern = /\b(firm.?ground|fg|soft.?ground|sg|artificial.?ground|ag|turf|tf|ground\s*boots)\b/;
            
            if (detectedSubType) {
              const isFutsal = ['futsal', 'indoor', 'ic'].includes(detectedSubType);
              const isOutdoor = ['firm ground', 'fg', 'sg', 'ag', 'turf', 'tf'].includes(detectedSubType);
              
              if (isFutsal) {
                // Produk asal adalah futsal/indoor, tolak kasut padang
                if (outdoorPattern.test(itemName)) return false;
              } else if (isOutdoor) {
                // Produk asal adalah kasut padang, tolak futsal/indoor
                if (indoorPattern.test(itemName)) return false;
              }
            } else {
              // Sub-jenis kasut TIDAK dikesan dari nama asal (cth: "Boots" sahaja tanpa "Futsal" atau "Firm Ground")
              const isOriginalBoot = /\b(boots|cleats)\b/.test(productName.toLowerCase());
              if (isOriginalBoot && indoorPattern.test(itemName)) return false;
            }

            // ==========================================
            // SEMAKAN SUB-JENIS BEG & AKSESORI
            // (Mengelakkan beg sandang dipadankan dengan beg jerut walaupun model sama cth: "Heritage")
            // ==========================================
            const origName = productName.toLowerCase();
            const isDrawstringOrig = /\b(drawstring|gymsack|gym\s*sack|shoe\s*bag)\b/.test(origName);
            const isWaistOrig = /\b(waist|waistpack|hip|fanny|crossbody|sling|pouch)\b/.test(origName);
            const isDuffelOrig = /\b(duffel|duffle|holdall|grip\s*bag)\b/.test(origName);
            const isBackpackOrig = /\b(backpack|bagpack|rucksack)\b/.test(origName);
            
            const isDrawstringItem = /\b(drawstring|gymsack|gym\s*sack|shoe\s*bag)\b/.test(itemName);
            const isWaistItem = /\b(waist|waistpack|hip|fanny|crossbody|sling|pouch)\b/.test(itemName);
            const isDuffelItem = /\b(duffel|duffle|holdall|grip\s*bag)\b/.test(itemName);
            const isBackpackItem = /\b(backpack|bagpack|rucksack)\b/.test(itemName);

            // Peraturan 1: Jika kedai lain sebut jenis SPESIFIK (drawstring/sling/duffel),
            // WAJIB pastikan nama asal pun ada sebut benda tu.
            // Pengecualian: Backpack tidak disemak begini sebab kadang-kadang kedai tak tulis 'backpack' untuk beg biasa.
            if (!isDrawstringOrig && isDrawstringItem) return false;
            if (!isWaistOrig && isWaistItem) return false;
            if (!isDuffelOrig && isDuffelItem) return false;

            // Peraturan 2: Jika nama asal dah sebut jenisnya, tolak jika item dari kedai lain sebut jenis LAIN.
            if (isDrawstringOrig && (isWaistItem || isDuffelItem || isBackpackItem)) return false;
            if (isWaistOrig && (isDrawstringItem || isDuffelItem || isBackpackItem)) return false;
            if (isDuffelOrig && (isDrawstringItem || isWaistItem || isBackpackItem)) return false;
            if (isBackpackOrig && (isDrawstringItem || isWaistItem || isDuffelItem)) return false;

            return true;
          });

          const grouped = {};
          
          // Masukkan produk asal (yang diklik dari Home) ke dalam senarai terlebih dahulu
          if (initialSource && initialLink) {
            grouped[initialSource] = {
              name: productName,
              price: initialPrice,
              image: initialImage,
              source: initialSource,
              link: initialLink
            };
          }

          filtered.forEach(item => {
            if (!grouped[item.source] || parseFloat(item.price.replace(/[^\d.]/g, '')) < parseFloat(grouped[item.source].price.replace(/[^\d.]/g, ''))) {
              grouped[item.source] = item;
            }
          });
          const finalResults = Object.values(grouped);
          setComparisonResults(finalResults);
          
          // Semak saiz secara background tanpa ganggu jadual harga
          // Guna Promise.allSettled untuk elakkan Race Condition
          const sizePromises = finalResults.map(async (item) => {
             if (item.link && item.source) {
                try {
                   const res = await fetch(`${API_URL}/check-sizes?url=${encodeURIComponent(item.link)}&source=${encodeURIComponent(item.source)}`);
                   const sizeData = await res.json();
                   return { source: item.source, sizes: sizeData.status === 'Success' ? sizeData.sizes : [] };
                } catch(error) {
                   console.error(error);
                   return { source: item.source, sizes: [] };
                }
             }
             return { source: item.source, sizes: [] };
          });

          const sizeResults = await Promise.allSettled(sizePromises);
          
          // Kemaskini state SEKALI SAHAJA selepas semua saiz diperoleh
          setComparisonResults(prev => {
            const updated = [...prev];
            sizeResults.forEach(result => {
              if (result.status === 'fulfilled' && result.value) {
                const idx = updated.findIndex(p => p.source === result.value.source);
                if (idx !== -1) {
                  updated[idx] = { ...updated[idx], sizes: result.value.sizes };
                }
              }
            });
            return updated;
          });
        }
      } catch (error) {
        console.error("Gagal memuatkan perbandingan:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // --- ISU 1: AUTO-REKOD HARGA semasa buka halaman ---
    const recordPriceSnapshot = async () => {
      if (!productName || !initialPrice) return;
      try {
        const normalizedId = normalizeProductId(productName);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = Timestamp.fromDate(today);

        // Semak jika sudah ada rekod hari ini (elak rekod berganda)
        const checkQ = query(
          collection(db, "price_history"),
          where("productId", "==", normalizedId)
        );
        const checkSnap = await getDocs(checkQ);
        
        // Tapisan (filter) di client-side untuk elak masalah Composite Index Firestore
        const hasRecordedToday = checkSnap.docs.some(doc => {
           const timestamp = doc.data().createdAt;
           // Jika timestamp null (bermakna ia baru ditambah dan pending sync), ia pasti hari ini
           if (!timestamp) return true;
           const docDate = timestamp.toDate();
           return docDate >= today;
        });

        if (hasRecordedToday) return; // Sudah direkod hari ini

        const price = parseFloat(initialPrice.toString().replace(/[^\d.]/g, ''));
        if (isNaN(price)) return;

        await addDoc(collection(db, "price_history"), {
          productName: productName,
          productId: normalizedId,
          price: price,
          priceRaw: initialPrice,
          source: initialSource || 'Unknown',
          createdAt: serverTimestamp()
        });
        console.log('📈 Harga direkod automatik:', price);
      } catch (err) {
        console.error('Error recording price snapshot:', err);
      }
    };

    const fetchHistory = async () => {
      if (!productName) return;
      setIsFetchingHistory(true);
      try {
        const normalizedId = normalizeProductId(productName);
        
        // --- ISU 3: HAD 30 HARI ---
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const thirtyDaysTimestamp = Timestamp.fromDate(thirtyDaysAgo);

        // --- ISU 2: QUERY MENGGUNAKAN productId (normalized) ---
        // Cuba query dengan productId dahulu
        let q = query(
          collection(db, "price_history"),
          where("productId", "==", normalizedId)
        );
        let snap = await getDocs(q);

        // Fallback: jika tiada hasil, cuba query lama (exact productName)
        if (snap.empty) {
          q = query(
            collection(db, "price_history"),
            where("productName", "==", productName)
          );
          snap = await getDocs(q);
        }

        const history = snap.docs.map(doc => {
          const timestamp = doc.data().createdAt;
          // Gunakan new Date() jika timestamp belum sync (masih null di cache lokal)
          const validDate = timestamp ? timestamp.toDate() : new Date();
          return {
            price: doc.data().price,
            rawDate: validDate.getTime(),
            date: validDate.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })
          };
        });
        // Susun secara manual (client-side)
        history.sort((a, b) => a.rawDate - b.rawDate);
        
        // Tapis hanya 30 hari terakhir (fallback juga ditapis di client-side)
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const filteredHistory = history.filter(h => h.rawDate >= cutoff || h.rawDate === 0);
        
        setHistoryData(filteredHistory.length > 0 ? filteredHistory : history);
      } catch (err) {
        console.error("Error fetching history:", err);
      } finally {
        setIsFetchingHistory(false);
      }
    };

    recordPriceSnapshot();
    fetchHistory();
    fetchComparison();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productName]);

  // FORMAT DATA UNTUK GRAF (Figure 11)
  const getChartData = () => {
    // Jika tiada history langsung
    if (historyData.length === 0) {
      return { labels: [], datasets: [] };
    }

    // Jika hanya ada 1 rekod, kita "gandakan" ia supaya nampak garisan lurus (visualisasi yang cantik)
    let displayData = [...historyData];
    if (displayData.length === 1) {
       displayData.push({ ...displayData[0], date: 'Now' });
       displayData.unshift({ ...displayData[0], date: 'Earlier' });
    }

    return {
      labels: displayData.map(h => h.date),
      datasets: [
        {
          label: 'Price (RM)',
          data: displayData.map(h => h.price),
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 5,
          pointBackgroundColor: '#2563eb',
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        titleFont: { size: 14 },
        bodyFont: { size: 14 },
        padding: 12,
        displayColors: false,
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        grid: { color: '#f1f5f9' },
        ticks: { color: '#64748b', font: { size: 10 } }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 10 } }
      }
    }
  };

  const handleSaveWatchlist = async () => {
    if (!user) {
      alert("Please log in to save to Watchlist!");
      navigate('/login');
      return;
    }

    // Helper: simpan ke trending untuk perkayakan kolam recommendation
    const saveToTrending = async () => {
      try {
        await addDoc(collection(db, "trending"), {
          name: productName,
          price: initialPrice,
          image: initialImage,
          link: initialLink || '',
          source: initialSource,
          category: "Footwear",
          createdAt: serverTimestamp()
        });
      } catch (err) {
        console.error("Error saving to trending:", err);
      }
    };

    try {
      await addDoc(collection(db, "watchlist"), {
        userId: user.uid,
        name: productName,
        price: initialPrice,
        image: initialImage,
        link: initialLink || '',
        source: initialSource,
        addedAt: serverTimestamp()
      });
      setIsSaved(true);
      saveToTrending(); // Juga simpan ke trending
      alert(`"${productName}" successfully saved to Watchlist!`);
    } catch (error) {
      console.error(error);
      alert("Failed to save to Watchlist.");
    }
  };

  const handleSetAlert = async (e) => {
    e.preventDefault();
    if (!user) {
      alert("Please log in to set a price alert!");
      navigate('/login');
      return;
    }
    if (!targetPrice) return;

    try {
      await addDoc(collection(db, "price_alerts"), {
        userId: user.uid,
        userEmail: user.email,
        productName: productName,
        targetPrice: targetPrice,
        currentPrice: initialPrice,
        image: initialImage,
        link: initialLink || '',
        source: initialSource || 'Unknown',
        createdAt: serverTimestamp(),
        status: "active",
        method: alertMethod
      });
      alert(`Alert set! We will notify you if the price of ${productName} drops below RM${targetPrice}`);
      setTargetPrice('');

      // Simpan ke trending juga apabila user set alert (signal kuat minat user)
      try {
        await addDoc(collection(db, "trending"), {
          name: productName,
          price: initialPrice,
          image: initialImage,
          link: initialLink || '',
          source: initialSource,
          category: "Footwear",
          createdAt: serverTimestamp()
        });
      } catch (err) {
        console.error("Error saving to trending from alert:", err);
      }
    } catch (error) {
      console.error(error);
      alert("Failed to set price alert.");
    }
  };

  return (
    <div style={containerStyle}>
      {/* Back Button */}
      <button onClick={() => navigate(-1)} style={backBtn}>
        <ChevronLeft size={20} /> Back to Results
      </button>

      <div style={mainGrid}>
        {/* Left Side: Product Image */}
        <div style={imageSection}>
          <div style={mainImageWrapper}>
            <img src={initialImage} alt={productName} style={mainImage} />
            <button 
              onClick={handleSaveWatchlist} 
              style={isSaved ? savedBtnStyle : watchlistBtnStyle}
              title={isSaved ? "Saved to Watchlist" : "Save to Watchlist"}
            >
              <Bookmark size={24} fill={isSaved ? "#fff" : "none"} />
            </button>
          </div>
          <h1 style={productTitle}>{productName}</h1>
          <p style={productDescription}>
            A high-performance sport gear designed for maximum comfort and durability. 
            Compare prices across major retailers in Malaysia to get the best deal.
          </p>
        </div>

        {/* Right Side: Comparison & Alerts */}
        <div style={infoSection}>
          {/* Price Comparison Table (Figure 11) */}
          <div style={cardStyle}>
            <div style={cardHeader}>
              <h2 style={cardTitle}>Price Comparison</h2>
              <span style={updatedTag}><Clock size={14} /> Updated just now</span>
            </div>
            
            <div style={tableWrapper}>
              {isLoading ? (
                <div style={loaderWrapper}>
                  <Loader2 className="spin" size={30} color="#2563eb" />
                  <p>Searching other stores...</p>
                </div>
              ) : (
                <table style={tableStyle}>
                  <tbody>
                    {comparisonResults.map((res, idx) => (
                      <tr key={idx} style={tableRow}>
                        <td style={tdStore}>
                          <div style={{ marginBottom: '8px' }}>{res.source}</div>
                          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', maxWidth: '200px' }}>
                             {!res.sizes ? (
                               <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                 <Loader2 className="spin" size={12} /> Checking sizes...
                               </span>
                             ) : res.sizes.length > 0 ? (
                               res.sizes.map((s, i) => <span key={i} style={sizeBadge}>{s}</span>)
                             ) : (
                               <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>Out of stock</span>
                             )}
                          </div>
                        </td>
                        <td style={tdPrice}>{formatPrice(res.price)}</td>
                        <td style={tdAction}>
                          <a href={res.link} target="_blank" rel="noreferrer" style={goStoreBtn}>
                            Go to Store <ExternalLink size={14} />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div style={priceTrendCard}>
            <div style={trendHeader}>
              <Clock size={20} color="#2563eb" />
              <h3 style={trendTitle}>30-Day Price Trend</h3>
            </div>
            
            <div style={{ height: '220px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isFetchingHistory ? (
                <div style={{ textAlign: 'center', color: '#64748b' }}>
                  <Loader2 className="spin" size={24} />
                  <p style={{ fontSize: '0.8rem', marginTop: '10px' }}>Loading history...</p>
                </div>
              ) : historyData.length >= 1 ? (
                <Line data={getChartData()} options={chartOptions} />
              ) : (
                <div style={{ textAlign: 'center', backgroundColor: '#f8fafc', padding: '30px', borderRadius: '12px', width: '100%' }}>
                  <TrendingDown size={30} color="#cbd5e1" />
                  <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '10px 0', lineHeight: '1.4' }}>
                    System has just started tracking this product. <br/>
                    <strong>Trend graph will appear</strong> after the first price data is recorded.
                  </p>
                </div>
              )}
            </div>
            
            {historyData.length >= 2 && (() => {
              const earliestPrice = historyData[0].price;
              const latestPrice = historyData[historyData.length - 1].price;
              const diff = latestPrice - earliestPrice;
              const isDown = diff < 0;
              const isUp = diff > 0;
              const color = isDown ? '#10b981' : isUp ? '#ef4444' : '#64748b';
              const Icon = isDown ? TrendingDown : isUp ? TrendingUp : TrendingDown;
              const label = isDown ? 'cheaper' : isUp ? 'more expensive' : 'stable';
              return (
                <p style={trendFooter}>
                  <Icon size={14} color={color} />
                  <span style={{ color: color, fontWeight: '600', marginLeft: '5px' }}>
                    RM{Math.abs(diff).toFixed(2)}
                  </span> 
                  <span style={{ marginLeft: '5px' }}>{label} since first tracked</span>
                </p>
              );
            })()}
          </div>

          <div style={subGrid}>
            {/* Price Alert (Figure 11) */}
            <div style={priceAlertCard}>
              <h2 style={{ ...cardTitle, color: '#fff' }}><Bell size={18} /> Price Alert</h2>
              <p style={alertSubtitle}>Get notified when this item drops below your target price.</p>
              
              <form onSubmit={handleSetAlert} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                <div style={inputGroup}>
                  <span style={inputPrefix}>{currency === 'MYR' ? 'RM' : currency}</span>
                  <input 
                    type="number" 
                    placeholder="Target Price" 
                    style={priceInput}
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    required
                  />
                </div>
                <div style={alertButtons}>
                    <button 
                      type="button" 
                      style={channelBtn(alertMethod === 'email')}
                      onClick={() => setAlertMethod('email')}
                    >
                      Email
                    </button>
                    <button 
                      type="button" 
                      style={channelBtn(alertMethod === 'telegram')}
                      onClick={() => setAlertMethod('telegram')}
                    >
                      Telegram
                    </button>
                </div>
                <button type="submit" style={setAlertBtn}>Set Alert</button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* YOU MIGHT ALSO LIKE - Content-Based Recommendation */}
      {similarProducts.length > 0 && (
        <div style={similarSection}>
          <h2 style={similarTitle}>
            <Sparkles size={20} style={{ color: '#f59e0b', verticalAlign: 'middle', marginRight: '8px' }} />
            You Might Also Like
          </h2>
          <p style={similarSubtitle}>Similar products based on brand and category.</p>
          <div style={similarGrid}>
            {similarProducts.map((item, idx) => (
              <div 
                key={idx} 
                style={similarCard}
                className="hover-lift"
                onClick={() => navigate(`/product-details?name=${encodeURIComponent(item.name)}&price=${encodeURIComponent(item.price)}&image=${encodeURIComponent(item.image)}&source=${encodeURIComponent(item.source)}&link=${encodeURIComponent(item.link)}`)}
              >
                {item.reason && <div style={similarReasonTag}>{item.reason}</div>}
                <div style={similarImageWrapper}>
                  <img src={item.image} alt={item.name} style={similarImage} />
                </div>
                <div style={similarContent}>
                  <p style={similarItemName}>{item.name}</p>
                  <div style={similarFooter}>
                    <span style={similarPrice}>{formatPrice(item.price)}</span>
                    <span style={similarSource}>{item.source}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// --- STYLING (CSS-in-JS) ---
const containerStyle = { padding: '40px 5%', maxWidth: '1300px', margin: '0 auto', minHeight: '100vh', backgroundColor: '#f8fafc' };
const backBtn = { display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', marginBottom: '30px', fontWeight: '500' };
const mainGrid = { display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '40px' };

const imageSection = { display: 'flex', flexDirection: 'column', gap: '20px' };
const mainImageWrapper = { backgroundColor: '#fff', borderRadius: '20px', padding: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', position: 'relative' };

const watchlistBtnStyle = {
  position: 'absolute',
  top: '20px',
  right: '20px',
  backgroundColor: '#fff',
  border: '1px solid #e2e8f0',
  padding: '12px',
  borderRadius: '50%',
  cursor: 'pointer',
  color: '#64748b',
  display: 'flex',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
};

const savedBtnStyle = {
  ...watchlistBtnStyle,
  backgroundColor: '#2563eb',
  color: '#fff',
  borderColor: '#2563eb'
};
const mainImage = { maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' };
const productTitle = { fontSize: '1.8rem', fontWeight: '800', color: '#1e293b', margin: '0 0 10px 0', lineHeight: '1.2' };
const productDescription = { color: '#64748b', lineHeight: '1.6', fontSize: '1rem' };

const infoSection = { display: 'flex', flexDirection: 'column', gap: '24px' };
const cardStyle = { backgroundColor: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' };
const cardHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const cardTitle = { fontSize: '1.2rem', fontWeight: '700', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' };
const updatedTag = { fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' };

const tableWrapper = { marginTop: '10px' };
const tableStyle = { width: '100%', borderCollapse: 'collapse' };
const tableRow = { borderBottom: '1px solid #f1f5f9' };
const tdStore = { padding: '15px 0', fontWeight: '600', color: '#475569' };
const sizeBadge = { backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '4px', fontSize: '0.7rem', color: '#334155', whiteSpace: 'nowrap' };
const tdPrice = { padding: '15px 0', fontWeight: '800', color: '#2563eb', fontSize: '1.1rem', textAlign: 'right' };
const tdAction = { padding: '15px 0', textAlign: 'right' };
const goStoreBtn = { backgroundColor: '#0f172a', color: '#fff', padding: '8px 16px', borderRadius: '6px', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '6px' };

const priceTrendCard = { ...cardStyle };
const trendHeader = { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' };
const trendTitle = { fontSize: '1.1rem', fontWeight: '700', color: '#1e293b', margin: 0 };
const trendFooter = { fontSize: '0.85rem', color: '#64748b', marginTop: '15px', display: 'flex', alignItems: 'center' };

const subGrid = { display: 'grid', gridTemplateColumns: '1fr', gap: '24px' };
const priceAlertCard = { 
  background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)', 
  borderRadius: '24px', 
  padding: '30px', 
  color: '#fff', 
  display: 'flex', 
  flexDirection: 'column', 
  gap: '20px',
  boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.4)'
};
const alertSubtitle = { fontSize: '0.95rem', color: '#c7d2fe', margin: 0, lineHeight: '1.5' };
const inputGroup = { 
  display: 'flex', 
  alignItems: 'center', 
  backgroundColor: 'rgba(255, 255, 255, 0.15)', 
  borderRadius: '12px', 
  padding: '5px 18px', 
  border: '1px solid rgba(255, 255, 255, 0.2)'
};
const inputPrefix = { fontWeight: '800', color: '#fff', fontSize: '1.1rem' };
const priceInput = { 
  background: 'none', 
  border: 'none', 
  padding: '12px 10px', 
  color: '#fff', 
  outline: 'none', 
  width: '100%', 
  fontWeight: '700', 
  fontSize: '1.1rem' 
};
const alertButtons = { display: 'flex', gap: '10px' };
const channelBtn = (isActive) => ({ 
  flex: 1, 
  backgroundColor: isActive ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)', 
  border: isActive ? '2px solid #fff' : '1px solid rgba(255, 255, 255, 0.2)', 
  color: '#fff', 
  padding: '10px', 
  borderRadius: '10px', 
  cursor: 'pointer', 
  fontSize: '0.85rem',
  fontWeight: '700',
  transition: 'all 0.2s ease'
});
const setAlertBtn = { 
  backgroundColor: '#fff', 
  color: '#4f46e5', 
  border: 'none', 
  padding: '14px', 
  borderRadius: '12px', 
  fontWeight: '800', 
  fontSize: '1rem',
  cursor: 'pointer', 
  marginTop: '5px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
};
const loaderWrapper = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '40px 0', color: '#64748b' };

// --- STYLES: You Might Also Like ---
const similarSection = {
  marginTop: '50px',
  padding: '30px 0'
};

const similarTitle = {
  fontSize: '1.5rem',
  fontWeight: '800',
  color: '#1e293b',
  margin: '0 0 5px 0',
  display: 'flex',
  alignItems: 'center'
};

const similarSubtitle = {
  color: '#64748b',
  margin: '0 0 25px 0',
  fontSize: '0.9rem'
};

const similarGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: '20px'
};

const similarCard = {
  backgroundColor: '#fff',
  borderRadius: '16px',
  padding: '16px',
  cursor: 'pointer',
  border: '1px solid #e2e8f0',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  transition: 'all 0.25s ease',
  position: 'relative'
};

const similarReasonTag = {
  position: 'absolute',
  top: '12px',
  right: '12px',
  background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
  color: '#92400e',
  padding: '3px 10px',
  borderRadius: '6px',
  fontSize: '0.7rem',
  fontWeight: '700',
  zIndex: 1
};

const similarImageWrapper = {
  height: '140px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '12px',
  backgroundColor: '#f8fafc',
  borderRadius: '12px'
};

const similarImage = {
  maxWidth: '100%',
  maxHeight: '120px',
  objectFit: 'contain'
};

const similarContent = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px'
};

const similarItemName = {
  fontSize: '0.85rem',
  fontWeight: '600',
  color: '#1e293b',
  margin: 0,
  lineHeight: '1.3',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden'
};

const similarFooter = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const similarPrice = {
  fontSize: '0.95rem',
  fontWeight: '800',
  color: '#2563eb'
};

const similarSource = {
  fontSize: '0.7rem',
  color: '#64748b',
  backgroundColor: '#f1f5f9',
  padding: '2px 8px',
  borderRadius: '4px',
  fontWeight: '600'
};

export default ProductDetails;
