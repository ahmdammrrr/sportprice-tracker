import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendEmailVerification } from 'firebase/auth';
import { LogIn, UserPlus, Mail, Lock } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore'; 
import { db } from '../firebase'; // Pastikan db diimport

const Auth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  // Helper untuk Kekuatan Kata Laluan
  const calculatePasswordStrength = (pass) => {
    let score = 0;
    if (pass.length > 5) score += 1;
    if (pass.length > 7) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return Math.min(score, 4);
  };
  const strengthScore = calculatePasswordStrength(password);
  const strengthColors = ['#e2e8f0', '#ef4444', '#f59e0b', '#10b981', '#10b981']; // Gray, Red, Orange, Green, Green
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  const handleSubmit = async (e) => {
  e.preventDefault();
  setError('');
  
  try {
    if (isLogin) {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Semak Email Verification (penting untuk keselamatan)
      if (!user.emailVerified && email !== 'admin@sportprice.com' && email !== 'ahmadammar0601@gmail.com') {
        await signOut(auth);
        throw new Error("Please verify your email address before logging in. Check your inbox/spam folder.");
      }

      if (email === 'admin@sportprice.com' || email === 'ahmadammar0601@gmail.com') {
        alert("Welcome back, Admin!");
        navigate('/admin');
      } else {
        alert("Welcome back!");
        navigate('/dashboard');
      }
    } else {
      // Validasi UI Register
      if (password !== confirmPassword) {
        throw new Error("Passwords do not match!");
      }
      if (strengthScore < 3) {
        throw new Error("Please choose a stronger password (min 8 chars, 1 uppercase, 1 number).");
      }

      // 1. Cipta user di Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. HANTAR E-MEL PENGESAHAN
      await sendEmailVerification(user);

      // 2. Simpan data user ke Firestore secara manual
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        joinedDate: new Date().toISOString(),
        status: "Active"
      });

      // 4. SELESAIKAN ISU AUTO-LOGIN
      // Secara lalai, Firebase akan terus log masuk user selepas daftar.
      // Kita sign-out mereka supaya mereka terpaksa login secara manual selepas sahkan e-mel.
      await signOut(auth);

      alert("Registration successful! A verification link has been sent to your email. Please verify your email before logging in.");
      
      // Kosongkan password dan tukar form kepada mod Login
      setPassword('');
      setConfirmPassword('');
      setIsLogin(true);
    }
  } catch (err) {
    setError(err.message);
  }
};

  return (
    <div style={{ ...containerStyle, backgroundColor: isLogin ? '#f8fafc' : '#ecfdf5', transition: 'background-color 0.5s ease' }}>
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

          {/* Password Strength Meter (Hanya untuk Register) */}
          {!isLogin && password.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '-5px' }}>
              <div style={{ display: 'flex', gap: '5px', height: '4px' }}>
                {[1, 2, 3, 4].map(level => (
                  <div key={level} style={{ flex: 1, backgroundColor: strengthScore >= level ? strengthColors[strengthScore] : '#e2e8f0', borderRadius: '2px', transition: 'all 0.3s' }} />
                ))}
              </div>
              <span style={{ fontSize: '0.7rem', color: strengthColors[strengthScore], textAlign: 'right', fontWeight: 'bold' }}>
                {strengthLabels[strengthScore]}
              </span>
            </div>
          )}

          {/* Confirm Password (Hanya untuk Register) */}
          {!isLogin && (
            <div style={inputGroup}>
              <Lock size={18} color="#666" />
              <input 
                type="password" 
                placeholder="Confirm Password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={inputStyle} 
                required 
              />
            </div>
          )}

          <button type="submit" style={{ ...buttonStyle, backgroundColor: isLogin ? '#2563eb' : '#10b981', transition: 'background-color 0.3s ease' }}>
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