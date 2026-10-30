import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { 
  getSchools, 
  getDomains, 
  getAllStandards,
  getAllIndicators,
  School, 
  Domain, 
  Standard, 
  Indicator,
  isSharedDomain,
  isSharedIndicator
} from '../services/evaluationService';
import { Evidence, getAllEvidenceResilient } from '../services/evidenceService';
import { calculateIndicatorProgress, calculateAverageProgress } from '../utils/calculations';
import { 
  ChevronRight, 
  ChevronDown,
  BarChart2, 
  CheckCircle, 
  Target,
  Network,
  ChevronLeft,
  Info,
  Calendar,
  Layers,
  ArrowUpRight,
  Activity,
  Award
} from 'lucide-react';

export default function SchoolPage() {
  const { schoolId } = useParams();
  const [school, setSchool] = useState<School | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loadingData, setLoadingData] = useState({
    school: true,
    domains: true,
    standards: true,
    indicators: true,
    evidence: true
  });
  
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchSchoolData = async () => {
      try {
        const [schoolsData, domainsData, standardsData, indicatorsData, evidenceData] = await Promise.all([
          getSchools(),
          getDomains(),
          getAllStandards(),
          getAllIndicators(),
          getAllEvidenceResilient()
        ]);
        if (!active) return;
        const schoolData = schoolsData.find(s => s.id === schoolId);
        setSchool(schoolData || null);
        setDomains(domainsData);
        setStandards(standardsData);
        setIndicators(indicatorsData);
        setEvidence(evidenceData);
      } catch {
        // Fallback already handled inside service getters
      } finally {
        if (active) {
          setLoadingData({
            school: false,
            domains: false,
            standards: false,
            indicators: false,
            evidence: false
          });
        }
      }
    };
    fetchSchoolData();

    return () => {
      active = false;
    };
  }, [schoolId]);

  // Calculation helpers
  const getIndicatorProgress = (id: string) => {
    const ind = indicators.find(i => i.id === id);
    const std = standards.find(s => s.id === ind?.standardId);
    const dom = domains.find(d => d.id === std?.domainId);
    
    const isShared = isSharedIndicator(ind, dom);
    
    // Filter evidence based on sharing status
    const indicatorEv = evidence.filter(e => {
      if (e.indicatorId !== id) return false;
      return isShared || e.isShared || e.schoolId === schoolId;
    });
    
    return calculateIndicatorProgress(indicatorEv, ind?.targetEvidenceCount || 6).approved;
  };

  const getDomainProgress = (domainId: string) => {
    const domainStandards = standards.filter(s => s.domainId === domainId);
    const domainIndicators = indicators.filter(i => domainStandards.some(s => s.id === i.standardId));
    if (domainIndicators.length === 0) return null; // Use null for "no data"
    
    const progressList = domainIndicators.map(i => getIndicatorProgress(i.id));
    return calculateAverageProgress(progressList);
  };

  const getSchoolProgress = () => {
    if (domains.length === 0) return 0;
    const progressList = domains.map(d => getDomainProgress(d.id)).filter(p => p !== null) as number[];
    return calculateAverageProgress(progressList);
  };

  const getSharedDomainsProgress = () => {
    const sharedDomains = domains.filter(d => isSharedDomain(d));
    if (sharedDomains.length === 0) return 0;
    const progressList = sharedDomains.map(d => getDomainProgress(d.id)).filter(p => p !== null) as number[];
    return calculateAverageProgress(progressList);
  };

  const getPrivateDomainsProgress = () => {
    const privateDomains = domains.filter(d => !isSharedDomain(d));
    if (privateDomains.length === 0) return 0;
    const progressList = privateDomains.map(d => getDomainProgress(d.id)).filter(p => p !== null) as number[];
    return calculateAverageProgress(progressList);
  };

  const isLoading = Object.values(loadingData).some(v => v);

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-gray-500 font-bold">جاري تحديث نسب الإنجاز المباشرة...</p>
    </div>
  );
  if (!school) return <div className="p-12 text-center text-red-500 font-bold text-xl">المدرسة غير موجودة</div>;

  const totalProgress = getSchoolProgress();
  const sharedProgress = getSharedDomainsProgress();
  const privateProgress = getPrivateDomainsProgress();

  return (
    <div className="space-y-8 pb-20">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/evaluation" className="hover:text-blue-600 transition-colors text-xs font-bold">التقويم</Link>
        <ChevronRight size={12} />
        <span className="text-slate-900 font-bold text-xs">{school.name}</span>
      </nav>

      {/* School Header */}
      <div className="bg-slate-900 rounded-[40px] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden group">
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-blue-600 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-400">
                مجمع الشفا التعليمي
              </div>
              <div className="bg-white/10 px-4 py-1 rounded-full text-[10px] font-bold text-blue-300 uppercase tracking-widest border border-white/5">
                تحديث مباشر
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-black mb-6 leading-tight group-hover:text-blue-400 transition-colors">{school.name}</h1>
            <div className="flex flex-wrap gap-6 items-center">
              <div className="flex flex-col">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <BarChart2 size={10} className="text-blue-400" />
                  إجمالي الإنجاز
                </span>
                <span className="text-4xl font-black text-blue-400">{totalProgress.toFixed(1)}%</span>
              </div>
              <div className="flex flex-col border-r border-white/10 pr-6">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5 text-amber-300">
                  <Activity size={10} className="text-amber-400" />
                  المجالات المشتركة (الإدارة والبيئة)
                </span>
                <span className="text-3xl font-black text-amber-400">{sharedProgress.toFixed(1)}%</span>
              </div>
              <div className="flex flex-col border-r border-white/10 pr-6">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <Target size={10} className="text-blue-400" />
                  المجالات الخاصة بالمدرسة
                </span>
                <span className="text-3xl font-black text-white/90">{privateProgress.toFixed(1)}%</span>
              </div>
              <div className="flex flex-col border-r border-white/10 pr-6">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <Layers size={10} className="text-green-400" />
                  الشواهد المعتمدة
                </span>
                <span className="text-3xl font-black text-green-400">
                  {evidence.filter(e => e.status === 'approved' && (e.schoolId === schoolId || e.isShared)).length}
                </span>
              </div>
            </div>
          </div>
          
          <div className="shrink-0 space-y-4">
             <div className="flex flex-col gap-1 items-end text-xs font-bold text-slate-400 bg-white/5 p-4 rounded-3xl border border-white/5">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-blue-500" />
                  <span>العام الدراسي 1447-1448هـ</span>
                </div>
             </div>
             <div className="h-4 bg-white/10 rounded-full overflow-hidden w-full md:w-64 border border-white/10">
               <div 
                 className="h-full bg-blue-500 rounded-full transition-all duration-1000 shadow-[0_0_20px_rgba(59,130,246,0.6)]" 
                 style={{ width: `${totalProgress}%` }}
               ></div>
             </div>
          </div>
        </div>
        
        <div className="absolute top-0 left-0 w-full h-full opacity-20 group-hover:opacity-30 transition-opacity">
          <div className="absolute -top-20 -left-20 w-[500px] h-[500px] bg-blue-600 rounded-full blur-[150px]"></div>
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-amber-500 rounded-full blur-[120px]"></div>
        </div>
      </div>

      {/* Domains Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <Layers className="text-blue-600" size={28} />
            محاور وبنود التقييم
          </h2>
          <span className="text-xs font-bold text-gray-400 bg-gray-100 px-4 py-1.5 rounded-full">
            {domains.length} مجالات رئيسية
          </span>
        </div>

        <div className="space-y-5">
          {domains.map((domain) => (
            <DomainAccordion 
              key={domain.id} 
              domain={domain} 
              standards={standards.filter(s => s.domainId === domain.id)}
              indicators={indicators}
              isExpanded={expandedDomain === domain.id}
              onToggle={() => setExpandedDomain(expandedDomain === domain.id ? null : domain.id)}
              progress={getDomainProgress(domain.id)}
              indicatorProgressGetter={getIndicatorProgress}
              schoolId={schoolId}
              schoolName={school.name}
            />
          ))}
        </div>
      </div>

      {/* Help Card */}
      <div className="bg-blue-50/50 p-8 rounded-[40px] border border-blue-100 flex flex-col md:flex-row items-center gap-8 group">
        <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-blue-200 group-hover:scale-110 transition-transform">
          <Info size={32} />
        </div>
        <div className="flex-1 text-center md:text-right">
          <h3 className="text-xl font-black text-blue-900 mb-2">كيفية متابعة الإنجاز</h3>
          <p className="text-blue-800/70 text-sm leading-relaxed max-w-2xl font-medium">
            مجالي <strong>الإدارة المدرسية</strong> و<strong>البيئة المدرسية</strong> مشتركان لجميع مدارس المجمع، وتظهر فيهما نفس نسبة الإنجاز في كافة المدارس بمجرد اعتماد شواهدها. بينما تختص كل مدرسة بشواهدها في مجالي التعليم والتعلم ونواتج التعلم.
          </p>
        </div>
        <button className="px-8 py-4 bg-white text-blue-600 rounded-2xl font-black text-sm border border-blue-200 shadow-sm hover:bg-blue-600 hover:text-white transition-all whitespace-nowrap">
          دليل الاستخدام
        </button>
      </div>
    </div>
  );
}

