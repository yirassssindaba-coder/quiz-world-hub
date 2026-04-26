import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Shield, Plus, Trash2, Users, BookOpen, Newspaper, BarChart3, Loader2, Edit, Box, Upload, Power, Image as ImageIcon, Eye } from 'lucide-react';
import { createModelAsset, deleteModelAsset, getModelAssets, getModelData, setActiveModel, type ModelAsset, type ModelPlacement } from '@/lib/modelAssets';

export default function Admin() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/auth'); return; }
    if (!isAdmin) { navigate('/'); toast({ title: 'Akses ditolak', description: 'Anda bukan admin.', variant: 'destructive' }); }
  }, [user, isAdmin, authLoading]);

  if (authLoading || !isAdmin) return <div className="container py-12"><Skeleton className="h-96 rounded-xl" /></div>;

  return (
    <div className="container py-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center">
          <Shield className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-[Space_Grotesk]">Admin Panel</h1>
          <p className="text-muted-foreground">Kelola soal, kategori, berita, dan pengguna.</p>
        </div>
      </div>

      <Tabs defaultValue="questions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 max-w-3xl">
          <TabsTrigger value="questions"><BookOpen className="h-4 w-4 mr-1" />Soal</TabsTrigger>
          <TabsTrigger value="categories"><BarChart3 className="h-4 w-4 mr-1" />Kategori</TabsTrigger>
          <TabsTrigger value="news"><Newspaper className="h-4 w-4 mr-1" />Berita</TabsTrigger>
          <TabsTrigger value="models"><Box className="h-4 w-4 mr-1" />3D Models</TabsTrigger>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-1" />Users</TabsTrigger>
        </TabsList>

        <TabsContent value="questions"><QuestionsAdmin /></TabsContent>
        <TabsContent value="categories"><CategoriesAdmin /></TabsContent>
        <TabsContent value="news"><NewsAdmin /></TabsContent>
        <TabsContent value="models"><Models3DAdmin /></TabsContent>
        <TabsContent value="users"><UsersAdmin /></TabsContent>
      </Tabs>
    </div>
  );
}

