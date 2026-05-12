"use client";

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { AlertCircle, Loader2, Package, Wrench, ShieldCheck, Eye, Send, Lock, User } from 'lucide-react';

export default function LoginView({ onLogin }: { onLogin?: () => void }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Enter both username and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password, rememberMe }),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error ?? 'Unable to sign in.');
        return;
      }

      onLogin?.();
      router.replace(result.redirectTo ?? '/dashboard');
      router.refresh();
    } catch {
      setError('Unable to reach the authentication service.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
        <ShieldCheck size={400} className="text-primary" />
      </div>
      <div className="absolute bottom-0 left-0 p-12 opacity-5 pointer-events-none">
        <Wrench size={300} className="text-primary" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[440px] flex flex-col gap-8"
      >
        <header className="text-center flex flex-col items-center gap-2">
          <div className="w-16 h-16 bg-primary-container rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <Package className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Repair Request Management System</h1>
          <p className="text-[11px] font-bold text-secondary uppercase tracking-[0.2em]">Maintenance & Operations Portal</p>
        </header>

        <div className="bg-white border border-outline-variant rounded-2xl shadow-xl overflow-hidden">
          <div className="p-8 space-y-6">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-primary">Admin Login</h2>
              <p className="text-xs text-secondary">Please enter your administrator credentials to access the management portal.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-secondary uppercase tracking-widest pl-1">Admin Username</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline group-focus-within:text-primary transition-colors" />
                  <input 
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                    placeholder="admin"
                    className="w-full pl-11 pr-4 py-3 bg-surface-container-low border border-outline-variant rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest pl-1">Password</label>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline group-focus-within:text-primary transition-colors" />
                  <input 
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter admin password"
                    className="w-full pl-11 pr-12 py-3 bg-surface-container-low border border-outline-variant rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-xs font-bold text-error">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center justify-between py-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary/20"
                  />
                  <span className="text-xs text-secondary group-hover:text-primary transition-colors">Remember me</span>
                </label>
                <a href="#" className="text-xs font-bold text-primary hover:underline">Forgot Password?</a>
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary-container text-white py-3.5 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    Signing In <Loader2 className="w-4 h-4 animate-spin" />
                  </>
                ) : (
                  <>
                    Sign In <Send className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-6 border-t border-outline-variant/50 flex items-center justify-center gap-2 text-outline text-[11px]">
              <ShieldCheck className="w-4 h-4" />
              <span>Secure, encrypted authentication session</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_8px_rgba(46,125,50,0.5)]"></div>
            <span className="text-xs text-secondary">System Status: <span className="font-bold text-success">All Operations Normal</span></span>
          </div>
          <a href="#" className="text-[10px] font-bold text-primary uppercase hover:underline">Support</a>
        </div>
      </motion.div>
    </div>
  );
}
