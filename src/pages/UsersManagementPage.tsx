import { useState, useEffect } from 'react';
import { collection, getDocs, getDocsFromCache, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db, readLocalCache, writeLocalCache, runFirestoreOp } from '../services/firebase';
import { UserProfile } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  CheckCircle, 
  XCircle, 
  Shield, 
  User, 
  Search,
  ChevronRight,
  Clock,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function UsersManagementPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    try {
      const snap = await runFirestoreOp(() => getDocs(q));
      const list = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
      writeLocalCache('shafa_all_users', list);
      setUsers(list);
    } catch {
      try {
        const cached = await getDocsFromCache(q);
        if (!cached.empty) {
          const list = cached.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
          writeLocalCache('shafa_all_users', list);
          setUsers(list);
        } else {
          const fallbackUsers = readLocalCache<UserProfile[]>('shafa_all_users', profile ? [profile] : []);
          setUsers(fallbackUsers);
        }
      } catch {
        const fallbackUsers = readLocalCache<UserProfile[]>('shafa_all_users', profile ? [profile] : []);
        setUsers(fallbackUsers);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [profile]);

  const handleUpdateStatus = async (userId: string, newStatus: UserProfile['status']) => {
    const updated = users.map(u => u.uid === userId ? { ...u, status: newStatus } : u);
    setUsers(updated);
    writeLocalCache('shafa_all_users', updated);
    const target = updated.find(u => u.uid === userId);
    if (target) writeLocalCache(`shafa_user_${userId}`, target);

    try {
      await runFirestoreOp(() => updateDoc(doc(db, 'users', userId), { status: newStatus }));
    } catch {
      // Saved in local cache
    }
  };

  const handleUpdateRole = async (userId: string, newRole: UserProfile['role']) => {
    const updated = users.map(u => u.uid === userId ? { ...u, role: newRole } : u);
    setUsers(updated);
    writeLocalCache('shafa_all_users', updated);
    const target = updated.find(u => u.uid === userId);
    if (target) writeLocalCache(`shafa_user_${userId}`, target);

    try {
      await runFirestoreOp(() => updateDoc(doc(db, 'users', userId), { role: newRole }));
    } catch {
      // Saved in local cache
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/admin" className="hover:text-blue-600">لوحة الإدارة</Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 font-bold">إدارة الأعضاء</span>
      </nav>

      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">إدارة الأعضاء</h1>
          <p className="text-gray-500">اعتماد حسابات المعلمين ومنح صلاحيات الرفع والإدارة.</p>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute right-4 top-3 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="بحث بالاسم أو البريد..."
            className="w-full pr-12 pl-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-400 font-bold">جاري تحميل قائمة المستخدمين...</div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-900 text-white text-sm">
                <tr>
                  <th className="p-5 font-bold">المستخدم</th>
                  <th className="p-5 font-bold text-center">الرتبة</th>
                  <th className="p-5 font-bold text-center">الحالة</th>
                  <th className="p-5 font-bold text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((user) => (
                  <tr key={user.uid} className="hover:bg-gray-50 transition-colors">
                    <td className="p-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                          <User size={20} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{user.displayName}</div>
                          <div className="text-xs text-gray-400">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-5 text-center">
                      <select 
                        className="text-xs bg-gray-50 border-none rounded-lg p-2 font-bold text-slate-700 cursor-pointer outline-none focus:ring-1 focus:ring-blue-500"
                        value={user.role}
                        onChange={(e) => handleUpdateRole(user.uid, e.target.value as any)}
                        disabled={user.role === 'owner'}
                      >
                        <option value="owner">المالك</option>
                        <option value="admin">مدير</option>
                        <option value="member">عضو</option>
                        <option value="visitor">زائر</option>
                      </select>
                    </td>
                    <td className="p-5 text-center">
                      <StatusBadge status={user.status} />
                    </td>
                    <td className="p-5">
                      <div className="flex items-center justify-center gap-2">
                        {user.status === 'pending' && (
                          <>
                            <button 
                              onClick={() => handleUpdateStatus(user.uid, 'approved')}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="اعتماد"
                            >
                              <CheckCircle size={20} />
                            </button>
                            <button 
                              onClick={() => handleUpdateStatus(user.uid, 'rejected')}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="رفض"
                            >
                              <XCircle size={20} />
                            </button>
                          </>
                        )}
                        {user.status === 'approved' && user.role !== 'owner' && (
                          <button 
                            onClick={() => handleUpdateStatus(user.uid, 'suspended')}
                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="إيقاف الحساب"
                          >
                            <AlertCircle size={20} />
                          </button>
                        )}
                        {user.status === 'suspended' && (
                          <button 
                            onClick={() => handleUpdateStatus(user.uid, 'approved')}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="تفعيل الحساب"
                          >
                            <CheckCircle size={20} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredUsers.length === 0 && (
            <div className="p-12 text-center text-gray-400">لا توجد نتائج بحث مطابقة.</div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: UserProfile['status'] }) {
  const configs = {
    pending: { color: 'text-amber-600', bg: 'bg-amber-50', label: 'قيد المراجعة', icon: <Clock size={12} /> },
    approved: { color: 'text-green-600', bg: 'bg-green-50', label: 'معتمد', icon: <CheckCircle size={12} /> },
    rejected: { color: 'text-red-600', bg: 'bg-red-50', label: 'مرفوض', icon: <XCircle size={12} /> },
    suspended: { color: 'text-gray-600', bg: 'bg-gray-100', label: 'موقوف', icon: <AlertCircle size={12} /> },
  };

  const config = configs[status] || configs.pending;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase ${config.bg} ${config.color}`}>
      {config.icon}
      {config.label}
    </span>
  );
}
