import { useValidation } from '../validation/useValidation.js';
import { Badge } from '../components/ui/badge.js';
import { AlertCircle, AlertTriangle } from 'lucide-react';

export function ValidationBanner() {
  const issues = useValidation();
  if (issues.length === 0) return null;

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  const renderList = (items: typeof issues) => (
    <div className="flex flex-wrap gap-2">
      {items.slice(0, 3).map((i, idx) => (
        <span key={idx} className="text-amber-800">
          <code className="rounded bg-amber-100 px-1">{i.path || '/'}</code> — {i.message}
        </span>
      ))}
      {items.length > 3 && <span className="text-amber-700">+{items.length - 3} more</span>}
    </div>
  );

  return (
    <div className="space-y-1 border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-900">
      {errors.length > 0 && (
        <div className="flex items-center gap-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          <Badge variant="outline" className="border-amber-400 text-amber-700">
            {errors.length}
          </Badge>
          <span className="font-medium">Must fix before saving:</span>
          {renderList(errors)}
        </div>
      )}
      {warnings.length > 0 && (
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          <Badge variant="outline" className="border-amber-300 text-amber-600">
            {warnings.length}
          </Badge>
          <span className="font-medium">Legacy values (won't block saving):</span>
          {renderList(warnings)}
        </div>
      )}
    </div>
  );
}
