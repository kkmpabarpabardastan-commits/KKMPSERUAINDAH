import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Search, Save, X, AlertCircle, Check, Receipt,
  Edit3, Plus, Trash2, LayoutList, Layers, Calendar, Package,
} from 'lucide-react';
import { supabase, type Transaction, type Member, type Product, type Service } from '@/lib/supabase';
import { formatRupiah, formatShortDate } from '@/lib/format';
import { getIcon } from '@/lib/icons';

type StockEffect = { productId: string; delta: number };

function stockEffectFor(t: {
  type: string;
  status: string;
  product_id: string | null;
  quantity: number | null;
}): StockEffect | null {
  if (t.status !== 'lunas') return null;
  if (!t.product_id) return null;
  const qty = t.quantity ?? 0;
  if (qty <= 0) return null;
  if (t.type === 'penjualan') return { productId: t.product_id, delta: -qty };
  if (t.type === 'pembelian') return { productId: t.product_id, delta: qty };
  return null;
}

async function applyStockDelta(productId: string, delta: number) {
  const { data: prod, error: fetchErr } = await supabase
    .from('products')
    .select('stock')
    .eq('id', productId)
    .maybeSingle();
  if (fetchErr || !prod) return;
  const newStock = Math.max(0, (prod.stock ?? 0) + delta);
  await supabase.from('products').update({ stock: newStock }).eq('id', productId);
}

type EditState = {
  id: string | null;
  type: string;
  description: string;
  amount: string;
  member_id: string;
  product_id: string;
  quantity: string;
  transaction_date: string;
  status: string;
};

type ServiceEditState = {
  id: string | null;
  name: string;
  description: string;
  category: string;
  fee_or_rate: string;
  icon: string;
};

const todayStr = new Date().toISOString().split('T')[0];

const emptyForm: EditState = {
  id: null,
  type: 'penjualan',
  description: '',
  amount: '',
  member_id: '',
  product_id: '',
  quantity: '',
  transaction_date: todayStr,
  status: 'lunas',
};

const emptyServiceForm: ServiceEditState = {
  id: null,
  name: '',
  description: '',
  category: 'simpanan',
  fee_or_rate: '',
  icon: 'Wallet',
};

const typeOptions = [
  { value: 'penjualan', label: 'Penjualan' },
  { value: 'pembelian', label: 'Pembelian' },
  { value: 'simpanan', label: 'Simpanan' },
  { value: 'pinjaman', label: 'Pinjaman' },
  { value: 'biaya_operasional', label: 'Biaya Operasional' },
];

const statusOptions = [
  { value: 'lunas', label: 'Lunas' },
  { value: 'pending', label: 'Pending' },
  { value: 'batal', label: 'Batal' },
];

const serviceCategoryOptions = [
  { value: 'simpanan', label: 'Simpanan' },
  { value: 'pinjaman', label: 'Pinjaman' },
  { value: 'jasa', label: 'Jasa' },
  { value: 'perdagangan', label: 'Perdagangan' },
];

const iconOptions = ['Wallet', 'Coins', 'Handshake', 'Package', 'ShoppingCart', 'TrendingUp', 'Building2', 'Landmark'];

const typeLabels: Record<string, string> = {
  penjualan: 'Penjualan',
  pembelian: 'Pembelian',
  simpanan: 'Simpanan',
  pinjaman: 'Pinjaman',
  biaya_operasional: 'Biaya Operasional',
};

const statusColors: Record<string, string> = {
  lunas: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  batal: 'bg-red-50 text-red-700',
};

const categoryLabels: Record<string, string> = {
  simpanan: 'Simpanan',
  pinjaman: 'Pinjaman',
  jasa: 'Jasa',
  perdagangan: 'Perdagangan',
};

const inputClass = 'w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm';
const labelClass = 'block text-xs font-medium text-gray-600 mb-1';

