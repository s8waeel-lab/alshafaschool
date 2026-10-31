import { 
  collection, 
  getDocs, 
  getDocsFromCache,
  doc, 
  addDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, readLocalCache, writeLocalCache, runFirestoreOp } from './firebase';

export interface LibraryFile {
  id: string;
  title: string;
  description: string;
  fileUrl: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  categoryId: string;
  schoolId?: string;
  academicYear: string;
  accessLevel: 'public' | 'private';
  uploadedBy: string;
  createdAt: any;
}

const LIBRARY_CACHE_KEY = 'shafa_library_files';

export const getCachedLibraryFiles = (): LibraryFile[] => {
  return readLocalCache<LibraryFile[]>(LIBRARY_CACHE_KEY, []);
};

export const saveCachedLibraryFiles = (files: LibraryFile[]): void => {
  writeLocalCache(LIBRARY_CACHE_KEY, files);
};

export const addLibraryFileResilient = async (
  libraryData: Omit<LibraryFile, 'id'>
): Promise<LibraryFile> => {
  const localItem: LibraryFile = {
    ...libraryData,
    id: `local_lib_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: { seconds: Math.floor(Date.now() / 1000) }
  };

  try {
    const docRef = await runFirestoreOp(() => addDoc(collection(db, 'libraryFiles'), libraryData));
    const savedItem: LibraryFile = { ...localItem, id: docRef.id };
    const existing = getCachedLibraryFiles().filter(f => f.id !== savedItem.id);
    saveCachedLibraryFiles([savedItem, ...existing]);
    return savedItem;
  } catch {
    const existing = getCachedLibraryFiles();
    saveCachedLibraryFiles([localItem, ...existing]);
    return localItem;
  }
};

export const removeLibraryFileResilient = async (id: string): Promise<void> => {
  const existing = getCachedLibraryFiles().filter(f => f.id !== id);
  saveCachedLibraryFiles(existing);
  try {
    if (!id.startsWith('local_lib_')) {
      await runFirestoreOp(() => deleteDoc(doc(db, 'libraryFiles', id)));
    }
  } catch {
    // Ignore quota error since local cache is already updated
  }
};

export const getLibraryFiles = async (categoryId?: string, schoolId?: string, isPublicOnly: boolean = true) => {
  let files: LibraryFile[] = [];

  try {
    let q = query(collection(db, 'libraryFiles'));
    
    // We fetch all and filter in JS if many filters, but let's try at least one server-side filter
    if (isPublicOnly) {
      q = query(collection(db, 'libraryFiles'), where('accessLevel', '==', 'public'));
    }

    const snapshot = await runFirestoreOp(() => getDocs(q));
    const serverFiles = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LibraryFile));
    const localOnly = getCachedLibraryFiles().filter(f => f.id.startsWith('local_lib_'));
    files = [...serverFiles, ...localOnly];
    saveCachedLibraryFiles(files);
  } catch {
    try {
      const cachedSnap = await getDocsFromCache(collection(db, 'libraryFiles'));
      if (!cachedSnap.empty) {
        const cachedFiles = cachedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LibraryFile));
        const localOnly = getCachedLibraryFiles().filter(f => f.id.startsWith('local_lib_'));
        files = [...cachedFiles, ...localOnly];
        saveCachedLibraryFiles(files);
      } else {
        files = getCachedLibraryFiles();
      }
    } catch {
      files = getCachedLibraryFiles();
    }
  }

  if (isPublicOnly) {
    files = files.filter(f => f.accessLevel === 'public');
  }

  if (categoryId) {
    files = files.filter(f => f.categoryId === categoryId);
  }

  if (schoolId) {
    files = files.filter(f => f.schoolId === schoolId || f.schoolId === 'shared');
  }

  return files.sort((a, b) => {
    const timeA = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
    const timeB = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
    return timeB - timeA;
  });
};

export const uploadLibraryFile = async (
  file: File, 
  data: Omit<LibraryFile, 'id' | 'fileUrl' | 'filePath' | 'fileType' | 'fileSize' | 'createdAt'>,
  userId: string
) => {
  const filePath = `library/${Date.now()}_${file.name}`;
  const fileRef = ref(storage, filePath);
  
  await uploadBytes(fileRef, file);
  const fileUrl = await getDownloadURL(fileRef);
  
  const fileDoc: Omit<LibraryFile, 'id'> = {
    ...data,
    fileUrl,
    filePath,
    fileType: file.type,
    fileSize: file.size,
    uploadedBy: userId,
    createdAt: serverTimestamp()
  };
  
  return await addLibraryFileResilient(fileDoc);
};

export const deleteLibraryFile = async (file: LibraryFile) => {
  try {
    const fileRef = ref(storage, file.filePath);
    await deleteObject(fileRef);
  } catch {
    // Ignore storage delete error
  }
  await removeLibraryFileResilient(file.id);
};

