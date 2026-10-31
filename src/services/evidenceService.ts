import { 
  collection, 
  getDocs, 
  getDocsFromCache,
  query, 
  where, 
  doc, 
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, readLocalCache, writeLocalCache, runFirestoreOp } from './firebase';

export interface Evidence {
  id: string;
  title: string;
  description: string;
  fileUrl: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  indicatorId: string;
  schoolId?: string;
  isShared: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'archived';
  rejectionReason?: string;
  uploadedBy: string;
  createdAt: any;
  updatedAt: any;
}

const EVIDENCE_CACHE_KEY = 'shafa_evidence';

export const getCachedEvidence = (): Evidence[] => {
  return readLocalCache<Evidence[]>(EVIDENCE_CACHE_KEY, []);
};

export const saveCachedEvidence = (items: Evidence[]): void => {
  writeLocalCache(EVIDENCE_CACHE_KEY, items);
};

export const getAllEvidenceResilient = async (): Promise<Evidence[]> => {
  try {
    const snap = await runFirestoreOp(() => getDocs(collection(db, 'evidence')));
    const serverItems = snap.docs.map(d => ({ id: d.id, ...d.data() } as Evidence));
    const localOnly = getCachedEvidence().filter(e => e.id.startsWith('local_ev_'));
    const merged = [...serverItems, ...localOnly];
    saveCachedEvidence(merged);
    return merged;
  } catch {
    try {
      const cachedSnap = await getDocsFromCache(collection(db, 'evidence'));
      if (!cachedSnap.empty) {
        const cachedItems = cachedSnap.docs.map(d => ({ id: d.id, ...d.data() } as Evidence));
        const localOnly = getCachedEvidence().filter(e => e.id.startsWith('local_ev_'));
        const merged = [...cachedItems, ...localOnly];
        saveCachedEvidence(merged);
        return merged;
      }
    } catch {
      // Ignore cache miss
    }
    return getCachedEvidence();
  }
};

export const addEvidenceResilient = async (
  evidenceData: Omit<Evidence, 'id'>
): Promise<Evidence> => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const localItem: Evidence = {
    ...evidenceData,
    id: `local_ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: { seconds: nowSeconds },
    updatedAt: { seconds: nowSeconds }
  };

  try {
    const docRef = await runFirestoreOp(() => addDoc(collection(db, 'evidence'), evidenceData));
    const savedItem: Evidence = { ...localItem, id: docRef.id };
    const existing = getCachedEvidence().filter(e => e.id !== savedItem.id);
    saveCachedEvidence([savedItem, ...existing]);
    return savedItem;
  } catch {
    const existing = getCachedEvidence();
    saveCachedEvidence([localItem, ...existing]);
    return localItem;
  }
};

export const removeEvidenceResilient = async (id: string): Promise<void> => {
  const existing = getCachedEvidence().filter(e => e.id !== id);
  saveCachedEvidence(existing);
  try {
    if (!id.startsWith('local_ev_')) {
      await runFirestoreOp(() => deleteDoc(doc(db, 'evidence', id)));
    }
  } catch {
    // Ignore quota error
  }
};

export const getEvidenceByIndicator = async (indicatorId: string, schoolId?: string) => {
  try {
    let q = query(collection(db, 'evidence'), where('indicatorId', '==', indicatorId));
    const snap = await runFirestoreOp(() => getDocs(q));
    const serverItems = snap.docs.map(d => ({ id: d.id, ...d.data() } as Evidence));
    
    // Merge with local-only items from cache
    const localOnly = getCachedEvidence().filter(e => e.id.startsWith('local_ev_') && e.indicatorId === indicatorId);
    let results = [...serverItems, ...localOnly];
    
    if (schoolId) {
      results = results.filter(e => e.isShared || e.schoolId === schoolId || e.schoolId === 'shared');
    }
    return results;
  } catch {
    // Fallback to cache
    const all = await getAllEvidenceResilient();
    let results = all.filter(e => e.indicatorId === indicatorId);
    if (schoolId) {
      results = results.filter(e => e.isShared || e.schoolId === schoolId || e.schoolId === 'shared');
    }
    return results;
  }
};

export const uploadEvidence = async (
  file: File,
  data: Omit<Evidence, 'id' | 'fileUrl' | 'filePath' | 'fileType' | 'fileSize' | 'createdAt' | 'updatedAt' | 'status'>,
  userId: string
) => {
  const filePath = `evidence/${data.indicatorId}/${Date.now()}_${file.name}`;
  const fileRef = ref(storage, filePath);
  
  await uploadBytes(fileRef, file);
  const fileUrl = await getDownloadURL(fileRef);
  
  const evidenceDoc: Omit<Evidence, 'id'> = {
    ...data,
    fileUrl,
    filePath,
    fileType: file.type,
    fileSize: file.size,
    status: 'pending',
    uploadedBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  
  return await addEvidenceResilient(evidenceDoc);
};

export const updateEvidenceStatus = async (evidenceId: string, status: Evidence['status'], reason?: string) => {
  const existing = getCachedEvidence().map(e =>
    e.id === evidenceId
      ? { ...e, status, rejectionReason: reason || undefined, updatedAt: { seconds: Math.floor(Date.now() / 1000) } }
      : e
  );
  saveCachedEvidence(existing);

  try {
    if (!evidenceId.startsWith('local_ev_')) {
      const evidenceRef = doc(db, 'evidence', evidenceId);
      await runFirestoreOp(() =>
        updateDoc(evidenceRef, {
          status,
          rejectionReason: reason || null,
          updatedAt: serverTimestamp()
        })
      );
    }
  } catch {
    // Ignore quota error since local cache is updated
  }
};