function Models3DAdmin() {
  const [assets, setAssets] = useState<ModelAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ asset: ModelAsset; data?: string } | null>(null);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [fallbackFile, setFallbackFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    placement: 'hero' as ModelPlacement,
    version: 'v1',
  });
  const { toast } = useToast();

  useEffect(() => {
    setAssets(getModelAssets());
  }, []);

  useEffect(() => {
    if (!preview?.data || customElements.get('model-viewer')) return;
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';
    document.head.appendChild(script);
  }, [preview?.data]);

  const handleUpload = async () => {
    if (!form.name || !modelFile) {
      toast({ title: 'Nama dan file model wajib diisi', variant: 'destructive' });
      return;
    }
    const fileName = modelFile.name.toLowerCase();
    if (!fileName.endsWith('.glb') && !fileName.endsWith('.gltf')) {
      toast({ title: 'Format tidak didukung', description: 'Gunakan file .glb atau .gltf.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      await createModelAsset({ ...form, modelFile, thumbnailFile, fallbackFile });
      setAssets(getModelAssets());
      setForm({ name: '', description: '', placement: 'hero', version: 'v1' });
      setModelFile(null);
      setThumbnailFile(null);
      setFallbackFile(null);
      toast({ title: 'Model 3D disimpan', description: 'Aktifkan model agar muncul di area terpilih.' });
    } catch (error) {
      toast({ title: 'Gagal menyimpan model', description: error instanceof Error ? error.message : 'Coba lagi.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const openPreview = async (asset: ModelAsset) => {
    const data = await getModelData(asset.id);
    setPreview({ asset, data });
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle>Kelola Model 3D</CardTitle>
          <CardDescription>Upload/replace file GLB/GLTF, thumbnail, fallback image, versi, dan placement. Data model disimpan lokal di browser admin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <Label>Nama Model</Label>
              <Input data-testid="input-model-name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Contoh: Globe Hero" />
            </div>
            <div>
              <Label>Placement</Label>
              <Select value={form.placement} onValueChange={(value: ModelPlacement) => setForm(p => ({ ...p, placement: value }))}>
                <SelectTrigger data-testid="select-model-placement"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['hero', 'globe', 'ambient', 'news', 'dashboard'] as ModelPlacement[]).map(item => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Versi</Label>
              <Input data-testid="input-model-version" value={form.version} onChange={e => setForm(p => ({ ...p, version: e.target.value }))} placeholder="v1" />
            </div>
            <div>
              <Label>File GLB/GLTF</Label>
              <Input data-testid="input-model-file" type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" onChange={e => setModelFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <div>
            <Label>Deskripsi Aksesibilitas</Label>
            <Textarea data-testid="input-model-description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Deskripsikan model untuk alt text dan fallback." />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label>Thumbnail Preview</Label>
              <Input data-testid="input-model-thumbnail" type="file" accept="image/*" onChange={e => setThumbnailFile(e.target.files?.[0] || null)} />
            </div>
            <div>
              <Label>Fallback Image</Label>
              <Input data-testid="input-model-fallback" type="file" accept="image/*" onChange={e => setFallbackFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <Button data-testid="button-upload-model" onClick={handleUpload} disabled={uploading} className="bg-gradient-primary text-white">
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Upload / Replace Model
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {assets.map(asset => (
          <Card key={asset.id} className="depth-card overflow-hidden border-border/50">
            <div className="grid h-40 place-items-center bg-muted/40">
              {asset.thumbnailDataUrl || asset.fallbackDataUrl ? (
                <img data-testid={`img-model-preview-${asset.id}`} src={asset.thumbnailDataUrl || asset.fallbackDataUrl} alt={asset.name} className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-12 w-12 text-muted-foreground" />
              )}
            </div>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle data-testid={`text-model-name-${asset.id}`} className="text-base">{asset.name}</CardTitle>
                  <CardDescription>{asset.placement} · {asset.version}</CardDescription>
                </div>
                {asset.active && <Badge>Aktif</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="line-clamp-2 text-sm text-muted-foreground">{asset.description || asset.modelFileName}</p>
              <div className="flex flex-wrap gap-2">
                <Button data-testid={`button-preview-model-${asset.id}`} size="sm" variant="outline" onClick={() => openPreview(asset)}>
                  <Eye className="mr-1 h-4 w-4" /> Preview
                </Button>
                <Button data-testid={`button-activate-model-${asset.id}`} size="sm" variant={asset.active ? 'secondary' : 'default'} onClick={() => setAssets(setActiveModel(asset.id, asset.placement, !asset.active))}>
                  <Power className="mr-1 h-4 w-4" /> {asset.active ? 'Nonaktif' : 'Aktifkan'}
                </Button>
                <Button data-testid={`button-delete-model-${asset.id}`} size="sm" variant="ghost" className="text-destructive" onClick={() => setAssets(deleteModelAsset(asset.id))}>
                  <Trash2 className="mr-1 h-4 w-4" /> Hapus
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={Boolean(preview)} onOpenChange={open => !open && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Preview Model 3D</DialogTitle></DialogHeader>
          {preview && (
            <div className="space-y-3">
              {preview.data ? (
                <model-viewer
                  data-testid="model-viewer-admin-preview"
                  src={preview.data}
                  poster={preview.asset.thumbnailDataUrl || preview.asset.fallbackDataUrl}
                  alt={preview.asset.description || preview.asset.name}
                  camera-controls
                  auto-rotate
                  shadow-intensity="0.8"
                  className="h-[420px] w-full rounded-xl bg-muted"
                />
              ) : (
                <div className="grid h-[320px] place-items-center rounded-xl bg-muted text-muted-foreground">Data model tidak tersedia.</div>
              )}
              <p className="text-sm text-muted-foreground">{preview.asset.description || preview.asset.modelFileName}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuestionsAdmin() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    category_id: '', question_text: '', question_type: 'multiple_choice',
    difficulty_level: 'easy', options: ['', '', '', ''], correct_answer: 'A', explanation: ''
  });

  useEffect(() => {
    const fetch = async () => {
      const [qRes, cRes] = await Promise.all([
        supabase.from('questions').select('*, categories(name)').order('created_at', { ascending: false }).limit(50),
        supabase.from('categories').select('*'),
      ]);
      setQuestions(qRes.data || []);
      setCategories(cRes.data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const handleAdd = async () => {
    if (!form.category_id || !form.question_text) {
      toast({ title: 'Isi semua field wajib', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('questions').insert({
      category_id: form.category_id,
      question_text: form.question_text,
      question_type: form.question_type,
      difficulty_level: form.difficulty_level,
      options: form.question_type === 'multiple_choice' ? form.options.filter(o => o) : null,
      correct_answer: form.correct_answer,
      explanation: form.explanation || null,
    });
    if (error) {
      toast({ title: 'Gagal menambah soal', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Soal berhasil ditambahkan!' });
      setDialogOpen(false);
      const { data } = await supabase.from('questions').select('*, categories(name)').order('created_at', { ascending: false }).limit(50);
      setQuestions(data || []);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('questions').delete().eq('id', id);
    setQuestions(prev => prev.filter(q => q.id !== id));
    toast({ title: 'Soal dihapus' });
  };

  if (loading) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Kelola Soal ({questions.length})</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-primary text-white"><Plus className="mr-1 h-4 w-4" />Tambah Soal</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Tambah Soal Baru</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Kategori</Label>
                  <Select value={form.category_id} onValueChange={v => setForm(p => ({ ...p, category_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Pertanyaan</Label>
                  <Textarea value={form.question_text} onChange={e => setForm(p => ({ ...p, question_text: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipe</Label>
                    <Select value={form.question_type} onValueChange={v => setForm(p => ({ ...p, question_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="multiple_choice">Pilihan Ganda</SelectItem>
                        <SelectItem value="true_false">Benar/Salah</SelectItem>
                        <SelectItem value="short_answer">Isian Singkat</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Kesulitan</Label>
                    <Select value={form.difficulty_level} onValueChange={v => setForm(p => ({ ...p, difficulty_level: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Mudah</SelectItem>
                        <SelectItem value="medium">Sedang</SelectItem>
                        <SelectItem value="hard">Sulit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {form.question_type === 'multiple_choice' && (
                  <div className="space-y-2">
                    <Label>Opsi Jawaban</Label>
                    {form.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-sm font-medium w-6">{String.fromCharCode(65 + i)}.</span>
                        <Input value={opt} onChange={e => {
                          const opts = [...form.options];
                          opts[i] = e.target.value;
                          setForm(p => ({ ...p, options: opts }));
                        }} placeholder={`Opsi ${String.fromCharCode(65 + i)}`} />
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <Label>Jawaban Benar</Label>
                  <Input value={form.correct_answer} onChange={e => setForm(p => ({ ...p, correct_answer: e.target.value }))} placeholder="A, B, C, D / Benar / teks" />
                </div>
                <div>
                  <Label>Penjelasan (opsional)</Label>
                  <Textarea value={form.explanation} onChange={e => setForm(p => ({ ...p, explanation: e.target.value }))} />
                </div>
                <Button onClick={handleAdd} className="w-full bg-gradient-primary text-white">Simpan Soal</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Soal</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Level</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map(q => (
                <TableRow key={q.id}>
                  <TableCell className="max-w-xs truncate">{q.question_text}</TableCell>
                  <TableCell><Badge variant="outline">{q.categories?.name}</Badge></TableCell>
                  <TableCell className="text-xs">{q.question_type}</TableCell>
                  <TableCell><Badge variant="secondary">{q.difficulty_level}</Badge></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(q.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function CategoriesAdmin() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    supabase.from('categories').select('*').order('name').then(({ data }) => {
      setCategories(data || []);
      setLoading(false);
    });
  }, []);

  const handleAdd = async () => {
    if (!name || !slug) { toast({ title: 'Nama dan slug wajib diisi', variant: 'destructive' }); return; }
    const { error } = await supabase.from('categories').insert({ name, slug, description: description || null });
    if (error) { toast({ title: 'Gagal', description: error.message, variant: 'destructive' }); }
    else {
      toast({ title: 'Kategori ditambahkan!' });
      setName(''); setSlug(''); setDescription('');
      const { data } = await supabase.from('categories').select('*').order('name');
      setCategories(data || []);
    }
  };

  if (loading) return <Skeleton className="h-48 rounded-xl" />;

  return (
    <Card className="border-border/50">
      <CardHeader><CardTitle>Kelola Kategori</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input placeholder="Nama Kategori" value={name} onChange={e => { setName(e.target.value); setSlug(e.target.value.toLowerCase().replace(/\s+/g, '_')); }} />
          <Input placeholder="Slug" value={slug} onChange={e => setSlug(e.target.value)} />
          <Input placeholder="Deskripsi (opsional)" value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <Button onClick={handleAdd} className="bg-gradient-primary text-white"><Plus className="mr-1 h-4 w-4" />Tambah</Button>
        <div className="space-y-2">
          {categories.map(c => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.slug}</p>
              </div>
              <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={async () => {
                await supabase.from('categories').delete().eq('id', c.id);
                setCategories(prev => prev.filter(x => x.id !== c.id));
                toast({ title: 'Kategori dihapus' });
              }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function NewsAdmin() {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({ title: '', summary: '', content: '', source: '', source_url: '', location: '', category: 'penipuan' });

  useEffect(() => {
    supabase.from('news_articles').select('*').order('published_at', { ascending: false }).then(({ data }) => {
      setArticles(data || []);
      setLoading(false);
    });
  }, []);

  const handleAdd = async () => {
    if (!form.title || !form.summary) { toast({ title: 'Judul dan ringkasan wajib', variant: 'destructive' }); return; }
    const { error } = await supabase.from('news_articles').insert(form);
    if (error) { toast({ title: 'Gagal', description: error.message, variant: 'destructive' }); }
    else {
      toast({ title: 'Berita ditambahkan!' });
      setDialogOpen(false);
      const { data } = await supabase.from('news_articles').select('*').order('published_at', { ascending: false });
      setArticles(data || []);
    }
  };

  if (loading) return <Skeleton className="h-48 rounded-xl" />;

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Kelola Berita ({articles.length})</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button size="sm" className="bg-gradient-primary text-white"><Plus className="mr-1 h-4 w-4" />Tambah</Button></DialogTrigger>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Tambah Berita</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Judul</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
                <div><Label>Ringkasan</Label><Textarea value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} /></div>
                <div><Label>Konten (opsional)</Label><Textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Sumber</Label><Input value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} /></div>
                  <div><Label>Lokasi</Label><Input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} /></div>
                </div>
                <div><Label>URL Sumber</Label><Input value={form.source_url} onChange={e => setForm(p => ({ ...p, source_url: e.target.value }))} /></div>
                <div>
                  <Label>Kategori</Label>
                  <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['penipuan', 'scam_online', 'cybercrime', 'pencurian', 'korupsi', 'penggelapan', 'keamanan_digital'].map(c => (
                        <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAdd} className="w-full bg-gradient-primary text-white">Simpan</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {articles.map(a => (
            <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="min-w-0 flex-1 mr-3">
                <p className="font-medium truncate">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.category} · {new Date(a.published_at).toLocaleDateString('id-ID')}</p>
              </div>
              <Button variant="ghost" size="icon" className="text-destructive h-8 w-8 shrink-0" onClick={async () => {
                await supabase.from('news_articles').delete().eq('id', a.id);
                setArticles(prev => prev.filter(x => x.id !== a.id));
                toast({ title: 'Berita dihapus' });
              }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function UsersAdmin() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('profiles').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setProfiles(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <Skeleton className="h-48 rounded-xl" />;

  return (
    <Card className="border-border/50">
      <CardHeader><CardTitle>Pengguna ({profiles.length})</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Bergabung</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{p.display_name || 'Unnamed'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(p.created_at).toLocaleDateString('id-ID')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
