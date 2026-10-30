import { 
  collection, 
  getDocs, 
  getDocsFromCache,
  query, 
  where, 
  orderBy, 
  doc, 
  setDoc
} from 'firebase/firestore';
import { db, readLocalCache, writeLocalCache, runFirestoreOp } from './firebase';

export interface School {
  id: string;
  name: string;
  order: number;
}

export interface Domain {
  id: string;
  name: string;
  order: number;
  isShared: boolean;
}

export interface Standard {
  id: string;
  name: string;
  domainId: string;
  order: number;
}

export interface Indicator {
  id: string;
  name: string;
  standardId: string;
  isShared: boolean;
  targetEvidenceCount: number;
  order: number;
}

export const DEFAULT_SCHOOLS: School[] = [
  { id: 'sch_primary', name: 'الشفا الابتدائية', order: 1 },
  { id: 'sch_intermediate', name: 'الشفا المتوسطة', order: 2 },
  { id: 'sch_secondary', name: 'الشفا الثانوية', order: 3 },
];

export const DEFAULT_DOMAINS: Domain[] = [
  { id: 'dom_teach', name: 'التعليم والتعلم', order: 1, isShared: false },
  { id: 'dom_results', name: 'نواتج التعلم', order: 2, isShared: false },
  { id: 'dom_mgmt', name: 'الإدارة المدرسية', order: 3, isShared: true },
  { id: 'dom_env', name: 'البيئة المدرسية', order: 4, isShared: true },
];

export const DEFAULT_STANDARDS: Standard[] = [
  // التعليم والتعلم
  { id: 'std_teach_1', name: 'بناء خبرات التعلم', domainId: 'dom_teach', order: 1 },
  { id: 'std_teach_2', name: 'تقويم التعلم', domainId: 'dom_teach', order: 2 },
  // نواتج التعلم
  { id: 'std_results_1', name: 'التحصيل العلمي', domainId: 'dom_results', order: 1 },
  { id: 'std_results_2', name: 'التطور الشخصي والصحي والاجتماعي', domainId: 'dom_results', order: 2 },
  // الإدارة المدرسية
  { id: 'std_mgmt_1', name: 'التخطيط', domainId: 'dom_mgmt', order: 1 },
  { id: 'std_mgmt_2', name: 'قيادة العملية التعليمية', domainId: 'dom_mgmt', order: 2 },
  { id: 'std_mgmt_3', name: 'المجتمع المدرسي', domainId: 'dom_mgmt', order: 3 },
  { id: 'std_mgmt_4', name: 'التطوير المؤسسي', domainId: 'dom_mgmt', order: 4 },
  { id: 'std_mgmt_5', name: 'حقوق المتعلم وحمايته', domainId: 'dom_mgmt', order: 5 },
  // البيئة المدرسية
  { id: 'std_env_1', name: 'المبنى المدرسي', domainId: 'dom_env', order: 1 },
  { id: 'std_env_2', name: 'الأمن والسلامة', domainId: 'dom_env', order: 2 },
];

