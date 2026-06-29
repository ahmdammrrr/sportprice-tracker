import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { LogIn, UserPlus, Mail, Lock } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore'; 
import { db } from '../firebase'; // Pastikan db diimport

const Auth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
  e.preventDefault();
  setError('');
  
  try {
    if (isLogin) {
      await signInWithEmailAndPassword(auth, email, password);
      if (email === 'admin@sportprice.com' || email === 'ahmadammar0601@gmail.com') {
        alert("Welcome back, Admin!");
        navigate('/admin');
      } else {
        alert("Welcome back!");
        navigate('/dashboard');
      }
    } else {
      // 1. Cipta user di Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Simpan data user ke Firestore secara manual
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        joinedDate: new Date().toISOString(),
        status: "Active"
      });

      if (email === 'admin@sportprice.com' || email === 'ahmadammar0601@gmail.com') {
        alert("Admin account created successfully!");
        navigate('/admin');
      } else {
        alert("Account created successfully and saved to Database!");
        navigate('/dashboard');
      }
    }
  } catch (err) {
    setError(err.message);
  }
};

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>
          {isLogin ? 'Login to SportPrice' : 'Create a New Account'}
        </h2>

        {error && <p style={{ color: 'red', fontSize: '0.8rem' }}>{error}</p>}

        <form onSubmit={handleSubmit} style={formStyle}>
          <div style={inputGroup}>
            <Mail size={18} color="#666" />
            <input 
              type="email" 
              placeholder="Your Email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle} 
              required 
            />
          </div>

          <div style={inputGroup}>
            <Lock size={18} color="#666" />
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle} 
              required 
            />
          </div>

          <button type="submit" style={buttonStyle}>
            {isLogin ? <><LogIn size={18} /> Login</> : <><UserPlus size={18} /> Register</>}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '15px', fontSize: '0.9rem' }}>
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <span 
            onClick={() => setIsLogin(!isLogin)} 
            style={{ color: '#2563eb', cursor: 'pointer', fontWeight: 'bold', marginLeft: '5px' }}
          >
            {isLogin ? 'Register Here' : 'Login Here'}
          </span>
        </p>
      </div>
    </div>
  );
};

// --- STYLING RINGKAS ---
const containerStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', backgroundColor: '#f8fafc' };
const cardStyle = { backgroundColor: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', width: '100%', maxWidth: '400px' };
const formStyle = { display: 'flex', flexDirection: 'column', gap: '15px' };
const inputGroup = { display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #ddd', padding: '10px', borderRadius: '8px' };
const inputStyle = { border: 'none', outline: 'none', width: '100%' };
const buttonStyle = { backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' };

export default Auth;