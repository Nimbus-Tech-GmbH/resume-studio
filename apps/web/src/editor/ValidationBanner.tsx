import { useValidation } from '../validation/useValidation.js';
import { Badge } from '../components/ui/badge.js';
import { AlertCircle } from 'lucide-react';

export function ValidationBanner() {
  const issues = useValidation();
  if (issues.length === 0) return null;
  return (
    <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-900">
      <AlertCircle className="h-4 w-4 text-amber-600" />
      <Badge variant="outline" className="border-amber-400 text-amber-700">
        {issues.length}
      </Badge>
      <span className="font-medium">Validation issues:</span>
      <div className="flex flex-wrap gap-2">
        {issues.slice(0, 3).map((i, idx) => (
          <span key={idx} className="text-amber-800">
            <code className="rounded bg-amber-100 px-1">{i.path || '/'}</code> — {i.message}
          </span>
        ))}
        {issues.length > 3 && (
          <span className="text-amber-700">+{issues.length - 3} more</span>
        )}
      </div>
    </div>
  );
}