export const DEFAULT_INDICATORS: Indicator[] = [
  // التعليم والتعلم - بناء خبرات التعلم
  { id: 'ind_1_1_1_2', name: '(1-1-1-2): توفر المدرسة فرصاً متكافئة للتعلم تلبي احتياجات المتعلمين ومنهم ذوو الإعاقة والموهوبون', standardId: 'std_teach_1', isShared: false, targetEvidenceCount: 6, order: 1 },
  { id: 'ind_2_1_1_2', name: '(2-1-1-2): تدعم المدرسة تنفيذ المناهج؛ بما يحقق نواتج التعلم المستهدفة', standardId: 'std_teach_1', isShared: false, targetEvidenceCount: 6, order: 2 },
  { id: 'ind_3_1_1_2', name: '(3-1-1-2): تنوع المدرسة في استراتيجيات التعليم والتعلم؛ لتلبية احتياجات المتعلمين ودعم تعلمهم', standardId: 'std_teach_1', isShared: false, targetEvidenceCount: 6, order: 3 },
  { id: 'ind_4_1_1_2', name: '(4-1-1-2): تفعّل المدرسة التقنية الرقمية لدعم تعلم المتعلمين وتلبية احتياجاتهم', standardId: 'std_teach_1', isShared: false, targetEvidenceCount: 6, order: 4 },
  { id: 'ind_5_1_1_2', name: '(5-1-1-2): تنفذ المدرسة أنشطة تعلم تطبيقية ترتبط بحياة المتعلمين', standardId: 'std_teach_1', isShared: false, targetEvidenceCount: 6, order: 5 },
  { id: 'ind_6_1_1_2', name: '(6-1-1-2): تنمي المدرسة المهارات القرائية والعددية الأساسية لدى المتعلمين', standardId: 'std_teach_1', isShared: false, targetEvidenceCount: 6, order: 6 },
  { id: 'ind_7_1_1_2', name: '(7-1-1-2): تنمي المدرسة مهارات التفكير والبحث والابتكار لدى المتعلمين', standardId: 'std_teach_1', isShared: false, targetEvidenceCount: 6, order: 7 },
  { id: 'ind_8_1_1_2', name: '(8-1-1-2): تنمي المدرسة المهارات العاطفية والاجتماعية لدى المتعلمين', standardId: 'std_teach_1', isShared: false, targetEvidenceCount: 6, order: 8 },
  { id: 'ind_9_1_1_2', name: '(9-1-1-2): تعزز المدرسة دافعية المتعلمين للتعلم والاستمتاع به', standardId: 'std_teach_1', isShared: false, targetEvidenceCount: 6, order: 9 },
  // التعليم والتعلم - تقويم التعلم
  { id: 'ind_1_1_2_2', name: '(1-1-2-2): تطبق المدرسة أساليب وأدوات تقويم متنوعة للكشف عن مستويات أداء المتعلمين المختلفة', standardId: 'std_teach_2', isShared: false, targetEvidenceCount: 6, order: 10 },
  { id: 'ind_2_1_2_2', name: '(2-1-2-2): تطبق المدرسة أساليب وأدوات متنوعة لتقويم نواتج التعلم المستهدفة في مناهج التعليم', standardId: 'std_teach_2', isShared: false, targetEvidenceCount: 6, order: 11 },
  { id: 'ind_3_1_2_2', name: '(3-1-2-2): تحلل المدرسة نتائج التقويم، وتوظفها في تحسين عمليات التعليم والتعلم والتقويم', standardId: 'std_teach_2', isShared: false, targetEvidenceCount: 6, order: 12 },
  { id: 'ind_4_1_2_2', name: '(4-1-2-2): تقدم المدرسة التغذية الراجعة للمتعلمين وأولياء أمورهم بانتظام، وتتابع تقدمهم بشكل مستمر', standardId: 'std_teach_2', isShared: false, targetEvidenceCount: 6, order: 13 },
  
  // نواتج التعلم - التحصيل العلمي
  { id: 'ind_1_1_1_3', name: '(1-1-1-3): يحقق المتعلمون نتائج مرتفعة في مجال القراءة وفقاً للاختبارات الوطنية', standardId: 'std_results_1', isShared: false, targetEvidenceCount: 6, order: 1 },
  { id: 'ind_2_1_1_3', name: '(2-1-1-3): يحقق المتعلمون نتائج مرتفعة في مجال الرياضيات وفقاً للاختبارات الوطنية', standardId: 'std_results_1', isShared: false, targetEvidenceCount: 6, order: 2 },
  { id: 'ind_3_1_1_3', name: '(3-1-1-3): يحقق المتعلمون نتائج مرتفعة في مجال العلوم وفقاً للاختبارات الوطنية', standardId: 'std_results_1', isShared: false, targetEvidenceCount: 6, order: 3 },
  { id: 'ind_4_1_1_3', name: '(4-1-1-3): يحقق المتعلمون تقدماً في مجال القراءة قياساً على مستوى أداء المدرسة السابق في الاختبارات الوطنية', standardId: 'std_results_1', isShared: false, targetEvidenceCount: 6, order: 4 },
  { id: 'ind_5_1_1_3', name: '(5-1-1-3): يحقق المتعلمون تقدماً في مجال الرياضيات قياساً على مستوى أداء المدرسة السابق في الاختبارات الوطنية', standardId: 'std_results_1', isShared: false, targetEvidenceCount: 6, order: 5 },
  { id: 'ind_6_1_1_3', name: '(6-1-1-3): يحقق المتعلمون تقدماً في مجال العلوم قياساً على مستوى أداء المدرسة السابق في الاختبارات الوطنية', standardId: 'std_results_1', isShared: false, targetEvidenceCount: 6, order: 6 },
  { id: 'ind_7_1_1_3', name: '(7-1-1-3): يحقق المتعلمون نتائج متقدمة في الاختبارات التحصيلية وفقاً للاختبارات الوطنية', standardId: 'std_results_1', isShared: false, targetEvidenceCount: 6, order: 7 },
  { id: 'ind_8_1_1_3', name: '(8-1-1-3): يحقق المتعلمون نتائج متقدمة في اختبارات القدرات العامة', standardId: 'std_results_1', isShared: false, targetEvidenceCount: 6, order: 8 },
  // نواتج التعلم - التطور الشخصي والصحي والاجتماعي
  { id: 'ind_1_2_1_3', name: '(1-2-1-3): يظهر المتعلمون الاعتزاز بالقيم والهوية الوطنية', standardId: 'std_results_2', isShared: false, targetEvidenceCount: 6, order: 9 },
  { id: 'ind_2_2_1_3', name: '(2-2-1-3): يظهر المتعلمون اتجاهات إيجابية نحو ذواتهم والآخرين', standardId: 'std_results_2', isShared: false, targetEvidenceCount: 6, order: 10 },
  { id: 'ind_3_2_1_3', name: '(3-2-1-3): يظهر المتعلمون التزاماً بالممارسات الصحية السليمة', standardId: 'std_results_2', isShared: false, targetEvidenceCount: 6, order: 11 },
  { id: 'ind_4_2_1_3', name: '(4-2-1-3): يشارك المتعلمون في الأنشطة المجتمعية والأعمال التطوعية', standardId: 'std_results_2', isShared: false, targetEvidenceCount: 6, order: 12 },
  { id: 'ind_5_2_1_3', name: '(5-2-1-3): يلتزم المتعلمون بقواعد السلوك والانضباط المدرسي', standardId: 'std_results_2', isShared: false, targetEvidenceCount: 6, order: 13 },
  { id: 'ind_6_2_1_3', name: '(6-2-1-3): يظهر المتعلمون الاستقلالية والقدرة على التعلم الذاتي', standardId: 'std_results_2', isShared: false, targetEvidenceCount: 6, order: 14 },
  { id: 'ind_7_2_1_3', name: '(7-2-1-3): يظهر المتعلمون اعتزازاً بثقافتهم واحتراماً للتنوع الثقافي في المجتمع', standardId: 'std_results_2', isShared: false, targetEvidenceCount: 6, order: 15 },

  // الإدارة المدرسية - التخطيط
  { id: 'ind_1_1_1_1', name: '(1-1-1-1): تضع المدرسة خطة تشغيلية شاملة وفق أهداف تطويرية محددة', standardId: 'std_mgmt_1', isShared: true, targetEvidenceCount: 6, order: 1 },
  { id: 'ind_2_1_1_1', name: '(2-1-1-1): تتابع المدرسة تنفيذ خطتها التشغيلية وتطورها بما يضمن تحقيق أهدافها', standardId: 'std_mgmt_1', isShared: true, targetEvidenceCount: 6, order: 2 },
  // الإدارة المدرسية - قيادة العملية التعليمية
  { id: 'ind_1_1_2_1', name: '(1-1-2-1): تعزز المدرسة القيم الإسلامية والهوية الوطنية', standardId: 'std_mgmt_2', isShared: true, targetEvidenceCount: 6, order: 3 },
  { id: 'ind_2_1_2_1', name: '(2-1-2-1): تطبق المدرسة قيم مهنة التعليم وأخلاقياتها، وتتابع الالتزام بها', standardId: 'std_mgmt_2', isShared: true, targetEvidenceCount: 6, order: 4 },
  { id: 'ind_3_1_2_1', name: '(3-1-2-1): تطبق المدرسة إجراءات محددة لدعم الانضباط المدرسي، وتتابع الالتزام بها', standardId: 'std_mgmt_2', isShared: true, targetEvidenceCount: 6, order: 5 },
  { id: 'ind_4_1_2_1', name: '(4-1-2-1): تنفذ المدرسة برامج وأنشطة تربوية داعمة للسلوك الإيجابي لدى المتعلمين، ومنهم ذوو الإعاقة والموهوبون وتتابعها', standardId: 'std_mgmt_2', isShared: true, targetEvidenceCount: 6, order: 6 },
  { id: 'ind_5_1_2_1', name: '(5-1-2-1): تنفذ المدرسة برامج وأنشطة إثرائية لتطوير مواهب المتعلمين، وتهيئهم للمستقبل', standardId: 'std_mgmt_2', isShared: true, targetEvidenceCount: 6, order: 7 },
  // الإدارة المدرسية - المجتمع المدرسي
  { id: 'ind_1_1_3_1', name: '(1-1-3-1): تعزز المدرسة بناء العلاقات الإيجابية والتعاون في المجتمع المدرسي', standardId: 'std_mgmt_3', isShared: true, targetEvidenceCount: 6, order: 8 },
  { id: 'ind_2_1_3_1', name: '(2-1-3-1): تعزز المدرسة مشاركة الأسرة في تعلم أبنائها، والتحضير لمستقبلهم', standardId: 'std_mgmt_3', isShared: true, targetEvidenceCount: 6, order: 9 },
  { id: 'ind_3_1_3_1', name: '(3-1-3-1): تعزز المدرسة الشراكة المجتمعية؛ لدعم التعلم والتأثير الإيجابي في المجتمع', standardId: 'std_mgmt_3', isShared: true, targetEvidenceCount: 6, order: 10 },
  // الإدارة المدرسية - التطوير المؤسسي
  { id: 'ind_1_4_1_1', name: '(1-4-1-1): تدعم المدرسة منسوبيها للحصول على الرخصة المهنية وتتابعها', standardId: 'std_mgmt_4', isShared: true, targetEvidenceCount: 6, order: 11 },
  { id: 'ind_5_1_4_1', name: '(5-1-4-1): تدعم المدرسة التطوير المهني لمنسوبيها وفقاً لنتائج تقويم الأداء الوظيفي وتحليل احتياجاتهم', standardId: 'std_mgmt_4', isShared: true, targetEvidenceCount: 6, order: 12 },
  { id: 'ind_6_1_4_1', name: '(6-1-4-1): تطبق المدرسة التقويم المبني على المعايير المعتمدة من الهيئة بشكل مستمر', standardId: 'std_mgmt_4', isShared: true, targetEvidenceCount: 6, order: 13 },
  { id: 'ind_7_1_4_1', name: '(7-1-4-1): تنفذ المدرسة خطة للتحسين بناءً على نتائج التقويم المدرسي، وتتابعها', standardId: 'std_mgmt_4', isShared: true, targetEvidenceCount: 6, order: 14 },
  // الإدارة المدرسية - حقوق المتعلم وحمايته
  { id: 'ind_1_1_5_1', name: '(1-1-5-1): تلتزم المدرسة بالمحافظة على حقوق المتعلمين وحمايتهم', standardId: 'std_mgmt_5', isShared: true, targetEvidenceCount: 6, order: 15 },
  { id: 'ind_2_1_5_1', name: '(2-1-5-1): توفر المدرسة مناخاً آمناً للتعلم والنمو نفسياً واجتماعياً', standardId: 'std_mgmt_5', isShared: true, targetEvidenceCount: 6, order: 16 },

  // البيئة المدرسية - المبنى المدرسي
  { id: 'ind_1_1_4_1', name: '(1-1-4-1): توفر المدرسة مبنى تعليمي يستوفي المواصفات والاشتراطات المعتمدة من حيث النوع والخدمات المساندة', standardId: 'std_env_1', isShared: true, targetEvidenceCount: 6, order: 1 },
  { id: 'ind_2_1_4_1', name: '(2-1-4-1): تنظيم مبنى المدرسة ملائم لعدد المتعلمين وخصائص المرحلة العمرية، ومنهم ذوو الإعاقة', standardId: 'std_env_1', isShared: true, targetEvidenceCount: 6, order: 2 },
  { id: 'ind_3_1_4_1', name: '(3-1-4-1): تتوافر فصول ومعامل ملائمة للعملية التعليمية تلبي احتياجات المتعلمين ومنهم ذوو الإعاقة', standardId: 'std_env_1', isShared: true, targetEvidenceCount: 6, order: 3 },
  { id: 'ind_4_1_4_1', name: '(4-1-4-1): تلبي المرافق والخدمات المساندة احتياجات المتعلمين ومنهم ذوو الإعاقة', standardId: 'std_env_1', isShared: true, targetEvidenceCount: 6, order: 4 },
  // البيئة المدرسية - الأمن والسلامة
  { id: 'ind_1_2_4_1', name: '(1-2-4-1): تتوافر في مبنى المدرسة ومرافقها جميع متطلبات الأمن والسلامة', standardId: 'std_env_2', isShared: true, targetEvidenceCount: 6, order: 5 },
  { id: 'ind_2_2_4_1', name: '(2-2-4-1): تتابع المدرسة صيانة المبنى وجميع مرافقه وتجهيزاته بشكل دوري', standardId: 'std_env_2', isShared: true, targetEvidenceCount: 6, order: 6 },
  { id: 'ind_3_2_4_1', name: '(3-2-4-1): تتابع المدرسة نظافة المبنى المدرسي وجميع مرافقه بشكل مستمر', standardId: 'std_env_2', isShared: true, targetEvidenceCount: 6, order: 7 },
];

