export default function ReportSourceBadge({ isSeed }: { isSeed: boolean }) {
  if (isSeed) {
    return (
      <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
        Sample Incident
      </span>
    );
  }
  return (
    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
      Community Report
    </span>
  );
}
