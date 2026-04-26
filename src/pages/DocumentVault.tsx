import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Upload, FolderOpen, Search, Grid3X3, List, Star, StarOff, Trash2,
  Download, Eye, Share2, Edit3, MoreVertical, Plus, X, FileText,
  FolderPlus, RotateCcw, Shield, Clock, HardDrive, AlertCircle,
  CheckCircle2, ExternalLink, Copy, Lock, Calendar, Tag, Archive,
  ChevronRight, Info, BarChart3, Loader2, Image, File
} from 'lucide-react';
import {
  uploadDocument, getSignedUrl, deleteDocument, restoreDocument,
  renameDocument, toggleFavorite, logAudit, formatBytes, getFileIcon,
  getFileColor, ALLOWED_TYPES, MAX_FILE_SIZE, CATEGORIES, BUCKET,
  PREVIEWABLE_TYPES
} from '@/lib/documentStorage';

interface Document {
  id: string;
  user_id: string;
  folder_id: string | null;
  file_name: string;
  original_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  category: string;
  tags: string[];
  description: string | null;
  visibility: string;
  version: number;
  checksum: string | null;
  is_favorite: boolean;
  is_archived: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  color: string;
}

type ViewMode = 'grid' | 'list';
type FilterMode = 'all' | 'favorites' | 'recent' | 'archived' | 'trash';

