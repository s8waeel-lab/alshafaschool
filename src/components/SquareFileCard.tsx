import React, { useEffect, useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FolderGit2,
  Eye,
  ExternalLink,
  Download,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  resolveFileUrl,
  getGoogleDriveThumbnailUrl,
  getPreviewType,
  generatePdfThumbnail,
  downloadFile,
  openFileInNewWindow,
  extractGoogleDriveInfo,
} from '../utils/fileUtils';
import { PreviewableFileItem } from './FilePreviewModal';

interface SquareFileCardProps {
  item: PreviewableFileItem & {
    indicatorId?: string;
    schoolId?: string;
    isShared?: boolean;
    rejectionReason?: string;
    academicYear?: string;
    accessLevel?: 'public' | 'private';
  };
  onPreview: (item: PreviewableFileItem) => void;
  /** Visible ONLY for Administration (isAdmin) */
  canDelete: boolean;
  onDelete?: (id: string) => void;
  /** Optional extra actions (e.g. Approve / Reject in EvidenceReviewPage) */
  extraActions?: React.ReactNode;
}

export default function SquareFileCard({
  item,
  onPreview,
  canDelete,
  onDelete,
  extraActions,
}: SquareFileCardProps) {
  const [previewImgSrc, setPreviewImgSrc] = useState<string | null>(null);
  const [resolvedMime, setResolvedMime] = useState<string>(item.fileType || '');
  const [resolvedName, setResolvedName] = useState<string>('');
  const [resolving, setResolving] = useState<boolean>(false);
  const [imgFailed, setImgFailed] = useState<boolean>(false);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setImgFailed(false);
    setPreviewImgSrc(null);

    const prepareThumbnail = async () => {
      setResolving(true);
      try {
        const resolved = await resolveFileUrl(item.fileUrl, item.filePath);
        if (!isMounted) return;

        const mime = resolved.mimeType || item.fileType || '';
        setResolvedMime(mime);
        setResolvedName(resolved.fileName || '');

        const pType = getPreviewType(
          resolved.resolvedUrl || item.fileUrl,
          mime,
          item.title,
          item.filePath,
          resolved.fileName,
          resolved.uint8Array
        );

        if (pType === 'image' && resolved.resolvedUrl) {
          setPreviewImgSrc(resolved.resolvedUrl);
        } else if (pType === 'pdf') {
          const pdfDataUrl = await generatePdfThumbnail(item.fileUrl, {
            data: resolved.uint8Array,
            url: resolved.resolvedUrl,
          });
          if (isMounted && pdfDataUrl) {
            setPreviewImgSrc(pdfDataUrl);
          }
        } else if (pType === 'drive') {
          const driveThumb = getGoogleDriveThumbnailUrl(item.fileUrl, 800);
          if (driveThumb) {
            setPreviewImgSrc(driveThumb);
          }
        }
      } catch {
        // Fallback to visual document sheet
      } finally {
        if (isMounted) setResolving(false);
      }
    };

    prepareThumbnail();

    return () => {
      isMounted = false;
    };
  }, [item.fileUrl, item.filePath, item.fileType, item.title]);

  const isDriveLink =
    item.filePath === 'google_drive_link' ||
    item.fileUrl?.includes('drive.google.com') ||
    item.fileUrl?.includes('docs.google.com');

  const driveInfo = extractGoogleDriveInfo(item.fileUrl);

  const statusConfig: Record<
    string,
    { color: string; bg: string; border: string; icon: React.ReactNode; label: string }
  > = {
    pending: {
      color: 'text-amber-700',
      bg: 'bg-amber-50/95',
      border: 'border-amber-200',
      icon: <Clock size={12} />,
      label: 'قيد المراجعة',
    },
    approved: {
      color: 'text-emerald-700',
      bg: 'bg-emerald-50/95',
      border: 'border-emerald-200',
      icon: <CheckCircle size={12} />,
      label: 'معتمد',
    },
    rejected: {
      color: 'text-red-700',
      bg: 'bg-red-50/95',
      border: 'border-red-200',
      icon: <AlertCircle size={12} />,
      label: 'مرفوض',
    },
    archived: {
      color: 'text-slate-600',
      bg: 'bg-slate-100/95',
      border: 'border-slate-200',
      icon: <FileText size={12} />,
      label: 'مؤرشف',
    },
  };

  const currentStatus = item.status ? statusConfig[item.status] : null;

  const formatDate = (ts: any) => {
    if (!ts) return '';
    try {
      const date = ts.toDate ? ts.toDate() : ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
      return new Intl.DateTimeFormat('ar-SA').format(date);
    } catch {
      return '';
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const ext = (resolvedMime || item.fileType || '').split('/')[1] || 'pdf';
    const cleanExt = ext.includes(';') ? ext.split(';')[0] : ext;
    const baseName = resolvedName || item.title;
    const fileName = baseName.includes('.') ? baseName : `${baseName}.${cleanExt}`;
    downloadFile(item.fileUrl, fileName, item.filePath);
  };

  const handleOpenNewTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    openFileInNewWindow(item);
  };

  const getFileBadgeInfo = () => {
    const pType = getPreviewType(
      item.fileUrl,
      resolvedMime || item.fileType,
      item.title,
      item.filePath,
      resolvedName
    );
    if (driveInfo?.kind === 'folder') {
      return {
        label: 'مجلد قوقل درايف',
        color: 'text-blue-600 bg-blue-50 border-blue-100',
        accent: 'bg-blue-600',
        icon: <FolderGit2 size={28} />,
      };
    }
    if (isDriveLink) {
      return {
        label: 'مستند Google Drive',
        color: 'text-blue-600 bg-blue-50 border-blue-100',
        accent: 'bg-blue-600',
        icon: <FolderGit2 size={28} />,
      };
    }
    if (pType === 'image') {
      return {
        label: 'صورة مرفقة',
        color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
        accent: 'bg-indigo-600',
        icon: <ImageIcon size={28} />,
      };
    }
    if (pType === 'pdf') {
      return {
        label: 'مستند PDF',
        color: 'text-red-600 bg-red-50 border-red-100',
        accent: 'bg-red-600',
        icon: <FileText size={28} />,
      };
    }
    if (pType === 'sheet') {
      return {
        label: 'جدول بيانات',
        color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
        accent: 'bg-emerald-600',
        icon: <FileSpreadsheet size={28} />,
      };
    }
    return {
      label: 'ملف وثيقة',
      color: 'text-slate-700 bg-slate-100 border-slate-200',
      accent: 'bg-slate-700',
      icon: <FileText size={28} />,
    };
  };

  const badgeInfo = getFileBadgeInfo();

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all duration-300 flex flex-col overflow-hidden group">
      {/* SQUARE VISUAL PREVIEW BOX */}
      <div
        onClick={() => onPreview(item)}
        className="relative aspect-square w-full bg-slate-100 overflow-hidden cursor-pointer border-b border-slate-100 select-none"
        title="اضغط لاستعراض الملف مباشرة"
      >
        {/* Crisp Visual Document Page Preview */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/50 p-5 flex flex-col items-center justify-center">
          <div className="w-full h-full max-w-[85%] max-h-[90%] bg-white rounded-2xl shadow-md border border-slate-200/90 flex flex-col justify-between relative overflow-hidden group-hover:scale-[1.03] transition-transform duration-300">
            <div className={`h-2 w-full ${badgeInfo.accent}`} />

            <div className="p-4 flex-1 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${badgeInfo.color}`}>
                  {badgeInfo.icon}
                </div>
                <div className="text-left">
                  <span className="text-[10px] font-black text-slate-400 block">مجمع الشفا التعليمي</span>
                  <span className="text-[10px] font-bold text-blue-600">{badgeInfo.label}</span>
                </div>
              </div>

              <div className="my-auto py-2 space-y-2.5 text-right">
                <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-2.5">
                  <p className="text-xs font-black text-slate-800 line-clamp-2 leading-relaxed">
                    {item.title}
                  </p>
                  {item.description && (
                    <p className="text-[10px] text-slate-500 line-clamp-1 mt-1">
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5 px-1">
                  <div className="h-1.5 bg-slate-100 rounded-full w-full"></div>
                  <div className="h-1.5 bg-slate-100 rounded-full w-4/5"></div>
                  <div className="h-1.5 bg-slate-100 rounded-full w-3/5"></div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-bold">
                <span>{formatDate(item.createdAt) || 'موثق'}</span>
                <span className="text-blue-600 flex items-center gap-1">
                  <Eye size={11} />
                  <span>اضغط للاستعراض</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Real File Image / Rendered PDF Page 1 Layer */}
        {resolving ? (
          <div className="absolute inset-0 bg-white/75 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-10">
            <Loader2 size={26} className="animate-spin text-blue-600" />
            <span className="text-[11px] font-bold text-slate-600">جاري تجهيز صورة الملف...</span>
          </div>
        ) : previewImgSrc && !imgFailed ? (
          <img
            src={previewImgSrc}
            alt={item.title}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover object-top z-10 group-hover:scale-105 transition-transform duration-500 bg-white"
          />
        ) : null}

        {/* Top Badges Overlay (Status & File Type) */}
        <div className="absolute top-3 right-3 left-3 flex items-center justify-between gap-2 z-20 pointer-events-none">
          {currentStatus ? (
            <span
              className={`px-2.5 py-1 rounded-xl text-[11px] font-black flex items-center gap-1 border shadow-xs backdrop-blur-md ${currentStatus.bg} ${currentStatus.color} ${currentStatus.border}`}
            >
              {currentStatus.icon}
              <span>{currentStatus.label}</span>
            </span>
          ) : (
            <span></span>
          )}

          <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-slate-900/75 text-white backdrop-blur-md shadow-xs">
            {badgeInfo.label}
          </span>
        </div>

        {/* Hover Scrim with Direct Preview Prompt */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 flex flex-col items-center justify-end p-4">
          <div className="w-full py-2.5 px-4 bg-white/95 text-slate-900 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-200">
            <Eye size={16} className="text-blue-600" />
            <span>استعراض الملف</span>
          </div>
        </div>
      </div>

      {/* Card Details & Actions */}
      <div className="p-4 flex-1 flex flex-col justify-between gap-3 bg-white">
        <div>
          <h4
            onClick={() => onPreview(item)}
            className="font-black text-slate-800 text-sm line-clamp-2 group-hover:text-blue-600 transition-colors cursor-pointer leading-snug mb-1"
            title={item.title}
          >
            {item.title}
          </h4>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 font-medium">
            <span>{isDriveLink ? 'رابط Google Drive' : 'ملف مرفق'}</span>
            {item.createdAt && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{formatDate(item.createdAt)}</span>
              </>
            )}
            {item.academicYear && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{item.academicYear}</span>
              </>
            )}
          </div>

          {item.rejectionReason && (
            <div className="mt-2 text-[11px] text-red-600 font-bold bg-red-50 px-2.5 py-1.5 rounded-xl border border-red-100 flex items-center gap-1.5">
              <AlertCircle size={12} className="shrink-0" />
              <span className="line-clamp-2">السبب: {item.rejectionReason}</span>
            </div>
          )}
        </div>

        {/* Extra Review Actions (Approve / Reject for EvidenceReviewPage) */}
        {extraActions && <div className="pt-2 border-t border-slate-100">{extraActions}</div>}

        {/* Primary Action Bar: Preview + External + Download (For Everyone) + Delete (Admin Only) */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
          {!confirmDelete ? (
            <>
              <div className="flex items-center gap-1.5 flex-1">
                {/* Preview in Modal Button */}
                <button
                  type="button"
                  onClick={() => onPreview(item)}
                  className="flex-1 py-2 px-2.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  title="استعراض الملف"
                >
                  <Eye size={15} />
                  <span>استعراض</span>
                </button>

                {/* Open in Another Window Button (Never downloads!) */}
                <button
                  type="button"
                  onClick={handleOpenNewTab}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer shrink-0"
                  title="استعراض في نافذة أخرى"
                >
                  <ExternalLink size={15} />
                </button>

                {/* Download Button - Available to ALL (Admin, Members, Visitors) */}
                <button
                  type="button"
                  onClick={handleDownload}
                  className="py-2 px-2.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title="تحميل الملف"
                >
                  <Download size={15} />
                  <span>تحميل</span>
                </button>
              </div>

              {/* Delete Button - Visible strictly to Administration (canDelete = isAdmin) */}
              {canDelete && onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(true);
                  }}
                  className="p-2 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-xl transition-colors cursor-pointer shrink-0"
                  title="حذف الملف (للإدارة)"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </>
          ) : (
            <div className="w-full flex items-center justify-between gap-2 bg-red-50 px-3 py-1.5 rounded-xl border border-red-200">
              <span className="text-[11px] font-bold text-red-800">تأكيد الحذف؟</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(item.id);
                    setConfirmDelete(false);
                  }}
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-lg cursor-pointer"
                >
                  حذف
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(false);
                  }}
                  className="px-2.5 py-1 bg-white text-slate-600 border border-slate-200 text-[11px] font-bold rounded-lg cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
