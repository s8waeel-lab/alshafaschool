import { useEffect, useState } from 'react';
import {
  X,
  Download,
  ExternalLink,
  Trash2,
  FileText,
  FolderGit2,
  Loader2,
  ZoomIn,
  ZoomOut,
  FileSpreadsheet,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import {
  resolveFileUrl,
  getPreviewType,
  getGoogleDriveThumbnailUrl,
  downloadFile,
  openFileInNewWindow,
} from '../utils/fileUtils';

export interface PreviewableFileItem {
  id: string;
  title: string;
  description?: string;
  fileUrl: string;
  filePath?: string;
  fileType?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'archived';
  createdAt?: any;
}

interface FilePreviewModalProps {
  item: PreviewableFileItem | null;
  onClose: () => void;
  canDelete?: boolean;
  onDelete?: (id: string) => void;
}

export default function FilePreviewModal({
  item,
  onClose,
  canDelete = false,
  onDelete,
}: FilePreviewModalProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [resolvedMime, setResolvedMime] = useState<string>('');
  const [resolvedName, setResolvedName] = useState<string>('');
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [sheetRows, setSheetRows] = useState<any[][]>([]);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheetIdx, setActiveSheetIdx] = useState<number>(0);
  const [workbookData, setWorkbookData] = useState<XLSX.WorkBook | null>(null);
  const [useDocsViewerFallback, setUseDocsViewerFallback] = useState<boolean>(false);
  const [driveImgFailed, setDriveImgFailed] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(100);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);

  useEffect(() => {
    if (!item) return;
    let isMounted = true;
    setConfirmDelete(false);
    setError(null);
    setPdfPages([]);
    setSheetRows([]);
    setSheetNames([]);
    setWorkbookData(null);
    setUseDocsViewerFallback(false);
    setDriveImgFailed(false);
    setZoom(100);

    const loadFileForModal = async () => {
      setLoading(true);
      try {
        const res = await resolveFileUrl(item.fileUrl, item.filePath);
        if (!isMounted) return;

        const mime = res.mimeType || item.fileType || '';
        setResolvedUrl(res.resolvedUrl);
        setResolvedMime(mime);
        setResolvedName(res.fileName || '');

        const pType = getPreviewType(
          res.resolvedUrl || item.fileUrl,
          mime,
          item.title,
          item.filePath,
          res.fileName,
          res.uint8Array
        );

        if (pType === 'pdf') {
          try {
            let loadingTask;
            if (res.uint8Array && res.uint8Array.byteLength > 0) {
              const dataCopy = new Uint8Array(res.uint8Array);
              loadingTask = pdfjsLib.getDocument({ data: dataCopy });
            } else if (res.resolvedUrl) {
              const response = await fetch(res.resolvedUrl);
              const buf = await response.arrayBuffer();
              loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf) });
            }

            if (loadingTask) {
              const pdf = await loadingTask.promise;
              const totalPages = Math.min(pdf.numPages, 30);
              const renderedPages: string[] = [];

              for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                if (!isMounted) return;
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 1.6 });
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  canvas.width = viewport.width;
                  canvas.height = viewport.height;
                  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
                  renderedPages.push(canvas.toDataURL('image/png'));
                }
              }

              if (isMounted) {
                setPdfPages(renderedPages);
              }
            }
          } catch {
            if (
              isMounted &&
              (item.fileUrl.startsWith('http://') || item.fileUrl.startsWith('https://'))
            ) {
              setUseDocsViewerFallback(true);
            }
          }
        } else if (pType === 'sheet') {
          try {
            let bytes = res.uint8Array;
            if (!bytes && res.resolvedUrl) {
              const response = await fetch(res.resolvedUrl);
              const buf = await response.arrayBuffer();
              bytes = new Uint8Array(buf);
            }
            if (bytes) {
              const wb = XLSX.read(bytes, { type: 'array' });
              if (isMounted && wb.SheetNames.length > 0) {
                setWorkbookData(wb);
                setSheetNames(wb.SheetNames);
                const firstSheet = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1 });
                setSheetRows(rows);
              }
            }
          } catch {
            if (
              isMounted &&
              (item.fileUrl.startsWith('http://') || item.fileUrl.startsWith('https://'))
            ) {
              setUseDocsViewerFallback(true);
            }
          }
        } else if (
          pType === 'other' &&
          (item.fileUrl.startsWith('http://') || item.fileUrl.startsWith('https://'))
        ) {
          setUseDocsViewerFallback(true);
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.warn('Modal preview fallback:', err);
        setError('يمكنك فتح الملف للاستعراض في نافذة مستقلة أو تحميله.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadFileForModal();
    return () => {
      isMounted = false;
    };
  }, [item]);

  // Close on Escape key
  useEffect(() => {
    if (!item) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  const isDriveLink =
    item.filePath === 'google_drive_link' ||
    item.fileUrl?.includes('drive.google.com') ||
    item.fileUrl?.includes('docs.google.com');

  const previewType = getPreviewType(
    resolvedUrl || item.fileUrl,
    resolvedMime || item.fileType,
    item.title,
    item.filePath,
    resolvedName
  );
  const driveHighResThumb = getGoogleDriveThumbnailUrl(item.fileUrl, 1600);

  const handleSelectSheet = (idx: number) => {
    if (!workbookData || !sheetNames[idx]) return;
    setActiveSheetIdx(idx);
    const sheet = workbookData.Sheets[sheetNames[idx]];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    setSheetRows(rows);
  };

  const handleDownload = () => {
    const ext = (resolvedMime || item.fileType || '').split('/')[1] || 'pdf';
    const cleanExt = ext.includes(';') ? ext.split(';')[0] : ext;
    const baseName = resolvedName || item.title;
    const fileName = baseName.includes('.') ? baseName : `${baseName}.${cleanExt}`;
    downloadFile(item.fileUrl, fileName, item.filePath);
  };

  const handleOpenExternal = () => {
    openFileInNewWindow(item);
  };

  const canZoom =
    previewType === 'image' ||
    (previewType === 'pdf' && pdfPages.length > 0) ||
    (previewType === 'drive' && driveHighResThumb && !driveImgFailed);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-white shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              {isDriveLink ? (
                <FolderGit2 size={20} />
              ) : previewType === 'sheet' ? (
                <FileSpreadsheet size={20} />
              ) : (
                <FileText size={20} />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-slate-800 text-sm sm:text-base truncate" title={item.title}>
                {item.title}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{isDriveLink ? 'مستند Google Drive' : 'ملف مرفق'}</span>
                {pdfPages.length > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums font-bold text-blue-600">{pdfPages.length} صفحات</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Zoom Controls */}
            {canZoom && (
              <div className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl ml-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(60, z - 20))}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors cursor-pointer"
                  title="تصغير"
                >
                  <ZoomOut size={15} />
                </button>
                <span className="text-[11px] font-bold text-slate-700 px-1.5 tabular-nums">{zoom}%</span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(200, z + 20))}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors cursor-pointer"
                  title="تكبير"
                >
                  <ZoomIn size={15} />
                </button>
              </div>
            )}

            {/* Download Button - Available to ALL (Admin, Members, Visitors) */}
            <button
              type="button"
              onClick={handleDownload}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm whitespace-nowrap cursor-pointer"
              title="تحميل الملف"
            >
              <Download size={15} />
              <span>تحميل</span>
            </button>

            {/* Open in New Window/Tab Button (Opens /view-file route — NEVER downloads!) */}
            <button
              type="button"
              onClick={handleOpenExternal}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm whitespace-nowrap cursor-pointer"
              title="استعراض في نافذة أخرى بدون تحميل"
            >
              <ExternalLink size={15} />
              <span>فتح في نافذة أخرى</span>
            </button>

            {/* Delete Button - Admin Only */}
            {canDelete && onDelete && (
              !confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="px-3 py-2 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                  title="حذف الملف (للإدارة)"
                >
                  <Trash2 size={15} />
                  <span className="hidden sm:inline">حذف</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 bg-red-50 px-2.5 py-1.5 rounded-xl border border-red-200">
                  <span className="text-[11px] font-bold text-red-800">تأكيد؟</span>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(item.id);
                      onClose();
                    }}
                    className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-lg cursor-pointer"
                  >
                    نعم
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1 bg-white text-slate-600 border border-slate-200 text-[11px] font-bold rounded-lg cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              )
            )}

            <div className="w-px h-6 bg-slate-200 mx-1"></div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="إغلاق المعاينة"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body / File Viewer */}
        <div className="flex-1 bg-slate-100 relative overflow-y-auto p-4 sm:p-8 flex flex-col items-center">
          {loading ? (
            <div className="my-auto flex flex-col items-center gap-3 text-slate-600">
              <Loader2 size={36} className="animate-spin text-blue-600" />
              <p className="text-sm font-bold">جاري تحضير صفحات الملف للمعاينة المباشرة...</p>
            </div>
          ) : previewType === 'image' && resolvedUrl && !error ? (
            <div className="my-auto flex items-center justify-center w-full">
              <img
                src={resolvedUrl}
                alt={item.title}
                referrerPolicy="no-referrer"
                style={{ width: `${zoom}%`, maxWidth: zoom > 100 ? 'none' : '100%' }}
                className="object-contain rounded-2xl shadow-xl border border-slate-200 bg-white transition-all duration-200"
              />
            </div>
          ) : pdfPages.length > 0 ? (
            <div className="w-full flex flex-col items-center gap-6">
              {pdfPages.map((pageDataUrl, idx) => (
                <div
                  key={idx}
                  style={{
                    width: `${Math.min(zoom, 100)}%`,
                    maxWidth: zoom > 100 ? `${zoom * 8}px` : '850px',
                  }}
                  className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden transition-all duration-200"
                >
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
                    <span>{item.title}</span>
                    <span className="tabular-nums">
                      صفحة {idx + 1} من {pdfPages.length}
                    </span>
                  </div>
                  <img
                    src={pageDataUrl}
                    alt={`${item.title} - صفحة ${idx + 1}`}
                    className="w-full h-auto block"
                  />
                </div>
              ))}
            </div>
          ) : sheetRows.length > 0 ? (
            <div className="w-full bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              {sheetNames.length > 1 && (
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
                  {sheetNames.map((name, idx) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => handleSelectSheet(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        activeSheetIdx === idx
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
              <div className="overflow-x-auto max-h-[68vh]">
                <table className="w-full text-xs text-right border-collapse">
                  <tbody>
                    {sheetRows.slice(0, 150).map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className={
                          rIdx === 0
                            ? 'bg-slate-100 font-black text-slate-800 border-b border-slate-300'
                            : 'border-b border-slate-100 hover:bg-blue-50/40 text-slate-700'
                        }
                      >
                        {(Array.isArray(row) ? row : []).map((cell, cIdx) => (
                          <td key={cIdx} className="px-3 py-2 border-l border-slate-100 whitespace-nowrap">
                            {cell !== null && cell !== undefined ? String(cell) : ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : useDocsViewerFallback ? (
            <div className="w-full h-full bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200">
              <iframe
                src={`https://docs.google.com/gview?url=${encodeURIComponent(item.fileUrl)}&embedded=true`}
                title={item.title}
                className="w-full h-full border-0"
              />
            </div>
          ) : previewType === 'drive' && driveHighResThumb && !driveImgFailed ? (
            <div className="my-auto flex flex-col items-center gap-5 w-full max-w-4xl">
              <div
                style={{ width: `${zoom}%`, maxWidth: zoom > 100 ? 'none' : '820px' }}
                className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden transition-all duration-200"
              >
                <img
                  src={driveHighResThumb}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  onError={() => setDriveImgFailed(true)}
                  className="w-full h-auto object-contain block"
                />
              </div>
              <button
                type="button"
                onClick={handleOpenExternal}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg cursor-pointer"
              >
                <ExternalLink size={16} />
                <span>فتح المستند الكامل في Google Drive (نافذة جديدة)</span>
              </button>
            </div>
          ) : (
            <div className="my-auto bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-lg text-center max-w-lg mx-4 space-y-5">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto border border-blue-100">
                {isDriveLink ? <FolderGit2 size={38} /> : <FileText size={38} />}
              </div>
              <div className="space-y-2">
                <h4 className="font-black text-slate-800 text-xl">{item.title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {isDriveLink
                    ? 'يمكنك فتح هذا الرابط واستعراضه مباشرة في نافذة جديدة في Google Drive.'
                    : error || 'يمكنك استعراض هذا الملف مباشرة في نافذة مستقلة أو تحميله إلى جهازك.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleOpenExternal}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-md cursor-pointer"
                >
                  <ExternalLink size={16} />
                  <span>فتح واستعراض في نافذة أخرى</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-md cursor-pointer"
                >
                  <Download size={16} />
                  <span>تحميل الملف</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
