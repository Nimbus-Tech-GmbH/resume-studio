import { useValidation } from '../validation/useValidation.js';

export function ValidationBanner() {
  const issues = useValidation();
  if (issues.length === 0) return null;
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
      <span className="font-medium">{issues.length} validation issue(s):</span>{' '}
      {issues.slice(0, 3).map((i, idx) => (
        <span key={idx} className="ml-2">
          <code>{i.path || '/'}</code> — {i.message}
        </span>
      ))}
      {issues.length > 3 && (
        <span className="ml-2 text-amber-700">+{issues.length - 3} more</span>
      )}
    </div>
  );
}