export const isSharedDomain = (domain?: { id?: string; name?: string; isShared?: boolean } | null): boolean => {
  if (!domain) return false;
  if (domain.isShared === true) return true;
  if (domain.id === 'dom_mgmt' || domain.id === 'dom_env') return true;
  
  if (domain.name) {
    const cleanName = domain.name.trim();
    const sharedKeywords = [
      'الإدارة المدرسية', 'الادارة المدرسية', 'الاداره المدرسيه', 'الإداره المدرسيه',
      'البيئة المدرسية', 'البيئة المدرسيه', 'البيئه المدرسيه', 'البيئه المدرسية',
      'المبنى المدرسي', 'المبني المدرسي', 'المباني المدرسية',
      'الأمن والسلامة', 'الامن والسلامه', 'الأمن والسلامه', 'الامن والسلامة',
      'القيادة والتخطيط', 'التخطيط والقيادة'
    ];
    return sharedKeywords.some(keyword => cleanName.includes(keyword));
  }
  return false;
};

export const isSharedIndicator = (
  indicator?: { id?: string; isShared?: boolean; standardId?: string } | null,
  parentDomain?: { id?: string; name?: string; isShared?: boolean } | null
): boolean => {
  if (!indicator) return false;
  if (indicator.isShared === true) return true;
  if (parentDomain && isSharedDomain(parentDomain)) return true;
  return false;
};

