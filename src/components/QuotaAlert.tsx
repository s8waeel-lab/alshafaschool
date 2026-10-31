import { AlertCircle } from 'lucide-react';
import { isFirestoreQuotaTripped } from '../services/firebase';

export default function QuotaAlert() {
  if (!isFirestoreQuotaTripped()) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 p-6 rounded-3xl flex items-start gap-4 text-amber-800 animate-in fade-in slide-in-from-top-4 mb-8 shadow-sm">
      <AlertCircle className="shrink-0 mt-1" size={24} />
      <div className="space-y-1">
        <h3 className="font-black text-sm text-amber-900">تنبيه: تم تجاوز حد الاستهلاك اليومي لقاعدة البيانات</h3>
        <p className="text-xs font-bold leading-relaxed opacity-90">
          بسبب الضغط العالي على النظام حالياً، قد لا تظهر كافة الملفات أو الأعضاء المسجلين بشكل كامل. 
          يتم حالياً عرض البيانات المخزنة مؤقتاً على جهازك فقط. يرجى المحاولة لاحقاً عندما يتم تصفير العداد اليومي (خلال 24 ساعة).
        </p>
      </div>
    </div>
  );
}
