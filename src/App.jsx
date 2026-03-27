import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  onSnapshot, 
  updateDoc, 
  addDoc, 
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import { 
  LayoutDashboard, 
  Package, 
  ChefHat, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  ClipboardList,
  Search,
  ArrowRightLeft,
  XCircle,
  Info,
  PlusCircle,
  MinusCircle,
  Bell,
  History,
  CalendarDays,
  CalendarX,
  Edit2,
  Lock,
  Eye,
  LogOut,
  UserCheck,
  Mail,
  Key,
  Check,
  X
} from 'lucide-react';

// --- CONFIGURAÇÃO FIREBASE (Conectado ao seu .env) ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'senai-alimentos-lab'; // Nome identificador do seu projeto

// --- PALETA DE CORES SENAI ---
const colors = {
  primary: '#004587', // Azul SENAI
  accent: '#F05023',  // Laranja SENAI
  secondary: '#003666',
  background: '#F8FAFC'
};

// --- FUNÇÕES AUXILIARES ---
const formatDisplayDate = (dateStr) => {
  if (!dateStr) return "-";
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

const formatFullDate = (isoStr) => {
  if (!isoStr) return "-";
  const date = new Date(isoStr);
  return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

// --- COMPONENTES DE INTERFACE ---
function NavButton({ active, onClick, icon, label }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-5 px-6 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all group ${
        active 
          ? 'text-white shadow-2xl' 
          : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900'
      }`}
      style={{ 
        backgroundColor: active ? colors.primary : 'transparent', 
        boxShadow: active ? `0 20px 25px -5px ${colors.primary}33` : 'none' 
      }}
    >
      {React.cloneElement(icon, { size: 20, className: active ? 'text-white' : 'text-slate-300 group-hover:text-slate-900' })}
      <span>{label}</span>
    </button>
  );
}

function StatCard({ label, value, type = "default" }) {
  const themes = {
    default: { text: 'text-slate-900', border: 'border-slate-100', bg: 'bg-white', accent: colors.primary },
    info: { text: 'text-blue-800', border: 'border-blue-50', bg: 'bg-blue-50/40', accent: '#3b82f6' },
    warning: { text: 'text-red-600', border: 'border-red-100', bg: 'bg-red-50/20', accent: colors.accent }
  };
  const theme = themes[type] || themes.default;

  return (
    <div className={`${theme.bg} p-10 rounded-[3.5rem] border shadow-sm transition-all hover:scale-[1.02] ${theme.border} group relative overflow-hidden`}>
      <div className="absolute top-0 right-0 w-3 h-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: theme.accent }}></div>
      <div className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-6">{label}</div>
      <div className={`text-6xl font-black tracking-tighter ${theme.text}`}>{String(value)}</div>
    </div>
  );
}

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [session, setSession] = useState(null); 
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [inventory, setInventory] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [showAlertDetails, setShowAlertDetails] = useState(false);
  
  const [isLoginView, setIsLoginView] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingCourse, setEditingCourse] = useState(null);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [newCourseItems, setNewCourseItems] = useState([{ itemId: '', qtyPlanned: '' }]);

  const todayStr = new Date().toISOString().split('T')[0];

  // --- SISTEMA DE LOGS ---
  const registerLog = async (action, details) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), {
        user: session?.email || session?.role || 'desconhecido',
        action,
        details,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error("Erro ao gravar log:", e);
    }
  };

  // --- FUNÇÕES DE MANIPULAÇÃO ---
  const addIngredientField = () => setNewCourseItems(prev => [...prev, { itemId: '', qtyPlanned: '' }]);
  const removeIngredientField = (index) => {
    if (newCourseItems.length > 1) setNewCourseItems(prev => prev.filter((_, i) => i !== index));
  };
  const updateIngredientField = (index, field, value) => {
    setNewCourseItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const showFeedback = (text, type = 'error') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 5000);
  };

  // --- AUTENTICAÇÃO INICIAL (Regra 3) ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          // Iniciar anonimamente por padrão para garantir permissões de leitura básica se o usuário não logar como admin
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Erro crítico na inicialização da autenticação:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      // Se já estava como viewer e agora tem user, mantém a sessão se ela já existia
      if (firebaseUser && !firebaseUser.isAnonymous) {
        setSession({ role: 'admin', email: firebaseUser.email });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const email = e.target.email.value;
    const password = e.target.password.value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      showFeedback("Login realizado com sucesso!", "success");
    } catch (error) {
      showFeedback("Falha no login: verifique suas credenciais.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewerAccess = async () => {
    setSession({ role: 'viewer' });
  };

  const handleLogout = async () => {
    await signOut(auth);
    setSession(null);
    setIsLoginView(false);
    // Reinicia como anônimo para manter permissões de leitura se necessário
    await signInAnonymously(auth);
  };

  // --- CARREGAMENTO DE DADOS (Regras 1 e 2) ---
  useEffect(() => {
    // Só inicia listeners se houver um usuário autenticado e uma sessão escolhida
    if (!user || !session) return;

    const inventoryRef = collection(db, 'artifacts', appId, 'public', 'data', 'inventory');
    const coursesRef = collection(db, 'artifacts', appId, 'public', 'data', 'courses');

    const unsubInv = onSnapshot(inventoryRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInventory(data);
    }, (error) => {
      console.error("Erro no listener de inventário:", error);
    });

    const unsubCourses = onSnapshot(coursesRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCourses(data);
    }, (error) => {
      console.error("Erro no listener de cursos:", error);
    });

    return () => { 
      unsubInv(); 
      unsubCourses(); 
    };
  }, [user, session]);

  // --- LÓGICA DE NEGÓCIO ---
  const reservedQuantities = useMemo(() => {
    const totals = {};
    courses.filter(c => c.status === 'planejado').forEach(course => {
      course.items.forEach(item => {
        if (!totals[item.itemId]) totals[item.itemId] = [];
        totals[item.itemId].push({ courseName: course.name, qty: item.qtyPlanned, date: course.date });
      });
    });
    return totals;
  }, [courses]);

  const getVirtualStock = (itemId, physicalQty) => {
    const reservations = reservedQuantities[itemId] || [];
    const reservedTotal = reservations.reduce((acc, curr) => acc + curr.qty, 0);
    return Math.max(0, physicalQty - reservedTotal);
  };

  const inventoryAlerts = useMemo(() => {
    const today = new Date();
    const limitDate = new Date();
    limitDate.setDate(today.getDate() + 15);
    const lowStock = inventory.filter(item => getVirtualStock(item.id, item.quantity) <= (item.minStock || 0));
    const expired = inventory.filter(item => item.expiryDate && new Date(item.expiryDate) < today);
    const expiringSoon = inventory.filter(item => item.expiryDate && new Date(item.expiryDate) <= limitDate && new Date(item.expiryDate) >= today);
    const expiryConflicts = [];
    courses.filter(c => c.status === 'planejado').forEach(course => {
      course.items.forEach(cItem => {
        const invItem = inventory.find(i => i.id === cItem.itemId);
        if (invItem?.expiryDate && new Date(course.date) > new Date(invItem.expiryDate)) {
          expiryConflicts.push({ courseName: course.name, itemName: invItem.name });
        }
      });
    });
    return { total: lowStock.length + expired.length + expiringSoon.length + expiryConflicts.length, lowStock, expired, expiringSoon, expiryConflicts };
  }, [inventory, courses]);

  // --- ACÇÕES PROTEGIDAS ---
  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!user || session.role !== 'admin') return;
    const form = e.target;
    try {
      const name = form.name.value;
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'inventory'), {
        name, quantity: parseFloat(form.quantity.value), unit: form.unit.value,
        expiryDate: form.expiryDate.value, minStock: parseFloat(form.minStock.value || 0),
        lastUpdated: new Date().toISOString()
      });
      registerLog("Criação de Insumo", `Adicionado: ${name}`);
      form.reset();
      document.getElementById('modal-add').classList.add('hidden');
      showFeedback("Insumo registrado!", "success");
    } catch (err) { showFeedback("Erro ao salvar."); }
  };

  const handleUpdateItem = async (e) => {
    e.preventDefault();
    if (!user || session.role !== 'admin' || !editingItem) return;
    const form = e.target;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventory', editingItem.id), {
        name: form.name.value, quantity: parseFloat(form.quantity.value),
        unit: form.unit.value, expiryDate: form.expiryDate.value,
        minStock: parseFloat(form.minStock.value || 0), lastUpdated: new Date().toISOString()
      });
      registerLog("Edição de Insumo", `Alterado: ${form.name.value}`);
      setEditingItem(null);
      showFeedback("Insumo atualizado!", "success");
    } catch (err) { showFeedback("Erro ao atualizar."); }
  };

  const handleDeleteItem = async (id, name) => {
    if (!user || session.role !== 'admin') return;
    if ((reservedQuantities[id] || []).length > 0) {
      showFeedback("Não é possível excluir: item reservado.");
      return;
    }
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventory', id));
      registerLog("Eliminação de Insumo", `Eliminado: ${name}`);
      showFeedback("Removido.", "success");
    } catch (err) { showFeedback("Erro."); }
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!user || session.role !== 'admin') return;
    const form = e.target;
    const courseDate = form.courseDate.value;
    const courseName = form.courseName.value;

    const itemsToSave = [];
    for (const entry of newCourseItems) {
      const qtyReq = parseFloat(entry.qtyPlanned);
      const stockItem = inventory.find(i => i.id === entry.itemId);
      if (!stockItem) continue;
      if (getVirtualStock(stockItem.id, stockItem.quantity) < qtyReq) {
        showFeedback(`Estoque insuficiente de ${stockItem.name}.`);
        return;
      }
      if (stockItem.expiryDate && new Date(courseDate) > new Date(stockItem.expiryDate)) {
        showFeedback(`O insumo ${stockItem.name} estará vencido na data da aula.`, "error");
        return;
      }
      itemsToSave.push({ itemId: entry.itemId, qtyPlanned: qtyReq, itemName: stockItem.name, unit: stockItem.unit });
    }

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'courses'), {
        name: courseName, date: courseDate, status: 'planejado', items: itemsToSave, createdAt: new Date().toISOString()
      });
      registerLog("Agendamento de Turma", `Agendado: ${courseName} para ${formatDisplayDate(courseDate)}`);
      setIsCourseModalOpen(false);
      setNewCourseItems([{ itemId: '', qtyPlanned: '' }]);
      showFeedback("Turma agendada!", "success");
    } catch (err) { showFeedback("Erro."); }
  };

  const handleUpdateCourse = async (e) => {
    e.preventDefault();
    if (!user || session.role !== 'admin' || !editingCourse) return;
    const form = e.target;
    const courseDate = form.courseDate.value;
    const courseName = form.courseName.value;

    const itemsToSave = [];
    for (const entry of newCourseItems) {
      const qtyReq = parseFloat(entry.qtyPlanned);
      const stockItem = inventory.find(i => i.id === entry.itemId);
      if (!stockItem) continue;
      
      const othersReserved = (reservedQuantities[stockItem.id] || [])
        .filter(r => r.courseName !== editingCourse.name)
        .reduce((acc, curr) => acc + curr.qty, 0);
      const available = stockItem.quantity - othersReserved;

      if (available < qtyReq) {
        showFeedback(`Conflito: ${stockItem.name} só possui ${available}${stockItem.unit} livres.`);
        return;
      }
      itemsToSave.push({ itemId: entry.itemId, qtyPlanned: qtyReq, itemName: stockItem.name, unit: stockItem.unit });
    }

    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'courses', editingCourse.id), {
        name: courseName, date: courseDate, items: itemsToSave
      });
      registerLog("Edição de Turma", `Alterado: ${courseName}`);
      setEditingCourse(null);
      setIsCourseModalOpen(false);
      showFeedback("Alterações salvas!", "success");
    } catch (err) { showFeedback("Erro."); }
  };

  const deleteCourse = async (id, name) => {
    if (!user || session.role !== 'admin') return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'courses', id));
      registerLog("Cancelamento de Turma", `Turma cancelada: ${name}`);
      showFeedback("Cancelado.", "success");
    } catch (err) { showFeedback("Erro."); }
  };

  const finishCourse = async (course, actualUsageList) => {
    if (!user || session.role !== 'admin') return;
    try {
      const batch = writeBatch(db);
      for (const item of course.items) {
        const actualQty = actualUsageList[item.itemId];
        const itemRef = doc(db, 'artifacts', appId, 'public', 'data', 'inventory', item.itemId);
        const itemSnap = await getDoc(itemRef);
        const currentStock = itemSnap.data().quantity;
        if (actualQty > currentStock) {
          showFeedback(`Saldo insuficiente de ${item.itemName}.`);
          return;
        }
        batch.update(itemRef, { quantity: currentStock - actualQty, lastUpdated: new Date().toISOString() });
      }
      batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'courses', course.id), {
        status: 'concluido', actualUsage: actualUsageList, finishedAt: new Date().toISOString()
      });
      await batch.commit();
      registerLog("Finalização de Turma", `Turma concluída: ${course.name}`);
      showFeedback("Finalizado com sucesso!", "success");
    } catch (err) { showFeedback("Erro."); }
  };

  // --- TELA DE LOGIN ---
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="bg-white p-10 md:p-16 rounded-[3.5rem] shadow-2xl max-w-md w-full border border-slate-100 text-center animate-in zoom-in duration-300">
           <div className="flex justify-center mb-10">
             <div className="p-5 rounded-[2rem] shadow-xl" style={{ backgroundColor: colors.primary }}>
               <ChefHat className="text-white w-12 h-12" />
             </div>
           </div>
           
           <h1 className="text-4xl font-black tracking-tighter mb-2" style={{ color: colors.primary }}>SENAI</h1>
           <p className="text-[10px] font-black uppercase tracking-[0.5em] opacity-30 mb-12">Laboratório de Alimentos</p>
           
           {!isLoginView ? (
             <div className="space-y-4">
               <button 
                 onClick={() => setIsLoginView(true)}
                 className="w-full py-6 rounded-3xl bg-slate-900 text-white font-black uppercase text-xs tracking-widest flex items-center justify-center gap-4 hover:bg-slate-800 transition-all shadow-xl active:scale-95"
               >
                 <Lock size={18} /> Acesso Administrador
               </button>
               <button 
                 onClick={handleViewerAccess}
                 className="w-full py-6 rounded-3xl bg-white border-2 border-slate-100 text-slate-400 font-black uppercase text-xs tracking-widest flex items-center justify-center gap-4 hover:border-blue-200 hover:text-blue-600 transition-all active:scale-95"
               >
                 <Eye size={18} /> Acesso Visitante
               </button>
             </div>
           ) : (
             <form onSubmit={handleAdminLogin} className="space-y-6 animate-in slide-in-from-bottom duration-300">
                <div className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input name="email" type="email" placeholder="E-mail funcional" required className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-sm" />
                  </div>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input name="password" type="password" placeholder="Senha de acesso" required className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 font-bold text-sm" />
                  </div>
                </div>
                <button type="submit" className="w-full py-6 rounded-3xl text-white font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all" style={{ backgroundColor: colors.primary }}>
                  Entrar no Sistema
                </button>
                <button type="button" onClick={() => setIsLoginView(false)} className="text-[10px] font-black uppercase text-slate-300 hover:text-slate-500 tracking-widest">Voltar</button>
             </form>
           )}
           <p className="mt-12 text-[9px] text-slate-300 font-bold uppercase tracking-widest">Unidade SENAI Macapá - Amapá</p>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderBottomColor: colors.primary }}></div>
        <p className="text-blue-900 font-black uppercase text-xs tracking-widest">Autenticando...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans text-slate-800">
      
      {/* ALERTAS */}
      {inventoryAlerts.total > 0 && (
        <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2 animate-in slide-in-from-right duration-500">
          <button 
            onClick={() => setShowAlertDetails(!showAlertDetails)}
            className={`flex items-center gap-3 px-6 py-4 rounded-3xl shadow-2xl border transition-all text-white font-black ${
              inventoryAlerts.expired.length > 0 || inventoryAlerts.expiryConflicts.length > 0 ? 'bg-red-600' : 'bg-[#F05023]'
            }`}
          >
            <Bell className="animate-pulse" size={20} />
            <div className="text-left leading-none">
              <div className="text-[10px] uppercase tracking-tighter">Estado Crítico</div>
              <div className="text-xs">{inventoryAlerts.total} Problemas</div>
            </div>
            {showAlertDetails ? <XCircle size={18}/> : <PlusCircle size={18}/>}
          </button>

          {showAlertDetails && (
            <div className="bg-white border border-slate-200 rounded-[2rem] shadow-2xl p-6 w-80 max-h-[80vh] overflow-y-auto animate-in zoom-in duration-200">
              <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-[0.2em] border-b pb-2">Diagnóstico Técnico</h4>
              {inventoryAlerts.expiryConflicts.map((c, i) => (
                <div key={i} className="text-[11px] font-bold text-red-700 bg-red-50 p-3 rounded-xl mb-2">
                  {c.courseName}: Insumo vence antes da aula!
                </div>
              ))}
              {inventoryAlerts.expired.map(i => <div key={i.id} className="text-xs font-bold text-red-600 mb-1 border-b pb-1 last:border-0">{i.name} (Vencido)</div>)}
              {inventoryAlerts.expiringSoon.map(i => <div key={i.id} className="text-xs font-bold text-orange-500 mb-1 border-b pb-1 last:border-0">{i.name} (Vence em 15 dias)</div>)}
              {inventoryAlerts.lowStock.map(i => <div key={i.id} className="text-xs font-bold text-blue-800 mb-1 border-b pb-1 last:border-0">{i.name} (Saldo Baixo)</div>)}
            </div>
          )}
        </div>
      )}

      {/* FEEDBACK */}
      {feedback && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom min-w-[350px] ${
          feedback.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-700 text-white'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 size={20}/> : <AlertTriangle size={20}/>}
          <span className="font-black text-xs uppercase tracking-tight">{feedback.text}</span>
        </div>
      )}

      {/* SIDEBAR */}
      <nav className="w-full md:w-80 bg-white border-r border-slate-200 p-8 space-y-4 shrink-0 flex flex-col">
        <div className="flex items-center gap-4 py-8 mb-8">
          <div className="p-3 rounded-2xl shadow-xl" style={{ backgroundColor: colors.primary }}>
            <ChefHat className="text-white w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black leading-none tracking-tighter" style={{ color: colors.primary }}>SENAI</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30">Alimentos AP</p>
          </div>
        </div>
        
        <div className="flex-1 space-y-4">
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard />} label="Dashboard" />
          <NavButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package />} label="Inventário" />
          <NavButton active={activeTab === 'courses'} onClick={() => setActiveTab('courses')} icon={<ClipboardList />} label="Turmas" />
        </div>

        <div className="pt-8 border-t border-slate-100">
           <div className="p-6 bg-slate-50 rounded-[2rem] relative overflow-hidden">
              <div className="flex items-center justify-between relative z-10">
                 <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-slate-300 tracking-widest">{session.role === 'admin' ? 'Administrador' : 'Visitante'}</p>
                    <p className="text-[10px] font-black text-slate-700 truncate max-w-[120px]">{session.email || 'Acesso Limitado'}</p>
                 </div>
                 <button onClick={handleLogout} className="p-3 bg-white text-slate-300 hover:text-red-500 rounded-xl shadow-sm transition-all"><LogOut size={16}/></button>
              </div>
           </div>
        </div>
      </nav>

      {/* CONTEÚDO */}
      <main className="flex-1 overflow-y-auto p-4 md:p-16">
        <header className="mb-16 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <h2 className="text-5xl font-black text-slate-900 uppercase tracking-tighter">
              {activeTab === 'dashboard' && 'Status de Gestão'}
              {activeTab === 'inventory' && 'Controle Técnico'}
              {activeTab === 'courses' && 'Agenda Laboratorial'}
            </h2>
            <div className="flex items-center gap-4 mt-4">
              <span className="w-16 h-2 rounded-full" style={{ backgroundColor: colors.accent }}></span>
              <p className="text-slate-400 text-sm font-black uppercase tracking-[0.3em]">Unidade SENAI Macapá</p>
            </div>
          </div>

          {activeTab === 'courses' && session.role === 'admin' && (
            <button 
              onClick={() => {
                setEditingCourse(null);
                setNewCourseItems([{ itemId: '', qtyPlanned: '' }]);
                setIsCourseModalOpen(true);
              }}
              className="px-10 py-5 rounded-3xl text-white font-black uppercase text-xs tracking-widest flex items-center gap-4 shadow-2xl hover:opacity-90 transition-all active:scale-95"
              style={{ backgroundColor: colors.primary }}
            >
              <PlusCircle size={20} /> Agendar Nova Turma
            </button>
          )}
        </header>

        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <StatCard label="Insumos Ativos" value={inventory.length} />
            <StatCard label="Reservas Futuras" value={courses.filter(c => c.status === 'planejado').length} type="info" />
            <StatCard label="Riscos Operacionais" value={inventoryAlerts.total} type="warning" />
          </div>
        )}

        {/* INVENTÁRIO */}
        {activeTab === 'inventory' && (
          <div className="space-y-10">
            <div className="flex flex-col sm:flex-row gap-6 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
               <div className="relative flex-1">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input 
                  className="w-full pl-16 pr-6 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold text-sm"
                  placeholder="Localizar insumo..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              {session.role === 'admin' && (
                <button 
                  onClick={() => { setEditingItem(null); document.getElementById('modal-add')?.classList.toggle('hidden'); }}
                  className="text-white px-12 py-5 rounded-3xl font-black uppercase text-xs flex items-center gap-4 shadow-xl active:scale-95 transition-all"
                  style={{ backgroundColor: colors.primary }}
                >
                  <Plus size={20}/> Adicionar Item
                </button>
              )}
            </div>

            {session.role === 'admin' && (editingItem || !document.getElementById('modal-add')?.classList.contains('hidden')) && (
              <div id="modal-add" className={`${!editingItem ? 'hidden' : ''} bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-2xl animate-in zoom-in mb-10`}>
                <h3 className="text-sm font-black uppercase mb-10 tracking-[0.5em]" style={{ color: colors.primary }}>
                  {editingItem ? 'Actualizar Insumo' : 'Novo Insumo Técnico'}
                </h3>
                <form onSubmit={editingItem ? handleUpdateItem : handleAddItem} className="grid grid-cols-1 md:grid-cols-4 gap-8">
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 block mb-3 uppercase tracking-widest">Nome do Insumo</label>
                    <input name="name" defaultValue={editingItem?.name || ''} required className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 block mb-3 uppercase tracking-widest">Quantidade Real</label>
                    <input name="quantity" type="number" step="0.01" defaultValue={editingItem?.quantity || 0} required className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 block mb-3 uppercase tracking-widest">Unidade</label>
                    <select name="unit" defaultValue={editingItem?.unit || 'kg'} className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold">
                      <option value="kg">kg</option><option value="l">L</option><option value="un">un</option><option value="g">g</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 block mb-3 uppercase tracking-widest">Data de Validade</label>
                    <input name="expiryDate" type="date" defaultValue={editingItem?.expiryDate || ''} required className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 block mb-3 uppercase tracking-widest">Limite Alerta</label>
                    <input name="minStock" type="number" step="0.01" defaultValue={editingItem?.minStock || 0} className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold" />
                  </div>
                  <div className="flex items-end gap-3">
                    <button type="submit" className="flex-1 py-4 text-white rounded-2xl font-black uppercase text-xs shadow-lg" style={{ backgroundColor: colors.primary }}>Guardar</button>
                    <button type="button" onClick={() => {setEditingItem(null); document.getElementById('modal-add').classList.add('hidden')}} className="px-8 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-xs">Sair</button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b tracking-widest">
                    <tr>
                      <th className="px-12 py-8">Insumo</th>
                      <th className="px-12 py-8">Saldo Físico</th>
                      <th className="px-12 py-8">Saldo Virtual</th>
                      <th className="px-12 py-8">Vencimento</th>
                      {session.role === 'admin' && <th className="px-12 py-8 text-right">Ações</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {inventory.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => {
                      const vStock = getVirtualStock(item.id, item.quantity);
                      return (
                        <tr key={item.id} className="text-sm hover:bg-slate-50/50 transition-colors">
                          <td className="px-12 py-7 font-black text-slate-900">{item.name}</td>
                          <td className="px-12 py-7 font-mono font-bold text-slate-400">{item.quantity} {item.unit}</td>
                          <td className="px-12 py-7 font-mono font-black text-blue-900">{vStock} {item.unit}</td>
                          <td className="px-12 py-7">
                             <div className={`text-xs font-bold ${new Date(item.expiryDate) < new Date() ? 'text-red-600' : 'text-slate-400'}`}>
                               {item.expiryDate ? formatDisplayDate(item.expiryDate) : '-'}
                             </div>
                          </td>
                          {session.role === 'admin' && (
                            <td className="px-12 py-7 text-right space-x-3">
                               <button onClick={() => setEditingItem(item)} className="p-3 text-slate-300 hover:text-blue-600 hover:bg-white rounded-xl shadow-sm transition-all"><Edit2 size={16}/></button>
                               <button onClick={() => handleDeleteItem(item.id, item.name)} className="p-3 text-slate-200 hover:text-red-600 hover:bg-white rounded-xl shadow-sm transition-all"><Trash2 size={16}/></button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
            </div>
          </div>
        )}

        {/* CURSOS */}
        {activeTab === 'courses' && (
          <div className="space-y-16">
            {isCourseModalOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[3.5rem] shadow-2xl p-12 relative animate-in zoom-in duration-300">
                  <button onClick={() => setIsCourseModalOpen(false)} className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all"><X size={24} /></button>
                  <h3 className="text-3xl font-black text-slate-900 uppercase mb-10 tracking-tighter flex items-center gap-4">
                    <PlusCircle style={{ color: colors.accent }} /> {editingCourse ? 'Editar Turma' : 'Agendar Aula'}
                  </h3>
                  <form onSubmit={editingCourse ? handleUpdateCourse : handleCreateCourse} className="space-y-8">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-3 tracking-widest">Identificação da Turma</label>
                      <input name="courseName" defaultValue={editingCourse?.name || ''} required className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold focus:ring-2 focus:ring-blue-100 outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-3 tracking-widest">Data Programada</label>
                      <input name="courseDate" type="date" min={todayStr} defaultValue={editingCourse?.date || ''} required className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold" />
                    </div>
                    <div className="pt-10 border-t space-y-6">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Insumos Necessários</label>
                        <button type="button" onClick={addIngredientField} className="text-blue-600 font-black text-[10px] uppercase flex items-center gap-2 hover:underline"><PlusCircle size={18}/> Adicionar Insumo</button>
                      </div>
                      {newCourseItems.map((field, idx) => (
                        <div key={idx} className="p-6 bg-slate-50 rounded-[2rem] animate-in slide-in-from-left">
                          <div className="flex gap-4 mb-4">
                            <select required className="flex-1 bg-transparent border-none text-xs font-black outline-none" value={field.itemId} onChange={e => updateIngredientField(idx, 'itemId', e.target.value)}>
                              <option value="">Escolher Produto...</option>
                              {inventory.map(i => <option key={i.id} value={i.id}>{i.name} ({getVirtualStock(i.id, i.quantity)}{i.unit} livre)</option>)}
                            </select>
                            <button type="button" onClick={() => removeIngredientField(idx)} className="text-slate-300 hover:text-red-500 transition-colors"><MinusCircle size={22}/></button>
                          </div>
                          <input required type="number" step="0.01" className="w-full bg-transparent border-t border-white pt-4 text-xs font-black outline-none" placeholder="Quantidade exata" value={field.qtyPlanned} onChange={e => updateIngredientField(idx, 'qtyPlanned', e.target.value)} />
                        </div>
                      ))}
                    </div>
                    <button type="submit" className="w-full py-7 text-white rounded-[2rem] font-black uppercase text-xs shadow-2xl transition-all active:scale-95 tracking-[0.3em]" style={{ backgroundColor: colors.primary }}>{editingCourse ? 'Salvar Alterações' : 'Efetuar Agendamento'}</button>
                  </form>
                </div>
              </div>
            )}

            <div className="space-y-12">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em]">Turmas Planejadas (Agendamento)</h3>
              {courses.filter(c => c.status === 'planejado').length === 0 ? (
                <div className="p-32 text-center border-4 border-dotted border-slate-100 rounded-[4rem]">
                   <CalendarX className="mx-auto mb-4 text-slate-100" size={48}/>
                   <p className="text-slate-300 font-black uppercase text-[10px] tracking-widest">Nenhuma atividade no radar</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-10">
                  {courses.filter(c => c.status === 'planejado').map(course => (
                    <div key={course.id} className="bg-white p-12 rounded-[3.5rem] border shadow-sm relative overflow-hidden group transition-all">
                      <div className="absolute top-0 left-0 w-3 h-full transition-all group-hover:w-6" style={{ backgroundColor: colors.primary }}></div>
                      <div className="flex flex-col md:flex-row justify-between items-start mb-10 gap-6">
                        <div>
                          <h4 className="font-black text-4xl text-slate-900 mb-4 tracking-tighter">{course.name}</h4>
                          <div className="flex items-center gap-3 text-sm font-black text-blue-800 opacity-60"><CalendarDays size={20}/><span>Agendado para: {formatDisplayDate(course.date)}</span></div>
                        </div>
                        {session.role === 'admin' && (
                          <div className="flex gap-3">
                            <button onClick={() => { setEditingCourse(course); setNewCourseItems(course.items); setIsCourseModalOpen(true); }} className="p-4 rounded-2xl bg-slate-50 text-slate-300 hover:text-blue-600 shadow-sm transition-colors"><Edit2 size={22}/></button>
                            <button onClick={() => deleteCourse(course.id, course.name)} className="p-4 rounded-2xl bg-slate-50 text-slate-300 hover:text-red-600 shadow-sm transition-colors"><Trash2 size={22}/></button>
                          </div>
                        )}
                      </div>
                      <div className="bg-slate-50 p-12 rounded-[3rem] border border-slate-100">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12">
                          {course.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-10 pb-6 border-b border-white mb-6 last:mb-0 last:pb-0 last:border-0">
                              <span className="text-sm font-black text-slate-500 uppercase tracking-tighter">{item.itemName}</span>
                              <div className="flex items-center gap-5">
                                {session.role === 'admin' ? (
                                  <input id={`usage-${course.id}-${item.itemId}`} type="number" step="0.01" defaultValue={item.qtyPlanned} className="w-32 p-4 text-lg font-black bg-white rounded-2xl text-right shadow-sm outline-none focus:ring-2 focus:ring-blue-100" />
                                ) : (
                                  <div className="text-lg font-black text-slate-900">{item.qtyPlanned}</div>
                                )}
                                <span className="text-[10px] font-black text-slate-300 uppercase">{item.unit}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {session.role === 'admin' && (
                          <button onClick={() => { const usages = {}; course.items.forEach(i => usages[i.itemId] = parseFloat(document.getElementById(`usage-${course.id}-${i.itemId}`).value)); finishCourse(course, usages); }} className="w-full mt-12 py-7 text-white rounded-[2rem] font-black uppercase text-xs shadow-xl active:scale-95 transition-all tracking-[0.2em]" style={{ backgroundColor: '#10b981' }}><CheckCircle2 size={20} className="inline mr-3"/> Finalizar Aula e Atualizar Estoque Físico</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] pt-12">Histórico de Conclusão e Relatório</h3>
              {courses.filter(c => c.status === 'concluido').length === 0 ? (
                <p className="text-slate-300 italic text-[10px] font-black uppercase tracking-widest text-center">Laboratório sem registro de encerramento.</p>
              ) : (
                <div className="grid grid-cols-1 gap-10">
                  {courses.filter(c => c.status === 'concluido').sort((a,b) => b.finishedAt.localeCompare(a.finishedAt)).map(course => (
                    <div key={course.id} className="bg-white p-12 rounded-[3.5rem] border border-slate-100 relative overflow-hidden opacity-90 hover:opacity-100 transition-all shadow-sm">
                      <div className="absolute top-0 left-0 w-3 h-full opacity-30" style={{ backgroundColor: '#10b981' }}></div>
                      <div className="flex justify-between items-start mb-10">
                        <div>
                          <div className="flex items-center gap-3 mb-4"><span className="text-[9px] font-black bg-emerald-50 text-emerald-600 px-4 py-2 rounded-full border border-emerald-100 uppercase tracking-widest">Processado</span><h4 className="font-black text-3xl text-slate-900 tracking-tighter">{course.name}</h4></div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2"><p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-3"><CalendarDays size={14}/> Agendado: {formatDisplayDate(course.date)}</p><p className="text-[10px] font-black text-emerald-600 uppercase flex items-center gap-3"><Check size={14}/> Finalizado em: {formatFullDate(course.finishedAt)}</p></div>
                        </div>
                      </div>
                      <div className="mt-10 border-t border-slate-50 pt-10">
                         <h5 className="text-[10px] font-black text-slate-900 uppercase mb-6 tracking-widest">Consumo Final Realizado:</h5>
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {course.items.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-sm">
                                 <span className="text-xs font-black text-slate-600 uppercase tracking-tighter">{item.itemName}</span>
                                 <div className="text-right leading-none"><div className="text-lg font-black text-emerald-700">{course.actualUsage[item.itemId]} {item.unit}</div><div className="text-[9px] font-bold text-slate-400 uppercase mt-2 opacity-50">Previsto: {item.qtyPlanned}</div></div>
                              </div>
                            ))}
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}