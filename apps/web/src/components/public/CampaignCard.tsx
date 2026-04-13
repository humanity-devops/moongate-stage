import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import type { CrowdfundCampaign } from '@/lib/api';
import { Trophy, Clock, Users, Globe, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface CampaignCardProps {
  campaign: CrowdfundCampaign;
  tenantSlug: string;
  eventSlug: string;
  itemSlug: string;
}

function timeRemaining(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`;
}

const STATUS_CONFIG = {
  active:    { label: 'Active',   color: 'rgba(34,197,94,0.7)',    bg: 'rgba(34,197,94,0.08)',    border: 'rgba(34,197,94,0.2)',   Icon: Clock },
  won:       { label: 'Goal met', color: 'rgba(201,162,39,0.9)',   bg: 'rgba(201,162,39,0.1)',    border: 'rgba(201,162,39,0.3)',  Icon: Trophy },
  lost:      { label: 'Lost',     color: 'rgba(255,255,255,0.3)',  bg: 'rgba(255,255,255,0.04)',  border: 'rgba(255,255,255,0.08)', Icon: XCircle },
  expired:   { label: 'Expired',  color: 'rgba(255,255,255,0.3)',  bg: 'rgba(255,255,255,0.04)',  border: 'rgba(255,255,255,0.08)', Icon: XCircle },
  cancelled: { label: 'Cancelled',color: 'rgba(255,255,255,0.3)',  bg: 'rgba(255,255,255,0.04)',  border: 'rgba(255,255,255,0.08)', Icon: XCircle },
};

export function CampaignCard({ campaign, tenantSlug, eventSlug, itemSlug }: CampaignCardProps) {
  const cfg = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.active;
  const StatusIcon = cfg.Icon;
  const pct = campaign.percentFunded;
  const isActive = campaign.status === 'active';
  const isWon = campaign.status === 'won';

  const detailHref = `/${tenantSlug}/${eventSlug}/items/${itemSlug}/campaigns/${campaign.id}`;

  return (
    <div
      className="relative flex flex-col transition-all duration-200"
      style={{
        background: isWon ? 'rgba(201,162,39,0.05)' : '#0d0d14',
        border: `1px solid ${isWon ? 'rgba(201,162,39,0.2)' : isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)'}`,
        opacity: (!isActive && !isWon) ? 0.55 : 1,
      }}
    >
      {/* Won gold bar */}
      {isWon && (
        <div
          className="h-[2px]"
          style={{ background: 'linear-gradient(90deg, transparent, #c9a227, transparent)' }}
        />
      )}

      <div className="p-6 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="font-display text-lg font-bold text-white leading-tight truncate"
              >
                {campaign.entityName}
              </span>
              {isWon && <Trophy className="w-4 h-4 flex-shrink-0" style={{ color: '#c9a227' }} />}
            </div>
            {campaign.entityWebsite && (
              <a
                href={campaign.entityWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase transition-colors hover:text-brand-400"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                <Globe className="w-2.5 h-2.5" />
                {new URL(campaign.entityWebsite).hostname}
              </a>
            )}
          </div>

          <span
            className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.2em] uppercase px-2.5 py-1.5 flex-shrink-0"
            style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
          >
            <StatusIcon className="w-2.5 h-2.5" />
            {cfg.label}
          </span>
        </div>

        {/* Description */}
        {campaign.entityDescription && (
          <p className="font-sans text-sm leading-relaxed line-clamp-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {campaign.entityDescription}
          </p>
        )}

        {/* Progress bar */}
        <div>
          <div className="flex items-end justify-between mb-2">
            <div>
              <span className="font-mono text-xl font-semibold text-white tabular-nums">
                {formatCurrency(Number(campaign.raisedAmount), campaign.currency)}
              </span>
              <span className="font-mono text-xs ml-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                of {formatCurrency(Number(campaign.goalAmount), campaign.currency)}
              </span>
            </div>
            <span
              className="font-mono text-sm font-semibold tabular-nums"
              style={{ color: isWon ? '#c9a227' : pct >= 75 ? 'rgba(134,239,172,0.8)' : pct >= 40 ? '#7b93f8' : 'rgba(255,255,255,0.4)' }}
            >
              {pct}%
            </span>
          </div>

          {/* Track */}
          <div
            className="w-full h-1.5 overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <div
              className="h-full transition-all duration-700"
              style={{
                width: `${Math.min(100, pct)}%`,
                background: isWon
                  ? 'linear-gradient(90deg, #c9a227, #f0d070)'
                  : pct >= 75
                    ? 'linear-gradient(90deg, rgba(67,97,238,0.8), rgba(134,239,172,0.8))'
                    : '#4361ee',
              }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5">
            <Users className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.3)' }} />
            <span className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {campaign.backerCount} backer{campaign.backerCount !== 1 ? 's' : ''}
            </span>
          </div>
          {isActive && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.3)' }} />
              <span className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {timeRemaining(campaign.deadline)}
              </span>
            </div>
          )}
          {isWon && campaign.wonAt && (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3" style={{ color: 'rgba(201,162,39,0.7)' }} />
              <span className="font-mono text-xs" style={{ color: 'rgba(201,162,39,0.6)' }}>
                Reached goal {new Date(campaign.wonAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* CTA */}
        {isActive && (
          <Link
            href={detailHref}
            className="block w-full text-center py-3 font-sans font-semibold text-sm text-white transition-colors duration-200 bg-brand-500 hover:bg-brand-600"
          >
            Back This Campaign →
          </Link>
        )}
        {!isActive && (
          <Link
            href={detailHref}
            className="block w-full text-center py-3 font-mono text-[10px] tracking-[0.2em] uppercase transition-colors duration-200"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.3)',
            }}
          >
            View Campaign
          </Link>
        )}
      </div>
    </div>
  );
}
