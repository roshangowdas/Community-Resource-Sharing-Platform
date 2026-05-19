import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { Mail, Lock, User, ArrowRight, ShieldCheck, Eye, EyeOff } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const { loginWithGoogle, loginWithEmail, registerWithEmail } = useAuth();
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      navigate('/');
    } catch (err: any) {
      console.error(err);
      let message = 'Google coordination failed.';
      if (err.code === 'auth/unauthorized-domain') {
        message = 'Localhost is not an authorized domain. Please add it to your Firebase Console settings.';
      }
      setError(message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isLogin) {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(name, email, password);
        setIsLogin(true);
      }
      navigate('/');
    } catch (err: any) {
      console.error(err);
      let message = 'Authentication protocol failure.';
      
      // Handle technical Firebase error codes
      if (err.code === 'auth/email-already-in-use') {
        message = 'This email is already part of the grid. Try logging in instead.';
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        message = 'This email is already linked to another login method (e.g. Google). Please use that instead.';
      } else if (err.code === 'auth/wrong-password') {
        message = 'Access denied. Password verification failed.';
      } else if (err.code === 'auth/user-not-found') {
        message = 'Node not found. Please register as a new neighbor first.';
      } else if (err.code === 'auth/invalid-credential') {
        message = 'Invalid credentials provided. If you registered via Google, please use the Google button.';
      } else if (err.code === 'auth/weak-password') {
        message = 'Password strength insufficient. Minimum 6 characters required.';
      } else if (err.code === 'auth/operation-not-allowed') {
        message = 'Email/Password auth is not enabled in Firebase. Please enable it in the Firebase Console.';
      } else if (err.message) {
        message = err.message;
      }
      
      setError(message);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-24">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-12 md:p-16 border-sky-500/10 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-40 h-40 bg-sky-500/10 rounded-full blur-3xl -ml-20 -mt-20 px-8" />
        
        <div className="text-center mb-16 relative z-10 space-y-6">
          <div className="w-20 h-20 bg-sky-950 rounded-[2rem] mx-auto flex items-center justify-center text-sky-400 shadow-3xl shadow-sky-500/10 border border-sky-500/20">
            <ShieldCheck size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-4xl font-bold text-white tracking-tighter uppercase tracking-wide">{isLogin ? 'Protocol Login' : 'Register Node'}</h2>
            <p className="text-sky-100/40 text-[10px] uppercase tracking-[0.4em] font-bold">Secure Local Access</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-600 text-[10px] font-bold uppercase tracking-[0.1em]">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          {!isLogin && (
            <div className="relative group">
              <User className="absolute left-6 top-1/2 -translate-y-1/2 text-sky-100/40 group-focus-within:text-sky-400 transition-colors" size={20} />
              <input 
                required
                type="text" 
                placeholder="Neighbor Name"
                className="w-full bg-sky-500/5 backdrop-blur-md border border-sky-500/20 rounded-[1.5rem] p-6 pl-16 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-sm font-medium shadow-inner text-white placeholder:text-sky-100/20"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
          )}

          <div className="relative group">
            <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-sky-100/40 group-focus-within:text-sky-400 transition-colors" size={20} />
            <input 
              required
              type="email" 
              placeholder="Primary Email"
              className="w-full bg-sky-500/5 backdrop-blur-md border border-sky-500/20 rounded-[1.5rem] p-6 pl-16 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-sm font-medium shadow-inner text-white placeholder:text-sky-100/20"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="relative group">
            <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-sky-100/40 group-focus-within:text-sky-400 transition-colors" size={20} />
            <input 
              required
              type={showPassword ? "text" : "password"} 
              placeholder="Secure Password"
              className="w-full bg-sky-500/5 backdrop-blur-md border border-sky-500/20 rounded-[1.5rem] p-6 pl-16 pr-16 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-sm font-medium shadow-inner text-white placeholder:text-sky-100/20"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-6 top-1/2 -translate-y-1/2 text-sky-100/40 hover:text-sky-400 transition-colors"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <button 
            type="submit"
            className="w-full bg-sky-500 text-white py-6 rounded-[1.5rem] font-bold flex items-center justify-center gap-3 hover:bg-sky-600 transition-all mt-8 text-sm uppercase tracking-[0.3em] shadow-3xl shadow-sky-500/20 hover:-translate-y-1"
          >
            {isLogin ? 'Verify Identity' : 'Join Grid'} <ArrowRight size={20} />
          </button>

          <div className="relative flex items-center justify-center my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-sky-500/10"></div>
            </div>
            <div className="relative px-4 bg-[#020617] text-[10px] font-bold text-sky-100/30 uppercase tracking-[0.2em]">or coordinate via</div>
          </div>

          <button 
            type="button"
            onClick={handleGoogleLogin}
            className="w-full bg-sky-500/5 text-sky-100 py-6 rounded-[1.5rem] font-bold flex items-center justify-center gap-3 hover:bg-sky-500/10 border border-sky-500/20 transition-all text-sm uppercase tracking-[0.3em] shadow-sm hover:-translate-y-1"
          >
            <svg className="w-5 h-5 mr-1" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </button>
        </form>

        <div className="mt-12 text-center text-[10px] font-bold text-sky-100/40 uppercase tracking-[0.3em]">
          {isLogin ? "New neighbor?" : "Active grid member?"}{' '}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-sky-400 underline underline-offset-8 transition-colors hover:text-sky-300"
          >
            {isLogin ? 'Register now' : 'Login here'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
