import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  FileText, 
  Settings, 
  Plus, 
  Search, 
  AlertTriangle, 
  TrendingUp, 
  DollarSign, 
  Download, 
  Printer, 
  Trash2, 
  Edit,
  CheckCircle2,
  X,
  Users,
  LogOut,
  Lock,
  Mail
} from 'lucide-react';

// --- MOCK DATA FOR INITIAL LOAD ---
const initialProducts = [];

const initialSales = [];

const initialUsers = [
  { id: 'USR-001', name: 'Ajay', email: 'ajay', role: 'Owner', password: 'ajay@123' },
  { id: 'USR-002', name: 'Yuvraj', email: 'yuvraj', role: 'Manager', password: 'yuvraj@321' },
];

// --- LOCAL STORAGE (PERSIST DATA ON REFRESH) ---
const STORAGE_KEYS = {
  products: 'pe_products_v1',
  sales: 'pe_sales_v1',
  users: 'pe_users_v1',
};

function loadJsonFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJsonToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Ignore quota / privacy mode errors; app will still work in-memory.
    console.warn('Failed to save to localStorage:', key, e);
  }
}

// --- GOOGLE SHEETS (OPTIONAL SYNC) ---
// Uses Google Apps Script Web App endpoint. Configure in `.env` (see `.env.example`).
const SHEET_SYNC_ENABLED = String(import.meta.env.VITE_GOOGLE_SHEETS_SYNC_ENABLED || '') === 'true';
const SHEET_SYNC_URL = String(import.meta.env.VITE_GOOGLE_SHEETS_WEBAPP_URL || '').trim();

async function syncToGoogleSheet(payload) {
  if (!SHEET_SYNC_ENABLED || !SHEET_SYNC_URL) return { skipped: true };

  const body = JSON.stringify(payload);

  // Best-effort: Apps Script Web Apps commonly have CORS limitations.
  // 1) Try normal CORS request (lets us read response if allowed).
  // 2) If blocked, fallback to `no-cors` (fire-and-forget).
  try {
    const res = await fetch(SHEET_SYNC_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* ignore */ }

    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || text || `Request failed (${res.status})`;
      throw new Error(msg);
    }

    return data || { ok: true };
  } catch (err) {
    // Fallback: no-cors avoids browser CORS blocking but response is opaque.
    await fetch(SHEET_SYNC_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body,
    });
    return { ok: true, opaque: true, fallback: true };
  }
}

