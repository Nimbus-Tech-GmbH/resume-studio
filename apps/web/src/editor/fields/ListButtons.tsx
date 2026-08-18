/** Small shared UI atoms for list add/remove buttons. */
export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start rounded border border-dashed border-neutral-300 px-3 py-1 text-xs text-neutral-500 hover:bg-neutral-50"
    >
      {label}
    </button>
  );
}

export function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded px-2 text-xs text-neutral-500 hover:bg-red-50 hover:text-red-600"
      aria-label="Remove item"
      title="Remove"
    >
      ×
    </button>
  );
}
