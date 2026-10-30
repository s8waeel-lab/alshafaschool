import { collection, doc, setDoc, getDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { ref, getBytes } from 'firebase/storage';
import { db, storage, runFirestoreOp } from '../services/firebase';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const CHUNK_SIZE = 600 * 1024; // ~600KB per chunk (well below 1MB Firestore limit)
const LOCAL_FILE_DB_NAME = 'shafa_local_files_db';
const LOCAL_FILE_STORE = 'files';

interface LocalStoredFile {
  id: string;
  fileName: string;
  fileType: string;
  dataUrl: string;
}

function openLocalFileDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(LOCAL_FILE_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const dbInstance = req.result;
        if (!dbInstance.objectStoreNames.contains(LOCAL_FILE_STORE)) {
          dbInstance.createObjectStore(LOCAL_FILE_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

async function saveFileToLocalDb(item: LocalStoredFile): Promise<void> {
  try {
    const idb = await openLocalFileDb();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(LOCAL_FILE_STORE, 'readwrite');
      tx.objectStore(LOCAL_FILE_STORE).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore IndexedDB error
  }
}

async function getFileFromLocalDb(id: string): Promise<LocalStoredFile | null> {
  try {
    const idb = await openLocalFileDb();
    return await new Promise<LocalStoredFile | null>((resolve, reject) => {
      const tx = idb.transaction(LOCAL_FILE_STORE, 'readonly');
      const req = tx.objectStore(LOCAL_FILE_STORE).get(id);
      req.onsuccess = () => resolve((req.result as LocalStoredFile) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export interface ResolvedFileData {
  resolvedUrl: string;
  isBlob: boolean;
  fileName?: string;
  mimeType?: string;
  uint8Array?: Uint8Array;
}

// In-memory caches so square thumbnail cards and preview modals are instantaneous
const resolvedFileCache = new Map<string, ResolvedFileData>();
const pdfThumbnailCache = new Map<string, string>();

/**
 * Inspects the first bytes (magic numbers) of a file to reliably detect PDF or Image types
 * even if the file was saved with a generic mimeType or custom Arabic title without an extension.
 */
export function detectMimeFromBytes(bytes?: Uint8Array): string | null {
  if (!bytes || bytes.byteLength < 4) return null;

  // %PDF (25 50 44 46)
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'application/pdf';
  }
  // PNG (89 50 4E 47)
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  // JPEG (FF D8 FF)
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  // GIF (47 49 46 38)
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif';
  }
  // WEBP (RIFF....WEBP)
  if (
    bytes.byteLength >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

export function inferMimeType(rawMime?: string, fileName?: string, bytes?: Uint8Array): string {
  const fromBytes = detectMimeFromBytes(bytes);
  if (fromBytes) return fromBytes;

  const mime = (rawMime || '').trim().toLowerCase();
  if (mime && mime !== 'application/octet-stream' && mime !== 'binary/octet-stream') {
    return mime;
  }

  const lowerName = (fileName || '').toLowerCase();
  if (lowerName.endsWith('.pdf')) return 'application/pdf';
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerName.endsWith('.webp')) return 'image/webp';
  if (lowerName.endsWith('.gif')) return 'image/gif';
  if (lowerName.endsWith('.svg')) return 'image/svg+xml';
  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (lowerName.endsWith('.csv')) return 'text/csv';
  if (lowerName.endsWith('.txt')) return 'text/plain;charset=utf-8';
  return mime || 'application/octet-stream';
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

function dataUrlToBytes(
  dataUrl: string,
  fileName?: string,
  storedFileType?: string
): { blob: Blob; mime: string; uint8Array: Uint8Array } {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const detectedMime = mimeMatch ? mimeMatch[1] : '';
  const bstr = atob(parts[1] || '');
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  const mime = inferMimeType(storedFileType || detectedMime, fileName, u8arr);
  return { blob: new Blob([u8arr], { type: mime }), mime, uint8Array: u8arr };
}

/**
 * Renders the first page of a PDF (from Uint8Array or URL) to a PNG data URL for square thumbnail preview.
 * Uses HTML5 Canvas via pdfjs-dist so Chrome NEVER blocks it like an iframe.
 */
export const generatePdfThumbnail = async (
  cacheKey: string,
  source: { data?: Uint8Array; url?: string }
): Promise<string | null> => {
  if (pdfThumbnailCache.has(cacheKey)) {
    return pdfThumbnailCache.get(cacheKey)!;
  }

  try {
    let loadingTask;
    if (source.data && source.data.byteLength > 0) {
      const dataCopy = new Uint8Array(source.data);
      loadingTask = pdfjsLib.getDocument({ data: dataCopy });
    } else if (source.url) {
      const response = await fetch(source.url, { mode: 'cors' });
      const arrayBuf = await response.arrayBuffer();
      loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuf) });
    } else {
      return null;
    }

    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.2 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport,
      canvas,
    }).promise;

    const dataUrl = canvas.toDataURL('image/png');
    pdfThumbnailCache.set(cacheKey, dataUrl);
    return dataUrl;
  } catch (err) {
    console.warn('PDF thumbnail generation fallback:', err);
    return null;
  }
};

/**
 * Extracts Google Drive file/folder ID and type from a URL if applicable.
 */
export const extractGoogleDriveInfo = (
  url: string
): { id: string; kind: 'file' | 'folder' | 'doc' | 'sheet' | 'slide' } | null => {
  if (!url) return null;

  const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch?.[1]) {
    return { id: folderMatch[1], kind: 'folder' };
  }

  const docMatch = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docMatch?.[1]) {
    return { id: docMatch[1], kind: 'doc' };
  }

  const sheetMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (sheetMatch?.[1]) {
    return { id: sheetMatch[1], kind: 'sheet' };
  }

  const slideMatch = url.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  if (slideMatch?.[1]) {
    return { id: slideMatch[1], kind: 'slide' };
  }

  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (fileMatch?.[1]) {
    return { id: fileMatch[1], kind: 'file' };
  }

  return null;
};

/**
 * Returns a Google Drive thumbnail image URL when a valid file/doc ID is present.
 */
export const getGoogleDriveThumbnailUrl = (url: string, size: number = 800): string | null => {
  const info = extractGoogleDriveInfo(url);
  if (!info || info.kind === 'folder') return null;
  return `https://drive.google.com/thumbnail?id=${info.id}&sz=w${size}`;
};

/**
 * Classifies how a file should be previewed using all available metadata and magic bytes.
 */
export const getPreviewType = (
  url: string,
  mimeType?: string,
  title?: string,
  filePath?: string,
  fileName?: string,
  bytes?: Uint8Array
): 'image' | 'pdf' | 'sheet' | 'drive' | 'other' => {
  if (!url) return 'other';

  if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
    return 'drive';
  }

  const effectiveMime = inferMimeType(mimeType, fileName || filePath || title, bytes).toLowerCase();

  let decodedUrl = url.toLowerCase();
  try {
    decodedUrl = decodeURIComponent(url).toLowerCase();
  } catch {
    // ignore decode errors
  }
  const cleanUrl = decodedUrl.split('?')[0];
  const combinedNames = `${title || ''} ${filePath || ''} ${fileName || ''} ${cleanUrl}`.toLowerCase();

  if (
    effectiveMime.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|svg|bmp|avif)(\b|$)/i.test(combinedNames)
  ) {
    return 'image';
  }

  if (
    effectiveMime.includes('pdf') ||
    /\.pdf(\b|$)/i.test(combinedNames)
  ) {
    return 'pdf';
  }

  if (
    effectiveMime.includes('sheet') ||
    effectiveMime.includes('excel') ||
    effectiveMime.includes('csv') ||
    /\.(xlsx?|csv)(\b|$)/i.test(combinedNames)
  ) {
    return 'sheet';
  }

  return 'other';
};

