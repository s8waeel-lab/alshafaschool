import { useState, useEffect } from 'react';
import { getLibraryFiles, addLibraryFileResilient, removeLibraryFileResilient, LibraryFile } from '../services/fileService';
import { useAuth } from '../context/AuthContext';
import { 
  Search, 
  Filter, 
  Plus, 
  Upload,
  Link as LinkIcon,
  FolderGit2,
  ExternalLink,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

import { serverTimestamp } from 'firebase/firestore';
import { uploadFileResilient } from '../utils/fileUtils';
import SquareFileCard from '../components/SquareFileCard';
import FilePreviewModal, { PreviewableFileItem } from '../components/FilePreviewModal';

export default function DigitalLibraryPage() {
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isUploading, setIsUploading] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file');
  const [fileTitle, setFileTitle] = useState('');
  const [fileDescription, setFileDescription] = useState('');
  const [fileCategory, setFileCategory] = useState('plans');
  const [driveUrl, setDriveUrl] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previewItem, setPreviewItem] = useState<PreviewableFileItem | null>(null);

  const { user, profile, isMember, isAdmin } = useAuth();

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const fetchFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLibraryFiles(
        selectedCategory === 'all' ? undefined : selectedCategory,
        undefined,
        !isMember && !isAdmin
      );
      setFiles(data);
    } catch {
      setError('حدث خطأ أثناء تحميل الملفات من المكتبة.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [selectedCategory, isMember, isAdmin]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    setStatusMessage(null);
    try {
      const uploadResult = await uploadFileResilient(file, 'library', user.uid);
      const finalTitle = fileTitle.trim() || file.name;

      const libraryData: Omit<LibraryFile, 'id'> = {
        title: finalTitle,
        description: fileDescription.trim() || `ملف مرفوع للمكتبة الرقمية: ${finalTitle}`,
        fileUrl: uploadResult.fileUrl,
        filePath: uploadResult.filePath,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
        categoryId: fileCategory,
        schoolId: profile?.schoolId || 'shared',
        academicYear: '1447-1448',
        accessLevel: 'public',
        uploadedBy: user.uid,
        createdAt: serverTimestamp()
      };
      
      await addLibraryFileResilient(libraryData);
      setFileTitle('');
      setFileDescription('');
      setShowAddPanel(false);
      showFeedback('success', 'تم رفع الملف للمكتبة الرقمية بنجاح.');
      fetchFiles();
    } catch (err: any) {
      showFeedback('error', err.message || 'حدث خطأ أثناء رفع الملف.');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleAddDriveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmedTitle = fileTitle.trim();
    const trimmedUrl = driveUrl.trim();

    if (!trimmedTitle) {
      showFeedback('error', 'يرجى إدخال عنوان الملف.');
      return;
    }

    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      showFeedback('error', 'يرجى إدخال رابط قوقل درايف صحيح يبدأ بـ https://');
      return;
    }

    setIsUploading(true);
    setStatusMessage(null);
    try {
      const libraryData: Omit<LibraryFile, 'id'> = {
        title: trimmedTitle,
        description: fileDescription.trim() || `رابط قوقل درايف في المكتبة الرقمية: ${trimmedTitle}`,
        fileUrl: trimmedUrl,
        filePath: 'google_drive_link',
        fileType: 'application/vnd.google-apps.drive-sdk',
        fileSize: 0,
        categoryId: fileCategory,
        schoolId: profile?.schoolId || 'shared',
        academicYear: '1447-1448',
        accessLevel: 'public',
        uploadedBy: user.uid,
        createdAt: serverTimestamp()
      };

      await addLibraryFileResilient(libraryData);
      setFileTitle('');
      setFileDescription('');
      setDriveUrl('');
      setShowAddPanel(false);
      showFeedback('success', 'تمت إضافة رابط الملف للمكتبة الرقمية بنجاح.');
      fetchFiles();
    } catch {
      showFeedback('error', 'حدث خطأ أثناء إضافة الرابط للمكتبة.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (id: string) => {
    if (!isAdmin) return;
    try {
      await removeLibraryFileResilient(id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
      showFeedback('success', 'تم حذف الملف من المكتبة الرقمية.');
    } catch {
      showFeedback('error', 'حدث خطأ أثناء حذف الملف.');
    }
  };

  const filteredFiles = files.filter(f => 
    f.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="bg-white p-8 md:p-12 rounded-[40px] border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-8 relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-4xl font-black text-slate-800 mb-2 leading-tight">المكتبة الرقمية</h1>
          <p className="text-gray-500 text-lg">مستودع الخطط والبرامج والنماذج المدرسية المعتمدة بمجمع الشفا.</p>
        </div>
        
        <div className="relative z-10 shrink-0 flex flex-wrap items-center gap-3">
          {(isMember || isAdmin) && (
            <button
              onClick={() => setShowAddPanel((prev) => !prev)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black shadow-xl hover:shadow-blue-100 transition-all flex items-center gap-3 cursor-pointer whitespace-nowrap"
            >
              {showAddPanel ? <X size={22} /> : <Plus size={22} />}
              <span>{showAddPanel ? 'إغلاق النافذة' : 'إضافة ملف جديد'}</span>
            </button>
          )}
        </div>
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-50 rounded-full -mr-24 -mt-24 opacity-40 blur-3xl pointer-events-none"></div>
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

      {/* Add File / Drive Link Panel */}
      {showAddPanel && (isMember || isAdmin) && (
        <div className="bg-white p-8 rounded-3xl border border-blue-100 shadow-lg space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-xl font-black text-slate-800">إضافة ملف أو رابط للمكتبة الرقمية</h3>
              <p className="text-xs text-gray-500 mt-1">
                يمكنك رفع ملف مباشرة من جهازك أو إرفاق رابط جاهز من قوقل درايف.
              </p>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl self-start">
              <button
                type="button"
                onClick={() => setUploadMode('file')}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                  uploadMode === 'file' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Upload size={14} />
                <span>رفع ملف مباشر</span>
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('link')}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                  uploadMode === 'link' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LinkIcon size={14} />
                <span>إرفاق رابط Google Drive</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                عنوان الملف {uploadMode === 'file' && '(اختياري)'}
              </label>
              <input
                type="text"
                value={fileTitle}
                onChange={(e) => setFileTitle(e.target.value)}
                placeholder="مثال: الخطة التشغيلية للمجمع 1448"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                التصنيف
              </label>
              <select
                value={fileCategory}
                onChange={(e) => setFileCategory(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                <option value="plans">الخطط المدرسية</option>
                <option value="programs">البرامج والمبادرات</option>
                <option value="circulars">التعاميم</option>
                <option value="models">النماذج</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                وصف مختصر (اختياري)
              </label>
              <input
                type="text"
                value={fileDescription}
                onChange={(e) => setFileDescription(e.target.value)}
                placeholder="وصف مختصر لمحتوى الملف..."
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {uploadMode === 'file' ? (
            <div className="flex justify-end">
              <input 
                type="file" 
                id="library-upload" 
                className="hidden" 
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              <label 
                htmlFor="library-upload"
                className={`px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2.5 cursor-pointer ${
                  isUploading ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>جاري رفع الملف...</span>
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    <span>اختيار الملف من الجهاز ورفعه</span>
                  </>
                )}
              </label>
            </div>
          ) : (
            <form onSubmit={handleAddDriveLink} className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  رابط الملف أو المجلد في Google Drive
                </label>
                <input
                  type="url"
                  required
                  dir="ltr"
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-left focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={isUploading}
                className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2 whitespace-nowrap"
              >
                <LinkIcon size={18} />
                <span>{isUploading ? 'جاري الحفظ...' : 'حفظ الرابط في المكتبة'}</span>
              </button>
            </form>
          )}
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-4 top-3.5 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="ابحث عن ملف بالعنوان أو الوصف..."
            className="w-full pr-12 pl-4 py-3.5 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-2 shadow-sm min-w-[200px]">
          <Filter size={18} className="text-gray-400" />
          <select 
            className="bg-transparent border-none outline-none text-sm font-medium flex-1 cursor-pointer"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">جميع التصنيفات</option>
            <option value="plans">الخطط المدرسية</option>
            <option value="programs">البرامج والمبادرات</option>
            <option value="circulars">التعاميم</option>
            <option value="models">النماذج</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm font-bold">
          {error}
        </div>
      )}

      {/* Square Files Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="bg-white aspect-square rounded-3xl animate-pulse border border-gray-100"></div>
          ))}
        </div>
      ) : filteredFiles.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredFiles.map((file) => (
            <SquareFileCard
              key={file.id}
              item={file}
              onPreview={(selected) => setPreviewItem(selected)}
              canDelete={isAdmin}
              onDelete={handleDeleteFile}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white p-20 rounded-3xl text-center border border-gray-100 shadow-sm">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search size={40} className="text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">لم يتم العثور على ملفات</h3>
          <p className="text-gray-400">حاول تغيير كلمات البحث أو التصنيفات المختارة، أو أضف ملفاً جديداً للمكتبة.</p>
        </div>
      )}

      {/* Direct Popup Preview Modal */}
      <FilePreviewModal
        item={previewItem}
        onClose={() => setPreviewItem(null)}
        canDelete={isAdmin}
        onDelete={handleDeleteFile}
      />
    </div>
  );
}