// --- MAIN APP COMPONENT ---
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // State (Simulating Database)
  const [products, setProducts] = useState(() => loadJsonFromStorage(STORAGE_KEYS.products, initialProducts));
  const [sales, setSales] = useState(() => loadJsonFromStorage(STORAGE_KEYS.sales, initialSales));
  const [users, setUsers] = useState(() => loadJsonFromStorage(STORAGE_KEYS.users, initialUsers));
  
  // Notification Toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Persist data for lifetime (until browser storage cleared)
  useEffect(() => {
    saveJsonToStorage(STORAGE_KEYS.products, products);
  }, [products]);

  useEffect(() => {
    saveJsonToStorage(STORAGE_KEYS.sales, sales);
  }, [sales]);

  useEffect(() => {
    saveJsonToStorage(STORAGE_KEYS.users, users);
  }, [users]);

  // If not logged in, show login screen
  if (!currentUser) {
    return <LoginScreen users={users} onLogin={setCurrentUser} />;
  }

  const userRole = currentUser.role;

  // --- DASHBOARD CALCULATIONS ---
  const totalProducts = products.length;
  const currentStockValue = products.reduce((acc, p) => acc + (p.stock * p.purchasePrice), 0);
  
  const today = new Date().toISOString().split('T')[0];
  const todaySales = sales
    .filter(s => s.date.startsWith(today))
    .reduce((acc, s) => acc + s.grandTotal, 0);
    
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyRevenue = sales
    .filter(s => s.date.startsWith(currentMonth))
    .reduce((acc, s) => acc + s.grandTotal, 0);

  const lowStockProducts = products.filter(p => p.stock <= p.reorderLevel);
  const recentSales = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  // Render Logic
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard 
          metrics={{totalProducts, currentStockValue, todaySales, monthlyRevenue}} 
          lowStockProducts={lowStockProducts} 
          recentSales={recentSales} 
          sales={sales}
        />;
      case 'products':
        return <ProductsManager products={products} setProducts={setProducts} showToast={showToast} role={userRole} />;
      case 'sales':
        return <SalesManager products={products} setProducts={setProducts} sales={sales} setSales={setSales} showToast={showToast} />;
      case 'reports':
        return <ReportsManager sales={sales} products={products} setSales={setSales} setProducts={setProducts} showToast={showToast} role={userRole} />;
      case 'users':
        return userRole === 'Owner' ? <UsersManager users={users} setUsers={setUsers} showToast={showToast} /> : <Dashboard metrics={{totalProducts, currentStockValue, todaySales, monthlyRevenue}} lowStockProducts={lowStockProducts} recentSales={recentSales} sales={sales} />;
      default:
        return <Dashboard metrics={{totalProducts, currentStockValue, todaySales, monthlyRevenue}} lowStockProducts={lowStockProducts} recentSales={recentSales} sales={sales} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      {/* Sidebar - Hidden on print */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col print:hidden">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="text-indigo-400" />
            Pradeep Electronics
          </h1>
          <p className="text-xs text-slate-500 mt-1">Inventory Management</p>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <NavItem icon={<LayoutDashboard />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<Package />} label="Products" active={activeTab === 'products'} onClick={() => setActiveTab('products')} />
          <NavItem icon={<ShoppingCart />} label="Sales Entry" active={activeTab === 'sales'} onClick={() => setActiveTab('sales')} />
          <NavItem icon={<FileText />} label="Reports" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
          {userRole === 'Owner' && (
            <NavItem icon={<Users />} label="Users" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center justify-between px-2 py-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
                {currentUser.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm text-white font-medium truncate max-w-[120px]">{currentUser.name}</p>
                <p className="text-xs text-indigo-300">{currentUser.role}</p>
              </div>
            </div>
            <button 
              onClick={() => setCurrentUser(null)}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative">
        {renderContent()}

        {/* Toast Notification */}
        {toast && (
          <div className={`fixed bottom-4 right-4 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white print:hidden transition-all transform translate-y-0 opacity-100 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            <span className="font-medium">{toast.message}</span>
          </div>
        )}
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        active ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'
      }`}
    >
      {React.cloneElement(icon, { size: 20 })}
      <span className="font-medium">{label}</span>
    </button>
  );
}

// --- DASHBOARD COMPONENT ---
function Dashboard({ metrics, lowStockProducts, recentSales, sales }) {
  // Simple Bar Chart Data Prep (Last 7 Days)
  const last7Days = Array.from({length: 7}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const chartData = last7Days.map(date => {
    const daySales = sales.filter(s => s.date.startsWith(date)).reduce((acc, s) => acc + s.grandTotal, 0);
    return { date: date.slice(5), total: daySales };
  });
  
  const maxChartVal = Math.max(...chartData.map(d => d.total), 1000); // min 1000 for scale

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Dashboard Summary</h2>
      
      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Products" value={metrics.totalProducts} icon={<Package />} color="bg-blue-500" />
        <StatCard title="Current Stock Value" value={`₹${metrics.currentStockValue.toLocaleString()}`} icon={<DollarSign />} color="bg-emerald-500" />
        <StatCard title="Today's Sales" value={`₹${metrics.todaySales.toLocaleString()}`} icon={<TrendingUp />} color="bg-indigo-500" />
        <StatCard title="Monthly Revenue" value={`₹${metrics.monthlyRevenue.toLocaleString()}`} icon={<CheckCircle2 />} color="bg-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Low Stock Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-1">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
              <AlertTriangle className="text-rose-500" size={20}/> Low Stock Alerts
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="pb-2 font-medium">Product</th>
                  <th className="pb-2 font-medium">Stock</th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.length === 0 ? (
                  <tr><td colSpan="2" className="py-4 text-center text-slate-500">Stock is healthy!</td></tr>
                ) : lowStockProducts.map(p => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 text-slate-800 font-medium truncate max-w-[150px]">{p.name}</td>
                    <td className="py-3">
                      <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-md font-bold">
                        {p.stock} {p.unit}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Sales & Chart */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Sales Last 7 Days</h3>
            <div className="h-48 flex items-end gap-2 justify-between">
              {chartData.map((d, idx) => {
                const height = (d.total / maxChartVal) * 100;
                return (
                  <div key={idx} className="flex flex-col items-center flex-1 group">
                    <div className="w-full relative flex justify-center h-40 items-end">
                      {/* Tooltip */}
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-slate-800 text-white text-xs py-1 px-2 rounded transition-opacity whitespace-nowrap z-10">
                        ₹{d.total.toLocaleString()}
                      </div>
                      <div 
                        className="w-full max-w-[40px] bg-indigo-500 rounded-t-md transition-all duration-500 hover:bg-indigo-600" 
                        style={{ height: `${Math.max(height, 2)}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-slate-500 mt-2">{d.date}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Sales */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Recent Sales</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-slate-500 bg-slate-50 border-y border-slate-200">
                  <tr>
                    <th className="py-3 px-4 font-medium">Invoice ID</th>
                    <th className="py-3 px-4 font-medium">Customer</th>
                    <th className="py-3 px-4 font-medium">Items</th>
                    <th className="py-3 px-4 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map(s => (
                    <tr key={s.id} className="border-b border-slate-100">
                      <td className="py-3 px-4 font-medium text-indigo-600">{s.id}</td>
                      <td className="py-3 px-4">{s.customerName}</td>
                      <td className="py-3 px-4">{s.items.length} items</td>
                      <td className="py-3 px-4 text-right font-bold">₹{s.grandTotal.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center gap-4">
      <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white ${color}`}>
        {React.cloneElement(icon, { size: 28 })}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <h4 className="text-2xl font-bold text-slate-800">{value}</h4>
      </div>
    </div>
  );
}


// --- PRODUCTS MANAGER COMPONENT ---
function ProductsManager({ products, setProducts, showToast, role }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const emptyForm = { name: '', category: '', brand: '', unit: 'Piece', purchasePrice: 0, sellingPrice: 0, gst: 18, stock: 0, reorderLevel: 10, hsn: '' };
  const [formData, setFormData] = useState(emptyForm);

  const filteredProducts = products.filter(p => 
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.brand || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categoryOptions = Array.from(
    new Set(
      products
        .map(p => (p.category || '').trim())
        .filter(Boolean)
    )
  );

  const unitOptions = Array.from(
    new Set(
      products
        .map(p => (p.unit || '').trim())
        .filter(Boolean)
    )
  );

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setFormData(product);
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    if(confirm('Are you sure you want to delete this product?')) {
      setProducts(products.filter(p => p.id !== id));
      showToast('Product deleted from inventory', 'success');
      syncToGoogleSheet({
        type: 'product',
        action: 'delete',
        at: new Date().toISOString(),
        productId: id,
      }).catch(() => showToast('Google Sheet sync failed (product delete)', 'error'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let syncPayload = null;
    if (editingProduct) {
      const updated = { ...formData, id: editingProduct.id };
      setProducts(products.map(p => p.id === editingProduct.id ? updated : p));
      showToast('Product updated successfully');
      syncPayload = { type: 'product', action: 'update', at: new Date().toISOString(), product: updated };
    } else {
      const maxNum = products.reduce((max, p) => {
        const num = parseInt(p.id.replace(/\D/g, ''), 10);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);
      const newId = `PRD-${String(maxNum + 1).padStart(3, '0')}`;
      const created = { ...formData, id: newId };
      setProducts([created, ...products]);
      showToast('New product added to inventory');
      syncPayload = { type: 'product', action: 'create', at: new Date().toISOString(), product: created };
    }
    setIsModalOpen(false);

    if (syncPayload) {
      try {
        await syncToGoogleSheet(syncPayload);
      } catch {
        showToast('Google Sheet sync failed (product save)', 'error');
      }
    }
  };

  return (
    <div className="p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Inventory Management</h2>
          <p className="text-slate-500">Manage your electrical items, pricing, and stock levels.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search products..." 
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {role !== 'Sales' && (
            <button 
              onClick={openAddModal}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Plus size={18} /> Add Product
            </button>
          )}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">Product ID</th>
                <th className="py-3 px-4 font-semibold">Name & Details</th>
                <th className="py-3 px-4 font-semibold">Unit</th>
                <th className="py-3 px-4 font-semibold text-right">Selling Price</th>
                <th className="py-3 px-4 font-semibold text-right">GST %</th>
                <th className="py-3 px-4 font-semibold text-center">Stock</th>
                {role !== 'Sales' && <th className="py-3 px-4 font-semibold text-center">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 text-slate-500 font-medium">{p.id}</td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-800">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.brand} | HSN: {p.hsn}</div>
                  </td>
                  <td className="py-3 px-4">{p.unit}</td>
                  <td className="py-3 px-4 text-right font-medium text-slate-800">₹{p.sellingPrice}</td>
                  <td className="py-3 px-4 text-right">{p.gst}%</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${p.stock <= p.reorderLevel ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {p.stock}
                    </span>
                  </td>
                  {role !== 'Sales' && (
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEditModal(p)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50"><Edit size={16}/></button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50"><Trash2 size={16}/></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={role !== 'Sales' ? 7 : 6} className="py-8 text-center text-slate-500">No products found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800">{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label>
                  <input required type="text" className="w-full p-2 border border-slate-300 rounded-lg" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Brand</label>
                  <input type="text" className="w-full p-2 border border-slate-300 rounded-lg" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <input
                    list="category-options"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g. Wire, Switches, Lighting"
                  />
                  <datalist id="category-options">
                    {categoryOptions.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unit of Measurement</label>
                  <input
                    list="unit-options"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="e.g. Piece, Box, Roll, Meter"
                  />
                  <datalist id="unit-options">
                    {unitOptions.map(u => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Purchase Price (₹)</label>
                  <input required type="number" step="0.01" className="w-full p-2 border border-slate-300 rounded-lg" value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: parseFloat(e.target.value) || 0})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Selling Price (₹)</label>
                  <input required type="number" step="0.01" className="w-full p-2 border border-slate-300 rounded-lg" value={formData.sellingPrice} onChange={e => setFormData({...formData, sellingPrice: parseFloat(e.target.value) || 0})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">GST %</label>
                  <select className="w-full p-2 border border-slate-300 rounded-lg" value={formData.gst} onChange={e => setFormData({...formData, gst: parseFloat(e.target.value)})}>
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">HSN Code</label>
                  <input type="text" className="w-full p-2 border border-slate-300 rounded-lg" value={formData.hsn} onChange={e => setFormData({...formData, hsn: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Opening Stock</label>
                  <input required type="number" className="w-full p-2 border border-slate-300 rounded-lg" value={formData.stock} onChange={e => setFormData({...formData, stock: parseInt(e.target.value) || 0})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Reorder Level Alert</label>
                  <input required type="number" className="w-full p-2 border border-slate-300 rounded-lg" value={formData.reorderLevel} onChange={e => setFormData({...formData, reorderLevel: parseInt(e.target.value) || 0})} />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center gap-2">
                  <Package size={18}/> {editingProduct ? 'Update Product' : 'Save to Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- SALES MANAGER (POS) COMPONENT ---
const SHOP_NAME = 'Pradeep Electronics';

function SalesManager({ products, setProducts, sales, setSales, showToast }) {
  const [customerName, setCustomerName] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [cart, setCart] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [qty, setQty] = useState(1);
  const [includeGst, setIncludeGst] = useState(true);
  const [gstAmount, setGstAmount] = useState(0);
  const [gstManuallyEdited, setGstManuallyEdited] = useState(false);
  const [discountMode, setDiscountMode] = useState('percent'); // 'percent' | 'amount'
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [lastCompletedSale, setLastCompletedSale] = useState(null);

  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Auto-fill GST when items added (if not manually edited)
  useEffect(() => {
    if (includeGst && !gstManuallyEdited) {
      const calc = cart.reduce((acc, item) => acc + (item.total * (item.gst / 100)), 0);
      setGstAmount(calc);
    }
  }, [cart, includeGst, gstManuallyEdited]);

  // Keep discount ₹ and discount % in sync
  const subtotal = cart.reduce((acc, item) => acc + item.total, 0);
  useEffect(() => {
    if (discountMode !== 'percent') return;
    const p = parseFloat(discountPercent);
    if (isNaN(p) || subtotal <= 0) {
      setDiscountAmount('');
      return;
    }
    const amt = subtotal * (p / 100);
    setDiscountAmount(amt ? amt.toFixed(2) : '');
  }, [subtotal, discountMode, discountPercent]);

  useEffect(() => {
    if (discountMode !== 'amount') return;
    const amt = parseFloat(discountAmount);
    if (isNaN(amt) || subtotal <= 0) {
      setDiscountPercent('');
      return;
    }
    const p = (amt / subtotal) * 100;
    setDiscountPercent(p ? p.toFixed(2) : '');
  }, [subtotal, discountMode, discountAmount]);

  const addToCart = () => {
    if (!selectedProduct) return;
    if (qty <= 0) {
      showToast('Quantity must be greater than 0', 'error');
      return;
    }
    if (qty > selectedProduct.stock) {
      showToast(`Only ${selectedProduct.stock} ${selectedProduct.unit} available in stock!`, 'error');
      return;
    }

    const existingItemIndex = cart.findIndex(item => item.productId === selectedProduct.id);
    const itemTotal = selectedProduct.sellingPrice * qty;

    if (existingItemIndex >= 0) {
      const updatedCart = [...cart];
      const newQty = updatedCart[existingItemIndex].qty + qty;
      if(newQty > selectedProduct.stock) {
        showToast('Cannot exceed available stock', 'error');
        return;
      }
      updatedCart[existingItemIndex].qty = newQty;
      updatedCart[existingItemIndex].total = selectedProduct.sellingPrice * newQty;
      setCart(updatedCart);
    } else {
      setCart([...cart, {
        productId: selectedProduct.id,
        name: selectedProduct.name,
        unit: selectedProduct.unit,
        price: selectedProduct.sellingPrice,
        gst: selectedProduct.gst,
        qty: qty,
        total: itemTotal
      }]);
    }
    
    // Reset inputs
    setSelectedProductId('');
    setQty(1);
  };

  const removeFromCart = (index) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  // Calculations
  const calculatedGst = cart.reduce((acc, item) => acc + (item.total * (item.gst / 100)), 0);
  const gstTotal = includeGst ? gstAmount : 0;
  const discountPercentNum = Math.max(0, parseFloat(discountPercent) || 0);
  const discountAmountNum = Math.max(0, parseFloat(discountAmount) || 0);
  const discountTotal = discountMode === 'percent' ? (subtotal * (discountPercentNum / 100)) : discountAmountNum;
  const grandTotal = subtotal - discountTotal + gstTotal;

  const processSale = () => {
    if (cart.length === 0) {
      showToast('Cart is empty', 'error');
      return;
    }

    // Deduct stock
    const updatedProducts = products.map(p => {
      const cartItem = cart.find(c => c.productId === p.id);
      if (cartItem) {
        return { ...p, stock: p.stock - cartItem.qty };
      }
      return p;
    });

    // Create Sale Record (ensure unique ID even after deletions)
    const maxInvNum = sales.reduce((max, s) => {
      const num = parseInt(s.id.replace(/\D/g, ''), 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 1000);
    const newSale = {
      id: `INV-${maxInvNum + 1}`,
      date: new Date().toISOString(),
      customerName: customerName || 'Cash Sale',
      paymentMode,
      items: cart,
      subtotal,
      discountMode,
      discountPercent: subtotal > 0 ? (discountTotal / subtotal) * 100 : 0,
      discountTotal,
      includeGst,
      gstPercent: includeGst && subtotal > 0 ? (gstTotal / subtotal) * 100 : 0,
      gstTotal,
      grandTotal
    };

    setProducts(updatedProducts);
    setSales([newSale, ...sales]);
    setLastCompletedSale(newSale);
    showToast('Sale completed successfully! Stock updated.');

    syncToGoogleSheet({
      type: 'sale',
      action: 'create',
      at: new Date().toISOString(),
      sale: newSale,
    }).catch(() => showToast('Google Sheet sync failed (sale)', 'error'));
    
    // Reset Form
    setCart([]);
    setCustomerName('');
    setPaymentMode('Cash');
    setGstAmount(0);
    setGstManuallyEdited(false);
    setDiscountMode('percent');
    setDiscountPercent('');
    setDiscountAmount('');
  };

  const printBill = () => {
    if (!lastCompletedSale) return;
    const printWindow = window.open('', '_blank');
    const s = lastCompletedSale;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bill - ${s.id}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 24px; max-width: 600px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 20px; }
            .shop-name { font-size: 24px; font-weight: bold; margin: 0; }
            .invoice-id { font-size: 14px; color: #666; margin-top: 8px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
            th { background: #f5f5f5; }
            .text-right { text-align: right; }
            .totals { margin-top: 20px; text-align: right; }
            .totals p { margin: 4px 0; }
            .grand-total { font-size: 18px; font-weight: bold; margin-top: 12px; }
            @media print { body { padding: 0; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="shop-name">${SHOP_NAME}</h1>
            <p class="invoice-id">Invoice: ${s.id} | Date: ${new Date(s.date).toLocaleString()}</p>
            <p style="margin: 4px 0; font-size: 12px;">Customer: ${s.customerName} | Payment: ${s.paymentMode}</p>
          </div>
          <table>
            <thead>
              <tr><th>Item</th><th class="text-right">Qty</th><th class="text-right">Price</th><th class="text-right">Amount</th></tr>
            </thead>
            <tbody>
              ${s.items.map(i => `<tr><td>${i.name}</td><td class="text-right">${i.qty} ${i.unit}</td><td class="text-right">₹${i.price}</td><td class="text-right">₹${(i.total).toFixed(2)}</td></tr>`).join('')}
            </tbody>
          </table>
          <div class="totals">
            <p>Subtotal: ₹${s.subtotal.toFixed(2)}</p>
            ${(s.discountTotal || 0) > 0 ? `<p>Discount: -₹${(s.discountTotal || 0).toFixed(2)}</p>` : ''}
            ${(s.gstTotal || 0) > 0 ? `<p>GST: ₹${s.gstTotal.toFixed(2)}</p>` : ''}
            <p class="grand-total">Grand Total: ₹${s.grandTotal.toFixed(2)}</p>
          </div>
          <p style="margin-top: 30px; text-align: center; font-size: 12px; color: #666;">Thank you for your business!</p>
          <div class="no-print" style="margin-top: 24px; text-align: center;">
            <button onclick="window.print()" style="padding: 10px 24px; background: #4f46e5; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">Print / Save PDF</button>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">New Sale Entry (POS)</h2>
        <p className="text-slate-500">Create invoices and automatically deduct stock.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Col - Product Selection */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Add Items to Invoice</h3>
            
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Product</label>
                <select 
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                >
                  <option value="">-- Choose Product --</option>
                  {products.filter(p => p.stock > 0).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock: {p.stock} {p.unit}) - ₹{p.sellingPrice}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full md:w-32">
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                <div className="relative">
                  <input 
                    type="number" 
                    min="1"
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  {selectedProduct && <span className="absolute right-8 top-3 text-xs text-slate-400">{selectedProduct.unit}</span>}
                </div>
              </div>
              <button 
                onClick={addToCart}
                disabled={!selectedProductId}
                className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-6 py-2.5 rounded-lg font-medium transition-colors flex justify-center items-center gap-2"
              >
                <Plus size={18}/> Add
              </button>
            </div>
          </div>

          {/* Cart Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[300px]">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Product</th>
                  <th className="py-3 px-4 font-semibold text-center">Qty</th>
                  <th className="py-3 px-4 font-semibold text-right">Price</th>
                  <th className="py-3 px-4 font-semibold text-right">GST</th>
                  <th className="py-3 px-4 font-semibold text-right">Total</th>
                  <th className="py-3 px-4 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 ? (
                  <tr><td colSpan="6" className="py-12 text-center text-slate-400">No items added to the invoice yet.</td></tr>
                ) : (
                  cart.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-100">
                      <td className="py-3 px-4 font-medium text-slate-800">{item.name}</td>
                      <td className="py-3 px-4 text-center">{item.qty} <span className="text-xs text-slate-500">{item.unit}</span></td>
                      <td className="py-3 px-4 text-right">₹{item.price}</td>
                      <td className="py-3 px-4 text-right">{item.gst}%</td>
                      <td className="py-3 px-4 text-right font-medium">₹{item.total}</td>
                      <td className="py-3 px-4 text-center">
                        <button onClick={() => removeFromCart(idx)} className="text-rose-500 hover:text-rose-700 p-1"><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col - Checkout Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-fit sticky top-8">
          <h3 className="text-lg font-bold text-slate-800 mb-6 border-b pb-2">Invoice Summary</h3>
          
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name (Optional)</label>
              <input 
                type="text" 
                placeholder="Walk-in Customer"
                className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode</label>
              <select 
                className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI / GPay</option>
                <option value="Card">Credit/Debit Card</option>
                <option value="Credit">Store Credit (Khata)</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="includeGst" 
                checked={includeGst} 
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIncludeGst(checked);
                  setGstManuallyEdited(false);
                  if (checked) setGstAmount(cart.reduce((acc, item) => acc + (item.total * (item.gst / 100)), 0));
                  else setGstAmount(0);
                }}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="includeGst" className="text-sm font-medium text-slate-700">Include GST in bill</label>
            </div>
            {includeGst && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">GST (%)</label>
                  <input
                    type="number"
                    className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-700"
                    value={subtotal > 0 ? ((gstTotal / subtotal) * 100).toFixed(2) : '0.00'}
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">GST Amount (₹)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    placeholder={`Suggested: ₹${calculatedGst.toFixed(2)}`}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
                    value={gstAmount || ''}
                    onChange={(e) => { setGstManuallyEdited(true); setGstAmount(parseFloat(e.target.value) || 0); }}
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Discount (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
                  value={discountPercent}
                  onChange={(e) => { setDiscountMode('percent'); setDiscountPercent(e.target.value); }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Discount Amount (₹)</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  placeholder="0"
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
                  value={discountAmount}
                  onChange={(e) => { setDiscountMode('amount'); setDiscountAmount(e.target.value); }}
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg space-y-3 mb-6">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            {discountTotal > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Discount</span>
                <span>-₹{discountTotal.toFixed(2)}</span>
              </div>
            )}
            {includeGst && gstTotal > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>GST</span>
                <span>₹{gstTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
              <span className="font-bold text-slate-800 text-lg">Grand Total</span>
              <span className="font-bold text-indigo-700 text-2xl">₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <button 
            onClick={processSale}
            disabled={cart.length === 0}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white py-3 rounded-lg font-bold text-lg transition-colors flex justify-center items-center gap-2 shadow-sm"
          >
            <CheckCircle2 size={24} /> Complete Sale
          </button>

          {lastCompletedSale && (
            <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
              <p className="text-sm text-emerald-600 font-medium">Bill {lastCompletedSale.id} saved!</p>
              <div className="flex gap-2">
                <button 
                  onClick={printBill}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                >
                  <Printer size={18} /> Download / Print Bill
                </button>
                <button 
                  onClick={() => setLastCompletedSale(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                >
                  New Sale
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// --- REPORTS MANAGER COMPONENT (Handles PDF/Excel Simulation + Sale deletion) ---
function ReportsManager({ sales, products, setSales, setProducts, showToast, role }) {
  const [reportType, setReportType] = useState('daily');
  
  // Filter sales based on selected range
  const filteredSales = useMemo(() => {
    const today = new Date();
    return sales.filter(s => {
      const saleDate = new Date(s.date);
      if (reportType === 'daily') {
        return saleDate.toDateString() === today.toDateString();
      } else if (reportType === 'weekly') {
        const weekAgo = new Date();
        weekAgo.setDate(today.getDate() - 7);
        return saleDate >= weekAgo;
      } else if (reportType === 'monthly') {
        return saleDate.getMonth() === today.getMonth() && saleDate.getFullYear() === today.getFullYear();
      }
      return true;
    });
  }, [sales, reportType]);

  const reportTotal = filteredSales.reduce((acc, s) => acc + s.grandTotal, 0);
  const reportGst = filteredSales.reduce((acc, s) => acc + s.gstTotal, 0);

  const canModifySales = role !== 'Sales';

  const handleDeleteSale = (saleId) => {
    if (!canModifySales) return;
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;

    if (!confirm(`Delete invoice ${sale.id}? This will restore stock for all its items.`)) return;

    // Restore stock for each item in the sale
    const updatedProducts = products.map(p => {
      const saleItem = (sale.items || []).find(i => i.productId === p.id);
      if (!saleItem) return p;
      return { ...p, stock: (p.stock || 0) + (saleItem.qty || 0) };
    });

    const updatedSales = sales.filter(s => s.id !== saleId);

    setProducts(updatedProducts);
    setSales(updatedSales);
    showToast(`Invoice ${sale.id} deleted and stock restored.`, 'success');

    syncToGoogleSheet({
      type: 'sale',
      action: 'delete',
      at: new Date().toISOString(),
      saleId,
      sale,
    }).catch(() => showToast('Google Sheet sync failed (sale delete)', 'error'));
  };

  // --- Export Functions ---
  const handlePrintPDF = () => {
    window.print(); // Uses CSS media queries to style the print view
  };

  const handleExportCSV = () => {
    // Generate simple CSV
    let csvContent = "data:text/csv;charset=utf-8,";
    // Header
    csvContent += "Invoice ID,Date,Customer,Payment Mode,Subtotal,Discount,GST,Grand Total\n";
    filteredSales.forEach(s => {
      const dateStr = new Date(s.date).toLocaleDateString();
      const discount = s.discountTotal || 0;
      csvContent += `${s.id},${dateStr},${s.customerName},${s.paymentMode},${s.subtotal.toFixed(2)},${discount.toFixed(2)},${(s.gstTotal || 0).toFixed(2)},${s.grandTotal.toFixed(2)}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Sales_Report_${reportType}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 print:p-0">
      {/* Controls - Hidden on Print */}
      <div className="print:hidden mb-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Business Reports</h2>
        
        <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 gap-4">
          <div className="flex gap-2 w-full sm:w-auto">
            {['daily', 'weekly', 'monthly', 'all'].map(type => (
              <button
                key={type}
                onClick={() => setReportType(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${reportType === type ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {type}
              </button>
            ))}
          </div>
          
          <div className="flex gap-3 w-full sm:w-auto">
            <button onClick={handleExportCSV} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors">
              <Download size={18}/> Excel (CSV)
            </button>
            <button onClick={handlePrintPDF} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors">
              <Printer size={18}/> Print / PDF
            </button>
          </div>
        </div>
      </div>

      {/* Report Content - This gets printed */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 print:shadow-none print:border-none print:p-0">
        
        {/* Print Header */}
        <div className="text-center mb-8 border-b border-slate-200 pb-6 print:block">
          <h1 className="text-3xl font-bold text-slate-800 flex justify-center items-center gap-2 mb-2">
            <Package className="text-indigo-600" size={32} /> Pradeep Electronics
          </h1>
          <p className="text-slate-500">| Phone: +91 98765 43210</p>
          <h2 className="text-xl font-bold text-slate-700 mt-6 capitalize">{reportType} Sales Report</h2>
          <p className="text-sm text-slate-500 mt-1">Generated on: {new Date().toLocaleString()}</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-center">
            <p className="text-sm text-slate-500 mb-1">Total Invoices</p>
            <p className="text-2xl font-bold text-slate-800">{filteredSales.length}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-center">
            <p className="text-sm text-slate-500 mb-1">Total GST Collected</p>
            <p className="text-2xl font-bold text-slate-800">₹{reportGst.toFixed(2)}</p>
          </div>
          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 text-center">
            <p className="text-sm text-indigo-600 mb-1">Net Revenue</p>
            <p className="text-2xl font-bold text-indigo-700">₹{reportTotal.toFixed(2)}</p>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="py-3 px-4 font-semibold">Invoice ID</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Customer</th>
                <th className="py-3 px-4 font-semibold">Payment</th>
                <th className="py-3 px-4 font-semibold text-right">GST</th>
                <th className="py-3 px-4 font-semibold text-right">Total Amount</th>
                {canModifySales && <th className="py-3 px-4 font-semibold text-center print:hidden">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr><td colSpan={canModifySales ? 7 : 6} className="py-8 text-center text-slate-500">No sales data found for the selected period.</td></tr>
              ) : (
                filteredSales.map(s => (
              <tr key={s.id} className="border-b border-slate-100">
                    <td className="py-3 px-4 font-medium text-slate-800">{s.id}</td>
                    <td className="py-3 px-4 text-slate-600">{new Date(s.date).toLocaleDateString()}</td>
                    <td className="py-3 px-4">{s.customerName}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${s.paymentMode === 'Cash' ? 'bg-amber-100 text-amber-700' : s.paymentMode === 'Credit' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {s.paymentMode}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500">₹{s.gstTotal.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-800">₹{s.grandTotal.toFixed(2)}</td>
                    {canModifySales && (
                      <td className="py-3 px-4 text-center print:hidden">
                        <button
                          type="button"
                          onClick={() => handleDeleteSale(s.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="mt-12 text-center text-xs text-slate-400 print:block hidden">
          --- End of Report ---
        </div>
      </div>
    </div>
  );
}

// --- USERS MANAGER COMPONENT ---
function UsersManager({ users, setUsers, showToast }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const emptyForm = { name: '', email: '', role: 'Sales', password: '' };
  const [formData, setFormData] = useState(emptyForm);

  const filteredUsers = users.filter(u => 
    (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.role || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openAddModal = () => {
    setEditingUser(null);
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({ ...user, password: '' }); // Don't pre-fill password for editing in MVP
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    if(confirm('Are you sure you want to remove this user?')) {
      setUsers(users.filter(u => u.id !== id));
      showToast('User removed successfully', 'success');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingUser) {
      const updatedUser = { ...formData, id: editingUser.id };
      if (!formData.password?.trim()) updatedUser.password = editingUser.password;
      setUsers(users.map(u => u.id === editingUser.id ? updatedUser : u));
      showToast('User details updated successfully');
    } else {
      const maxNum = users.reduce((max, u) => {
        const num = parseInt(u.id.replace(/\D/g, ''), 10);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);
      const newId = `USR-${String(maxNum + 1).padStart(3, '0')}`;
      setUsers([{ ...formData, id: newId }, ...users]);
      showToast('New user added successfully');
    }
    setIsModalOpen(false);
  };

  return (
    <div className="p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">User Management</h2>
          <p className="text-slate-500">Manage staff access and roles for the inventory system.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search users..." 
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={openAddModal}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus size={18} /> Add User
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">User ID</th>
                <th className="py-3 px-4 font-semibold">Name</th>
                <th className="py-3 px-4 font-semibold">Email</th>
                <th className="py-3 px-4 font-semibold">System Role</th>
                <th className="py-3 px-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 text-slate-500 font-medium">{u.id}</td>
                  <td className="py-3 px-4 font-bold text-slate-800">{u.name}</td>
                  <td className="py-3 px-4 text-slate-600">{u.email}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      u.role === 'Owner' ? 'bg-indigo-100 text-indigo-700' : 
                      u.role === 'Manager' ? 'bg-amber-100 text-amber-700' : 
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openEditModal(u)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50"><Edit size={16}/></button>
                      <button onClick={() => handleDelete(u.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50" disabled={u.role === 'Owner'}><Trash2 size={16}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800">{editingUser ? 'Edit User' : 'Add New User'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <input required type="text" className="w-full p-2 border border-slate-300 rounded-lg" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                  <input required type="email" className="w-full p-2 border border-slate-300 rounded-lg" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">System Role</label>
                  <select className="w-full p-2 border border-slate-300 rounded-lg" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                    <option value="Sales">Sales Staff (Add sales only)</option>
                    <option value="Manager">Store Manager (Manage stock & sales)</option>
                    <option value="Owner">Owner (Full access)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password {editingUser && '(Leave blank to keep current)'}</label>
                  <input type="password" required={!editingUser} className="w-full p-2 border border-slate-300 rounded-lg" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center gap-2">
                  <Users size={18}/> {editingUser ? 'Update User' : 'Add User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- LOGIN SCREEN COMPONENT ---
function LoginScreen({ users, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');

    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    
    if (user) {
      onLogin(user);
    } else {
      setError('Invalid email or password. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 overflow-hidden relative">
      <style>
        {`
          @keyframes slideUpFade {
            from { opacity: 0; transform: translateY(40px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes floatBox {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
            100% { transform: translateY(0px); }
          }
          @keyframes slideInLeft {
            0% { transform: translateX(-150%); opacity: 0; }
            100% { transform: translateX(0); opacity: 1; }
          }
          @keyframes popSpeechBubble {
            0% { opacity: 0; transform: scale(0.3) translateY(20px) rotate(15deg); }
            70% { transform: scale(1.1) translateY(-5px) rotate(-5deg); }
            100% { opacity: 1; transform: scale(1) translateY(0) rotate(0); }
          }
          .animate-slide-up {
            animation: slideUpFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
          }
          .animate-float {
            animation: floatBox 4s ease-in-out infinite;
          }
          .animate-walk-in {
            animation: slideInLeft 0.8s cubic-bezier(0.25, 1, 0.5, 1) both;
            animation-delay: 0.4s;
          }
          .animate-speech-bubble {
            animation: popSpeechBubble 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
            transform-origin: bottom left;
            animation-delay: 1.2s;
          }
          .delay-100 { animation-delay: 100ms; }
          .delay-200 { animation-delay: 200ms; }
        `}
      </style>

      {/* Background decorative blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-float pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-float delay-200 pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-slide-up">
        <div className="flex justify-center text-indigo-600 mb-4 animate-float">
          <Package size={56} className="drop-shadow-lg" />
        </div>
        <h2 className="mt-2 text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          Pradeep Electronics
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600 font-medium">
          Inventory & POS Management System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-slide-up delay-100">
        <div className="bg-white/80 backdrop-blur-xl py-8 px-4 shadow-2xl border border-white/50 sm:rounded-2xl sm:px-10">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm flex items-center gap-2 animate-slide-up">
                <AlertTriangle size={16} /> {error}
              </div>
            )}

            <div className="group">
              <label className="block text-sm font-medium text-slate-700 transition-colors group-focus-within:text-indigo-600">User ID</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
                </div>
                <input
                  type="text"
                  required
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 py-3 sm:text-sm border-slate-300 rounded-lg border transition-all duration-200"
                  placeholder="ajay / yuvraj"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="group">
              <label className="block text-sm font-medium text-slate-700 transition-colors group-focus-within:text-indigo-600">Password</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
                </div>
                <input
                  type="password"
                  required
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 py-3 sm:text-sm border-slate-300 rounded-lg border transition-all duration-200"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
              >
                Sign In to Dashboard
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Animated Character (icon only, no extra text) */}
      <div className="fixed bottom-0 left-0 md:left-4 z-20 flex items-end animate-walk-in pointer-events-none">
        <div className="relative z-20 flex items-end" style={{ filter: 'drop-shadow(0px 10px 15px rgba(0,0,0,0.2))' }}>
          <div className="text-7xl md:text-8xl">👨‍💼</div>
        </div>
      </div>

    </div>
  );
}