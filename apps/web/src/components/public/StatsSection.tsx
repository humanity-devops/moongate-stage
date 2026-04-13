import { formatNumber } from '@/lib/utils';
import { Users, Globe, Radio, Mail, Award } from 'lucide-react';

interface StatsSectionProps {
  stats: Record<string, unknown>;
}

export function StatsSection({ stats }: StatsSectionProps) {
  const items = [
    { label: 'Expected Attendees', value: stats.expectedAttendees ? `${formatNumber(stats.expectedAttendees as number)}+` : null, icon: Users },
    { label: 'International Attendees', value: stats.internationalPct ? `${stats.internationalPct}%` : null, icon: Globe },
    { label: 'Media Reach', value: stats.mediaReach ? formatNumber(stats.mediaReach as number) : null, icon: Radio },
    { label: 'Newsletter Subscribers', value: stats.newsletterSubs ? formatNumber(stats.newsletterSubs as number) : null, icon: Mail },
    { label: 'Past Sponsors', value: stats.sponsorsLastEdition ? `${stats.sponsorsLastEdition}+` : null, icon: Award },
  ].filter(i => i.value);

  if (items.length === 0) return null;

  return (
    <section
      style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(13,13,20,0.8)',
      }}
      className="py-14 px-6"
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-10">
          {items.map(({ label, value, icon: Icon }, i) => (
            <div
              key={label}
              className="text-center animate-fade-in-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div
                className="inline-flex items-center justify-center w-9 h-9 rounded mb-4"
                style={{ background: 'rgba(67,97,238,0.12)', border: '1px solid rgba(67,97,238,0.2)' }}
              >
                <Icon className="w-4 h-4 text-brand-400" />
              </div>
              <div className="font-mono text-2xl font-semibold text-white tabular-nums mb-1.5">{value}</div>
              <div className="font-mono text-[10px] tracking-[0.25em] text-white/35 uppercase leading-relaxed">{label}</div>
            </div>
          ))}
        </div>

        {Array.isArray(stats.topicTags) && (stats.topicTags as string[]).length > 0 && (
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {(stats.topicTags as string[]).map(tag => (
              <span
                key={tag}
                className="font-mono text-[11px] tracking-widest uppercase px-3 py-1.5"
                style={{
                  background: 'rgba(67,97,238,0.08)',
                  border: '1px solid rgba(67,97,238,0.18)',
                  color: 'rgba(123,147,248,0.8)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