const FOLDER_COLORS: Record<string, string> = {
  blue: 'text-blue-500', violet: 'text-violet-500', emerald: 'text-emerald-500',
  amber: 'text-amber-500', rose: 'text-rose-500', cyan: 'text-cyan-500',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} hari lalu`;
  return new Date(dateStr).toLocaleDateString('id-ID');
}

export default function DocumentVault() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState<boolean | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Upload state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadMeta, setUploadMeta] = useState({ category: 'Lainnya', description: '', tags: '', visibility: 'private' as const });

  // Action states
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [shareDoc, setShareDoc] = useState<Document | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [shareExpiry, setShareExpiry] = useState('3600');
  const [renameDoc, setRenameDoc] = useState<Document | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ doc: Document; permanent: boolean } | null>(null);
  const [detailDoc, setDetailDoc] = useState<Document | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Folder create
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderColor, setFolderColor] = useState('blue');

  // Stats
  const totalSize = documents.filter(d => !d.deleted_at).reduce((s, d) => s + d.file_size, 0);
  const totalActive = documents.filter(d => !d.deleted_at && !d.is_archived).length;
  const totalFavorites = documents.filter(d => d.is_favorite && !d.deleted_at).length;
  const totalTrash = documents.filter(d => !!d.deleted_at).length;

  const checkDbReady = useCallback(async () => {
    try {
      const { error } = await (supabase as any).from('documents').select('id').limit(1);
      setDbReady(!error);
    } catch {
      setDbReady(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: docs, error } = await (supabase as any)
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDocuments(docs || []);

      const { data: flds } = await (supabase as any)
        .from('document_folders')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      setFolders(flds || []);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkDbReady().then(() => fetchData());
  }, [checkDbReady, fetchData]);

  const filteredDocs = documents.filter(doc => {
    if (filterMode === 'trash') return !!doc.deleted_at;
    if (filterMode === 'favorites') return doc.is_favorite && !doc.deleted_at;
    if (filterMode === 'archived') return doc.is_archived && !doc.deleted_at;
    if (filterMode === 'recent') return !doc.deleted_at && new Date(doc.created_at) > new Date(Date.now() - 7 * 86400000);
    if (!!doc.deleted_at) return false;
    if (filterMode === 'all') {
      if (selectedFolder !== null && doc.folder_id !== selectedFolder) return false;
      if (selectedCategory !== 'Semua' && doc.category !== selectedCategory) return false;
    }
    return true;
  }).filter(doc =>
    searchQuery ? doc.original_name.toLowerCase().includes(searchQuery.toLowerCase()) || (doc.description || '').toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) { setUploadFile(f); setUploadOpen(true); }
  }, []);

  const handleUpload = async () => {
    if (!uploadFile || !user) return;
    setUploading(true);
    setUploadProgress(0);
    const tags = uploadMeta.tags.split(',').map(t => t.trim()).filter(Boolean);
    const { error } = await uploadDocument(
      uploadFile, user.id, selectedFolder,
      { category: uploadMeta.category, description: uploadMeta.description, tags, visibility: uploadMeta.visibility },
      setUploadProgress
    );
    setUploading(false);
    if (error) {
      toast({ title: 'Upload gagal', description: error.message || String(error), variant: 'destructive' });
    } else {
      toast({ title: 'File berhasil diupload!' });
      setUploadOpen(false);
      setUploadFile(null);
      setUploadProgress(0);
      fetchData();
    }
  };

  const handlePreview = async (doc: Document) => {
    setPreviewDoc(doc);
    setPreviewUrl(null);
    const url = await getSignedUrl(doc.storage_path, 3600);
    if (url) {
      await logAudit(user!.id, doc.id, 'preview', { file_name: doc.original_name });
      setPreviewUrl(url);
    }
  };

  const handleDownload = async (doc: Document) => {
    const url = await getSignedUrl(doc.storage_path, 300);
    if (!url) { toast({ title: 'Gagal membuat link download', variant: 'destructive' }); return; }
    await logAudit(user!.id, doc.id, 'download', { file_name: doc.original_name });
    const a = document.createElement('a');
    a.href = url; a.download = doc.original_name; a.click();
    toast({ title: 'Download dimulai' });
  };

  const handleShare = async (doc: Document) => {
    setShareDoc(doc);
    setShareUrl('');
    const url = await getSignedUrl(doc.storage_path, parseInt(shareExpiry));
    if (url) {
      setShareUrl(url);
      await logAudit(user!.id, doc.id, 'share', { expiry_seconds: shareExpiry });
    }
  };

  const generateShareUrl = async () => {
    if (!shareDoc) return;
    const url = await getSignedUrl(shareDoc.storage_path, parseInt(shareExpiry));
    if (url) setShareUrl(url);
  };

  const handleRename = async () => {
    if (!renameDoc || !renameValue.trim()) return;
    const { error } = await renameDocument(renameDoc.id, user!.id, renameValue.trim());
    if (error) { toast({ title: 'Gagal rename', variant: 'destructive' }); return; }
    toast({ title: 'File berhasil direname' });
    setRenameDoc(null);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await deleteDocument(deleteTarget.doc.id, user!.id, deleteTarget.permanent);
    if (error) { toast({ title: 'Gagal menghapus file', variant: 'destructive' }); return; }
    toast({ title: deleteTarget.permanent ? 'File dihapus permanen' : 'File dipindahkan ke Trash' });
    setDeleteTarget(null);
    fetchData();
  };

  const handleRestore = async (doc: Document) => {
    const { error } = await restoreDocument(doc.id, user!.id);
    if (error) { toast({ title: 'Gagal restore', variant: 'destructive' }); return; }
    toast({ title: 'File berhasil di-restore' });
    fetchData();
  };

  const handleToggleFav = async (doc: Document) => {
    await toggleFavorite(doc.id, user!.id, !doc.is_favorite);
    setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, is_favorite: !d.is_favorite } : d));
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim() || !user) return;
    await (supabase as any).from('document_folders').insert({ user_id: user.id, name: folderName.trim(), color: folderColor });
    toast({ title: `Folder "${folderName}" dibuat` });
    setFolderOpen(false);
    setFolderName('');
    fetchData();
  };

  const loadAuditLogs = async (docId: string) => {
    const { data } = await (supabase as any).from('document_audit_logs').select('*').eq('document_id', docId).order('created_at', { ascending: false }).limit(20);
    setAuditLogs(data || []);
  };

  const handleDetail = async (doc: Document) => {
    setDetailDoc(doc);
    await loadAuditLogs(doc.id);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Link disalin!' });
  };

  if (!user) {
    return (
      <div className="container py-24 text-center">
        <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Login diperlukan</h2>
        <p className="text-muted-foreground text-sm">Silakan login untuk mengakses Document Vault.</p>
      </div>
    );
  }

  if (dbReady === false) {
    return (
      <div className="container py-16 max-w-2xl">
        <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Setup Database Diperlukan</h2>
            <p className="text-sm text-muted-foreground mb-6">Tabel database belum tersedia. Jalankan SQL berikut di Supabase Dashboard → SQL Editor:</p>
            <div className="text-left bg-background rounded-lg p-4 text-xs font-mono border border-border overflow-auto max-h-80 mb-4">
              <pre>{`-- Document Vault Tables
