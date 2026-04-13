interface BenefitsTableProps {
  benefits: Record<string, unknown>[];
}

const BENEFIT_ICONS: Record<string, string> = {
  stage_access: '🎤',
  booth_size: '🏢',
  booth_furnishing: '🪑',
  logo_placement: '🖼',
  website_visibility: '🌐',
  social_mentions: '📱',
  newsletter_mentions: '📧',
  pass_count: '🎫',
  custom: '✦',
};

export function BenefitsTable({ benefits }: BenefitsTableProps) {
  return (
    <div
      className="overflow-hidden"
      style={{ border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
            <th className="text-left px-5 py-3.5">
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Benefit
              </span>
            </th>
            <th className="text-left px-5 py-3.5">
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Detail
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {benefits.map((benefit, i) => (
            <tr
              key={i}
              style={{
                borderBottom: i < benefits.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}
            >
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="text-base opacity-60">{BENEFIT_ICONS[benefit.type as string] ?? '•'}</span>
                  <span className="font-sans text-sm font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
                    {benefit.label as string}
                  </span>
                </div>
              </td>
              <td className="px-5 py-4">
                <span className="font-mono text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {(benefit.value as string) ?? (benefit.quantity ? `× ${benefit.quantity}` : '✓')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
