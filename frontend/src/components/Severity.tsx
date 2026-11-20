// Severity is always a shape plus a word, never colour alone.
export type SeverityKind = "critical" | "watch" | "stuck";

const WORDS: Record<SeverityKind, string> = {
  critical: "Runs out before reorder",
  watch: "Tight",
  stuck: "Stuck",
};
const TONE: Record<SeverityKind, string> = {
  critical: "text-critical",
  watch: "text-watch",
  stuck: "text-stuck",
};

function Shape({ kind }: { kind: SeverityKind }) {
  if (kind === "critical") return <rect x="1" y="1" width="10" height="10" rx="1" fill="currentColor" />;
  if (kind === "watch")
    return (
      <>
        <rect x="1.5" y="1.5" width="9" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect x="1" y="1" width="5.5" height="10" fill="currentColor" />
      </>
    );
  return <circle cx="6" cy="6" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.5" />;
}

export function Severity({ kind, label }: { kind: SeverityKind; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${TONE[kind]}`}>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <Shape kind={kind} />
      </svg>
      {label ?? WORDS[kind]}
    </span>
  );
}
