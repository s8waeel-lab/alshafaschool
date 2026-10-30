import { useState, useEffect } from 'react';
import { 
  Evidence, 
  getAllEvidenceResilient, 
  updateEvidenceStatus, 
  removeEvidenceResilient 
} from '../services/evidenceService';
import { useAuth } from '../context/AuthContext';
import { 
  CheckCircle, 
  XCircle, 
  ChevronRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import SquareFileCard from '../components/SquareFileCard';
import FilePreviewModal, { PreviewableFileItem } from '../components/FilePreviewModal';

export default function EvidenceReviewPage() {
  const { isAdmin } = useAuth();
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previewItem, setPreviewItem] = useState<PreviewableFileItem | null>(null);

  const loadPendingEvidence = async () => {
    try {
      const all = await getAllEvidenceResilient();
      const pendingItems = all
        .filter(e => e.status === 'pending')
        .sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
          const timeB = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
          return timeA - timeB;
        });
      setEvidence(pendingItems);
    } catch {
      // Handled via resilient cache
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadPendingEvidence();
  }, []);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleReview = async (id: string, status: 'approved' | 'rejected', reason?: string) => {
    try {
      await updateEvidenceStatus(
        id,
        status,
        status === 'rejected' ? (reason?.trim() || 'غير مطابق لمعايير المؤشر') : undefined
      );
      setEvidence(prev => prev.filter(e => e.id !== id));
      setRejectingId(null);
      setRejectionReason('');
      showFeedback('success', status === 'approved' ? 'تم اعتماد الشاهد بنجاح.' : 'تم رفض الشاهد وتسجيل الملاحظة.');
    } catch {
      showFeedback('error', 'حدث خطأ أثناء مراجعة الشاهد.');
    }
  };

  const handleDeleteEvidence = async (id: string) => {
    if (!isAdmin) return;
    try {
      await removeEvidenceResilient(id);
      setEvidence(prev => prev.filter(e => e.id !== id));
      showFeedback('success', 'تم حذف الشاهد بنجاح.');
    } catch {
      showFeedback('error', 'حدث خطأ أثناء حذف الشاهد.');
    }
  };

  return (
    <div className="space-y-8 pb-16">
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/admin" className="hover:text-blue-600">لوحة الإدارة</Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 font-bold">اعتماد الشواهد</span>
      </nav>

      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">اعتماد الشواهد</h1>
        <p className="text-gray-500">
          استعرض الملفات وروابط الشواهد المرفوعة حديثاً مباشرة في نافذة منبثقة واعتمدها لاحتسابها ضمن نسب الإنجاز.
        </p>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3 text-sm font-bold ${
            statusMessage.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 size={20} className="text-green-600 shrink-0" />
          ) : (
            <AlertCircle size={20} className="text-red-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white aspect-square rounded-3xl animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : evidence.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {evidence.map((item) => (
            <SquareFileCard
              key={item.id}
              item={item}
              onPreview={(selected) => setPreviewItem(selected)}
              canDelete={isAdmin}
              onDelete={handleDeleteEvidence}
              extraActions={
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>المؤشر: <strong className="text-slate-700">{item.indicatorId}</strong></span>
                    <span className="text-blue-700 font-bold">
                      {item.isShared || item.schoolId === 'shared' ? 'مشترك للمجمع' : item.schoolId}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleReview(item.id, 'approved')}
                      className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <CheckCircle size={15} />
                      <span>اعتماد</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectingId(rejectingId === item.id ? null : item.id);
                        setRejectionReason('');
                      }}
                      className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <XCircle size={15} />
                      <span>رفض</span>
                    </button>
                  </div>

                  {rejectingId === item.id && (
                    <div className="pt-2 space-y-2">
                      <input
                        type="text"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="اكتب سبب الرفض ليظهر للعضو..."
                        className="w-full px-3 py-2 bg-red-50/40 border border-red-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-red-400"
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleReview(item.id, 'rejected', rejectionReason)}
                          className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                        >
                          تأكيد الرفض
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectingId(null)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-slate-600 text-xs font-bold rounded-lg cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              }
            />
          ))}
        </div>
      ) : (
        <div className="bg-white p-20 rounded-3xl text-center border border-gray-100 shadow-sm">
          <CheckCircle className="mx-auto text-green-500 mb-6 opacity-20" size={80} />
          <h3 className="text-xl font-bold text-slate-800">لا توجد شواهد تنتظر المراجعة</h3>
          <p className="text-gray-400 mt-2">تمت مراجعة جميع الملفات المرفوعة.</p>
        </div>
      )}

      {/* Direct Popup Preview Modal */}
      <FilePreviewModal
        item={previewItem}
        onClose={() => setPreviewItem(null)}
        canDelete={isAdmin}
        onDelete={handleDeleteEvidence}
      />
    </div>
  );
}
