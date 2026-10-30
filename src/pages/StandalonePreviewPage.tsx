import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Download,
  FileText,
  FolderGit2,
  Loader2,
  ZoomIn,
  ZoomOut,
  ArrowRight,
  FileSpreadsheet,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import {
  resolveFileUrl,
  getPreviewType,
  getGoogleDriveThumbnailUrl,
  downloadFile,
} from '../utils/fileUtils';

export default function StandalonePreviewPage() {
  const [searchParams] = useSearchParams();
  const src = searchParams.get('src') || '';
  const title = searchParams.get('title') || 'استعراض المستند';
  const filePath = searchParams.get('path') || '';
  const fileType = searchParams.get('type') || '';

  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [resolvedMime, setResolvedMime] = useState<string>(fileType);
  const [resolvedName, setResolvedName] = useState<string>('');
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [sheetRows, setSheetRows] = useState<any[][]>([]);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheetIdx, setActiveSheetIdx] = useState<number>(0);
  const [workbookData, setWorkbookData] = useState<XLSX.WorkBook | null>(null);
  const [useDocsViewerFallback, setUseDocsViewerFallback] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(100);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!src) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setPdfPages([]);
    setSheetRows([]);
    setUseDocsViewerFallback(false);

    const loadDocument = async () => {
      try {
        const res = await resolveFileUrl(src, filePath);
        if (!isMounted) return;

        const mime = res.mimeType || fileType || '';
        setResolvedUrl(res.resolvedUrl);
        setResolvedMime(mime);
        setResolvedName(res.fileName || '');

        const pType = getPreviewType(
          res.resolvedUrl || src,
          mime,
          title,
          filePath,
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
              const totalPages = Math.min(pdf.numPages, 40);
              const renderedPages: string[] = [];

              for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                if (!isMounted) return;
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 1.7 });
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
            // If external PDF URL blocks direct CORS fetch, use embedded Google Docs viewer
            if (isMounted && (src.startsWith('http://') || src.startsWith('https://'))) {
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
            if (isMounted && (src.startsWith('http://') || src.startsWith('https://'))) {
              setUseDocsViewerFallback(true);
            }
          }
        } else if (pType === 'other' && (src.startsWith('http://') || src.startsWith('https://'))) {
          setUseDocsViewerFallback(true);
        }
      } catch (err) {
        console.error('Standalone preview error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDocument();
    return () => {
      isMounted = false;
    };
  }, [src, filePath, fileType, title]);

  const handleSelectSheet = (idx: number) => {
    if (!workbookData || !sheetNames[idx]) return;
    setActiveSheetIdx(idx);
    const sheet = workbookData.Sheets[sheetNames[idx]];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    setSheetRows(rows);
  };

  const handleDownload = () => {
    const ext = (resolvedMime || fileType || '').split('/')[1] || 'pdf';
    const cleanExt = ext.includes(';') ? ext.split(';')[0] : ext;
    const baseName = resolvedName || title;
    const fileName = baseName.includes('.') ? baseName : `${baseName}.${cleanExt}`;
    downloadFile(src, fileName, filePath);
  };

  const pType = getPreviewType(resolvedUrl || src, resolvedMime, title, filePath, resolvedName);
  const driveThumb = getGoogleDriveThumbnailUrl(src, 1600);
  const isDrive = src.includes('drive.google.com') || src.includes('docs.google.com');

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col font-sans" dir="rtl">
      {/* Top Viewer Toolbar */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
            {isDrive ? (
              <FolderGit2 size={20} />
            ) : pType === 'sheet' ? (
              <FileSpreadsheet size={20} />
            ) : (
              <FileText size={20} />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="font-black text-white text-sm sm:text-base truncate" title={title}>
              {title}
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>مستعرض الملفات المباشر — مجمع الشفا التعليمي</span>
              {pdfPages.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-blue-400 font-bold tabular-nums">{pdfPages.length} صفحات</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {(pType === 'image' || pdfPages.length > 0 || driveThumb) && (
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(50, z - 20))}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="تصغير"
              >
                <ZoomOut size={16} />
              </button>
              <span className="text-xs font-bold text-slate-200 px-2 tabular-nums">{zoom}%</span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(200, z + 20))}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="تكبير"
              >
                <ZoomIn size={16} />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleDownload}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
          >
            <Download size={16} />
            <span>تحميل الملف</span>
          </button>

          <Link
            to="/"
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <ArrowRight size={15} />
            <span>العودة للمنصة</span>
          </Link>
        </div>
      </header>

      {/* Main Document Viewport */}
      <main className="flex-1 p-4 sm:p-8 flex flex-col items-center overflow-y-auto">
        {loading ? (
          <div className="my-auto flex flex-col items-center gap-3 text-slate-300">
            <Loader2 size={40} className="animate-spin text-blue-500" />
            <p className="text-sm font-bold">جاري تجهيز الملف للاستعراض المباشر...</p>
          </div>
        ) : pType === 'image' && resolvedUrl ? (
          <div className="my-auto flex items-center justify-center w-full">
            <img
              src={resolvedUrl}
              alt={title}
              referrerPolicy="no-referrer"
              style={{ width: `${zoom}%`, maxWidth: zoom > 100 ? 'none' : '100%' }}
              className="object-contain rounded-2xl shadow-2xl border border-slate-800 bg-white transition-all duration-200"
            />
          </div>
        ) : pdfPages.length > 0 ? (
          <div className="w-full flex flex-col items-center gap-6">
            {pdfPages.map((pageDataUrl, idx) => (
              <div
                key={idx}
                style={{
                  width: `${Math.min(zoom, 100)}%`,
                  maxWidth: zoom > 100 ? `${zoom * 9}px` : '920px',
                }}
                className="bg-white rounded-2xl shadow-2xl border border-slate-800 overflow-hidden transition-all duration-200"
              >
                <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-600">
                  <span>{title}</span>
                  <span className="tabular-nums">
                    صفحة {idx + 1} من {pdfPages.length}
                  </span>
                </div>
                <img
                  src={pageDataUrl}
                  alt={`${title} - صفحة ${idx + 1}`}
                  className="w-full h-auto block"
                />
              </div>
            ))}
          </div>
        ) : sheetRows.length > 0 ? (
          <div className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
            {sheetNames.length > 1 && (
              <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
                {sheetNames.map((name, idx) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleSelectSheet(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      activeSheetIdx === idx
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
            <div className="overflow-x-auto max-h-[78vh]">
              <table className="w-full text-xs text-right border-collapse">
                <tbody>
                  {sheetRows.slice(0, 200).map((row, rIdx) => (
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
          <div className="w-full max-w-5xl h-[82vh] bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-700">
            <iframe
              src={`https://docs.google.com/gview?url=${encodeURIComponent(src)}&embedded=true`}
              title={title}
              className="w-full h-full border-0"
            />
          </div>
        ) : driveThumb ? (
          <div className="my-auto flex flex-col items-center gap-5 w-full max-w-4xl">
            <img
              src={driveThumb}
              alt={title}
              referrerPolicy="no-referrer"
              style={{ width: `${zoom}%`, maxWidth: zoom > 100 ? 'none' : '860px' }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-700 object-contain"
            />
          </div>
        ) : (
          <div className="my-auto bg-slate-800 border border-slate-700 rounded-3xl p-10 text-center max-w-md space-y-4 text-white">
            <FileText size={48} className="mx-auto text-blue-400" />
            <h2 className="text-lg font-black">{title}</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              هذا الملف جاهز، يمكنك تنزيله مباشرة إلى جهازك من الزر أدناه.
            </p>
            <button
              type="button"
              onClick={handleDownload}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black inline-flex items-center gap-2 cursor-pointer"
            >
              <Download size={16} />
              <span>تحميل الملف</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
