import { getAccessToken } from './authService';

/**
 * Service to handle Google Drive operations using the cached access token.
 */

const DRIVE_API_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
const DRIVE_METADATA_URL = 'https://www.googleapis.com/drive/v3/files';

export const uploadFileToDrive = async (file: File | null | undefined, folderName: string = 'Al Shafa Library') => {
  if (!file) {
    throw new Error('لم يتم اختيار ملف للرفع.');
  }
  
  console.log('Starting Google Drive upload for:', file.name);
  const token = getAccessToken();
  if (!token) {
    throw new Error('لم يتم العثور على صلاحية الوصول لـ Google Drive. يرجى تسجيل الدخول باستخدام جوجل مرة أخرى.');
  }

  try {
    // 1. Get or Create folder
    let folderId = await getFolderId(folderName, token);
    if (!folderId) {
      folderId = await createFolder(folderName, token);
    }

    // 2. Prepare multipart body
    const metadata = {
      name: file.name,
      parents: [folderId],
    };

    const boundary = '-------314159265358979323846';
    const delimiter = "--" + boundary + "\r\n";
    const bodyDelimiter = "\r\n--" + boundary + "\r\n";
    const closeDelimiter = "\r\n--" + boundary + "--";

    const contentType = file.type || 'application/octet-stream';
    
    // Create the multipart body using Blob parts to avoid encoding issues
    const metadataPart = new Blob([
      delimiter,
      "Content-Type: application/json; charset=UTF-8\r\n\r\n",
      JSON.stringify(metadata)
    ]);

    const mediaPart = new Blob([
      bodyDelimiter,
      "Content-Type: ", contentType, "\r\n\r\n",
      file
    ]);

    const closingPart = new Blob([closeDelimiter]);

    const multipartBody = new Blob([metadataPart, mediaPart, closingPart]);

    // 3. Upload file
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/related; boundary=' + boundary,
      },
      body: multipartBody,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) {
        throw new Error('انتهت صلاحية جلسة جوجل. يرجى تسجيل الخروج ثم الدخول مرة أخرى باستخدام جوجل.');
      }
      throw new Error(`فشل الرفع لـ Drive: ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    
    // 5. Make file readable (anyone with link)
    await makeFileReadable(result.id, token);
    
    // 6. Get WebView Link
    const fileInfo = await getFileInfo(result.id, token);
    
    return {
      id: result.id,
      webViewLink: fileInfo.webViewLink,
      webContentLink: fileInfo.webContentLink,
    };
  } catch (error: any) {
    console.error('Drive Service Error:', error);
    throw error;
  }
};

async function getFolderId(name: string, token: string) {
  const q = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const response = await fetch(`${DRIVE_METADATA_URL}?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  return data.files?.[0]?.id || null;
}

async function createFolder(name: string, token: string) {
  const response = await fetch(DRIVE_METADATA_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  const data = await response.json();
  return data.id;
}

async function makeFileReadable(fileId: string, token: string) {
  await fetch(`${DRIVE_METADATA_URL}/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'reader',
      type: 'anyone',
    }),
  });
}

async function getFileInfo(fileId: string, token: string) {
  const response = await fetch(`${DRIVE_METADATA_URL}/${fileId}?fields=webViewLink,webContentLink`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return await response.json();
}
