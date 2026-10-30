import { useState, useEffect } from 'react';
import { Evidence, getAllEvidenceResilient } from '../services/evidenceService';
import { calculateIndicatorProgress, calculateAverageProgress } from '../utils/calculations';
import { 
  Standard, 
  Indicator, 
  Domain, 
  School,
  getSchools,
  getDomains,
  getAllStandards,
  getAllIndicators,
  isSharedDomain,
  isSharedIndicator
} from '../services/evaluationService';
import { 
  AlertTriangle, 
  Activity, 
  School as SchoolIcon, 
  ChevronLeft,
  Building,
  CheckCircle,
  Network
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SelfEvaluationPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loadingData, setLoadingData] = useState({
    schools: true,
    domains: true,
    standards: true,
    indicators: true,
    evidence: true
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchAllData = async () => {
      try {
        const [schoolsData, domainsData, standardsData, indicatorsData, evidenceData] = await Promise.all([
          getSchools(),
          getDomains(),
          getAllStandards(),
          getAllIndicators(),
          getAllEvidenceResilient()
        ]);
        if (!active) return;
        setSchools(schoolsData);
        setDomains(domainsData);
        setStandards(standardsData);
        setIndicators(indicatorsData);
        setEvidence(evidenceData);
      } catch {
        if (!active) return;
        setError('تعذر تحميل بيانات المدارس والمجالات.');
      } finally {
        if (active) {
          setLoadingData({
            schools: false,
            domains: false,
            standards: false,
            indicators: false,
            evidence: false
          });
        }
      }
    };
    fetchAllData();
    return () => {
      active = false;
    };
  }, []);

  const getDomainProgress = (domainId: string, schoolId: string) => {
    const domainStandards = standards.filter(s => s.domainId === domainId);
    const domainIndicators = indicators.filter(i => domainStandards.some(s => s.id === i.standardId));
    if (domainIndicators.length === 0) return null; // Use null to indicate "no data"

    const indicatorPercentages = domainIndicators.map(ind => {
      const std = standards.find(s => s.id === ind.standardId);
      const dom = domains.find(d => d.id === std?.domainId);
      const isShared = isSharedIndicator(ind, dom);
      
      const indEv = evidence.filter(e => {
        if (e.indicatorId !== ind.id) return false;
        return isShared || e.isShared || e.schoolId === schoolId;
      });
      
      return calculateIndicatorProgress(indEv, ind.targetEvidenceCount || 6).approved;
    });

    return calculateAverageProgress(indicatorPercentages);
  };

  const getSchoolProgress = (schoolId: string) => {
    if (domains.length === 0) return 0;
    
    const domainPercentages = domains.map(domain => {
      return getDomainProgress(domain.id, schoolId);
    }).filter(p => p !== null) as number[];

    return calculateAverageProgress(domainPercentages);
  };

  const isLoading = Object.values(loadingData).some(v => v);

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-gray-500 font-bold">جاري تحميل بيانات التقويم المباشرة...</p>
    </div>
  );
  
  if (error) return (
    <div className="bg-red-50 p-12 rounded-3xl text-center border border-red-100">
      <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
      <h3 className="text-xl font-bold text-red-900 mb-2">حدث خطأ</h3>
      <p className="text-red-700">{error}</p>
      <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-red-600 text-white rounded-xl font-bold">إعادة المحاولة</button>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="bg-white p-8 md:p-12 rounded-[40px] border border-gray-100 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold mb-4">
            <Building size={14} />
            <span>مجمع الشفا التعليمي</span>
          </div>
          <h1 className="text-4xl font-black text-slate-800 mb-2">التقويم وشواهده</h1>
          <p className="text-gray-500 text-lg max-w-3xl">
            متابعة نسب الإنجاز المباشرة للمدارس. مجالي <strong>الإدارة المدرسية</strong> و<strong>البيئة المدرسية</strong> مشتركة بين المدارس الثلاث وتنعكس في كافة المدارس بالتساوي.
          </p>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-32 -mt-32 opacity-50 blur-3xl"></div>
      </div>

      {/* Shared Domains Overview Box */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {domains.filter(d => isSharedDomain(d)).map(domain => {
          // Progress is shared, so schoolId can be 'shared' or any school
          const sharedProgress = getDomainProgress(domain.id, 'shared');
          const domainStandards = standards.filter(s => s.domainId === domain.id);
          const domainIndicators = indicators.filter(i => domainStandards.some(s => s.id === i.standardId));
          const approvedCount = evidence.filter(e => 
            e.status === 'approved' && 
            domainIndicators.some(ind => ind.id === e.indicatorId)
          ).length;

          return (
            <div key={domain.id} className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white p-6 md:p-8 rounded-[32px] border border-amber-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-amber-700 text-xs font-black uppercase tracking-wider bg-amber-100/80 px-3 py-1 rounded-full border border-amber-200">
                    <Activity size={14} />
                    <span>مجال مشترك بين الثلاث مدارس</span>
                  </div>
                  <span className="text-2xl font-black text-amber-700">
                    {sharedProgress !== null ? `${sharedProgress.toFixed(1)}%` : '—'}
                  </span>
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">{domain.name}</h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  شواهد هذا المجال مشتركة للمجمع وتنعكس بنسبة موحدة في كل من: (الشفا الابتدائية، الشفا المتوسطة، الشفا الثانوية).
                </p>
              </div>

              <div className="space-y-2 mt-4 pt-4 border-t border-amber-100">
                <div className="flex justify-between items-center text-[11px] font-bold text-slate-600">
                  <span>الشواهد المعتمدة للمجمع:</span>
                  <span className="font-black text-amber-800">{approvedCount} شاهد</span>
                </div>
                <div className="h-3 bg-amber-100 rounded-full overflow-hidden p-0.5">
                  <div 
                    className="h-full bg-amber-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                    style={{ width: `${sharedProgress || 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Schools Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {schools.length > 0 ? schools.map((school) => (
          <SchoolCard 
            key={school.id} 
            school={school} 
            progress={getSchoolProgress(school.id)}
            domains={domains}
            getDomainProgress={(domainId: string) => getDomainProgress(domainId, school.id)}
          />
        )) : (
          <div className="col-span-3 bg-amber-50 p-12 rounded-3xl text-center border border-amber-100">
            <AlertTriangle className="mx-auto text-amber-500 mb-4" size={48} />
            <h3 className="text-xl font-bold text-amber-900 mb-2">لا توجد مدارس مضافة بعد</h3>
            <p className="text-amber-700">يرجى من مدير النظام تهيئة هيكل المدارس والمجالات من لوحة الإدارة.</p>
          </div>
        )}
      </div>

      {/* Information Banner */}
      <div className="bg-gradient-to-br from-blue-50 to-amber-50/50 p-8 md:p-10 rounded-[40px] border border-blue-100 mt-12 relative overflow-hidden shadow-sm">
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-600 border border-amber-200/50">
              <Activity size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800">
                المجالات المشتركة بمجمع الشفا التعليمي
              </h2>
              <p className="text-xs text-amber-700 font-bold">
                مجال الإدارة المدرسية + مجال البيئة المدرسية (مشتركة بين المدارس الثلاث)
              </p>
            </div>
          </div>
          <p className="text-slate-600 leading-relaxed text-sm md:text-base max-w-4xl">
            وفقاً لنظام مجمع الشفا التعليمي، يُعتبر كلاً من مجال <strong>الإدارة المدرسية</strong> ومجال <strong>البيئة المدرسية</strong> مجالين مشتركين وموحدين للمجمع كاملاً. أي شاهد يتم اعتماده في أي من هذين المجالين يُحتسب تلقائياً وبشكل متساوٍ ضمن نسب إنجاز جميع المدارس الثلاث (الابتدائية، المتوسطة، الثانوية)، بينما تختص كل مدرسة بشواهدها المستقلة في مجالي <strong>التعليم والتعلم</strong> و<strong>نواتج التعلم</strong>.
          </p>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-200 rounded-full -mr-32 -mt-32 opacity-20 blur-3xl pointer-events-none"></div>
      </div>
    </div>
  );
}

function SchoolCard({ 
  school, 
  progress, 
  domains, 
  getDomainProgress 
}: { 
  school: School; 
  progress: number; 
  domains: Domain[]; 
  getDomainProgress: (domainId: string) => number | null; 
}) {
  return (
    <div className="bg-white rounded-[40px] overflow-hidden border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 group flex flex-col h-full transform hover:-translate-y-2">
      <div className="bg-slate-900 p-8 text-white relative">
        <SchoolIcon className="text-blue-400 mb-6 group-hover:scale-110 transition-transform" size={48} />
        <h3 className="text-2xl font-black leading-tight mb-1">{school.name}</h3>
        <div className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold inline-block backdrop-blur-sm tracking-widest uppercase">
          مجمع الشفا التعليمي
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600 rounded-full -mr-16 -mt-16 opacity-20 blur-2xl"></div>
      </div>
      
      <div className="p-8 space-y-6 flex-1 flex flex-col">
        <div className="space-y-3">
          <div className="flex justify-between items-end">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">الإنجاز الإجمالي المعتمد</span>
            <span className="text-2xl font-black text-blue-600">{progress.toFixed(1)}%</span>
          </div>
          <div className="h-4 bg-gray-100 rounded-full overflow-hidden shadow-inner p-0.5">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(59,130,246,0.5)]" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Domains Breakdown for this School */}
        <div className="space-y-2.5 pt-2 border-t border-gray-100">
          <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>نسب الإنجاز بالمجالات:</span>
          </div>
          <div className="space-y-2">
            {domains.map((dom) => {
              const isShared = isSharedDomain(dom);
              const p = getDomainProgress(dom.id);
              return (
                <div key={dom.id} className="bg-gray-50/70 p-3 rounded-2xl border border-gray-100 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-700 text-xs">{dom.name}</span>
                      {isShared ? (
                        <span className="text-[9px] bg-amber-100 text-amber-800 font-black px-1.5 py-0.5 rounded border border-amber-200">
                          مشترك
                        </span>
                      ) : (
                        <span className="text-[9px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded border border-blue-100">
                          خاص
                        </span>
                      )}
                    </div>
                    <span className={`font-black ${isShared ? 'text-amber-700' : 'text-blue-700'}`}>
                      {p !== null ? `${p.toFixed(0)}%` : '—'}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-200/80 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${isShared ? 'bg-amber-500' : 'bg-blue-600'}`}
                      style={{ width: `${p || 0}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
          <div className="bg-gray-50/80 p-3 rounded-2xl border border-gray-100 flex flex-col items-center">
            <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">الحالة</div>
            <div className={`text-[10px] font-black px-2 py-1 rounded-lg ${progress === 100 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {progress === 100 ? 'مكتمل' : 'جاري العمل'}
            </div>
          </div>
          <div className="bg-gray-50/80 p-3 rounded-2xl border border-gray-100 flex flex-col items-center">
            <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">التقويم</div>
            <div className="text-lg font-black text-slate-800">1448</div>
          </div>
        </div>

        <div className="mt-auto pt-4">
          <Link 
            to={`/school/${school.id}`} 
            className="w-full py-4 bg-slate-900 hover:bg-blue-600 text-white rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-blue-200 group-hover:scale-[1.02]"
          >
            عرض المعايير والمؤشرات
            <ChevronLeft size={18} className="transition-transform group-hover:-translate-x-1" />
          </Link>
        </div>
      </div>
    </div>
  );
}