export function KelolaTransaksi() {
  const [subTab, setSubTab] = useState<'transaksi' | 'layanan'>('transaksi');

  // Transaction state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Service state
  const [services, setServices] = useState<Service[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceFilterCat, setServiceFilterCat] = useState('all');
  const [editingService, setEditingService] = useState<ServiceEditState | null>(null);
  const [savingService, setSavingService] = useState(false);
  const [serviceMsg, setServiceMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [trxRes, memRes, prodRes] = await Promise.all([
        supabase.from('transactions').select('*, member:members(*), product:products(*)').order('transaction_date', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('members').select('*').order('name'),
        supabase.from('products').select('*').order('name'),
      ]);
      setTransactions(trxRes.data ?? []);
      setMembers(memRes.data ?? []);
      setProducts(prodRes.data ?? []);
    } catch {
      // Supabase not configured or unreachable
    }
    setLoading(false);
  }, []);

  const loadServices = useCallback(async () => {
    try {
      const { data } = await supabase.from('services').select('*').order('category').order('name');
      setServices(data ?? []);
    } catch {
      // Supabase not configured or unreachable
    }
  }, []);

  useEffect(() => {
    loadData();
    loadServices();
  }, [loadData, loadServices]);

  // ===== Transaction handlers =====
  const filtered = transactions.filter((t) => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return t.description?.toLowerCase().includes(q) || t.member?.name?.toLowerCase().includes(q) || t.type.toLowerCase().includes(q);
  });

  const startEdit = (t: Transaction) => {
    setEditing({
      id: t.id,
      type: t.type,
      description: t.description ?? '',
      amount: String(t.amount),
      member_id: t.member_id ?? '',
      product_id: t.product_id ?? '',
      quantity: t.quantity ? String(t.quantity) : '',
      transaction_date: t.transaction_date,
      status: t.status,
    });
    setMsg(null);
  };

  const startAdd = () => {
    setEditing({ ...emptyForm });
    setMsg(null);
  };

  const isProductLinked = (type: string) => type === 'penjualan' || type === 'pembelian';

  const unitPriceFor = (productId: string, type: string): number => {
    const p = products.find((x) => x.id === productId);
    if (!p) return 0;
    if (type === 'pembelian') return Number(p.cost_price) > 0 ? Number(p.cost_price) : Number(p.price);
    return Number(p.price);
  };

  const recalcAmount = (e: EditState): string => {
    if (!isProductLinked(e.type) || !e.product_id) return e.amount;
    const qty = Number(e.quantity) || 0;
    const unit = unitPriceFor(e.product_id, e.type);
    return String(unit * qty);
  };

  const onProductChange = (productId: string) => {
    if (!editing) return;
    const next = { ...editing, product_id: productId };
    if (isProductLinked(next.type) && productId) {
      if (!next.quantity) next.quantity = '1';
      next.amount = recalcAmount(next);
    }
    setEditing(next);
  };

  const onQuantityChange = (qty: string) => {
    if (!editing) return;
    const next = { ...editing, quantity: qty };
    if (isProductLinked(next.type) && next.product_id) {
      next.amount = recalcAmount(next);
    }
    setEditing(next);
  };

  const onTypeChange = (type: string) => {
    if (!editing) return;
    const next = { ...editing, type };
    if (isProductLinked(type) && next.product_id) {
      if (!next.quantity) next.quantity = '1';
      next.amount = recalcAmount(next);
    }
    setEditing(next);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editing.description.trim()) {
      setMsg({ type: 'error', text: 'Deskripsi transaksi harus diisi.' });
      return;
    }
    if (!editing.amount || Number(editing.amount) <= 0) {
      setMsg({ type: 'error', text: 'Jumlah harus lebih dari 0.' });
      return;
    }

    const payload = {
      type: editing.type,
      description: editing.description.trim(),
      amount: Number(editing.amount),
      member_id: editing.member_id || null,
      product_id: editing.product_id || null,
      quantity: editing.quantity ? Number(editing.quantity) : null,
      transaction_date: editing.transaction_date,
      status: editing.status,
    };

    const newEffect = stockEffectFor({
      type: payload.type,
      status: payload.status,
      product_id: payload.product_id,
      quantity: payload.quantity,
    });

    setSaving(true);
    try {
      if (editing.id) {
        const { error } = await supabase.from('transactions').update(payload).eq('id', editing.id);
        if (error) throw error;
        const oldTx = transactions.find((t) => t.id === editing.id);
        const oldEffect = oldTx ? stockEffectFor(oldTx) : null;
        if (oldEffect) await applyStockDelta(oldEffect.productId, -oldEffect.delta);
        if (newEffect) await applyStockDelta(newEffect.productId, newEffect.delta);
        setMsg({ type: 'success', text: 'Transaksi berhasil diperbarui.' + (newEffect || oldEffect ? ' Stok produk diperbarui.' : '') });
        setEditing(null);
      } else {
        const { error } = await supabase.from('transactions').insert(payload);
        if (error) throw error;
        if (newEffect) await applyStockDelta(newEffect.productId, newEffect.delta);
        setMsg({ type: 'success', text: 'Transaksi baru berhasil ditambahkan.' + (newEffect ? ' Stok produk diperbarui.' : '') });
        setEditing(null);
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message ?? 'Gagal menyimpan data transaksi.' });
    }
    setSaving(false);
    loadData();
    setTimeout(() => setMsg(null), 4000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus transaksi ini?')) return;
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      const oldTx = transactions.find((t) => t.id === id);
      const oldEffect = oldTx ? stockEffectFor(oldTx) : null;
      if (oldEffect) await applyStockDelta(oldEffect.productId, -oldEffect.delta);
      setMsg({ type: 'success', text: 'Transaksi berhasil dihapus.' + (oldEffect ? ' Stok produk dikembalikan.' : '') });
      loadData();
      setTimeout(() => setMsg(null), 4000);
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message ?? 'Gagal menghapus transaksi.' });
    }
  };

  // ===== Monthly grouping =====
  const groupedMonths = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const d = new Date(t.transaction_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    const monthNames = (key: string) => {
      const [y, m] = key.split('-').map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    };
    return Array.from(groups.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, items]) => ({
        key,
        label: monthNames(key),
        items,
        subtotal: items.reduce((s, t) => s + Number(t.amount), 0),
      }));
  }, [filtered]);

  // ===== Service handlers =====
  const filteredServices = services.filter((s) => {
    if (serviceFilterCat !== 'all' && s.category !== serviceFilterCat) return false;
    if (!serviceSearch.trim()) return true;
    const q = serviceSearch.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q);
  });

  const startEditService = (s: Service) => {
    setEditingService({
      id: s.id,
      name: s.name,
      description: s.description ?? '',
      category: s.category,
      fee_or_rate: s.fee_or_rate ?? '',
      icon: s.icon,
    });
    setServiceMsg(null);
  };

  const startAddService = () => {
    setEditingService({ ...emptyServiceForm });
    setServiceMsg(null);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;
    if (!editingService.name.trim()) {
      setServiceMsg({ type: 'error', text: 'Nama layanan harus diisi.' });
      return;
    }

    const payload = {
      name: editingService.name.trim(),
      description: editingService.description.trim() || null,
      category: editingService.category,
      fee_or_rate: editingService.fee_or_rate.trim() || null,
      icon: editingService.icon,
    };

    setSavingService(true);
    try {
      if (editingService.id) {
        const { error } = await supabase.from('services').update(payload).eq('id', editingService.id);
        if (error) throw error;
        setServiceMsg({ type: 'success', text: 'Layanan berhasil diperbarui.' });
        setEditingService(null);
      } else {
        const { error } = await supabase.from('services').insert(payload);
        if (error) throw error;
        setServiceMsg({ type: 'success', text: 'Layanan baru berhasil ditambahkan.' });
        setEditingService(null);
      }
    } catch (err: any) {
      setServiceMsg({ type: 'error', text: err?.message ?? 'Gagal menyimpan layanan.' });
    }
    setSavingService(false);
    loadServices();
    setTimeout(() => setServiceMsg(null), 3000);
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm('Hapus layanan ini?')) return;
    try {
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) throw error;
      setServiceMsg({ type: 'success', text: 'Layanan berhasil dihapus.' });
      loadServices();
      setTimeout(() => setServiceMsg(null), 3000);
    } catch (err: any) {
      setServiceMsg({ type: 'error', text: err?.message ?? 'Gagal menghapus layanan.' });
    }
  };

  return (
    <div>
      {/* Sub-tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200 pb-px">
        <button
          onClick={() => setSubTab('transaksi')}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all ${
            subTab === 'transaksi' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <LayoutList className="w-4 h-4" />
          Transaksi
        </button>
        <button
          onClick={() => setSubTab('layanan')}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all ${
            subTab === 'layanan' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          Kelola Layanan
        </button>
      </div>

      {/* ===== TRANSAKSI SUB-TAB ===== */}
      {subTab === 'transaksi' && (
        <>
          {msg && (
            <div className={`mb-4 flex items-center gap-2 p-3 rounded-xl text-sm ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {msg.type === 'success' ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              {msg.text}
            </div>
          )}

          {!editing ? (
            <>
              {/* Toolbar */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari transaksi..."
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
                  Tambah Transaksi
                </button>
              </div>

              {/* Type Filter */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterType === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Semua Jenis
                </button>
                {typeOptions.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setFilterType(t.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterType === t.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Transaction List grouped by month */}
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse h-14" />
                  ))}
                </div>
              ) : groupedMonths.length === 0 ? (
                <div className="text-center py-16">
                  <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Belum ada transaksi</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {groupedMonths.map((month) => (
                    <div key={month.key}>
                      {/* Month header */}
                      <div className="flex items-center justify-between mb-2 px-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-red-600" />
                          <h4 className="text-sm font-bold text-gray-900">{month.label}</h4>
                          <span className="text-xs text-gray-400">{month.items.length} transaksi</span>
                        </div>
                        <span className="text-xs font-semibold text-gray-600">Subtotal: {formatRupiah(month.subtotal)}</span>
                      </div>
                      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tanggal</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Jenis</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Deskripsi</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Anggota</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Jumlah</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {month.items.map((t) => (
                                <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatShortDate(t.transaction_date)}</td>
                                  <td className="px-4 py-3 text-sm text-gray-700">{typeLabels[t.type] ?? t.type}</td>
                                  <td className="px-4 py-3 text-sm text-gray-700 max-w-xs">
                                    <div className="truncate">{t.description}</div>
                                    {t.quantity && (
                                      <span className="text-xs text-gray-400 inline-flex items-center gap-0.5">
                                        <Package className="w-3 h-3" />x{t.quantity}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">{t.member?.name ?? '-'}</td>
                                  <td className="px-4 py-3 text-sm text-right whitespace-nowrap font-semibold text-gray-900">{formatRupiah(Number(t.amount))}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex justify-center">
                                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[t.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                        {t.status === 'lunas' ? 'Lunas' : t.status === 'pending' ? 'Pending' : 'Batal'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button onClick={() => startEdit(t)} className="p-1.5 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-all" title="Edit">
                                        <Edit3 className="w-4 h-4" />
                                      </button>
                                      <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all" title="Hapus">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-red-600" />
                  {editing.id ? 'Edit Transaksi' : 'Tambah Transaksi Baru'}
                </h3>
                <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Jenis Transaksi *</label>
                    <select value={editing.type} onChange={(e) => onTypeChange(e.target.value)} className={inputClass}>
                      {typeOptions.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Status</label>
                    <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })} className={inputClass}>
                      {statusOptions.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Deskripsi *</label>
                  <input type="text" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className={inputClass} placeholder="Contoh: Penjualan Beras Premium 5kg" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Anggota (opsional)</label>
                    <select value={editing.member_id} onChange={(e) => setEditing({ ...editing, member_id: e.target.value })} className={inputClass}>
                      <option value="">Tanpa anggota</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>{m.member_number} - {m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Produk (opsional)</label>
                    <select value={editing.product_id} onChange={(e) => onProductChange(e.target.value)} className={inputClass}>
                      <option value="">Tanpa produk</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Produk terhubung: tampilkan harga satuan + jumlah barang, hitung otomatis */}
                {isProductLinked(editing.type) && editing.product_id ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Harga Satuan (Rp)</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formatRupiah(unitPriceFor(editing.product_id, editing.type))}
                            readOnly
                            className={`${inputClass} bg-gray-50 text-gray-600 cursor-not-allowed`}
                          />
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">
                          {editing.type === 'pembelian' ? 'Harga beli produk' : 'Harga jual produk'}
                        </p>
                      </div>
                      <div>
                        <label className={labelClass}>Jumlah Barang *</label>
                        <input
                          type="number"
                          value={editing.quantity}
                          onChange={(e) => onQuantityChange(e.target.value)}
                          className={inputClass}
                          placeholder="0"
                          min="1"
                        />
                        <p className="text-[11px] text-gray-400 mt-1">
                          Jumlah (Rp) = harga satuan × jumlah barang
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Jumlah (Rp) * — terhitung otomatis</label>
                      <input
                        type="number"
                        value={editing.amount}
                        readOnly
                        className={`${inputClass} bg-red-50 text-red-700 font-semibold cursor-not-allowed`}
                      />
                      <p className="text-[11px] text-red-500 mt-1 font-medium">
                        {formatRupiah(Number(editing.amount) || 0)}
                      </p>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className={labelClass}>Jumlah (Rp) *</label>
                    <input type="number" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} className={inputClass} placeholder="0" min="0" />
                  </div>
                )}

                <div>
                  <label className={labelClass}>Tanggal</label>
                  <input type="date" value={editing.transaction_date} onChange={(e) => setEditing({ ...editing, transaction_date: e.target.value })} className={inputClass} />
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-all">
                    <Save className="w-4 h-4" />
                    {saving ? 'Menyimpan...' : 'Simpan'}
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all">
                    Batal
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}

      {/* ===== LAYANAN SUB-TAB ===== */}
      {subTab === 'layanan' && (
        <>
          {serviceMsg && (
            <div className={`mb-4 flex items-center gap-2 p-3 rounded-xl text-sm ${serviceMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {serviceMsg.type === 'success' ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              {serviceMsg.text}
            </div>
          )}

          {!editingService ? (
            <>
              {/* Toolbar */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari layanan..."
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                  />
                </div>
                <button
                  onClick={startAddService}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Layanan
                </button>
              </div>

              {/* Category Filter */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setServiceFilterCat('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${serviceFilterCat === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Semua Kategori
                </button>
                {serviceCategoryOptions.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setServiceFilterCat(c.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${serviceFilterCat === c.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Service List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredServices.map((s) => {
                  const Icon = getIcon(s.icon);
                  return (
                    <div key={s.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 inline-block mb-1">
                            {categoryLabels[s.category] ?? s.category}
                          </span>
                          <h4 className="text-sm font-bold text-gray-900 leading-snug">{s.name}</h4>
                        </div>
                      </div>
                      {s.description && (
                        <p className="text-xs text-gray-600 leading-relaxed mb-3 line-clamp-2">{s.description}</p>
                      )}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <span className="text-xs text-gray-500">{s.fee_or_rate ?? '-'}</span>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => startEditService(s)} className="p-1.5 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-all" title="Edit">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteService(s.id)} className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all" title="Hapus">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {filteredServices.length === 0 && (
                <div className="text-center py-16">
                  <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Belum ada layanan</p>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-red-600" />
                  {editingService.id ? 'Edit Layanan' : 'Tambah Layanan Baru'}
                </h3>
                <button onClick={() => setEditingService(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveService} className="space-y-4">
                <div>
                  <label className={labelClass}>Nama Layanan *</label>
                  <input type="text" value={editingService.name} onChange={(e) => setEditingService({ ...editingService, name: e.target.value })} className={inputClass} placeholder="Contoh: Simpanan Sukarela" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Kategori</label>
                    <select value={editingService.category} onChange={(e) => setEditingService({ ...editingService, category: e.target.value })} className={inputClass}>
                      {serviceCategoryOptions.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Ketentuan / Biaya</label>
                    <input type="text" value={editingService.fee_or_rate} onChange={(e) => setEditingService({ ...editingService, fee_or_rate: e.target.value })} className={inputClass} placeholder="Contoh: Bunga 1% per bulan" />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Deskripsi</label>
                  <textarea value={editingService.description} onChange={(e) => setEditingService({ ...editingService, description: e.target.value })} className={inputClass} rows={3} placeholder="Penjelasan singkat layanan" />
                </div>

                <div>
                  <label className={labelClass}>Ikon</label>
                  <div className="flex flex-wrap gap-2">
                    {iconOptions.map((iconName) => {
                      const Icon = getIcon(iconName);
                      return (
                        <button
                          key={iconName}
                          type="button"
                          onClick={() => setEditingService({ ...editingService, icon: iconName })}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center border-2 transition-all ${
                            editingService.icon === iconName
                              ? 'border-red-600 bg-red-50 text-red-600'
                              : 'border-gray-200 text-gray-400 hover:border-gray-300'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="submit" disabled={savingService} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-all">
                    <Save className="w-4 h-4" />
                    {savingService ? 'Menyimpan...' : 'Simpan'}
                  </button>
                  <button type="button" onClick={() => setEditingService(null)} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all">
                    Batal
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
}
