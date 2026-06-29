import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, query, orderBy, limit } from 'firebase/firestore';
import { Users, Activity, Settings, Trash2, Power, Server, Edit3, X, Loader2 } from 'lucide-react';
import { getAuth, updateProfile, updateEmail, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

const AdminDashboard = ({ user }) => {
  const [activeTab, setActiveTab] = useState('users');
  const [usersList, setUsersList] = useState([]);
  const [logsList, setLogsList] = useState([]);
  const [stores, setStores] = useState({
    alikhsan: true,
    sportsdirect: true,
    originalclassic: true
  });
  
  const [apiUsage, setApiUsage] = useState({
    used: 0,
    total: 1000,
    percentage: 0
  });

  // States untuk Edit Profile Admin
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    if (user?.email === 'admin@sportprice.com' || user?.email === 'ahmadammar0601@gmail.com') {
      fetchUsers();
      fetchLogs();
      fetchApiUsage();
      fetchStoreSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function fetchStoreSettings() {
    try {
      const docSnap = await getDocs(query(collection(db, 'settings')));
      
      // Jika tak wujud, kita anggap semua ON
      let exists = false;
      docSnap.forEach(d => {
        if(d.id === 'store_status') {
           exists = true;
           setStores(d.data());
        }
      });
      
      // Setup default jika kosong
      if(!exists) {
        import('firebase/firestore').then(({ doc, setDoc }) => {
            setDoc(doc(db, 'settings', 'store_status'), stores);
        });
      }
    } catch (error) {
      console.error("Gagal dapatkan setting kedai", error);
    }
  }

  async function fetchApiUsage() {
    try {
      const response = await fetch(`${API_URL}/api/admin/scraper-usage`);
      const json = await response.json();
      if (json.status === 'Success') {
        const used = json.data.requestCount;
        const limit = json.data.requestLimit;
        setApiUsage({
          used: used,
          total: limit,
          percentage: (used / limit) * 100
        });
      }
    } catch (error) {
      console.error("Gagal dapatkan data API:", error);
    }
  }

  async function fetchLogs() {
    try {
      const q = query(collection(db, "system_logs"), orderBy("timestamp", "desc"), limit(50));
      const snapshot = await getDocs(q);
      const lList = snapshot.docs.map(doc => {
        const data = doc.data();
        let timeStr = new Date().toLocaleTimeString();
        if (data.timestamp) {
           timeStr = data.timestamp.toDate().toLocaleTimeString();
        }
        return { id: doc.id, time: timeStr, ...data };
      });
      setLogsList(lList);
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
  }

  async function fetchUsers() {
    try {
      const q = query(collection(db, "users"), orderBy("joinedDate", "desc"));
      const snapshot = await getDocs(q);
      const uList = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(u => u.email !== 'admin@sportprice.com' && u.email !== 'ahmadammar0601@gmail.com');
      setUsersList(uList);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }

  const handleDeleteUser = async (userId) => {
    if (confirm('Adakah anda pasti untuk padam user ini? Tindakan ini tidak boleh diundur.')) {
      try {
        const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
            alert("User successfully deleted from Database and Auth!");
            fetchUsers();
        } else {
            alert("Failed to delete user completely. See console for error.");
        }
      } catch (error) {
        console.error(error);
        alert("Failed to connect to server.");
      }
    }
  };

  const toggleStore = async (storeKey) => {
    const newStatus = !stores[storeKey];
    setStores(prev => ({ ...prev, [storeKey]: newStatus }));
    
    try {
        const { updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(db, 'settings', 'store_status'), {
            [storeKey]: newStatus
        });
    } catch (error) {
        console.error("Gagal kemaskini status kedai", error);
    }
  };

  const handleOpenEditModal = () => {
    setEditDisplayName(user.displayName || user.email.split('@')[0]);
    setEditEmail(user.email);
    setCurrentPassword('');
    setEditError('');
    setEditSuccess('');
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setEditError('');
    setEditSuccess('');

    try {
      const auth = getAuth();
      const isEmailChanged = editEmail !== user.email;

      // 1. Re-authenticate WAJIB jika email ditukar
      if (isEmailChanged) {
        if (!currentPassword) {
          throw new Error('Sila masukkan Kata Laluan Semasa untuk menukar e-mel.');
        }
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        
        await updateEmail(user, editEmail);
      }

      // 2. Update Display Name
      if (editDisplayName !== user.displayName) {
        await updateProfile(user, { displayName: editDisplayName });
      }

      // 3. Sync to Firestore
      const { updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: editDisplayName,
        email: editEmail
      });

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
      setIsSavingProfile(false);
    }
  };

  if (!user || (user.email !== 'admin@sportprice.com' && user.email !== 'ahmadammar0601@gmail.com')) {
    return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <h2 style={{ color: 'red' }}>Access Denied!</h2>
        <p>Only Administrators are allowed to access this page.</p>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{...headerStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div>
          <h2>Admin Control Panel ({user.displayName || user.email.split('@')[0]})</h2>
          <p>SportPrice Aggregator Central Monitoring System</p>
        </div>
        <button onClick={handleOpenEditModal} style={editBtn}>
          <Edit3 size={18} /> Edit Profile
        </button>
      </div>

      <div style={dashboardGrid}>
        {/* SIDEBAR */}
        <div style={sidebarStyle}>
          <button style={tabBtn(activeTab === 'users')} onClick={() => setActiveTab('users')}>
            <Users size={18} /> Manage Users
          </button>
          <button style={tabBtn(activeTab === 'api')} onClick={() => setActiveTab('api')}>
            <Activity size={18} /> API Usage
          </button>
          <button style={tabBtn(activeTab === 'stores')} onClick={() => setActiveTab('stores')}>
            <Settings size={18} /> Store Status
          </button>
          <button style={tabBtn(activeTab === 'logs')} onClick={() => setActiveTab('logs')}>
            <Server size={18} /> System Logs
          </button>
        </div>

        {/* MAIN CONTENT */}
        <div style={contentStyle}>
          {activeTab === 'users' && (
            <div>
              <h3>Registered Users List</h3>
              <div style={tableContainer}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={tableHeader}>
                      <th style={thStyle}>Email</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Telegram</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map((u) => (
                      <tr key={u.id} style={tableRow}>
                        <td style={tdStyle}>{u.email}</td>
                        <td style={tdStyle}>
                          <span style={statusBadge}>{u.status || 'Active'}</span>
                        </td>
                        <td style={tdStyle}>
                          {u.telegramChatId ? '✅ Connected' : '❌ Not yet'}
                        </td>
                        <td style={tdStyle}>
                          <button onClick={() => handleDeleteUser(u.id)} style={deleteBtn}>
                            <Trash2 size={16} /> Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {usersList.length === 0 && (
                      <tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center' }}>No users found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div>
              <h3>ScraperAPI Usage Monitoring</h3>
              <div style={cardStyle}>
                <p style={{ color: '#64748b', marginBottom: '10px' }}>Total Requests Used (This Month)</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{apiUsage.used}</span>
                  <span style={{ color: '#64748b' }}>/ {apiUsage.total}</span>
                </div>
                <div style={progressBarBg}>
                  <div style={{...progressBarFill, width: `${apiUsage.percentage}%`}}></div>
                </div>
                <p style={{ marginTop: '15px', fontSize: '0.9rem', color: '#64748b' }}>API quota is expected to last for another 14 days.</p>
              </div>
            </div>
          )}

          {activeTab === 'stores' && (
            <div>
              <h3>Retailer Configuration (Live Toggle)</h3>
              <p style={{ color: '#64748b', marginBottom: '20px' }}>Disable search for specific stores if their website is down.</p>
              
              <div style={cardStyle}>
                <div style={storeRow}>
                  <span style={{ fontWeight: 'bold' }}>Al-Ikhsan Sports</span>
                  <button onClick={() => toggleStore('alikhsan')} style={toggleBtn(stores.alikhsan)}>
                    <Power size={16} /> {stores.alikhsan ? 'ACTIVE' : 'DISABLED'}
                  </button>
                </div>
                <div style={storeRow}>
                  <span style={{ fontWeight: 'bold' }}>Sports Direct</span>
                  <button onClick={() => toggleStore('sportsdirect')} style={toggleBtn(stores.sportsdirect)}>
                    <Power size={16} /> {stores.sportsdirect ? 'ACTIVE' : 'DISABLED'}
                  </button>
                </div>
                <div style={storeRow}>
                  <span style={{ fontWeight: 'bold' }}>Original Classic</span>
                  <button onClick={() => toggleStore('originalclassic')} style={toggleBtn(stores.originalclassic)}>
                    <Power size={16} /> {stores.originalclassic ? 'ACTIVE' : 'DISABLED'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div>
              <h3>Live System Logs (Background Worker)</h3>
              <button onClick={fetchLogs} style={{ marginBottom: '10px', padding: '5px 10px', cursor: 'pointer' }}>Refresh Logs</button>
              <div style={{ backgroundColor: '#1e293b', color: '#10b981', padding: '20px', borderRadius: '8px', fontFamily: 'monospace', height: '300px', overflowY: 'auto' }}>
                {logsList.length === 0 ? <p>No logs available.</p> : null}
                {logsList.map(log => {
                  let color = '#10b981'; // hijau default
                  if (log.type === 'error') color = '#ef4444'; // merah
                  else if (log.type === 'warning') color = '#f59e0b'; // oren
                  else if (log.type === 'alert') color = '#3b82f6'; // biru
                  
                  return (
                    <p key={log.id} style={{ color, margin: '5px 0' }}>
                      <span style={{ color: '#94a3b8' }}>[{log.time}]</span> {log.message}
                    </p>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* EDIT PROFILE MODAL */}
      {isEditModalOpen && (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <div style={modalHeader}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>Edit Admin Profile</h2>
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
                    required
                  />
                </div>
              )}

              <button type="submit" disabled={isSavingProfile} style={saveBtn}>
                {isSavingProfile ? <Loader2 className="spin" size={18} /> : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// --- STYLING ---
const containerStyle = { padding: '40px 5%', maxWidth: '1200px', margin: '0 auto', minHeight: '80vh', backgroundColor: '#f8fafc' };
const headerStyle = { marginBottom: '30px' };
const dashboardGrid = { display: 'flex', gap: '30px' };
const sidebarStyle = { width: '250px', display: 'flex', flexDirection: 'column', gap: '10px' };
const contentStyle = { flex: 1, backgroundColor: '#fff', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' };
const tabBtn = (active) => ({ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px', backgroundColor: active ? '#2563eb' : 'transparent', color: active ? '#fff' : '#475569', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontWeight: 'bold' });
const emptyState = { textAlign: 'center', padding: '40px', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '8px' };

// --- MODAL STYLES ---
const editBtn = { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#1e293b', transition: 'all 0.2s ease', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' };
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

const tableContainer = { overflowX: 'auto', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' };
const tableHeader = { backgroundColor: '#f1f5f9', borderBottom: '2px solid #e2e8f0' };
const thStyle = { padding: '15px', textAlign: 'left', color: '#475569', fontWeight: '600' };
const tdStyle = { padding: '15px', borderBottom: '1px solid #e2e8f0', color: '#1e293b' };
const tableRow = { ':hover': { backgroundColor: '#f8fafc' } };
const statusBadge = { backgroundColor: '#dcfce7', color: '#166534', padding: '5px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' };
const deleteBtn = { display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' };
const cardStyle = { backgroundColor: '#f8fafc', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0' };
const progressBarBg = { width: '100%', height: '12px', backgroundColor: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' };
const progressBarFill = { height: '100%', backgroundColor: '#2563eb', transition: 'width 0.5s ease' };
const storeRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #e2e8f0' };
const toggleBtn = (active) => ({ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: active ? '#10b981' : '#ef4444', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' });

export default AdminDashboard;