export const getSchools = async (): Promise<School[]> => {
  const q = query(collection(db, 'schools'), orderBy('order', 'asc'));
  try {
    const snap = await runFirestoreOp(() => getDocs(q));
    if (!snap.empty) {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as School));
      writeLocalCache('shafa_schools', list);
      return list;
    }
  } catch {
    try {
      const cached = await getDocsFromCache(q);
      if (!cached.empty) {
        const list = cached.docs.map(d => ({ id: d.id, ...d.data() } as School));
        writeLocalCache('shafa_schools', list);
        return list;
      }
    } catch {
      // Ignore cache error
    }
  }
  return readLocalCache<School[]>('shafa_schools', DEFAULT_SCHOOLS);
};

export const getDomains = async (): Promise<Domain[]> => {
  const q = query(collection(db, 'domains'), orderBy('order', 'asc'));
  try {
    const snap = await runFirestoreOp(() => getDocs(q));
    if (!snap.empty) {
      const list = snap.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          name: data.name,
          order: data.order,
          isShared: isSharedDomain({ ...data, id: d.id })
        } as Domain;
      });
      writeLocalCache('shafa_domains', list);
      return list;
    }
  } catch {
    try {
      const cached = await getDocsFromCache(q);
      if (!cached.empty) {
        const list = cached.docs.map(d => {
          const data = d.data();
          return {
            ...data,
            id: d.id,
            name: data.name,
            order: data.order,
            isShared: isSharedDomain({ ...data, id: d.id })
          } as Domain;
        });
        writeLocalCache('shafa_domains', list);
        return list;
      }
    } catch {
      // Ignore cache error
    }
  }
  return readLocalCache<Domain[]>('shafa_domains', DEFAULT_DOMAINS);
};

