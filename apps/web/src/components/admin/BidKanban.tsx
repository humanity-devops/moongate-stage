import { formatCurrency } from '@/lib/utils';

type Bid = {
  id: string;
  status: string;
  companyName: string;
  contactName: string;
  proposedBudget: number;
  currency: string;
  item: { publicTitle: string };
};

interface BidKanbanProps {
  bids: Bid[];
  onAction: (bidId: string, action: 'accept' | 'reject') => void;
}

const COLUMNS = [
  { key: 'submitted', label: 'New', color: 'border-blue-500' },
  { key: 'under_review', label: 'Reviewing', color: 'border-yellow-500' },
  { key: 'countered', label: 'Countered', color: 'border-orange-500' },
  { key: 'accepted', label: 'Accepted', color: 'border-green-500' },
  { key: 'rejected', label: 'Rejected', color: 'border-gray-600' },
];

export function BidKanban({ bids, onAction }: BidKanbanProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map(col => {
        const colBids = bids.filter(b => b.status === col.key);
        const total = colBids.reduce((sum, b) => sum + Number(b.proposedBudget), 0);
        return (
          <div key={col.key} className="flex-shrink-0 w-72">
            <div className={`flex items-center justify-between mb-3 pb-2 border-b-2 ${col.color}`}>
              <h3 className="font-semibold text-white text-sm">{col.label}</h3>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-xs">{colBids.length}</span>
                {total > 0 && <span className="text-brand-400 text-xs font-medium">{formatCurrency(total)}</span>}
              </div>
            </div>
            <div className="space-y-3">
              {colBids.map(bid => (
                <div key={bid.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <h4 className="font-bold text-white text-sm mb-0.5">{bid.companyName}</h4>
                  <p className="text-gray-400 text-xs mb-2">{bid.item?.publicTitle}</p>
                  <div className="text-lg font-bold text-white mb-3">
                    {formatCurrency(Number(bid.proposedBudget), bid.currency)}
                  </div>
                  {['submitted', 'under_review'].includes(bid.status) && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => onAction(bid.id, 'accept')}
                        className="flex-1 bg-green-600 hover:bg-green-500 text-white py-1.5 rounded-lg text-xs font-semibold transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => onAction(bid.id, 'reject')}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-1.5 rounded-lg text-xs font-semibold transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {colBids.length === 0 && (
                <div className="text-center py-8 text-gray-600 text-xs">Empty</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
