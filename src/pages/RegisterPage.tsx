import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser, googleSignIn } from '../services/authService';
import { UserPlus, Mail, Lock, User, AlertCircle } from 'lucide-react';

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await registerUser(email, password, displayName);
      navigate('/');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('هذا البريد الإلكتروني مستخدم بالفعل.');
      } else {
        setError('حدث خطأ أثناء إنشاء الحساب. يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await googleSignIn();
      navigate('/');
    } catch (err: any) {
      setError('فشل تسجيل الدخول باستخدام جوجل. تأكد من منح الصلاحيات المطلوبة.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
      <div className="bg-slate-900 p-8 text-center text-white">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4 shadow-lg">
          <UserPlus size={32} />
        </div>
        <h1 className="text-2xl font-bold">إنشاء حساب جديد</h1>
        <p className="text-slate-400 text-sm mt-2">انضم إلى مجتمع مجمع الشفا التعليمي</p>
      </div>
      
      <div className="p-8 pb-0">
        <button 
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-xl px-6 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm mb-6"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c1.67-1.54 2.63-3.81 2.63-6.5z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          التسجيل باستخدام جوجل (موصى به)
        </button>
        
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-500">أو عن طريق البريد</span>
          </div>
        </div>
      </div>
      
      <form onSubmit={handleRegister} className="p-8 pt-0 space-y-5">
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">
            <AlertCircle size={20} className="shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-sm font-semibold text-gray-700 mr-1">الاسم الكامل</label>
          <div className="relative">
            <User className="absolute right-3 top-3 text-gray-400" size={18} />
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="الاسم الثلاثي"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-semibold text-gray-700 mr-1">البريد الإلكتروني</label>
          <div className="relative">
            <Mail className="absolute right-3 top-3 text-gray-400" size={18} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="example@email.com"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-semibold text-gray-700 mr-1">كلمة المرور</label>
          <div className="relative">
            <Lock className="absolute right-3 top-3 text-gray-400" size={18} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="أكثر من 6 خانات"
              minLength={6}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all mt-4"
        >
          {loading ? 'جاري إنشاء الحساب...' : 'إنشاء الحساب'}
        </button>

        <div className="pt-4 text-center border-t border-gray-100">
          <p className="text-sm text-gray-600">
            لديك حساب بالفعل؟{' '}
            <Link to="/login" className="text-blue-600 font-bold hover:underline">
              تسجيل الدخول
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
