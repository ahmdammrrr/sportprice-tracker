import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { 
  User, 
  Heart, 
  Bell, 
  TrendingDown, 
  ArrowRight, 
  LogOut, 
  MessageCircle,
  CheckCircle2,
  Loader2,
  Edit3,
  X
} from 'lucide-react';
import { getAuth, signOut, updateProfile, updateEmail, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { updateDoc } from 'firebase/firestore';

const Dashboard = ({ user }) => {
  const [stats, setStats] = useState({ watchlist: 0, alerts: 0, triggered: 0 });
  const [userProfile, setUserProfile] = useState(null);
  const [recentWatchlist, setRecentWatchlist] = useState([]);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // States untuk Edit Profile
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const navigate = useNavigate();
  const auth = getAuth();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        // 1. Fetch User Profile (Untuk Telegram Status) - Letak di atas supaya tak terjejas dengan error lain
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            setUserProfile(userSnap.data());
        }

        // 2. Fetch Stats
        const watchlistSnap = await getDocs(query(collection(db, "watchlist"), where("userId", "==", user.uid)));
        const alertsSnap = await getDocs(query(collection(db, "price_alerts"), where("userId", "==", user.uid)));
        const triggeredSnap = await getDocs(query(collection(db, "price_alerts"), where("userId", "==", user.uid), where("status", "==", "triggered")));
        
        setStats({
          watchlist: watchlistSnap.size,
          alerts: alertsSnap.size,
          triggered: triggeredSnap.size
        });

        // 3. Fetch Recent Watchlist (Top 3)
        const qRecent = query(collection(db, "watchlist"), where("userId", "==", user.uid), limit(3));
        const recentSnap = await getDocs(qRecent);
        setRecentWatchlist(recentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        // 4. Fetch Notifications (Tanpa orderBy untuk elak error Index Firebase)
        const qNotif = query(collection(db, "notifications"), where("userId", "==", user.uid), limit(5));
        const notifSnap = await getDocs(qNotif);
        setRecentNotifications(notifSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [user, navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const handleOpenEditModal = () => {
    setEditDisplayName(user.displayName || userProfile?.displayName || user.email.split('@')[0]);
    setEditEmail(user.email);
    setCurrentPassword('');
    setEditError('');
    setEditSuccess('');
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setEditError('');
    setEditSuccess('');

    try {
      const isEmailChanged = editEmail !== user.email;

      // 1. Re-authenticate WAJIB jika email ditukar
      if (isEmailChanged) {
        if (!currentPassword) {
          throw new Error('Sila masukkan Kata Laluan Semasa untuk menukar e-mel.');
        }
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        
        // Update Email di Auth
        await updateEmail(user, editEmail);
      }

      // 2. Update Display Name di Auth (jika berubah atau kosong)
      if (editDisplayName !== user.displayName) {
        await updateProfile(user, { displayName: editDisplayName });
      }

      // 3. Update Firestore (Sync)
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: editDisplayName,
        email: editEmail
      });

      // Kemas kini state UI tempatan
      setUserProfile(prev => ({ ...prev, displayName: editDisplayName, email: editEmail }));
      setEditSuccess('Profil berjaya dikemas kini!');
      
      setTimeout(() => {
        setIsEditModalOpen(false);
        setEditSuccess('');
      }, 2000);

    } catch (error) {
      console.error(error);
      if (error.code === 'auth/wrong-password') {
        setEditError('Kata laluan semasa salah.');
      } else if (error.code === 'auth/invalid-email') {
        setEditError('Format e-mel tidak sah.');
      } else if (error.code === 'auth/email-already-in-use') {
        setEditError('E-mel ini sudah digunakan oleh akaun lain.');
      } else {
        setEditError(error.message || 'Gagal mengemas kini profil.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div style={loadingWrapper}>
        <Loader2 className="spin" size={40} color="#2563eb" />
        <p>Loading your Dashboard...</p>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* HEADER SECTION */}
      <div style={headerSection}>
        <div style={userProfileStyle}>
          <div style={avatarStyle}>
            <User size={32} color="#fff" />
          </div>
          <div>
            <h1 style={welcomeTitle}>Welcome, {user.displayName || userProfile?.displayName || user.email.split('@')[0]}!</h1>
            <p style={userSub}>{user.email}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleOpenEditModal} style={editBtn}>
            <Edit3 size={18} /> Edit Profile
          </button>
          <button onClick={handleLogout} style={logoutBtn}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </div>

      {/* STATS GRID */}
      <div style={statsGrid}>
        <div style={statCard('#eff6ff', '#2563eb')}>
          <div style={statIconBox('#dbeafe', '#2563eb')}><Heart size={24} /></div>
          <div>
            <h3 style={statValue}>{stats.watchlist}</h3>
            <p style={statLabel}>Watchlist</p>
          </div>
        </div>
        <div style={statCard('#fef2f2', '#ef4444')}>
          <div style={statIconBox('#fee2e2', '#ef4444')}><Bell size={24} /></div>
          <div>
            <h3 style={statValue}>{stats.alerts}</h3>
            <p style={statLabel}>Price Alerts</p>
          </div>
        </div>
        <div style={statCard('#f0fdf4', '#10b981')}>
          <div style={statIconBox('#dcfce7', '#10b981')}><TrendingDown size={24} /></div>
          <div>
            <h3 style={statValue}>{stats.triggered}</h3>
            <p style={statLabel}>Drops Detected</p>
          </div>
        </div>
      </div>

      <div style={mainGrid}>
        {/* PROFILE & SETTINGS */}
        <div style={sectionBox}>
          <div style={sectionHeader}>
            <h2 style={sectionTitle}>Notification Settings</h2>
          </div>
          <div style={telegramBox}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={telegramIcon}><MessageCircle size={28} color="#fff" /></div>
              <div>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem', color: '#1e293b' }}>Telegram Bot</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Receive price alerts directly to Telegram.</p>
              </div>
            </div>
            
            <div style={{ marginTop: '20px' }}>
              {userProfile?.telegramChatId ? (
                <div style={connectedBadge}>
                  <CheckCircle2 size={16} /> Connected! (ID: {userProfile.telegramChatId})
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <a 
                    href={`https://t.me/sportprice_fyp_bot?start=${user.uid}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    style={connectBtn}
                  >
                    Connect Telegram Now
                  </a>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`https://t.me/sportprice_fyp_bot?start=${user.uid}`);
                      alert("Pautan telah disalin! Hantar kepada kawan anda.");
                    }} 
                    style={copyBtn}
                  >
                    Copy Link to Share
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RECENT ACTIVITY */}
        <div style={sectionBox}>
          <div style={sectionHeader}>
            <h2 style={sectionTitle}>Recent Activity</h2>
            <Link to="/watchlist" style={viewAllLink}>View All <ArrowRight size={14} /></Link>
          </div>
          <div style={watchlistList}>
            {recentWatchlist.length === 0 ? (
              <p style={emptyText}>No recent activity.</p>
            ) : (
              recentWatchlist.map(item => (
                <div key={item.id} style={watchlistCard}>
                  <img src={item.image} alt={item.name} style={itemImg} />
                  <div style={{ flex: 1 }}>
                    <h4 style={itemName}>{item.name}</h4>
                    <p style={itemPrice}>{item.price}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* NOTIFICATIONS */}
        <div style={sectionBox}>
          <div style={sectionHeader}>
            <h2 style={sectionTitle}>Notifications</h2>
            <Link to="/price-alerts" style={viewAllLink}>Manage Alerts <ArrowRight size={14} /></Link>
          </div>
          <div style={notifList}>
            {recentNotifications.length === 0 ? (
              <p style={emptyText}>No new notifications.</p>
            ) : (
              recentNotifications.map(notif => (
                <div key={notif.id} style={notifCard}>
                  <div style={notifDot} />
                  <div>
                    <h4 style={notifTitle}>{notif.title}</h4>
                    <p style={notifMsg}>{notif.message}</p>
                    <small style={notifTime}>{notif.createdAt?.toDate().toLocaleDateString()}</small>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* EDIT PROFILE MODAL */}
      {isEditModalOpen && (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <div style={modalHeader}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>Edit Profile</h2>
              <button onClick={() => setIsEditModalOpen(false)} style={closeBtn}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveProfile} style={modalBody}>
              {editError && <div style={errorBanner}>{editError}</div>}
              {editSuccess && <div style={successBanner}>{editSuccess}</div>}

              <div style={inputGroup}>
                <label style={inputLabel}>Display Name</label>
                <input 
                  type="text" 
                  value={editDisplayName} 
                  onChange={e => setEditDisplayName(e.target.value)} 
                  style={inputStyle}
                  placeholder="e.g. Ahmad Ali"
                  required
                />
              </div>

              <div style={inputGroup}>
                <label style={inputLabel}>Email Address</label>
                <input 
                  type="email" 
                  value={editEmail} 
                  onChange={e => setEditEmail(e.target.value)} 
                  style={inputStyle}
                  required
                />
              </div>

              {editEmail !== user.email && (
                <div style={inputGroup}>
                  <label style={inputLabel}>Current Password <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>(Required to change email)</span></label>
                  <input 
                    type="password" 
                    value={currentPassword} 
                    onChange={e => setCurrentPassword(e.target.value)} 
                    style={inputStyle}
                    placeholder="Enter your current password"
                    required
                  />
                </div>
              )}

              <button type="submit" disabled={isSaving} style={saveBtn}>
                {isSaving ? <Loader2 className="spin" size={18} /> : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// --- STYLING ---
const containerStyle = { padding: '40px 5%', maxWidth: '1200px', margin: '0 auto', minHeight: '100vh', backgroundColor: '#f8fafc' };
const loadingWrapper = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: '20px', color: '#64748b' };

const headerSection = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' };
const userProfileStyle = { display: 'flex', alignItems: 'center', gap: '20px' };
const avatarStyle = { backgroundColor: '#0f172a', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const welcomeTitle = { fontSize: '1.8rem', fontWeight: '800', color: '#1e293b', margin: 0 };
const userSub = { color: '#64748b', margin: '5px 0 0 0' };

const logoutBtn = { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#ef4444', transition: 'all 0.2s ease', boxShadow: 'var(--shadow-sm)' };
const editBtn = { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#1e293b', transition: 'all 0.2s ease', boxShadow: 'var(--shadow-sm)' };

const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginBottom: '40px' };
const statCard = () => ({ backgroundColor: '#fff', padding: '24px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' });
const statIconBox = (bg, color) => ({ backgroundColor: bg, color: color, padding: '12px', borderRadius: '12px', display: 'flex' });
const statValue = { fontSize: '1.8rem', fontWeight: '800', color: '#1e293b', margin: 0 };
const statLabel = { color: '#64748b', margin: 0, fontSize: '0.9rem', fontWeight: '500' };

const mainGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' };
const sectionBox = { backgroundColor: '#fff', borderRadius: '20px', padding: '30px', border: '1px solid #e2e8f0' };
const sectionHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' };
const sectionTitle = { fontSize: '1.2rem', fontWeight: '700', color: '#1e293b', margin: 0 };
const viewAllLink = { fontSize: '0.85rem', color: '#2563eb', textDecoration: 'none', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' };

const telegramBox = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' };
const telegramIcon = { backgroundColor: '#0088cc', padding: '12px', borderRadius: '12px', display: 'flex' };
const connectBtn = { display: 'inline-block', backgroundColor: '#0088cc', color: '#fff', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '0.9rem', width: '100%', textAlign: 'center', boxSizing: 'border-box' };
const copyBtn = { display: 'inline-block', backgroundColor: '#fff', color: '#0088cc', border: '1px solid #0088cc', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '0.9rem', width: '100%', textAlign: 'center', boxSizing: 'border-box', cursor: 'pointer' };
const connectedBadge = { display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', backgroundColor: '#dcfce7', padding: '10px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600', justifyContent: 'center' };

const watchlistList = { display: 'flex', flexDirection: 'column', gap: '15px' };
const watchlistCard = { display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', backgroundColor: '#f8fafc', borderRadius: '12px' };
const itemImg = { width: '50px', height: '50px', objectFit: 'contain', backgroundColor: '#fff', borderRadius: '8px', padding: '5px' };
const itemName = { fontSize: '0.9rem', fontWeight: '600', color: '#1e293b', margin: 0, lineHeight: '1.3' };
const itemPrice = { fontSize: '0.9rem', fontWeight: '700', color: '#2563eb', margin: '5px 0 0 0' };

const notifList = { display: 'flex', flexDirection: 'column', gap: '20px' };
const notifCard = { display: 'flex', gap: '15px', paddingBottom: '15px', borderBottom: '1px solid #f1f5f9' };
const notifDot = { width: '8px', height: '8px', backgroundColor: '#2563eb', borderRadius: '50%', marginTop: '8px', flexShrink: 0 };
const notifTitle = { fontSize: '0.95rem', fontWeight: '700', color: '#1e293b', margin: 0 };
const notifMsg = { fontSize: '0.85rem', color: '#64748b', margin: '5px 0 0 0', lineHeight: '1.4' };
const notifTime = { fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginTop: '5px' };
const emptyText = { textAlign: 'center', color: '#94a3b8', padding: '20px' };

// --- MODAL STYLES ---
const modalOverlay = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' };
const modalCard = { backgroundColor: '#fff', width: '100%', maxWidth: '450px', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' };
const modalHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #e2e8f0' };
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px', borderRadius: '50%' };
const modalBody = { padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' };
const inputGroup = { display: 'flex', flexDirection: 'column', gap: '8px' };
const inputLabel = { fontSize: '0.9rem', fontWeight: '600', color: '#475569' };
const inputStyle = { padding: '12px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', width: '100%', boxSizing: 'border-box' };
const saveBtn = { backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '600', fontSize: '1rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', marginTop: '10px' };
const errorBanner = { backgroundColor: '#fef2f2', color: '#ef4444', padding: '12px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '500' };
const successBanner = { backgroundColor: '#f0fdf4', color: '#10b981', padding: '12px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '500' };

export default Dashboard;

