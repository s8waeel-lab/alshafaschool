import { useState, useEffect } from 'react';
import { 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc
} from 'firebase/firestore';
import { db, writeLocalCache, runFirestoreOp } from '../services/firebase';
import { 
  School, 
  Domain, 
  Standard, 
  Indicator,
  getSchools,
  getDomains,
  getAllStandards,
  getAllIndicators,
  isSharedDomain,
  seedInitialStructure
} from '../services/evaluationService';
import { 
  Database, 
  Plus, 
  Trash2, 
  ChevronRight, 
  ChevronDown,
  Layout,
  Target,
  Network,
  AlertTriangle,
  FolderOpen,
  ChevronLeft,
  X,
  Check,
  PlusCircle,
  RefreshCcw
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function StructureManagementPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Inline Add States
  const [showAddSchool, setShowAddSchool] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [newDomainIsShared, setNewDomainIsShared] = useState(false);

  const [addingToDomain, setAddingToDomain] = useState<string | null>(null);
  const [newStandardName, setNewStandardName] = useState('');

  const [addingToStandard, setAddingToStandard] = useState<string | null>(null);
  const [newIndicatorName, setNewIndicatorName] = useState('');
  const [newIndicatorIsShared, setNewIndicatorIsShared] = useState(false);
  
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [expandedStandard, setExpandedStandard] = useState<string | null>(null);

  const [editingIndicator, setEditingIndicator] = useState<string | null>(null);
  const [editTargetCount, setEditTargetCount] = useState<number>(6);

  const fetchData = async () => {
    try {
      const [schoolsData, domainsData, standardsData, indicatorsData] = await Promise.all([
        getSchools(),
        getDomains(),
        getAllStandards(),
        getAllIndicators()
      ]);
      
      setSchools(schoolsData);
      setDomains(domainsData);
      setStandards(standardsData);
      setIndicators(indicatorsData);
    } catch {
      setError('حدث خطأ أثناء تحميل البيانات.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      await seedInitialStructure();
      await fetchData();
      setSuccess('تم استيراد كافة البيانات بنجاح.');
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError('حدث خطأ أثناء الاستيراد.');
    } finally {
      setSeeding(false);
    }
  };

  const handleAddSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolName.trim()) return;
    const id = 'sch_' + Math.random().toString(36).substr(2, 9);
    const newItem: School = { id, name: newSchoolName.trim(), order: schools.length + 1 };
    const updated = [...schools, newItem];
    writeLocalCache('shafa_schools', updated);
    setSchools(updated);
    setNewSchoolName('');
    setShowAddSchool(false);
    try {
      await runFirestoreOp(() => setDoc(doc(db, 'schools', id), newItem));
    } catch {
      // Saved in local cache
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainName.trim()) return;
    const id = 'dom_' + Math.random().toString(36).substr(2, 9);
    const domainIsShared = newDomainIsShared || isSharedDomain({ name: newDomainName.trim() });
    const newItem: Domain = {
      id,
      name: newDomainName.trim(),
      order: domains.length + 1,
      isShared: domainIsShared
    };
    const updated = [...domains, newItem];
    writeLocalCache('shafa_domains', updated);
    setDomains(updated);
    setNewDomainName('');
    setNewDomainIsShared(false);
    setShowAddDomain(false);
    try {
      await runFirestoreOp(() => setDoc(doc(db, 'domains', id), newItem));
    } catch {
      // Saved in local cache
    }
  };

  const handleAddStandard = async (e: React.FormEvent, domainId: string) => {
    e.preventDefault();
    if (!newStandardName.trim()) return;
    const id = 'std_' + Math.random().toString(36).substr(2, 9);
    const newItem: Standard = {
      id,
      name: newStandardName.trim(),
      domainId,
      order: standards.filter(s => s.domainId === domainId).length + 1
    };
    const updated = [...standards, newItem];
    writeLocalCache('shafa_standards', updated);
    setStandards(updated);
    setNewStandardName('');
    setAddingToDomain(null);
    try {
      await runFirestoreOp(() => setDoc(doc(db, 'standards', id), newItem));
    } catch {
      // Saved in local cache
    }
  };

  const handleAddIndicator = async (e: React.FormEvent, standardId: string) => {
    e.preventDefault();
    if (!newIndicatorName.trim()) return;
    
    const indicatorLines = newIndicatorName.split('\n').map(line => line.trim()).filter(line => line !== '');
    const currentOrder = indicators.filter(i => i.standardId === standardId).length + 1;
    const parentStandard = standards.find(s => s.id === standardId);
    const parentDomain = domains.find(d => d.id === parentStandard?.domainId);
    const isActuallyShared = newIndicatorIsShared || isSharedDomain(parentDomain);

    const newItems: Indicator[] = indicatorLines.map((name, index) => ({
      id: 'ind_' + Math.random().toString(36).substr(2, 9) + '_' + index,
      name,
      standardId,
      isShared: isActuallyShared,
      targetEvidenceCount: 6,
      order: currentOrder + index
    }));

    const updated = [...indicators, ...newItems];
    writeLocalCache('shafa_indicators', updated);
    setIndicators(updated);
    setNewIndicatorName('');
    setAddingToStandard(null);

    try {
      for (const item of newItems) {
        await runFirestoreOp(() => setDoc(doc(db, 'indicators', item.id), item));
      }
    } catch {
      // Saved in local cache
    }
  };

  const handleSyncSharingRules = async () => {
    setSyncing(true);
    try {
      const updatedDomains = domains.map(dom => ({
        ...dom,
        isShared: isSharedDomain(dom)
      }));
      const updatedIndicators = indicators.map(ind => {
        const std = standards.find(s => s.id === ind.standardId);
        const dom = updatedDomains.find(d => d.id === std?.domainId);
        return {
          ...ind,
          isShared: dom ? isSharedDomain(dom) : ind.isShared
        };
      });

      writeLocalCache('shafa_domains', updatedDomains);
      writeLocalCache('shafa_indicators', updatedIndicators);
      setDomains(updatedDomains);
      setIndicators(updatedIndicators);

      try {
        for (const dom of updatedDomains) {
          await runFirestoreOp(() => updateDoc(doc(db, 'domains', dom.id), { isShared: dom.isShared }));
        }
        for (const ind of updatedIndicators) {
          await runFirestoreOp(() => updateDoc(doc(db, 'indicators', ind.id), { isShared: ind.isShared }));
        }
      } catch {
        // Saved in local cache
      }

      setSuccess('تم بنجاح تحديث وتوحيد عناصر المجالات المشتركة.');
      setTimeout(() => setSuccess(null), 3000);
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdateTargetCount = async (indicatorId: string) => {
    const updated = indicators.map(i =>
      i.id === indicatorId ? { ...i, targetEvidenceCount: editTargetCount } : i
    );
    writeLocalCache('shafa_indicators', updated);
    setIndicators(updated);
    setEditingIndicator(null);

    try {
      await runFirestoreOp(() =>
        updateDoc(doc(db, 'indicators', indicatorId), {
          targetEvidenceCount: editTargetCount
        })
      );
    } catch {
      // Saved in local cache
    }
  };

  const removeItem = async (coll: string, id: string) => {
    if (coll === 'schools') {
      const updated = schools.filter(s => s.id !== id);
      writeLocalCache('shafa_schools', updated);
      setSchools(updated);
    } else if (coll === 'domains') {
      const updated = domains.filter(d => d.id !== id);
      writeLocalCache('shafa_domains', updated);
      setDomains(updated);
    } else if (coll === 'standards') {
      const updated = standards.filter(s => s.id !== id);
      writeLocalCache('shafa_standards', updated);
      setStandards(updated);
    } else if (coll === 'indicators') {
      const updated = indicators.filter(i => i.id !== id);
      writeLocalCache('shafa_indicators', updated);
      setIndicators(updated);
    }

    try {
      await runFirestoreOp(() => deleteDoc(doc(db, coll, id)));
    } catch {
      // Saved in local cache
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-gray-500 font-bold tracking-widest">جاري تحميل الهيكل التنظيمي...</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-32">
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/admin" className="hover:text-blue-600 transition-colors">لوحة الإدارة</Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 font-bold">إدارة الهيكل</span>
      </nav>

      {error && (
        <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-center gap-3 text-red-700 animate-in fade-in slide-in-from-top-2">
          <AlertTriangle size={20} />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 p-4 rounded-2xl border border-green-100 flex items-center gap-3 text-green-700 animate-in fade-in slide-in-from-top-2">
          <Check size={20} />
          <p className="text-sm font-bold">{success}</p>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-white p-8 md:p-12 rounded-[40px] border border-gray-100 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-8">
        <div className="max-w-xl">
          <h1 className="text-4xl font-black text-slate-800 mb-4 leading-tight">بناء هيكل المجمع</h1>
          <p className="text-gray-500 text-lg">
            قم بتعريف المدارس والمجالات والمعايير. المجالات التي تضيفها هنا ستظهر تلقائياً لجميع المدارس المرتبطة بالمجمع.
          </p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 shrink-0">
          <button 
            onClick={handleSeedData}
            disabled={seeding}
            className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-xl hover:shadow-blue-200 disabled:opacity-50"
          >
            {seeding ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <RefreshCcw size={24} />}
            استيراد الهيكل المعتمد
          </button>
          <button 
            onClick={handleSyncSharingRules}
            disabled={syncing}
            className="bg-amber-50 text-amber-700 px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-amber-600 hover:text-white transition-all border border-amber-200 disabled:opacity-50"
          >
            {syncing ? <div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin"></div> : <Network size={24} />}
            مزامنة قواعد المشاركة
          </button>
          {!showAddSchool ? (
            <button 
              onClick={() => setShowAddSchool(true)} 
              className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl"
            >
              <PlusCircle size={24} />
              إضافة مدرسة
            </button>
          ) : (
            <form onSubmit={handleAddSchool} className="bg-slate-100 p-3 rounded-2xl border border-slate-200 flex items-center gap-2 animate-in slide-in-from-left-4">
              <input 
                autoFocus
                type="text" 
                placeholder="اسم المدرسة..."
                className="bg-white px-4 py-2 text-sm font-bold rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-48"
                value={newSchoolName}
                onChange={(e) => setNewSchoolName(e.target.value)}
              />
              <button type="submit" className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-blue-600 shadow-md">
                <Check size={20} />
              </button>
              <button type="button" onClick={() => setShowAddSchool(false)} className="p-2.5 bg-white text-gray-400 rounded-xl hover:bg-gray-100 border border-gray-200">
                <X size={20} />
              </button>
            </form>
          )}
        </div>
      </div>


      {/* Schools Summary */}
      <section className="px-2">
        <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
          <Layout className="text-blue-600" size={24} />
          المدارس الحالية ({schools.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {schools.map(s => (
            <div key={s.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-blue-200 hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="font-bold text-slate-700">{s.name}</span>
              </div>
              <button onClick={() => removeItem('schools', s.id)} className="text-red-300 hover:text-red-500 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Nested Tree Section */}
      <section className="space-y-6 pt-8 border-t border-gray-100">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <FolderOpen className="text-amber-600" size={28} />
            هيكلة المجالات والمعايير
          </h2>
          {!showAddDomain ? (
            <button 
              onClick={() => setShowAddDomain(true)} 
              className="bg-blue-50 text-blue-700 px-6 py-2.5 rounded-2xl font-black text-sm hover:bg-blue-600 hover:text-white transition-all border border-blue-100 flex items-center gap-2"
            >
              <Plus size={20} />
              إضافة مجال للمجمع
            </button>
          ) : (
            <form onSubmit={handleAddDomain} className="bg-amber-50 p-4 rounded-3xl border border-amber-100 flex flex-col gap-3 animate-in zoom-in-95">
              <div className="flex items-center gap-2">
                <input 
                  autoFocus
                  type="text" 
                  placeholder="اسم المجال..."
                  className="bg-white px-4 py-2 text-sm font-bold rounded-xl border border-amber-200 outline-none focus:ring-2 focus:ring-amber-500 w-64"
                  value={newDomainName}
                  onChange={(e) => setNewDomainName(e.target.value)}
                />
                <button type="submit" className="p-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 shadow-md">
                  <Check size={18} />
                </button>
                <button type="button" onClick={() => setShowAddDomain(false)} className="p-2 bg-white text-gray-400 rounded-lg border border-gray-200">
                  <X size={18} />
                </button>
              </div>
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-amber-100">
                <input 
                  type="checkbox" 
                  id="domain-shared" 
                  className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500" 
                  checked={newDomainIsShared}
                  onChange={(e) => setNewDomainIsShared(e.target.checked)}
                />
                <label htmlFor="domain-shared" className="text-[10px] font-bold text-amber-700 cursor-pointer select-none">
                  هذا المجال مشترك بين جميع المدارس
                </label>
              </div>
            </form>
          )}
        </div>

        <div className="space-y-6">
          {domains.map(domain => (
            <div key={domain.id} className={`bg-white rounded-[32px] border transition-all duration-300 ${expandedDomain === domain.id ? 'border-amber-200 shadow-xl' : 'border-gray-100 shadow-sm'}`}>
              <div 
                className={`p-6 md:p-8 flex items-center justify-between cursor-pointer transition-colors ${expandedDomain === domain.id ? 'bg-amber-50/20' : 'bg-gray-50/30 hover:bg-gray-50'}`}
                onClick={() => setExpandedDomain(expandedDomain === domain.id ? null : domain.id)}
              >
                <div className="flex items-center gap-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${expandedDomain === domain.id ? 'bg-amber-600 text-white shadow-lg' : 'bg-white text-amber-600 shadow-sm'}`}>
                    <Database size={28} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 mb-1">{domain.name}</h3>
                    <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      <span className="bg-white px-2 py-0.5 rounded shadow-sm border border-gray-100">
                        {standards.filter(s => s.domainId === domain.id).length} معايير
                      </span>
                      {domain.isShared ? (
                        <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded shadow-sm border border-amber-200">
                          مشترك بين جميع المدارس
                        </span>
                      ) : (
                        <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded shadow-sm border border-gray-200">
                          خاص لكل مدرسة
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className={`p-2 rounded-full transition-transform duration-300 ${expandedDomain === domain.id ? 'bg-amber-600 text-white rotate-180' : 'bg-white text-gray-300 shadow-sm'}`}>
                  <ChevronDown size={20} />
                </div>
              </div>

              {expandedDomain === domain.id && (
                <div className="p-6 md:p-8 pt-2 space-y-6 animate-in slide-in-from-top-4">
                  <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                    <span className="text-xs font-bold text-gray-400">قائمة المعايير</span>
                    {addingToDomain !== domain.id ? (
                      <button onClick={(e) => { e.stopPropagation(); setAddingToDomain(domain.id); }} className="text-xs font-black text-blue-600 flex items-center gap-1.5 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 hover:bg-blue-600 hover:text-white transition-all">
                        <Plus size={16} /> إضافة معيار جديد
                      </button>
                    ) : (
                      <form onSubmit={(e) => handleAddStandard(e, domain.id)} className="flex items-center gap-2">
                        <input autoFocus type="text" placeholder="اسم المعيار..." className="text-xs font-bold px-3 py-1.5 border border-blue-200 rounded-lg outline-none w-48" value={newStandardName} onChange={(e) => setNewStandardName(e.target.value)} />
                        <button type="submit" className="p-1.5 bg-blue-600 text-white rounded-lg"><Check size={14} /></button>
                        <button type="button" onClick={() => setAddingToDomain(null)} className="p-1.5 bg-gray-100 text-gray-400 rounded-lg"><X size={14} /></button>
                      </form>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {standards.filter(s => s.domainId === domain.id).map(standard => (
                      <div key={standard.id} className={`border rounded-3xl transition-all duration-300 ${expandedStandard === standard.id ? 'border-blue-200 bg-blue-50/10' : 'border-gray-50 bg-white'}`}>
                        <div 
                          className="p-5 flex items-center justify-between cursor-pointer"
                          onClick={() => setExpandedStandard(expandedStandard === standard.id ? null : standard.id)}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${expandedStandard === standard.id ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-blue-500'}`}>
                              <Target size={20} />
                            </div>
                            <span className="font-bold text-slate-700">{standard.name}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-bold text-gray-400">
                              {indicators.filter(i => i.standardId === standard.id).length} مؤشرات
                            </span>
                            {expandedStandard === standard.id ? <ChevronDown size={18} /> : <ChevronLeft size={18} />}
                          </div>
                        </div>

                        {expandedStandard === standard.id && (
                          <div className="p-5 pt-0 space-y-4 animate-in zoom-in-95">
                            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                              <span className="text-[10px] font-bold text-gray-400 uppercase">المؤشرات التفصيلية</span>
                              {addingToStandard !== standard.id ? (
                                <button 
                                  onClick={() => {
                                    setAddingToStandard(standard.id);
                                    // Default indicator sharing to domain's sharing status
                                    const parentDomain = domains.find(d => d.id === standard.domainId);
                                    if (parentDomain) {
                                      setNewIndicatorIsShared(parentDomain.isShared);
                                    }
                                  }} 
                                  className="text-[10px] font-black text-green-600 flex items-center gap-1 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100 hover:bg-green-600 hover:text-white transition-all shadow-sm"
                                >
                                  <PlusCircle size={14} /> إضافة مجموعة مؤشرات
                                </button>
                              ) : (
                                <form onSubmit={(e) => handleAddIndicator(e, standard.id)} className="w-full flex flex-col gap-3 bg-green-50/50 p-4 rounded-2xl border border-green-100 animate-in fade-in zoom-in-95 mt-2">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-green-700 uppercase tracking-wider">إضافة سريعة للمؤشرات</label>
                                    <span className="text-[9px] text-green-600 bg-white px-2 py-0.5 rounded border border-green-100">ضع كل مؤشر في سطر مستقل</span>
                                  </div>
                                  <textarea 
                                    autoFocus 
                                    rows={5}
                                    placeholder="اكتب أو الصق المؤشرات هنا...&#10;المؤشر الأول&#10;المؤشر الثاني..." 
                                    className="text-[11px] font-bold px-3 py-2.5 border border-green-200 rounded-xl outline-none w-full bg-white leading-relaxed focus:ring-2 focus:ring-green-500 shadow-inner" 
                                    value={newIndicatorName} 
                                    onChange={(e) => setNewIndicatorName(e.target.value)} 
                                  />
                                  <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-green-100 self-start">
                                    <input 
                                      type="checkbox" 
                                      id="is-shared" 
                                      className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500" 
                                      checked={newIndicatorIsShared}
                                      onChange={(e) => setNewIndicatorIsShared(e.target.checked)}
                                    />
                                    <label htmlFor="is-shared" className="text-[10px] font-bold text-green-700 cursor-pointer select-none">
                                      هذا المؤشر مشترك بين جميع مدارس المجمع (شواهد موحدة)
                                    </label>
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <button type="submit" className="px-5 py-2 bg-green-600 text-white rounded-xl text-[10px] font-black hover:bg-green-700 shadow-md flex items-center gap-1.5 transform active:scale-95 transition-all">
                                      <Check size={14} /> حفظ كافة المؤشرات
                                    </button>
                                    <button type="button" onClick={() => setAddingToStandard(null)} className="px-5 py-2 bg-white text-gray-400 rounded-xl text-[10px] font-black border border-gray-200 hover:bg-gray-50 transform active:scale-95 transition-all">
                                      إلغاء
                                    </button>
                                  </div>
                                </form>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {indicators.filter(i => i.standardId === standard.id).map(indicator => (
                                <div key={indicator.id} className="p-4 bg-white border border-gray-100 rounded-2xl flex flex-col gap-3 group shadow-sm hover:border-green-200 transition-all">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-slate-400">
                                        <Network size={16} />
                                      </div>
                                      <span className="font-bold text-slate-600 leading-relaxed">{indicator.name}</span>
                                    </div>
                                    <button onClick={() => removeItem('indicators', indicator.id)} className="text-red-200 hover:text-red-500 transition-colors p-1">
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                  
                                  <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                                    <div className="flex items-center gap-3">
                                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">عدد الشواهد المستهدف:</span>
                                      {editingIndicator === indicator.id ? (
                                        <div className="flex items-center gap-2">
                                          <input 
                                            type="number" 
                                            className="w-16 px-2 py-1 text-[10px] font-bold border border-blue-200 rounded outline-none"
                                            value={editTargetCount}
                                            onChange={(e) => setEditTargetCount(parseInt(e.target.value) || 0)}
                                          />
                                          <button onClick={() => handleUpdateTargetCount(indicator.id)} className="p-1 bg-blue-600 text-white rounded"><Check size={12} /></button>
                                          <button onClick={() => setEditingIndicator(null)} className="p-1 bg-gray-100 text-gray-400 rounded"><X size={12} /></button>
                                        </div>
                                      ) : (
                                        <button 
                                          onClick={() => {
                                            setEditingIndicator(indicator.id);
                                            setEditTargetCount(indicator.targetEvidenceCount || 6);
                                          }}
                                          className="text-[10px] font-black text-blue-600 hover:underline"
                                        >
                                          {indicator.targetEvidenceCount || 6} (تعديل)
                                        </button>
                                      )}
                                    </div>
                                    <div className={`text-[8px] font-black px-2 py-0.5 rounded ${indicator.isShared ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-gray-50 text-gray-400 border border-gray-100'}`}>
                                      {indicator.isShared ? 'مشترك' : 'خاص'}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="pt-4 flex justify-end">
                              <button onClick={() => removeItem('standards', standard.id)} className="text-[10px] text-red-400 hover:text-red-600 font-bold px-3 py-1 rounded hover:bg-red-50">حذف هذا المعيار</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="pt-8 flex justify-center">
                    <button onClick={() => removeItem('domains', domain.id)} className="px-8 py-3 bg-red-50 text-red-600 font-black text-sm rounded-2xl hover:bg-red-600 hover:text-white transition-all flex items-center gap-2 border border-red-100">
                      <Trash2 size={18} />
                      حذف هذا المجال وجميع محتوياته
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
