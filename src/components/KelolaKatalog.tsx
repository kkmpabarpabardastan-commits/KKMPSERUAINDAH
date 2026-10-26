import { useEffect, useState, useCallback } from 'react';
import {
  Search, Save, X, AlertCircle, Check, Package,
  Edit3, Plus, Trash2, ImagePlus, ImageIcon, Loader2,
} from 'lucide-react';
import { supabase, type Product, type Category, type Supplier } from '@/lib/supabase';
import { formatRupiah, formatNumber } from '@/lib/format';

const categoryFallback = (cat: Category | null | undefined): string | null => cat?.image_url ?? null;

type EditState = {
  id: string | null;
  name: string;
  category_id: string;
  unit: string;
  price: string;
  cost_price: string;
  stock: string;
  min_stock: string;
  description: string;
  supplier_id: string;
  image_url: string;
  is_active: boolean;
};

const emptyForm: EditState = {
  id: null,
  name: '',
  category_id: '',
  unit: 'pcs',
  price: '',
  cost_price: '',
  stock: '',
  min_stock: '5',
  description: '',
  supplier_id: '',
  image_url: '',
  is_active: true,
};

export function KelolaKatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [prodRes, catRes, supRes] = await Promise.all([
        supabase.from('products').select('*, category:categories(*), supplier:suppliers(*)').order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('suppliers').select('*').order('name'),
      ]);
      setProducts(prodRes.data ?? []);
      setCategories(catRes.data ?? []);
      setSuppliers(supRes.data ?? []);
    } catch {
      setProducts([]);
      setCategories([]);
      setSuppliers([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = products.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.category?.name?.toLowerCase().includes(q);
  });

  const startEdit = (p: Product) => {
    setEditing({
      id: p.id,
      name: p.name,
      category_id: p.category_id ?? '',
      unit: p.unit,
      price: String(p.price),
      cost_price: String(p.cost_price),
      stock: String(p.stock),
      min_stock: String(p.min_stock),
      description: p.description ?? '',
      supplier_id: p.supplier_id ?? '',
      image_url: p.image_url ?? '',
      is_active: p.is_active,
    });
    setMsg(null);
  };

  const handleUploadImage = async (file: File) => {
    if (!editing) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
      const path = `produk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
      const { error: upErr } = await supabase.storage.from('products').upload(path, file, { cacheControl: '3600', upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('products').getPublicUrl(path);
      setEditing({ ...editing, image_url: pub.publicUrl });
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message ?? 'Gagal mengunggah foto.' });
    }
    setUploading(false);
  };

  const startAdd = () => {
    setEditing({ ...emptyForm, category_id: categories[0]?.id ?? '', supplier_id: suppliers[0]?.id ?? '' });
    setMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;

    if (!editing.name.trim()) {
      setMsg({ type: 'error', text: 'Nama barang harus diisi.' });
      return;
    }

    const payload = {
      name: editing.name.trim(),
      category_id: editing.category_id || null,
      unit: editing.unit.trim() || 'pcs',
      price: Number(editing.price) || 0,
      cost_price: Number(editing.cost_price) || 0,
      stock: Number(editing.stock) || 0,
      min_stock: Number(editing.min_stock) || 0,
      description: editing.description.trim() || null,
      supplier_id: editing.supplier_id || null,
      image_url: editing.image_url.trim() || null,
      is_active: editing.is_active,
    };

    setSaving(true);
    try {
      if (editing.id) {
        const { error } = await supabase.from('products').update(payload).eq('id', editing.id);
        if (error) throw error;
        setMsg({ type: 'success', text: 'Barang berhasil diperbarui.' });
        setEditing(null);
      } else {
        const { error } = await supabase.from('products').insert(payload);
        if (error) throw error;
        setMsg({ type: 'success', text: 'Barang baru berhasil ditambahkan.' });
        setEditing(null);
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message ?? 'Gagal menyimpan data barang.' });
    }
    setSaving(false);
    loadData();
    setTimeout(() => setMsg(null), 3000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus barang ini dari katalog?')) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      setMsg({ type: 'success', text: 'Barang berhasil dihapus.' });
      loadData();
      setTimeout(() => setMsg(null), 3000);
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message ?? 'Gagal menghapus barang.' });
    }
  };

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm';
  const labelClass = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <div>
      {msg && (
        <div className={`mb-4 flex items-center gap-2 p-3 rounded-xl text-sm ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {msg.type === 'success' ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {msg.text}
        </div>
      )}

      {!editing ? (
        <>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari barang..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
              />
            </div>
            <button
              onClick={startAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-all"
            >
              <Plus className="w-4 h-4" />
              Tambah Barang
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse h-14" />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nama</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Kategori</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Harga</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Stok</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map((p) => {
                      const fallback = categoryFallback(p.category);
                      const imgSrc = p.image_url ?? fallback;
                      return (
                      <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                              {imgSrc ? (
                                <img src={imgSrc} alt={p.name} className="w-full h-full object-cover" />
                              ) : (
                                <Package className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="font-medium text-gray-900 block">{p.name}</span>
                              {!p.is_active && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Nonaktif</span>
                              )}
                              {p.image_url ? (
                                <span className="ml-0 sm:ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">Foto</span>
                              ) : fallback ? (
                                <span className="ml-0 sm:ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-500">Kategori</span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{p.category?.name ?? '-'}</td>
                        <td className="px-4 py-3 text-sm text-right whitespace-nowrap font-semibold text-red-600">{formatRupiah(p.price)}</td>
                        <td className="px-4 py-3 text-sm text-right hidden md:table-cell whitespace-nowrap">
                          <span className={p.stock <= p.min_stock ? 'text-amber-600 font-medium' : 'text-gray-600'}>
                            {formatNumber(p.stock)} {p.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => startEdit(p)}
                              className="p-1.5 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-all"
                              title="Edit"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all"
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-red-600" />
              {editing.id ? 'Edit Barang' : 'Tambah Barang Baru'}
            </h3>
            <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className={labelClass}>Nama Barang *</label>
              <input
                type="text"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className={inputClass}
                placeholder="Contoh: Beras Premium 5kg"
              />
            </div>

            {/* Foto Produk */}
            <div>
              <label className={labelClass}>Foto Produk</label>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0 flex items-center justify-center">
                  {editing.image_url ? (
                    <img src={editing.image_url} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 cursor-pointer transition-all">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                    {uploading ? 'Mengunggah...' : 'Pilih Foto'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadImage(f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {editing.image_url && (
                    <button
                      type="button"
                      onClick={() => setEditing({ ...editing, image_url: '' })}
                      className="ml-2 text-xs text-red-600 hover:underline"
                    >
                      Hapus foto
                    </button>
                  )}
                  <p className="text-[11px] text-gray-400 leading-relaxed">Jika tidak ada foto, otomatis memakai foto kategori barang.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Kategori</label>
                <select value={editing.category_id} onChange={(e) => setEditing({ ...editing, category_id: e.target.value })} className={inputClass}>
                  <option value="">Tanpa kategori</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Satuan</label>
                <input type="text" value={editing.unit} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} className={inputClass} placeholder="kg, pcs, btl, dll" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Harga Jual (Rp) *</label>
                <input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} className={inputClass} placeholder="0" min="0" />
              </div>
              <div>
                <label className={labelClass}>Harga Beli (Rp)</label>
                <input type="number" value={editing.cost_price} onChange={(e) => setEditing({ ...editing, cost_price: e.target.value })} className={inputClass} placeholder="0" min="0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Stok</label>
                <input type="number" value={editing.stock} onChange={(e) => setEditing({ ...editing, stock: e.target.value })} className={inputClass} placeholder="0" min="0" />
              </div>
              <div>
                <label className={labelClass}>Min. Stok</label>
                <input type="number" value={editing.min_stock} onChange={(e) => setEditing({ ...editing, min_stock: e.target.value })} className={inputClass} placeholder="5" min="0" />
              </div>
            </div>

            <div>
              <label className={labelClass}>Pemasok</label>
              <select value={editing.supplier_id} onChange={(e) => setEditing({ ...editing, supplier_id: e.target.value })} className={inputClass}>
                <option value="">Tanpa pemasok</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Deskripsi</label>
              <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className={inputClass} rows={2} placeholder="Keterangan barang (opsional)" />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
              <span className="text-sm text-gray-700">Barang aktif (tampil di katalog)</span>
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-all"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
