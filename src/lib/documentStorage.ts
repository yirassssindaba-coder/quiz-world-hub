import { supabase } from '@/integrations/supabase/client';

export const BUCKET = 'documents';
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.ms-powerpoint': 'PPT',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'text/plain': 'TXT',
  'application/zip': 'ZIP',
  'application/x-zip-compressed': 'ZIP',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/gif': 'GIF',
  'image/webp': 'WEBP',
  'image/svg+xml': 'SVG',
  'application/json': 'JSON',
  'text/csv': 'CSV',
};

export const PREVIEWABLE_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'text/plain',
]);

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getFileIcon(fileType: string): string {
  if (fileType.includes('pdf')) return '📄';
  if (fileType.includes('word') || fileType.includes('document')) return '📝';
  if (fileType.includes('excel') || fileType.includes('sheet')) return '📊';
  if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📋';
  if (fileType.includes('image')) return '🖼️';
  if (fileType.includes('zip') || fileType.includes('compressed')) return '🗜️';
  if (fileType.includes('text') || fileType.includes('json') || fileType.includes('csv')) return '📃';
  return '📁';
}

export function getFileColor(fileType: string): string {
  if (fileType.includes('pdf')) return 'text-red-500';
  if (fileType.includes('word') || fileType.includes('document')) return 'text-blue-500';
  if (fileType.includes('excel') || fileType.includes('sheet')) return 'text-emerald-500';
  if (fileType.includes('powerpoint') || fileType.includes('presentation')) return 'text-orange-500';
  if (fileType.includes('image')) return 'text-violet-500';
  if (fileType.includes('zip')) return 'text-amber-500';
  return 'text-muted-foreground';
}

export async function computeChecksum(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return '';
  }
}

export async function uploadDocument(
  file: File,
  userId: string,
  folderId: string | null,
  metadata: {
    category: string;
    description: string;
    tags: string[];
    visibility: 'private' | 'shared';
  },
  onProgress?: (p: number) => void
): Promise<{ data: any; error: any }> {
  if (!ALLOWED_TYPES[file.type]) return { data: null, error: new Error('Tipe file tidak didukung') };
  if (file.size > MAX_FILE_SIZE) return { data: null, error: new Error('Ukuran file melebihi 50MB') };

  onProgress?.(5);
  const checksum = await computeChecksum(file);
  onProgress?.(15);

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${userId}/${timestamp}_${safeName}`;

  onProgress?.(20);

  // Check for existing file with same name for versioning
  const { data: existingDocs } = await (supabase as any)
    .from('documents')
    .select('id, version, file_name')
    .eq('user_id', userId)
    .eq('original_name', file.name)
    .is('deleted_at', null)
    .order('version', { ascending: false })
    .limit(1);

  const version = existingDocs && existingDocs.length > 0 ? (existingDocs[0].version || 1) + 1 : 1;

  onProgress?.(30);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { upsert: false, contentType: file.type });

  if (uploadError) return { data: null, error: uploadError };

  onProgress?.(80);

  const { data: doc, error: dbError } = await (supabase as any)
    .from('documents')
    .insert({
      user_id: userId,
      folder_id: folderId,
      file_name: `v${version}_${safeName}`,
      original_name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_path: storagePath,
      category: metadata.category,
      tags: metadata.tags,
      description: metadata.description,
      visibility: metadata.visibility,
      version,
      checksum,
      is_favorite: false,
      is_archived: false,
    })
    .select()
    .single();

  if (dbError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { data: null, error: dbError };
  }

  onProgress?.(95);

  await logAudit(userId, doc.id, 'upload', { file_name: file.name, file_size: file.size, version });

  onProgress?.(100);
  return { data: doc, error: null };
}

export async function getSignedUrl(storagePath: string, expiresIn = 3600): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn);
  return data?.signedUrl || null;
}

export async function deleteDocument(docId: string, userId: string, permanent = false): Promise<{ error: any }> {
  if (permanent) {
    const { data: doc } = await (supabase as any).from('documents').select('storage_path').eq('id', docId).single();
    if (doc) await supabase.storage.from(BUCKET).remove([doc.storage_path]);
    const { error } = await (supabase as any).from('documents').delete().eq('id', docId);
    await logAudit(userId, docId, 'permanent_delete', {});
    return { error };
  }
  const { error } = await (supabase as any).from('documents').update({ deleted_at: new Date().toISOString() }).eq('id', docId);
  await logAudit(userId, docId, 'soft_delete', {});
  return { error };
}

export async function restoreDocument(docId: string, userId: string): Promise<{ error: any }> {
  const { error } = await (supabase as any).from('documents').update({ deleted_at: null }).eq('id', docId);
  await logAudit(userId, docId, 'restore', {});
  return { error };
}

export async function renameDocument(docId: string, userId: string, newName: string): Promise<{ error: any }> {
  const { error } = await (supabase as any).from('documents').update({ original_name: newName, updated_at: new Date().toISOString() }).eq('id', docId);
  await logAudit(userId, docId, 'rename', { new_name: newName });
  return { error };
}

export async function toggleFavorite(docId: string, userId: string, isFavorite: boolean): Promise<{ error: any }> {
  const { error } = await (supabase as any).from('documents').update({ is_favorite: isFavorite }).eq('id', docId);
  await logAudit(userId, docId, isFavorite ? 'favorite' : 'unfavorite', {});
  return { error };
}

export async function logAudit(userId: string, documentId: string | null, action: string, details: any): Promise<void> {
  try {
    await (supabase as any).from('document_audit_logs').insert({ user_id: userId, document_id: documentId, action, details });
  } catch { /* ignore audit failures */ }
}

export const CATEGORIES = [
  'Semua', 'CV & Resume', 'Sertifikat', 'Laporan', 'Kontrak', 'Keuangan',
  'Riset', 'Materi Belajar', 'Portofolio', 'Foto & Media', 'Arsip', 'Lainnya',
];

export const CATEGORY_VALUES = CATEGORIES.slice(1).map(c => ({ label: c, value: c.toLowerCase().replace(/[^a-z]/g, '_') }));