/**
 * Uploads a file to chunked Firestore cloud storage (`uploadedFiles`) and local IndexedDB cache so that
 * direct in-browser previewing (Canvas PDF.js, Image, Spreadsheet) is 100% CORS-free, resilient to quota limits,
 * and never triggers unexpected browser downloads.
 */
export const uploadFileResilient = async (
  file: File,
  _folder: string,
  userId: string
): Promise<{ fileUrl: string; filePath: string }> => {
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('حجم الملف كبير جداً للرفع المباشر (الحد الأقصى 15 ميجابايت). يرجى رفعه في مجلد قوقل درايف الخاص بالمجمع ثم إرفاق رابطه.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  const normalizedMime = inferMimeType(file.type, file.name, uint8Array);

  const dataUrl = await fileToDataUrl(file);
  const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  // Save in local IndexedDB so it works even across tabs (/view-file) and when Firestore quota is exhausted
  await saveFileToLocalDb({
    id: fileId,
    fileName: file.name,
    fileType: normalizedMime,
    dataUrl,
  });

  try {
    const totalChunks = Math.ceil(dataUrl.length / CHUNK_SIZE);
    await runFirestoreOp(() =>
      setDoc(doc(db, 'uploadedFiles', fileId), {
        id: fileId,
        fileName: file.name,
        fileType: normalizedMime,
        fileSize: file.size,
        totalChunks,
        uploadedBy: userId,
        createdAt: serverTimestamp(),
      })
    );

    for (let i = 0; i < totalChunks; i++) {
      const chunkData = dataUrl.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await runFirestoreOp(() =>
        setDoc(doc(db, 'uploadedFiles', fileId, 'chunks', String(i)), {
          index: i,
          data: chunkData,
        })
      );
    }
  } catch {
    // Fallback already saved in local IndexedDB and memory cache
  }

  const firestoreUrl = `#firestore-file:${fileId}`;
  const properBlob = new Blob([uint8Array], { type: normalizedMime });
  const blobUrl = window.URL.createObjectURL(properBlob);

  resolvedFileCache.set(firestoreUrl, {
    resolvedUrl: blobUrl,
    isBlob: true,
    fileName: file.name,
    mimeType: normalizedMime,
    uint8Array,
  });

  return {
    fileUrl: firestoreUrl,
    filePath: `uploadedFiles/${fileId}`,
  };
};

/**
 * Resolves a stored fileUrl (including `#firestore-file:` URLs and Firebase Storage paths)
 * to a usable browser URL and raw bytes.
 */
export const resolveFileUrl = async (url: string, filePath?: string): Promise<ResolvedFileData> => {
  if (!url) {
    return { resolvedUrl: '', isBlob: false };
  }

  const cacheKey = `${url}|${filePath || ''}`;
  const cached = resolvedFileCache.get(url) || resolvedFileCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  if (url.startsWith('#firestore-file:')) {
    const fileId = url.replace('#firestore-file:', '');

    // Check local IndexedDB first for instant quota-free resolution
    const localFile = await getFileFromLocalDb(fileId);
    if (localFile && localFile.dataUrl) {
      const { blob, mime, uint8Array } = dataUrlToBytes(localFile.dataUrl, localFile.fileName, localFile.fileType);
      const blobUrl = window.URL.createObjectURL(blob);
      const result: ResolvedFileData = {
        resolvedUrl: blobUrl,
        isBlob: true,
        fileName: localFile.fileName,
        mimeType: mime,
        uint8Array,
      };
      resolvedFileCache.set(url, result);
      return result;
    }

    const metaSnap = await runFirestoreOp(() => getDoc(doc(db, 'uploadedFiles', fileId)));
    if (!metaSnap.exists()) {
      throw new Error('لم يتم العثور على الملف المخزن.');
    }

    const meta = metaSnap.data();
    const chunksSnap = await runFirestoreOp(() =>
      getDocs(query(collection(db, 'uploadedFiles', fileId, 'chunks'), orderBy('index', 'asc')))
    );

    const fullDataUrl = chunksSnap.docs.map((d) => d.data().data).join('');
    await saveFileToLocalDb({
      id: fileId,
      fileName: meta.fileName,
      fileType: meta.fileType,
      dataUrl: fullDataUrl,
    });

    const { blob, mime, uint8Array } = dataUrlToBytes(fullDataUrl, meta.fileName, meta.fileType);
    const blobUrl = window.URL.createObjectURL(blob);

    const result: ResolvedFileData = {
      resolvedUrl: blobUrl,
      isBlob: true,
      fileName: meta.fileName,
      mimeType: mime,
      uint8Array,
    };

    resolvedFileCache.set(url, result);
    return result;
  }

  // If it's a Firebase Storage file and we have its storage path, try reading bytes via SDK
  if (filePath && !filePath.startsWith('uploadedFiles/') && filePath !== 'google_drive_link') {
    try {
      const storageRef = ref(storage, filePath);
      const buffer = await getBytes(storageRef);
      const uint8Array = new Uint8Array(buffer);
      const mime = inferMimeType(undefined, filePath, uint8Array);
      const blob = new Blob([uint8Array], { type: mime });
      const blobUrl = window.URL.createObjectURL(blob);

      const result: ResolvedFileData = {
        resolvedUrl: blobUrl,
        isBlob: true,
        fileName: filePath.split('/').pop(),
        mimeType: mime,
        uint8Array,
      };
      resolvedFileCache.set(cacheKey, result);
      return result;
    } catch {
      // Fallback to direct URL
    }
  }

  return { resolvedUrl: url, isBlob: false };
};

/**
 * Opens a file in a new browser tab/window strictly for VIEWING (never downloading).
 * - For Google Drive links: opens the Google Drive web viewer URL.
 * - For uploaded files: opens the app's dedicated `/view-file` full-screen viewer route
 *   in a new browser tab so Chrome NEVER downloads the file.
 */
export const openFileInNewWindow = (item: {
  id?: string;
  title?: string;
  fileUrl: string;
  filePath?: string;
  fileType?: string;
}) => {
  const { fileUrl, title, filePath, fileType, id } = item;
  if (!fileUrl) return;

  // 1. If it's a Google Drive / Docs link, open the web view URL directly
  const driveInfo = extractGoogleDriveInfo(fileUrl);
  if (driveInfo) {
    let viewUrl = fileUrl;
    if (driveInfo.kind === 'file') {
      viewUrl = `https://drive.google.com/file/d/${driveInfo.id}/view`;
    } else if (driveInfo.kind === 'doc') {
      viewUrl = `https://docs.google.com/document/d/${driveInfo.id}/preview`;
    } else if (driveInfo.kind === 'sheet') {
      viewUrl = `https://docs.google.com/spreadsheets/d/${driveInfo.id}/preview`;
    } else if (driveInfo.kind === 'slide') {
      viewUrl = `https://docs.google.com/presentation/d/${driveInfo.id}/preview`;
    }
    const link = document.createElement('a');
    link.href = viewUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  if (fileUrl.includes('drive.google.com') || fileUrl.includes('docs.google.com')) {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  // 2. For any uploaded file, open our app's standalone HTML viewer route `/view-file` in a new tab.
  // Because `/view-file` is a web page route, Chrome ALWAYS opens it in a new tab and NEVER downloads it!
  const params = new URLSearchParams();
  if (id) params.set('id', id);
  params.set('src', fileUrl);
  if (title) params.set('title', title);
  if (filePath) params.set('path', filePath);
  if (fileType) params.set('type', fileType);

  const viewerUrl = `${window.location.origin}/view-file?${params.toString()}`;
  const link = document.createElement('a');
  link.href = viewerUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Legacy helper alias that delegates to openFileInNewWindow.
 */
export const openFileUrl = async (url: string, fallbackName?: string) => {
  openFileInNewWindow({ fileUrl: url, title: fallbackName });
};

/**
 * Utility to download a file from a URL, Google Drive link, or Firestore chunked file.
 * Available to all roles (Admin, Member, Visitor).
 */
export const downloadFile = async (url: string, fileName: string, filePath?: string) => {
  try {
    if (url.startsWith('#firestore-file:')) {
      const { resolvedUrl, fileName: storedName } = await resolveFileUrl(url, filePath);
      const link = document.createElement('a');
      link.href = resolvedUrl;
      link.download = storedName || fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const driveInfo = extractGoogleDriveInfo(url);
    if (driveInfo) {
      let downloadUrl = url;
      if (driveInfo.kind === 'file') {
        downloadUrl = `https://drive.google.com/uc?export=download&id=${driveInfo.id}`;
      } else if (driveInfo.kind === 'doc') {
        downloadUrl = `https://docs.google.com/document/d/${driveInfo.id}/export?format=pdf`;
      } else if (driveInfo.kind === 'sheet') {
        downloadUrl = `https://docs.google.com/spreadsheets/d/${driveInfo.id}/export?format=xlsx`;
      } else if (driveInfo.kind === 'slide') {
        downloadUrl = `https://docs.google.com/presentation/d/${driveInfo.id}/export/pdf`;
      }

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
  } catch (error) {
    console.error('Download failed, opening link:', error);
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
