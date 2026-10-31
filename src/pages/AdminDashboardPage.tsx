import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  FileCheck, 
  ShieldCheck, 
  Settings, 
  AlertCircle, 
  Database,
  BarChart4,
  CheckCircle2
} from 'lucide-react';
import { collection, getDocs, getDocsFromCache } from 'firebase/firestore';
import { db, readLocalCache, writeLocalCache, runFirestoreOp } from '../services/firebase';
import { seedInitialStructure } from '../services/evaluationService';
import { getAllEvidenceResilient } from '../services/evidenceService';
import { getLibraryFiles } from '../services/fileService';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboardPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    users: 0,
    evidence: 0,
    files: 0,
    pendingUsers: 0
  });
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [confirmSeed, setConfirmSeed] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      try {
        const { getCountFromServer, collection } = await import('firebase/firestore');
        
        const [usersSnap, evidenceSnap, filesSnap] = await Promise.all([
          runFirestoreOp(() => getCountFromServer(collection(db, 'users'))),
          runFirestoreOp(() => getCountFromServer(collection(db, 'evidence'))),
          runFirestoreOp(() => getCountFromServer(collection(db, 'libraryFiles')))
        ]);
        
        setStats({
          users: usersSnap.data().count,
          evidence: evidenceSnap.data().count,
          files: filesSnap.data().count,
          pendingUsers: 0 // We can't easily get pending count without a query, let's keep it 0 or do a separate count
        });

        // For pending users, we still need a small query
        const { query, where } = await import('firebase/firestore');
        const pendingSnap = await runFirestoreOp(() => getCountFromServer(query(collection(db, 'users'), where('status', '==', 'pending'))));
        setStats(prev => ({ ...prev, pendingUsers: pendingSnap.data().count }));

      } catch {
        // Fallback stats from existing resilient getters (which use cache)
        try {
          const [evList, libFiles] = await Promise.all([
            getAllEvidenceResilient(),
            getLibraryFiles(undefined, undefined, false)
          ]);
          setStats(prev => ({
            ...prev,
            evidence: evList.length,
            files: libFiles.length
          }));
        } catch { /* ignore */ }
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [user, profile]);

  const showBanner = (type: 'success' | 'error', text: string) => {
    setStatusBanner({ type, text });
    setTimeout(() => setStatusBanner(null), 5000);
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    setConfirmSeed(false);
    try {
      await seedInitialStructure();
      showBanner('success', 'تم تهيئة واستيراد هيكل المدارس والمجالات والمعايير والمؤشرات بنجاح.');
    } catch (err) {
      console.error(err);
      showBanner('error', 'حدث خطأ أثناء تهيئة الهيكل.');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">لوحة الإدارة</h1>
          <p className="text-gray-500">مرحباً بك يا {profile?.displayName}، يمكنك إدارة كافة جوانب المنصة وإعدادات المجمع من هنا.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {!confirmSeed ? (
            <button 
              onClick={() => setConfirmSeed(true)}
              disabled={isSeeding}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white rounded-xl font-bold text-sm shadow-sm transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Database size={18} />
              {isSeeding ? 'جاري التهيئة...' : 'تهيئة الهيكل المعتمد'}
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
              <span className="text-xs font-bold text-amber-900">تأكيد استيراد الهيكل؟</span>
              <button
                onClick={handleSeed}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                نعم
              </button>
              <button
                onClick={() => setConfirmSeed(false)}
                className="px-3 py-1 bg-white text-slate-600 border border-gray-200 text-xs font-bold rounded-lg cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          )}
          <button
            onClick={() => navigate('/admin/structure')}
            className="p-2.5 bg-white border border-gray-200 text-slate-600 rounded-xl hover:bg-gray-50 transition-all cursor-pointer"
            title="إدارة الهيكل"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {statusBanner && (
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3 text-sm font-bold transition-all ${
            statusBanner.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {statusBanner.type === 'success' ? (
            <CheckCircle2 size={20} className="text-green-600 shrink-0" />
          ) : (
            <AlertCircle size={20} className="text-red-600 shrink-0" />
          )}
          <span>{statusBanner.text}</span>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div onClick={() => navigate('/admin/users')} className="cursor-pointer">
          <AdminStatCard 
            icon={<Users className="text-blue-600" />} 
            label="إجمالي المستخدمين" 
            value={loading ? '...' : stats.users} 
            color="blue"
          />
        </div>
        <div onClick={() => navigate('/admin/users')} className="cursor-pointer">
          <AdminStatCard 
            icon={<AlertCircle className="text-amber-600" />} 
            label="طلبات معلقة" 
            value={loading ? '...' : stats.pendingUsers} 
            color="amber"
            highlight={stats.pendingUsers > 0}
          />
        </div>
        <div onClick={() => navigate('/admin/evidence')} className="cursor-pointer">
          <AdminStatCard 
            icon={<FileCheck className="text-green-600" />} 
            label="شواهد الأداء" 
            value={loading ? '...' : stats.evidence} 
            color="green"
          />
        </div>
        <div onClick={() => navigate('/library')} className="cursor-pointer">
          <AdminStatCard 
            icon={<BarChart4 className="text-purple-600" />} 
            label="ملفات المكتبة" 
            value={loading ? '...' : stats.files} 
            color="purple"
          />
        </div>
      </div>

      {/* Main Admin Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Quick Actions */}
        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
          <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
            <ShieldCheck className="text-blue-600" />
            إجراءات سريعة
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AdminActionBtn 
              label="إدارة الأعضاء" 
              icon={<Users size={20} />} 
              color="blue" 
              onClick={() => navigate('/admin/users')}
            />
            <AdminActionBtn 
              label="اعتماد الشواهد" 
              icon={<FileCheck size={20} />} 
              color="green" 
              onClick={() => navigate('/admin/evidence')}
            />
            <AdminActionBtn 
              label="إدارة الهيكل" 
              icon={<Database size={20} />} 
              color="amber" 
              onClick={() => navigate('/admin/structure')}
            />
            <AdminActionBtn 
              label="تقارير الإنجاز" 
              icon={<BarChart4 size={20} />} 
              color="purple" 
              onClick={() => navigate('/evaluation')}
            />
          </div>
        </div>

        {/* System Status & Guide */}
        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-800 mb-4">طريقة توثيق الشواهد المعتمدة</h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              تم تفعيل نظام التوثيق المزدوج في المنصة لتسهيل عمل جميع المعلمين والإداريين في مدارس مجمع الشفا التعليمي:
            </p>
            <ul className="space-y-2.5 text-xs text-slate-600 font-medium">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                <span><strong>الرفع المباشر:</strong> يمكن لأي عضو معتمد رفع ملفات الشواهد (PDF، صور، جداول) مباشرة من جهازه واستعراضها مباشرة داخل المنصة.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
                <span><strong>إرفاق رابط قوقل درايف:</strong> يمكن للعضو وضع رابط ملف أو مجلد جاهز من قوقل درايف مباشرة في صفحة المؤشر أو المكتبة الرقمية.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminStatCard({ icon, label, value, color, highlight }: any) {
  const colors: any = {
    blue: 'bg-blue-50 border-blue-100 hover:bg-blue-100',
    amber: 'bg-amber-50 border-amber-100 hover:bg-amber-100',
    green: 'bg-green-50 border-green-100 hover:bg-green-100',
    purple: 'bg-purple-50 border-purple-100 hover:bg-purple-100',
  };

  return (
    <div className={`p-6 rounded-3xl border shadow-sm transition-all ${colors[color]} ${highlight ? 'ring-2 ring-amber-500 ring-offset-2' : ''}`}>
      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm">
        {icon}
      </div>
      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</div>
      <div className="text-3xl font-black text-slate-800 mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function AdminActionBtn({ label, icon, color, onClick }: any) {
  const colorClasses: any = {
    blue: 'bg-blue-600 hover:bg-blue-700',
    green: 'bg-green-600 hover:bg-green-700',
    amber: 'bg-amber-600 hover:bg-amber-700',
    purple: 'bg-purple-600 hover:bg-purple-700',
  };

  return (
    <button 
      onClick={onClick}
      className={`w-full p-4 text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-sm hover:shadow-md whitespace-nowrap cursor-pointer ${colorClasses[color]}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