export const getAllStandards = async (): Promise<Standard[]> => {
  const q = query(collection(db, 'standards'), orderBy('order', 'asc'));
  try {
    const snap = await runFirestoreOp(() => getDocs(q));
    if (!snap.empty) {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Standard));
      writeLocalCache('shafa_standards', list);
      return list;
    }
  } catch {
    try {
      const cached = await getDocsFromCache(q);
      if (!cached.empty) {
        const list = cached.docs.map(d => ({ id: d.id, ...d.data() } as Standard));
        writeLocalCache('shafa_standards', list);
        return list;
      }
    } catch {
      // Ignore cache error
    }
  }
  return readLocalCache<Standard[]>('shafa_standards', DEFAULT_STANDARDS);
};

export const getAllIndicators = async (): Promise<Indicator[]> => {
  const q = query(collection(db, 'indicators'), orderBy('order', 'asc'));
  try {
    const snap = await runFirestoreOp(() => getDocs(q));
    if (!snap.empty) {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Indicator));
      writeLocalCache('shafa_indicators', list);
      return list;
    }
  } catch {
    try {
      const cached = await getDocsFromCache(q);
      if (!cached.empty) {
        const list = cached.docs.map(d => ({ id: d.id, ...d.data() } as Indicator));
        writeLocalCache('shafa_indicators', list);
        return list;
      }
    } catch {
      // Ignore cache error
    }
  }
  return readLocalCache<Indicator[]>('shafa_indicators', DEFAULT_INDICATORS);
};

