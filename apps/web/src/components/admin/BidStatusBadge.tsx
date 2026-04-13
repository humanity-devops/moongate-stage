const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  submitted: { label: 'New', className: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
  under_review: { label: 'Reviewing', className: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
  countered: { label: 'Countered', className: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' },
  accepted: { label: 'Accepted', className: 'bg-green-500/20 text-green-400 border border-green-500/30' },
  rejected: { label: 'Rejected', className: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  expired: { label: 'Expired', className: 'bg-gray-500/20 text-gray-400 border border-gray-500/30' },
  withdrawn: { label: 'Withdrawn', className: 'bg-gray-500/20 text-gray-500 border border-gray-500/30' },
};

export function BidStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'bg-gray-500/20 text-gray-400' };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${config.className}`}>
      {config.label}
    </span>
  );
}