function DomainAccordion({ domain, standards, indicators, isExpanded, onToggle, progress, indicatorProgressGetter, schoolId, schoolName }: any) {
  const domainIndicators = indicators.filter((i: any) => standards.some((s: any) => s.id === i.standardId));
  const isShared = isSharedDomain(domain);

  return (
    <div className={`bg-white rounded-[40px] border transition-all duration-500 overflow-hidden ${isExpanded ? (isShared ? 'border-amber-200 shadow-2xl scale-[1.01]' : 'border-blue-200 shadow-2xl scale-[1.01]') : 'border-gray-100 shadow-sm hover:border-blue-100 hover:shadow-md'}`}>
      {/* Header */}
      <div 
        className={`p-8 flex flex-col md:flex-row md:items-center justify-between cursor-pointer transition-colors ${isExpanded ? (isShared ? 'bg-amber-50/30' : 'bg-blue-50/30') : 'bg-white hover:bg-gray-50/30'}`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-6">
          <div className={`w-16 h-16 rounded-3xl flex items-center justify-center transition-all duration-500 ${isExpanded ? (isShared ? 'bg-amber-600 text-white shadow-xl shadow-amber-200 rotate-6' : 'bg-blue-600 text-white shadow-xl shadow-blue-200 rotate-6') : (isShared ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-slate-400')}`}>
            {isShared ? <Activity size={32} /> : <BarChart2 size={32} />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className="text-2xl font-black text-slate-800">{domain.name}</h3>
              {isShared ? (
                <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1 shadow-sm">
                  <Activity size={12} />
                  مجال مشترك بين مدارس المجمع (ينعكس في كافة المدارس)
                </span>
              ) : (
                <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-blue-100">
                  خاص بمدرسة {schoolName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-gray-50/50 px-3 py-1.5 rounded-xl border border-gray-100 w-fit">
              <span>{standards.length} معايير</span>
              <span className="w-1.5 h-1.5 bg-gray-200 rounded-full"></span>
              <span>{domainIndicators.length} مؤشرات أداء</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-8 mt-6 md:mt-0">
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-tighter ${isShared ? 'text-amber-700' : 'text-blue-600'}`}>
                {isShared ? 'إنجاز المجال المشترك' : 'إنجاز المجال الخاص'}
              </span>
              <span className={`text-xl font-black ${isShared ? 'text-amber-700' : 'text-blue-700'}`}>
                {progress !== null ? `${progress.toFixed(0)}%` : '—'}
              </span>
            </div>
            <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-100">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${isShared ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]' : 'bg-blue-600 shadow-[0_0_10px_rgba(59,130,246,0.3)]'}`} 
                style={{ width: `${progress || 0}%` }}
              ></div>
            </div>
          </div>
          <div className={`p-3 rounded-2xl transition-all duration-500 shadow-sm ${isExpanded ? (isShared ? 'bg-amber-600 text-white rotate-180 shadow-amber-200' : 'bg-blue-600 text-white rotate-180 shadow-blue-200') : 'bg-gray-50 text-slate-300'}`}>
            <ChevronDown size={24} />
          </div>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-8 pt-0 animate-in slide-in-from-top-6 duration-500">
          <div className="grid grid-cols-1 gap-8 pt-6 border-t border-blue-50">
            {standards.length > 0 ? standards.map((standard: any) => (
              <div key={standard.id} className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                  <h4 className="font-black text-slate-800 text-lg leading-tight">
                    {standard.name}
                  </h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {indicators.filter((i: any) => i.standardId === standard.id).map((indicator: any) => {
                    const indProgress = indicatorProgressGetter(indicator.id);
                    return (
                      <Link 
                        key={indicator.id}
                        to={`/school/${schoolId}/indicator/${indicator.id}`}
                        className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:border-blue-400 hover:shadow-2xl transition-all flex flex-col justify-between group h-full transform hover:-translate-y-1"
                      >
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${indProgress === 100 ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-slate-300'} group-hover:bg-blue-50 group-hover:text-blue-600`}>
                              {indProgress === 100 ? <CheckCircle size={20} /> : <Network size={20} />}
                            </div>
                            <div className="text-[10px] font-black text-blue-500 bg-blue-50 px-2.5 py-1 rounded-lg">
                              {indProgress.toFixed(0)}%
                            </div>
                          </div>
                          <span className="text-sm font-black text-slate-700 group-hover:text-slate-900 transition-colors leading-relaxed line-clamp-3">
                            {indicator.name}
                          </span>
                        </div>
                        
                        <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
                           <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden mr-1">
                              <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${indProgress}%` }}></div>
                           </div>
                           <ArrowUpRight size={16} className="text-gray-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )) : (
              <div className="p-12 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                <Target className="mx-auto text-gray-300 mb-4 opacity-20" size={48} />
                <p className="text-gray-400 font-bold">لا توجد معايير مضافة لهذا المجال بعد.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
