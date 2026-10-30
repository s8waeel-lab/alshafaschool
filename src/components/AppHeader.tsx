import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logoutUser } from '../services/authService';
import { LogOut, User, Library, BarChart2, Shield, Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function AppHeader() {
  const { user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logoutUser();
    navigate('/login');
  };

  return (
    <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex flex-col">
              <span className="text-xl font-bold text-white leading-tight">مكتبة مجمع الشفا التعليمي</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">بوابة المكتبة الرقمية والتقويم</span>
                <span className="text-[9px] bg-blue-600/30 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/20 font-bold">
                  {new Intl.DateTimeFormat('ar-SA-u-ca-islamic-uma', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <Link to="/library" className="hover:text-blue-400 flex items-center gap-2 transition-colors">
              <Library size={18} />
              <span>المكتبة الرقمية</span>
            </Link>
            <Link to="/evaluation" className="hover:text-blue-400 flex items-center gap-2 transition-colors">
              <BarChart2 size={18} />
              <span>التقويم</span>
            </Link>
            {isAdmin && (
              <Link to="/admin" className="hover:text-blue-400 flex items-center gap-2 transition-colors text-amber-400">
                <Shield size={18} />
                <span>الإدارة</span>
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="hidden md:flex flex-col items-end text-xs">
                  <span className="font-bold">{profile?.displayName}</span>
                  <span className="text-slate-400">{profile?.role === 'owner' ? 'المالك' : profile?.role === 'admin' ? 'مدير' : 'عضو'}</span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-all"
                  title="تسجيل الخروج"
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="px-4 py-2 text-sm font-medium hover:text-blue-400 transition-colors">دخول</Link>
                <Link to="/register" className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm">حساب جديد</Link>
              </div>
            )}
            
            <button className="md:hidden p-2 text-slate-400 hover:text-white" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {isMenuOpen && (
          <div className="md:hidden pb-4 pt-2 border-t border-slate-800 space-y-2">
            <Link to="/library" className="block px-4 py-2 hover:bg-slate-800 rounded" onClick={() => setIsMenuOpen(false)}>المكتبة الرقمية</Link>
            <Link to="/evaluation" className="block px-4 py-2 hover:bg-slate-800 rounded" onClick={() => setIsMenuOpen(false)}>التقويم</Link>
            {isAdmin && <Link to="/admin" className="block px-4 py-2 hover:bg-slate-800 rounded text-amber-400" onClick={() => setIsMenuOpen(false)}>الإدارة</Link>}
          </div>
        )}
      </div>
    </header>
  );
}