CREATE TABLE IF NOT EXISTS documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  folder_id uuid,
  file_name text NOT NULL,
  original_name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  storage_path text NOT NULL,
  category text DEFAULT 'Lainnya',
  tags text[] DEFAULT '{}',
  description text,
  visibility text DEFAULT 'private',
  version integer DEFAULT 1,
  checksum text,
  is_favorite boolean DEFAULT false,
  is_archived boolean DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_folders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  name text NOT NULL,
  parent_id uuid,
  color text DEFAULT 'blue',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  document_id uuid,
  action text NOT NULL,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- RLS Policies
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own documents" ON documents FOR ALL USING (auth.uid() = user_id);

ALTER TABLE document_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own folders" ON document_folders FOR ALL USING (auth.uid() = user_id);

ALTER TABLE document_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own audit logs" ON document_audit_logs FOR ALL USING (auth.uid() = user_id);

-- Storage bucket (run in Supabase Storage):
-- Create private bucket named "documents"`}</pre>
            </div>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => copyToClipboard(`CREATE TABLE IF NOT EXISTS documents (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid REFERENCES auth.users(id) NOT NULL, folder_id uuid, file_name text NOT NULL, original_name text NOT NULL, file_type text NOT NULL, file_size bigint NOT NULL DEFAULT 0, storage_path text NOT NULL, category text DEFAULT 'Lainnya', tags text[] DEFAULT '{}', description text, visibility text DEFAULT 'private', version integer DEFAULT 1, checksum text, is_favorite boolean DEFAULT false, is_archived boolean DEFAULT false, deleted_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());`)} variant="outline" size="sm" className="gap-2"><Copy className="h-3.5 w-3.5" /> Salin SQL</Button>
              <Button onClick={() => checkDbReady().then(() => fetchData())} size="sm" className="gap-2"><RotateCcw className="h-3.5 w-3.5" /> Coba Lagi</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-primary/10 border-4 border-dashed border-primary/50 flex items-center justify-center"
          >
            <div className="text-center">
              <Upload className="h-16 w-16 mx-auto text-primary mb-3" />
              <p className="text-xl font-bold text-primary">Lepaskan file di sini untuk upload</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container py-8 sm:py-10">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold font-[Space_Grotesk]">Document Vault</h1>
              <p className="text-sm text-muted-foreground">Penyimpanan dokumen aman dan permanen</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button data-testid="button-create-folder" variant="outline" size="sm" onClick={() => setFolderOpen(true)} className="gap-2">
              <FolderPlus className="h-4 w-4" /> Folder Baru
            </Button>
            <Button data-testid="button-upload-open" onClick={() => setUploadOpen(true)} className="bg-gradient-to-r from-blue-500 to-violet-600 text-white gap-2">
              <Upload className="h-4 w-4" /> Upload File
            </Button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Storage Stats */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><HardDrive className="h-4 w-4" /> Penyimpanan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Terpakai</span>
                    <span className="font-medium">{formatBytes(totalSize)}</span>
                  </div>
                  <Progress value={Math.min((totalSize / (1024 * 1024 * 1024)) * 100, 100)} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground mt-1">dari kapasitas yang tersedia</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'File Aktif', value: totalActive, icon: FileText, color: 'text-blue-500' },
                    { label: 'Favorit', value: totalFavorites, icon: Star, color: 'text-amber-500' },
                    { label: 'Folder', value: folders.length, icon: FolderOpen, color: 'text-violet-500' },
                    { label: 'Trash', value: totalTrash, icon: Trash2, color: 'text-rose-500' },
                  ].map(s => (
                    <div key={s.label} className="bg-muted/40 rounded-lg p-2 text-center">
                      <s.icon className={`h-4 w-4 mx-auto mb-1 ${s.color}`} />
                      <p className="text-sm font-bold">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Filter nav */}
            <Card className="border-border/50">
              <CardContent className="pt-4 space-y-1">
                {([
                  { key: 'all', label: 'Semua Dokumen', icon: FileText },
                  { key: 'recent', label: 'Terbaru (7 hari)', icon: Clock },
                  { key: 'favorites', label: 'Favorit', icon: Star },
                  { key: 'archived', label: 'Diarsipkan', icon: Archive },
                  { key: 'trash', label: 'Sampah', icon: Trash2 },
                ] as const).map(f => (
                  <button
                    key={f.key}
                    data-testid={`button-filter-${f.key}`}
                    onClick={() => { setFilterMode(f.key); setSelectedFolder(null); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${filterMode === f.key && !selectedFolder ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                  >
                    <f.icon className="h-4 w-4 shrink-0" />
                    {f.label}
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Folders */}
            {folders.length > 0 && (
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><FolderOpen className="h-4 w-4" /> Folder</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 pb-4">
                  {folders.map(f => (
                    <button
                      key={f.id}
                      data-testid={`button-folder-${f.id}`}
                      onClick={() => { setSelectedFolder(f.id); setFilterMode('all'); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${selectedFolder === f.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                    >
                      <FolderOpen className={`h-4 w-4 shrink-0 ${FOLDER_COLORS[f.color] || 'text-blue-500'}`} />
                      <span className="truncate">{f.name}</span>
                      <span className="ml-auto text-xs">{documents.filter(d => d.folder_id === f.id && !d.deleted_at).length}</span>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Main content */}
          <div className="lg:col-span-3 space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input data-testid="input-search-docs" placeholder="Cari nama file, deskripsi..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
              </div>
              <div className="flex gap-2">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger data-testid="select-category-filter" className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button data-testid="button-view-grid" variant={viewMode === 'grid' ? 'default' : 'outline'} size="icon" onClick={() => setViewMode('grid')}><Grid3X3 className="h-4 w-4" /></Button>
                <Button data-testid="button-view-list" variant={viewMode === 'list' ? 'default' : 'outline'} size="icon" onClick={() => setViewMode('list')}><List className="h-4 w-4" /></Button>
              </div>
            </div>

            {/* Context label */}
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">
                {filterMode === 'trash' ? '🗑️ Sampah' : filterMode === 'favorites' ? '⭐ Favorit' : filterMode === 'archived' ? '📦 Arsip' : filterMode === 'recent' ? '🕐 Terbaru' : selectedFolder ? `📁 ${folders.find(f => f.id === selectedFolder)?.name || 'Folder'}` : '📁 Semua Dokumen'}
              </p>
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{filteredDocs.length} file</span>
            </div>

            {/* Loading state */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : filteredDocs.length === 0 ? (
              /* Empty state */
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card className="border-dashed border-2 border-border/60">
                  <CardContent className="py-20 text-center">
                    <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                      {filterMode === 'trash' ? <Trash2 className="h-8 w-8 text-muted-foreground" /> : <FileText className="h-8 w-8 text-muted-foreground" />}
                    </div>
                    <h3 className="text-base font-semibold mb-1">
                      {filterMode === 'trash' ? 'Sampah kosong' : filterMode === 'favorites' ? 'Belum ada favorit' : 'Belum ada dokumen'}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {filterMode === 'all' ? 'Upload file pertama kamu atau drag & drop ke sini.' : 'Tidak ada dokumen di kategori ini.'}
                    </p>
                    {filterMode === 'all' && (
                      <Button onClick={() => setUploadOpen(true)} className="gap-2"><Upload className="h-4 w-4" /> Upload Sekarang</Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ) : viewMode === 'grid' ? (
              /* Grid view */
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <AnimatePresence>
                  {filteredDocs.map((doc, i) => (
                    <motion.div key={doc.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }}>
                      <Card data-testid={`card-doc-${doc.id}`} className={`border-border/50 hover:border-primary/30 hover:shadow-md transition-all group ${doc.deleted_at ? 'opacity-60' : ''}`}>
                        <CardContent className="pt-4 pb-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <span className="text-2xl">{getFileIcon(doc.file_type)}</span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate max-w-[140px]">{doc.original_name}</p>
                                <p className="text-[10px] text-muted-foreground">{formatBytes(doc.file_size)} · v{doc.version}</p>
                              </div>
                            </div>
                            <DocMenu doc={doc} onPreview={handlePreview} onDownload={handleDownload} onShare={handleShare} onRename={d => { setRenameDoc(d); setRenameValue(d.original_name); }} onFavorite={handleToggleFav} onDelete={d => setDeleteTarget({ doc: d, permanent: false })} onPermanentDelete={d => setDeleteTarget({ doc: d, permanent: true })} onRestore={handleRestore} onDetail={handleDetail} />
                          </div>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {doc.category && <Badge variant="outline" className="text-[10px]">{doc.category}</Badge>}
                            {doc.is_favorite && <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"><Star className="h-2.5 w-2.5 mr-0.5" />Favorit</Badge>}
                            {doc.is_archived && <Badge variant="outline" className="text-[10px]"><Archive className="h-2.5 w-2.5 mr-0.5" />Arsip</Badge>}
                          </div>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(doc.created_at)}</p>
                          {filterMode !== 'trash' && (
                            <div className="flex gap-1.5 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              {PREVIEWABLE_TYPES.has(doc.file_type) && (
                                <Button data-testid={`button-preview-${doc.id}`} variant="outline" size="sm" className="h-7 text-xs gap-1 flex-1" onClick={() => handlePreview(doc)}><Eye className="h-3 w-3" />Preview</Button>
                              )}
                              <Button data-testid={`button-download-${doc.id}`} variant="outline" size="sm" className="h-7 text-xs gap-1 flex-1" onClick={() => handleDownload(doc)}><Download className="h-3 w-3" />Unduh</Button>
                            </div>
                          )}
                          {filterMode === 'trash' && (
                            <div className="flex gap-1.5 mt-3">
                              <Button data-testid={`button-restore-${doc.id}`} variant="outline" size="sm" className="h-7 text-xs gap-1 flex-1" onClick={() => handleRestore(doc)}><RotateCcw className="h-3 w-3" />Restore</Button>
                              <Button data-testid={`button-perm-delete-${doc.id}`} variant="destructive" size="sm" className="h-7 text-xs gap-1 flex-1" onClick={() => setDeleteTarget({ doc, permanent: true })}><Trash2 className="h-3 w-3" />Hapus</Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              /* List view */
              <Card className="border-border/50">
                <div className="divide-y divide-border/50">
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/30">
                    <div className="col-span-5">Nama File</div>
                    <div className="col-span-2">Kategori</div>
                    <div className="col-span-2">Ukuran</div>
                    <div className="col-span-2">Tanggal</div>
                    <div className="col-span-1"></div>
                  </div>
                  <AnimatePresence>
                    {filteredDocs.map(doc => (
                      <motion.div key={doc.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-muted/30 transition-colors">
                        <div className="col-span-5 flex items-center gap-2.5 min-w-0">
                          <span className="text-xl">{getFileIcon(doc.file_type)}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{doc.original_name}</p>
                            <p className="text-[10px] text-muted-foreground">v{doc.version} {doc.is_favorite && '⭐'}</p>
                          </div>
                        </div>
                        <div className="col-span-2"><Badge variant="outline" className="text-[10px]">{doc.category || '—'}</Badge></div>
                        <div className="col-span-2 text-xs text-muted-foreground">{formatBytes(doc.file_size)}</div>
                        <div className="col-span-2 text-xs text-muted-foreground">{timeAgo(doc.created_at)}</div>
                        <div className="col-span-1 flex justify-end">
                          <DocMenu doc={doc} onPreview={handlePreview} onDownload={handleDownload} onShare={handleShare} onRename={d => { setRenameDoc(d); setRenameValue(d.original_name); }} onFavorite={handleToggleFav} onDelete={d => setDeleteTarget({ doc: d, permanent: false })} onPermanentDelete={d => setDeleteTarget({ doc: d, permanent: true })} onRestore={handleRestore} onDetail={handleDetail} />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={open => { if (!uploading) { setUploadOpen(open); if (!open) setUploadFile(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Upload Dokumen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {!uploadFile ? (
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
                data-testid="drop-zone-doc"
              >
                <input ref={fileRef} type="file" className="hidden" onChange={e => setUploadFile(e.target.files?.[0] || null)} data-testid="input-doc-file" accept={Object.keys(ALLOWED_TYPES).join(',')} />
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium text-sm mb-1">Klik atau drag file ke sini</p>
                <p className="text-xs text-muted-foreground">PDF, DOCX, XLSX, PPTX, TXT, ZIP, gambar — maks 50MB</p>
              </div>
            ) : (
              <div className="bg-muted/40 rounded-xl p-4 flex items-center gap-3">
                <span className="text-3xl">{getFileIcon(uploadFile.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{uploadFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(uploadFile.size)}</p>
                  {!ALLOWED_TYPES[uploadFile.type] && <p className="text-xs text-destructive mt-0.5">⚠ Tipe file tidak didukung</p>}
                  {uploadFile.size > MAX_FILE_SIZE && <p className="text-xs text-destructive mt-0.5">⚠ File melebihi batas 50MB</p>}
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setUploadFile(null)}><X className="h-4 w-4" /></Button>
              </div>
            )}

            {uploadFile && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1.5 block">Kategori</Label>
                    <Select value={uploadMeta.category} onValueChange={v => setUploadMeta(m => ({ ...m, category: v }))}>
                      <SelectTrigger data-testid="select-upload-category"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.slice(1).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Visibilitas</Label>
                    <Select value={uploadMeta.visibility} onValueChange={v => setUploadMeta(m => ({ ...m, visibility: v as any }))}>
                      <SelectTrigger data-testid="select-upload-visibility"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private"><Lock className="h-3 w-3 inline mr-1" />Private</SelectItem>
                        <SelectItem value="shared">Shared</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Deskripsi (opsional)</Label>
                  <Textarea data-testid="textarea-upload-desc" value={uploadMeta.description} onChange={e => setUploadMeta(m => ({ ...m, description: e.target.value }))} rows={2} placeholder="Deskripsi singkat file ini..." />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Tag (pisah dengan koma)</Label>
                  <Input data-testid="input-upload-tags" value={uploadMeta.tags} onChange={e => setUploadMeta(m => ({ ...m, tags: e.target.value }))} placeholder="cv, sertifikat, 2024..." />
                </div>
                {uploading && (
                  <div>
                    <div className="flex justify-between text-xs mb-1"><span>Mengupload...</span><span>{uploadProgress}%</span></div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>Batal</Button>
            <Button data-testid="button-confirm-upload" onClick={handleUpload} disabled={!uploadFile || uploading || !ALLOWED_TYPES[uploadFile?.type || ''] || uploadFile.size > MAX_FILE_SIZE} className="gap-2">
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin" />Mengupload...</> : <><Upload className="h-4 w-4" />Upload</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={open => { if (!open) { setPreviewDoc(null); setPreviewUrl(null); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 truncate">
              <span>{previewDoc && getFileIcon(previewDoc.file_type)}</span>
              {previewDoc?.original_name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto min-h-[400px] bg-muted/30 rounded-xl flex items-center justify-center">
            {!previewUrl ? (
              <div className="text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" /><p className="text-sm text-muted-foreground">Memuat preview...</p></div>
            ) : previewDoc?.file_type.includes('image') ? (
              <img src={previewUrl} alt={previewDoc?.original_name} className="max-w-full max-h-[60vh] object-contain rounded-lg" />
            ) : previewDoc?.file_type === 'application/pdf' ? (
              <iframe src={previewUrl} className="w-full h-[60vh] rounded-lg border-0" title="PDF Preview" />
            ) : previewDoc?.file_type === 'text/plain' ? (
              <iframe src={previewUrl} className="w-full h-[60vh] rounded-lg border-0 bg-white dark:bg-black" title="Text Preview" />
            ) : (
              <div className="text-center p-8">
                <File className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium mb-1">Preview tidak tersedia untuk tipe file ini</p>
                <p className="text-xs text-muted-foreground mb-4">Unduh file untuk membukanya</p>
                <Button onClick={() => previewDoc && handleDownload(previewDoc)} className="gap-2"><Download className="h-4 w-4" />Unduh File</Button>
              </div>
            )}
          </div>
          {previewDoc && previewUrl && (
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => handleDownload(previewDoc)} className="gap-2"><Download className="h-3.5 w-3.5" />Unduh</Button>
              <Button variant="outline" size="sm" onClick={() => window.open(previewUrl, '_blank')} className="gap-2"><ExternalLink className="h-3.5 w-3.5" />Buka di Tab Baru</Button>
              <Button variant="outline" size="sm" onClick={() => handleShare(previewDoc)} className="gap-2 ml-auto"><Share2 className="h-3.5 w-3.5" />Bagikan</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={!!shareDoc} onOpenChange={open => { if (!open) setShareDoc(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Share2 className="h-5 w-5" />Bagikan Dokumen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/40 rounded-lg p-3 flex items-center gap-2">
              <span>{shareDoc && getFileIcon(shareDoc.file_type)}</span>
              <span className="text-sm font-medium truncate">{shareDoc?.original_name}</span>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Link berlaku selama</Label>
              <Select value={shareExpiry} onValueChange={setShareExpiry}>
                <SelectTrigger data-testid="select-share-expiry"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="300">5 menit</SelectItem>
                  <SelectItem value="3600">1 jam</SelectItem>
                  <SelectItem value="86400">1 hari</SelectItem>
                  <SelectItem value="604800">7 hari</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button data-testid="button-generate-share-url" onClick={generateShareUrl} className="w-full gap-2"><Share2 className="h-4 w-4" />Generate Link</Button>
            {shareUrl && (
              <div>
                <Label className="text-xs mb-1.5 block">Link Share (Signed URL)</Label>
                <div className="flex gap-2">
                  <Input value={shareUrl} readOnly className="text-xs font-mono" />
                  <Button data-testid="button-copy-share-url" variant="outline" size="icon" onClick={() => copyToClipboard(shareUrl)}><Copy className="h-4 w-4" /></Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1"><Lock className="h-3 w-3" />Link ini bersifat sementara dan akan kedaluwarsa sesuai durasi yang dipilih.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameDoc} onOpenChange={open => { if (!open) setRenameDoc(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Edit3 className="h-5 w-5" />Rename File</DialogTitle></DialogHeader>
          <div>
            <Label className="text-xs mb-1.5 block">Nama baru</Label>
            <Input data-testid="input-rename-file" value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRename()} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDoc(null)}>Batal</Button>
            <Button data-testid="button-confirm-rename" onClick={handleRename} disabled={!renameValue.trim()}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailDoc} onOpenChange={open => { if (!open) setDetailDoc(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Info className="h-5 w-5" />Detail Dokumen</DialogTitle></DialogHeader>
          {detailDoc && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-3">
                <div className="bg-muted/40 rounded-xl p-4 flex items-center gap-3">
                  <span className="text-4xl">{getFileIcon(detailDoc.file_type)}</span>
                  <div>
                    <p className="font-medium">{detailDoc.original_name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(detailDoc.file_size)} · {detailDoc.file_type}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: 'Kategori', value: detailDoc.category },
                    { label: 'Versi', value: `v${detailDoc.version}` },
                    { label: 'Visibilitas', value: detailDoc.visibility },
                    { label: 'Diupload', value: new Date(detailDoc.created_at).toLocaleString('id-ID') },
                    { label: 'Diupdate', value: new Date(detailDoc.updated_at).toLocaleString('id-ID') },
                    { label: 'Checksum', value: detailDoc.checksum ? detailDoc.checksum.substring(0, 12) + '...' : '—' },
                  ].map(item => (
                    <div key={item.label}>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="font-medium text-sm truncate">{item.value || '—'}</p>
                    </div>
                  ))}
                </div>
                {detailDoc.tags && detailDoc.tags.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {detailDoc.tags.map(t => <Badge key={t} variant="outline" className="text-xs"><Tag className="h-2.5 w-2.5 mr-0.5" />{t}</Badge>)}
                    </div>
                  </div>
                )}
                {detailDoc.description && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Deskripsi</p>
                    <p className="text-sm">{detailDoc.description}</p>
                  </div>
                )}
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-1.5"><BarChart3 className="h-4 w-4" />Riwayat Aktivitas</p>
                  {auditLogs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Belum ada aktivitas tercatat</p>
                  ) : (
                    <div className="space-y-2">
                      {auditLogs.map(log => (
                        <div key={log.id} className="flex items-center gap-2 text-xs">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                          <span className="font-medium capitalize">{log.action.replace(/_/g, ' ')}</span>
                          <span className="text-muted-foreground ml-auto">{timeAgo(log.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FolderPlus className="h-5 w-5" />Buat Folder Baru</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs mb-1.5 block">Nama Folder</Label>
              <Input data-testid="input-folder-name" value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="contoh: CV 2024" autoFocus onKeyDown={e => e.key === 'Enter' && handleCreateFolder()} />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Warna</Label>
              <div className="flex gap-2">
                {Object.entries(FOLDER_COLORS).map(([color, cls]) => (
                  <button key={color} onClick={() => setFolderColor(color)} className={`h-7 w-7 rounded-full border-2 transition-all ${folderColor === color ? 'border-foreground scale-110' : 'border-transparent'} ${cls.replace('text-', 'bg-').replace('-500', '-400')}`} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderOpen(false)}>Batal</Button>
            <Button data-testid="button-confirm-folder" onClick={handleCreateFolder} disabled={!folderName.trim()}>Buat Folder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteTarget?.permanent ? '⚠️ Hapus Permanen?' : 'Pindahkan ke Trash?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.permanent
                ? `File "${deleteTarget.doc.original_name}" akan dihapus secara permanen dari storage. Tindakan ini tidak dapat dibatalkan.`
                : `File "${deleteTarget?.doc.original_name}" akan dipindahkan ke Trash. Kamu dapat me-restore-nya nanti.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-delete" onClick={handleDelete} className={deleteTarget?.permanent ? 'bg-destructive hover:bg-destructive/90' : ''}>
              {deleteTarget?.permanent ? 'Hapus Permanen' : 'Pindahkan ke Trash'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DocMenu({ doc, onPreview, onDownload, onShare, onRename, onFavorite, onDelete, onPermanentDelete, onRestore, onDetail }: {
  doc: Document;
  onPreview: (d: Document) => void;
  onDownload: (d: Document) => void;
  onShare: (d: Document) => void;
  onRename: (d: Document) => void;
  onFavorite: (d: Document) => void;
  onDelete: (d: Document) => void;
  onPermanentDelete: (d: Document) => void;
  onRestore: (d: Document) => void;
  onDetail: (d: Document) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button data-testid={`button-menu-${doc.id}`} variant="ghost" size="icon" className="h-7 w-7 shrink-0">
          <MoreVertical className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {!doc.deleted_at && (
          <>
            {PREVIEWABLE_TYPES.has(doc.file_type) && (
              <DropdownMenuItem onClick={() => onPreview(doc)} className="gap-2 text-sm"><Eye className="h-3.5 w-3.5" />Preview</DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onDownload(doc)} className="gap-2 text-sm"><Download className="h-3.5 w-3.5" />Unduh</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onShare(doc)} className="gap-2 text-sm"><Share2 className="h-3.5 w-3.5" />Bagikan</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onRename(doc)} className="gap-2 text-sm"><Edit3 className="h-3.5 w-3.5" />Rename</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFavorite(doc)} className="gap-2 text-sm">
              {doc.is_favorite ? <><StarOff className="h-3.5 w-3.5" />Hapus Favorit</> : <><Star className="h-3.5 w-3.5" />Tambah Favorit</>}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDetail(doc)} className="gap-2 text-sm"><Info className="h-3.5 w-3.5" />Detail & Log</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(doc)} className="gap-2 text-sm text-destructive focus:text-destructive"><Trash2 className="h-3.5 w-3.5" />Hapus</DropdownMenuItem>
          </>
        )}
        {doc.deleted_at && (
          <>
            <DropdownMenuItem onClick={() => onRestore(doc)} className="gap-2 text-sm"><RotateCcw className="h-3.5 w-3.5" />Restore</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onPermanentDelete(doc)} className="gap-2 text-sm text-destructive focus:text-destructive"><Trash2 className="h-3.5 w-3.5" />Hapus Permanen</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
