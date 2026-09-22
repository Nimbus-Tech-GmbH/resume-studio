import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { useValidation } from '@/validation/useValidation';

type ValidationIssue = ReturnType<typeof useValidation>[number];
type ValidationSeverity = 'error' | 'warning';

export function ValidationBanner() {
  const issues = useValidation();

  if (issues.length === 0) {
    return null;
  }

  const errors = issues.filter(({ severity }) => severity === 'error');
  const warnings = issues.filter(({ severity }) => severity === 'warning');

  return (
    <div
      role="status"
      aria-label="Resume validation results"
      className="my-2 space-y-2 border-b bg-muted px-6 py-2 text-sm"
    >
      {errors.length > 0 && (
        <ValidationGroup
          issues={errors}
          icon={<AlertCircle />}
          label="Must fix before saving"
          severity="error"
        />
      )}

      {warnings.length > 0 && (
        <ValidationGroup
          issues={warnings}
          icon={<AlertTriangle />}
          label="Legacy values (won't block saving)"
          severity="warning"
        />
      )}
    </div>
  );
}

interface ValidationGroupProps {
  issues: ValidationIssue[];
  icon: ReactNode;
  label: string;
  severity: ValidationSeverity;
}

function ValidationGroup({
  issues,
  icon,
  label,
  severity,
}: ValidationGroupProps) {
  const visibleIssues = issues.slice(0, 3);
  const remainingCount = issues.length - visibleIssues.length;
  const isError = severity === 'error';

  return (
    <div
      className={[
        'flex flex-wrap items-center gap-x-3 gap-y-1',
        isError ? 'text-destructive' : 'text-warning',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className="flex size-4 shrink-0 items-center justify-center"
      >
        {icon}
      </span>

      <Badge variant={isError ? 'destructive' : 'secondary'}>
        {issues.length}
      </Badge>

      <span className="font-medium">{label}:</span>

      <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1">
        {visibleIssues.map((issue, index) => (
          <ValidationIssueText
            key={`${issue.path}-${issue.message}-${index}`}
            issue={issue}
            severity={severity}
          />
        ))}

        {remainingCount > 0 && (
          <span className="whitespace-nowrap">
            +{remainingCount} more
          </span>
        )}
      </div>
    </div>
  );
}

interface ValidationIssueTextProps {
  issue: ValidationIssue;
  severity: ValidationSeverity;
}

function ValidationIssueText({
  issue,
  severity,
}: ValidationIssueTextProps) {
  const isError = severity === 'error';

  return (
    <span className="min-w-0">
      <code
        className={[
          'rounded px-1 font-mono text-xs',
          isError
            ? 'bg-destructive/10 text-destructive'
            : 'bg-warning/10 text-warning-foreground',
        ].join(' ')}
      >
        {issue.path || '/'}
      </code>{' '}
      — {issue.message}
    </span>
  );
}
