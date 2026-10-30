import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Library, BarChart2, FileText, Search, Clock, CheckCircle, ArrowLeft } from 'lucide-react';
import { getLibraryFiles } from '../services/fileService';
import { useAuth } from '../context/AuthContext';

export default function HomePage() {
  const { profile, isMember, isAdmin } = useAuth();
  const [libraryCount, setLibraryCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    getLibraryFiles(undefined, undefined, !isMember && !isAdmin)
      .then((files) => {
        if (active) setLibraryCount(files.length);
      })
      .catch(() => {
        if (active) setLibraryCount(0);
      });
    return () => {
      active = false;
    };
  }, [isMember, isAdmin]);

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative bg-slate-900 rounded-3xl p-8 md:p-16 text-white overflow-hidden shadow-2xl">
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            مرحباً بك في <span className="text-blue-400">مكتبة مجمع الشفا التعليمي</span>
          </h1>
          <p className="text-lg text-slate-300 mb-8 leading-relaxed">
            المنصة المركزية لإدارة الوثائق التعليمية، التقويم، وشواهد الأداء المدرسي لمجمع الشفا التعليمي بمدارسه الثلاث.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to="/library" className="px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2">
              <Library size={20} />
              تصفح المكتبة
            </Link>
            <Link to="/evaluation" className="px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-bold backdrop-blur-sm transition-all flex items-center gap-2">
              <BarChart2 size={20} />
              التقويم
            </Link>
          </div>
        </div>
        
        {/* Abstract Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-10 left-10 w-64 h-64 bg-blue-500 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-amber-500 rounded-full blur-3xl"></div>
        </div>
      </section>

      {/* Stats Quick Look */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          icon={<Library className="text-blue-600" />} 
          label="المكتبة الرقمية" 
          value={libraryCount === null ? '...' : `${libraryCount} ملف`} 
          description="خطط، برامج، ونماذج مدرسية"
          link="/library"
        />
        <StatCard 
          icon={<BarChart2 className="text-green-600" />} 
          label="التقويم" 
          value="3 مدارس" 
          description="متابعة نسب الإنجاز والشواهد"
          link="/evaluation"
        />
        <StatCard 
          icon={<FileText className="text-amber-600" />} 
          label="التقارير" 
          value="تقارير ذكية" 
          description="تحليل الأداء وأولويات التحسين"
          link="/evaluation"
        />
      </div>

      {/* Account Status for logged in members */}
      {profile && !isMember && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 flex items-start gap-4">
          <Clock className="text-amber-600 shrink-0" size={24} />
          <div>
            <h3 className="font-bold text-amber-900">حسابك قيد المراجعة</h3>
            <p className="text-amber-700 text-sm mt-1">
              تم استلام طلب تسجيلك. سيقوم مدير النظام بمراجعة حسابك وتفعيله لتتمكن من رفع الملفات والشواهد قريباً. يمكنك حالياً تصفح المحتوى العام.
            </p>
          </div>
        </div>
      )}

      {/* Featured Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Digital Library Intro */}
        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              <Library className="text-blue-600" />
              المكتبة الرقمية
            </h2>
            <Link to="/library" className="text-blue-600 hover:gap-2 transition-all flex items-center gap-1 text-sm font-bold">
              عرض الكل
              <ArrowLeft size={16} />
            </Link>
          </div>
          <p className="text-gray-600 mb-6">
            نظام متكامل لتنظيم الملفات المدرسية وتصنيفها، يسهل الوصول إلى الخطط والتعاميم والنماذج الرسمية في مكان واحد.
          </p>
          <div className="space-y-3">
            {['الخطط المدرسية', 'البرامج والمبادرات', 'التعاميم الرسمية', 'نماذج التقارير'].map(cat => (
              <div key={cat} className="flex items-center gap-2 text-sm text-gray-500">
                <CheckCircle size={14} className="text-blue-500" />
                {cat}
              </div>
            ))}
          </div>
        </div>

        {/* Self Evaluation Intro */}
        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              <BarChart2 className="text-green-600" />
              التقويم
            </h2>
            <Link to="/evaluation" className="text-green-600 hover:gap-2 transition-all flex items-center gap-1 text-sm font-bold">
              عرض التقدم
              <ArrowLeft size={16} />
            </Link>
          </div>
          <p className="text-gray-600 mb-6">
            متابعة شواهد الأداء المدرسي وتوثيقها وفق مجالات التقويم الأربعة، مع نظام حساب إنجاز ذكي وتلقائي.
          </p>
          <div className="space-y-3">
            {['الإدارة المدرسية (مشترك بين المدارس)', 'البيئة المدرسية (مشترك بين المدارس)', 'التعليم والتعلم (خاص بكل مدرسة)', 'نواتج التعلم (خاص بكل مدرسة)'].map(domain => (
              <div key={domain} className="flex items-center gap-2 text-sm text-gray-500">
                <CheckCircle size={14} className="text-green-500" />
                {domain}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, description, link }: any) {
  return (
    <Link to={link} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center gap-5">
      <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <h4 className="text-sm font-medium text-gray-500">{label}</h4>
        <div className="text-xl font-bold text-slate-800 my-1">{value}</div>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
    </Link>
  );
}
