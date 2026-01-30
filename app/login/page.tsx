'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      return;
    }

    router.push('/tests'); // 👈 vào app admin
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleLogin();
        }}
        className="w-full max-w-md bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700"
      >
        <h1 className="text-2xl font-black mb-6 text-orange-500 text-center uppercase tracking-tight">
          Admin Login
        </h1>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Email</label>
            <input
              type="email"
              required
              className="w-full p-3 rounded-xl bg-gray-900 border border-gray-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Mật khẩu</label>
            <input
              type="password"
              required
              className="w-full p-3 rounded-xl bg-gray-900 border border-gray-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400 text-sm animate-pulse">
            ⚠️ {error}
          </div>
        )}

        <button
          type="submit"
          className="w-full mt-6 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] py-3 rounded-xl font-bold text-lg shadow-lg shadow-orange-500/20 transition-all"
        >
          Đăng nhập
        </button>
      </form>
    </div>
  );
}