export const getStandardsByDomain = async (domainId: string) => {
  const all = await getAllStandards();
  return all
    .filter(s => s.domainId === domainId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
};

export const getIndicatorsByStandard = async (standardId: string) => {
  const all = await getAllIndicators();
  return all
    .filter(i => i.standardId === standardId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
};

// Initial data seeder (for owner only)
export const seedInitialStructure = async () => {
  writeLocalCache('shafa_schools', DEFAULT_SCHOOLS);
  writeLocalCache('shafa_domains', DEFAULT_DOMAINS);
  writeLocalCache('shafa_standards', DEFAULT_STANDARDS);
  writeLocalCache('shafa_indicators', DEFAULT_INDICATORS);

  try {
    for (const s of DEFAULT_SCHOOLS) await runFirestoreOp(() => setDoc(doc(db, 'schools', s.id), s));
    for (const d of DEFAULT_DOMAINS) await runFirestoreOp(() => setDoc(doc(db, 'domains', d.id), d));
    for (const st of DEFAULT_STANDARDS) await runFirestoreOp(() => setDoc(doc(db, 'standards', st.id), st));
    for (const ind of DEFAULT_INDICATORS) await runFirestoreOp(() => setDoc(doc(db, 'indicators', ind.id), ind));
  } catch {
    // Saved in local cache if Firestore quota is temporarily exceeded
  }
};



