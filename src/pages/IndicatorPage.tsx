import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Evidence, 
  getAllEvidenceResilient, 
  addEvidenceResilient, 
  removeEvidenceResilient 
} from '../services/evidenceService';
import { 
  ChevronRight, 
  FileText, 
  Plus, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink,
  Network,
  Activity,
  Upload,
  Link as LinkIcon,
  Calendar,
  FolderGit2,
  CheckCircle2
} from 'lucide-react';

import { serverTimestamp } from 'firebase/firestore';
import { calculateIndicatorProgress } from '../utils/calculations';
import { 
  Indicator, 
  Domain, 
  getAllIndicators, 
  getAllStandards, 
  getDomains, 
  isSharedIndicator 
} from '../services/evaluationService';
import { uploadFileResilient } from '../utils/fileUtils';
import SquareFileCard from '../components/SquareFileCard';
import FilePreviewModal, { PreviewableFileItem } from '../components/FilePreviewModal';

export default function IndicatorPage() {
  const { indicatorId, schoolId } = useParams();
  const { user, profile, isAdmin, isMember } = useAuth();
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [indicator, setIndicator] = useState<Indicator | null>(null);
  const [parentDomain, setParentDomain] = useState<Domain | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file');
  const [customTitle, setCustomTitle] = useState('');
  const [driveLinkUrl, setDriveLinkUrl] = useState('');
  const [driveLinkTitle, setDriveLinkTitle] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previewItem, setPreviewItem] = useState<PreviewableFileItem | null>(null);

  const loadIndicatorAndEvidence = async () => {
    if (!indicatorId) return;
    try {
      const [allIndicators, allStandards, allDomains, allEv] = await Promise.all([
        getAllIndicators(),
        getAllStandards(),
        getDomains(),
        getAllEvidenceResilient()
      ]);

      const indData = allIndicators.find(i => i.id === indicatorId) || null;
      setIndicator(indData);

      if (indData) {
        const stdData = allStandards.find(s => s.id === indData.standardId);
        if (stdData) {
          const domData = allDomains.find(d => d.id === stdData.domainId) || null;
          setParentDomain(domData);
        }
      }

      const filteredEv = allEv
        .filter(e => e.indicatorId === indicatorId)
        .sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
          const timeB = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
          return timeB - timeA;
        });
      setEvidence(filteredEv);
    } catch {
      // Fallback already handled inside resilient getters
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadIndicatorAndEvidence();
  }, [indicatorId]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // Derived state: filter evidence based on sharing status and current school context
  const currentEvidence = (() => {
    const isShared = isSharedIndicator(indicator, parentDomain);
    if (isShared) return evidence;
    if (!schoolId) return evidence;
    return evidence.filter(e => e.schoolId === schoolId || e.schoolId === 'shared' || e.isShared);
  })();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !indicatorId || !user || !indicator) return;

    setIsUploading(true);
    setStatusMessage(null);
    try {
      const uploadResult = await uploadFileResilient(file, `evidence/${indicatorId}`, user.uid);
      const isShared = isSharedIndicator(indicator, parentDomain);
      const finalTitle = customTitle.trim() || file.name;

      const evidenceData: Omit<Evidence, 'id'> = {
        title: finalTitle,
        description: `شاهد مرفوع للمؤشر: ${indicator.name}`,
        fileUrl: uploadResult.fileUrl,
        filePath: uploadResult.filePath,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
        indicatorId: indicatorId,
        schoolId: isShared ? 'shared' : (schoolId || profile?.schoolId || 'shared'),
        isShared: isShared,
        status: 'pending',
        uploadedBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await addEvidenceResilient(evidenceData);
      setCustomTitle('');
      showFeedback('success', 'تم رفع الشاهد بنجاح وهو قيد المراجعة الآن.');
      await loadIndicatorAndEvidence();
    } catch (err: any) {
      showFeedback('error', err.message || 'حدث خطأ أثناء رفع الملف.');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleAddDriveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!indicatorId || !user || !indicator) return;

    const trimmedUrl = driveLinkUrl.trim();
    const trimmedTitle = driveLinkTitle.trim();

    if (!trimmedTitle) {
      showFeedback('error', 'يرجى إدخال عنوان واضح للشاهد.');
      return;
    }

    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      showFeedback('error', 'يرجى إدخال رابط قوقل درايف صحيح يبدأ بـ https://');
      return;
    }

    setIsUploading(true);
    setStatusMessage(null);
    try {
      const isShared = isSharedIndicator(indicator, parentDomain);

      const evidenceData: Omit<Evidence, 'id'> = {
        title: trimmedTitle,
        description: `رابط قوقل درايف مرفق للمؤشر: ${indicator.name}`,
        fileUrl: trimmedUrl,
        filePath: 'google_drive_link',
        fileType: 'application/vnd.google-apps.drive-sdk',
        fileSize: 0,
        indicatorId: indicatorId,
        schoolId: isShared ? 'shared' : (schoolId || profile?.schoolId || 'shared'),
        isShared: isShared,
        status: 'pending',
        uploadedBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addEvidenceResilient(evidenceData);
      setDriveLinkTitle('');
      setDriveLinkUrl('');
      showFeedback('success', 'تم إرفاق رابط الشاهد بنجاح وهو قيد المراجعة الآن.');
      await loadIndicatorAndEvidence();
    } catch {
      showFeedback('error', 'حدث خطأ أثناء حفظ رابط الشاهد.');
    } finally {
      setIsUploading(false);
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

  const isIndicatorShared = isSharedIndicator(indicator, parentDomain);
  const approvedEvidence = currentEvidence.filter(e => e.status === 'approved');
  const pendingEvidence = currentEvidence.filter(e => e.status === 'pending');
  const progressResult = calculateIndicatorProgress(currentEvidence, indicator?.targetEvidenceCount || 6);
  const progress = progressResult.approved;
  const totalProgress = progressResult.total;

  return (
    <div className="space-y-8 pb-20">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/evaluation" className="hover:text-blue-600 transition-colors text-xs font-bold">التقويم</Link>
        <ChevronRight size={12} />
        {schoolId && (
          <>
            <Link to={`/school/${schoolId}`} className="hover:text-blue-600 transition-colors text-xs font-bold truncate max-w-[150px]">المدرسة</Link>
            <ChevronRight size={12} />
          </>
        )}
        <span className="text-slate-900 font-bold text-xs">تفاصيل المؤشر</span>
      </nav>

      {/* Indicator Header */}
      <div className="bg-white p-8 md:p-12 rounded-[40px] border border-gray-100 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest">
              <Network size={12} />
              مؤشر أداء
            </div>
            {isIndicatorShared ? (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold border border-amber-200">
                <Activity size={14} className="text-amber-600" />
                <span>مؤشر مشترك لجميع المدارس ({parentDomain?.name})</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-200">
                <span>خاص بمدرسة {schoolId ? 'المحددة' : 'مستقلة'} ({parentDomain?.name})</span>
              </div>
            )}
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-50 text-gray-500 rounded-full text-[10px] font-bold border border-gray-100 mr-auto">
               <Calendar size={12} className="text-blue-500" />
               {new Intl.DateTimeFormat('ar-SA-u-ca-islamic-uma', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
            </div>
          </div>
          
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 mb-6 leading-relaxed max-w-4xl">
            {indicator?.name || 'جاري تحميل تفاصيل المؤشر...'}
          </h1>

          {isIndicatorShared && (
            <div className="bg-amber-50/90 border border-amber-200 p-4 rounded-2xl mb-8 flex items-center gap-3 text-amber-800 text-xs font-bold">
              <Activity size={20} className="text-amber-600 shrink-0" />
              <span>هذا المؤشر يتبع لمجال مشترك ({parentDomain?.name}). أي شاهد يتم اعتماده هنا سينعكس تلقائياً في نسب إنجاز جميع مدارس مجمع الشفا التعليمي (الابتدائية، المتوسطة، الثانوية).</span>
            </div>
          )}
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-center">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex justify-between items-end">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">نسبة الإنجاز المعتمد</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-blue-600 tabular-nums">{progress.toFixed(1)}%</span>
                    {pendingEvidence.length > 0 && (
                      <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">
                        +{pendingEvidence.length} قيد المراجعة
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">المستهدف</span>
                  <span className="text-xl font-bold text-slate-600 tabular-nums">{approvedEvidence.length} / {indicator?.targetEvidenceCount || 6}</span>
                </div>
              </div>
              <div className="h-5 bg-gray-100 rounded-full overflow-hidden shadow-inner p-1 relative">
                <div 
                  className="absolute h-full bg-blue-500 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(59,130,246,0.5)] flex items-center justify-end px-2 z-10" 
                  style={{ width: `${progress}%` }}
                >
                  {progress > 10 && <span className="text-[8px] font-bold text-white uppercase">مكتمل</span>}
                </div>
                {totalProgress > progress && (
                  <div 
                    className="absolute h-full bg-blue-200 rounded-full transition-all duration-1000 z-0" 
                    style={{ width: `${totalProgress}%` }}
                  ></div>
                )}
              </div>
            </div>
            
            <div className="bg-slate-50 p-6 rounded-3xl border border-gray-100 flex justify-around items-center">
              <div className="text-center">
                <div className="text-2xl font-black text-green-600 tabular-nums">{approvedEvidence.length}</div>
                <div className="text-[9px] text-gray-400 font-bold uppercase">معتمد</div>
              </div>
              <div className="w-px h-8 bg-gray-200"></div>
              <div className="text-center">
                <div className="text-2xl font-black text-amber-500 tabular-nums">{pendingEvidence.length}</div>
                <div className="text-[9px] text-gray-400 font-bold uppercase">معلق</div>
              </div>
              <div className="w-px h-8 bg-gray-200"></div>
              <div className="text-center">
                <div className="text-2xl font-black text-slate-300 tabular-nums">{Math.max(0, (indicator?.targetEvidenceCount || 6) - approvedEvidence.length)}</div>
                <div className="text-[9px] text-gray-400 font-bold uppercase">متبقي</div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50 rounded-full -mr-48 -mt-48 opacity-30 blur-[100px]"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Evidence Square Cards Grid */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <div>
              <h2 className="text-2xl font-black text-slate-800">قائمة الشواهد الموثقة</h2>
              <p className="text-xs text-slate-500 mt-1">
                اضغط على مربع الشاهد لاستعراضه مباشرة في نافذة منبثقة أو تحميله.
              </p>
            </div>
            <div className="bg-slate-100 px-4 py-1.5 rounded-full text-xs font-bold text-slate-500 border border-slate-200 tabular-nums">
              {currentEvidence.length} ملفات إجمالاً
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white aspect-square rounded-3xl animate-pulse border border-gray-100" />
              ))}
            </div>
          ) : currentEvidence.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {currentEvidence.map((item) => (
                <SquareFileCard
                  key={item.id}
                  item={item}
                  onPreview={(selected) => setPreviewItem(selected)}
                  canDelete={isAdmin}
                  onDelete={handleDeleteEvidence}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white p-20 rounded-[40px] text-center border-2 border-dashed border-gray-100">
              <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-8">
                <FileText className="text-gray-200" size={48} />
              </div>
              <h3 className="text-2xl font-black text-slate-400 mb-2">لا توجد شواهد مرفوعة</h3>
              <p className="text-gray-400 max-w-sm mx-auto leading-relaxed">
                لم يتم رفع أي ملفات توثيق لهذا المؤشر بعد. ابدأ برفع ملفاتك أو إرفاق رابط الشاهد لرفع نسبة الإنجاز.
              </p>
            </div>
          )}
        </div>

        {/* Action Sidebar */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-[40px] p-8 md:p-10 text-white shadow-2xl relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="w-14 h-14 bg-blue-600/20 rounded-2xl flex items-center justify-center">
                  <Plus size={28} className="text-blue-400" />
                </div>
              </div>

              <h3 className="text-2xl font-black mb-2">توثيق جديد</h3>
              <p className="text-slate-400 text-xs mb-6 leading-relaxed">
                اختر رفع ملف مباشر من جهازك أو إرفاق رابط الشاهد من Google Drive.
              </p>

              {statusMessage && (
                <div
                  className={`p-3.5 rounded-2xl mb-5 text-xs font-bold flex items-center gap-2.5 border ${
                    statusMessage.type === 'success'
                      ? 'bg-green-500/20 border-green-500/30 text-green-300'
                      : 'bg-red-500/20 border-red-500/30 text-red-300'
                  }`}
                >
                  {statusMessage.type === 'success' ? (
                    <CheckCircle2 size={16} className="shrink-0 text-green-400" />
                  ) : (
                    <AlertCircle size={16} className="shrink-0 text-red-400" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}
              
              {isAdmin ? (
                <div className="space-y-5">
                  {/* Mode Switcher Tabs */}
                  <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-white/5 rounded-2xl border border-white/10">
                    <button
                      type="button"
                      onClick={() => setUploadMode('file')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
                        uploadMode === 'file'
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Upload size={14} />
                      <span>رفع ملف مباشر</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadMode('link')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
                        uploadMode === 'link'
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <LinkIcon size={14} />
                      <span>رابط Google Drive</span>
                    </button>
                  </div>

                  {uploadMode === 'file' ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                          عنوان الشاهد (اختياري)
                        </label>
                        <input
                          type="text"
                          value={customTitle}
                          onChange={(e) => setCustomTitle(e.target.value)}
                          placeholder="يُستخدم اسم الملف تلقائياً إن تُرك فارغاً"
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400"
                        />
                      </div>

                      <input 
                        type="file" 
                        id="file-upload" 
                        className="hidden" 
                        onChange={handleFileUpload}
                        disabled={isUploading}
                      />
                      <label 
                        htmlFor="file-upload"
                        className={`w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm shadow-lg transition-all flex items-center justify-center gap-3 cursor-pointer transform active:scale-95 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                      >
                        {isUploading ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>جاري رفع الملف...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={18} />
                            <span>اختيار ورفع ملف الشاهد</span>
                          </>
                        )}
                      </label>
                    </div>
                  ) : (
                    <form onSubmit={handleAddDriveLink} className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                          عنوان الشاهد
                        </label>
                        <input
                          type="text"
                          required
                          value={driveLinkTitle}
                          onChange={(e) => setDriveLinkTitle(e.target.value)}
                          placeholder="مثال: سجل خطة التعلم النشط"
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                          رابط الملف أو المجلد في Google Drive
                        </label>
                        <input
                          type="url"
                          required
                          dir="ltr"
                          value={driveLinkUrl}
                          onChange={(e) => setDriveLinkUrl(e.target.value)}
                          placeholder="https://drive.google.com/..."
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white text-left placeholder:text-slate-500 focus:outline-none focus:border-blue-400"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isUploading}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl font-black text-sm shadow-lg transition-all flex items-center justify-center gap-2"
                      >
                        <LinkIcon size={18} />
                        <span>{isUploading ? 'جاري الحفظ...' : 'إرفاق رابط الشاهد'}</span>
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                <div className="bg-white/5 p-6 rounded-3xl text-sm font-bold text-amber-400 border border-white/10 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle size={20} />
                    استعراض وتحميل الشواهد متاح للجميع
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed font-normal">
                    يمكنك استعراض جميع الشواهد مباشرة أو تحميلها. لرفع شواهد جديدة، يرجى تسجيل الدخول بحساب عضو معتمد.
                  </p>
                </div>
              )}
            </div>
            
            <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-blue-500 rounded-full opacity-10 blur-3xl pointer-events-none"></div>
          </div>

          <div className="bg-white rounded-[40px] p-10 border border-gray-100 shadow-sm">
            <h3 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-3">
              <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
              معايير الجودة
            </h3>
            <ul className="space-y-6">
              <QualityItem text="التأكد من مطابقة الملف للمؤشر المحدد" />
              <QualityItem text="وضوح الصور والمستندات المرفوعة" />
              <QualityItem text="تاريخ الشاهد يجب أن يكون حديثاً" />
              <QualityItem text="اعتماد القائد أو المسؤول عن الشاهد" />
            </ul>
          </div>
        </div>
      </div>

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

function QualityItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-4">
      <div className="w-6 h-6 bg-green-50 rounded-full flex items-center justify-center shrink-0 mt-0.5 border border-green-100">
        <CheckCircle size={12} className="text-green-600" />
      </div>
      <span className="text-xs font-bold text-slate-600 leading-relaxed">{text}</span>
    </li>
  );
}
