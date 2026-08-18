import { useValidation } from '../validation/useValidation.js';
import { Badge } from '../components/ui/badge.js';

export function ValidationBanner() {
  const issues = useValidation();
  if (issues.length === 0) return null;
  return (
    <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
      <Badge variant="outline" className="border-amber-400 text-amber-700">
        {issues.length}
      </Badge>
      <span className="font-medium">Validation issues:</span>
      {issues.slice(0, 3).map((i, idx) => (
        <span key={idx} className="text-amber-800">
          <code className="rounded bg-amber-100 px-1">{i.path || '/'}</code> — {i.message}
        </span>
      ))}
      {issues.length > 3 && (
        <span className="text-amber-700">+{issues.length - 3} more</span>
      )}
    </div>
  );
}
