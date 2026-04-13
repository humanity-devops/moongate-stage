'use client';
import { useEffect, useState, useRef } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ---- Types ----

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
};

type BidMessage = {
  id: string;
  authorType: string;
  authorName: string;
  content: string;
  createdAt: string;
};

type Conversation = {
  id: string;
  status: string;
  email: string;
  event: { id: string; name: string; slug: string; startDate?: string };
  item: { id: string; publicTitle: string; category: string };
  tenant: { slug: string; name: string };
  messages: BidMessage[];
};

// ---- Helpers ----

function getHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('moongate_token') : null;
  return { Authorization: `Bearer ${token ?? ''}`, 'Content-Type': 'application/json' };
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const TYPE_BADGE: Record<string, string> = {
  bid_accepted: 'text-green-300 bg-green-500/10 border-green-500/30',
  bid_countered: 'text-purple-300 bg-purple-500/10 border-purple-500/30',
  bid_rejected: 'text-red-300 bg-red-500/10 border-red-500/30',
  bid_message: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
};

function typeBadgeClass(type: string) {
  return TYPE_BADGE[type] ?? 'text-white/40 bg-white/[0.04] border-white/[0.06]';
}

function typeLabel(type: string) {
  return type.replace(/_/g, ' ');
}

// ---- Skeleton ----

function Skeleton() {
  return (
    <div className="space-y-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="glass rounded-xl h-16 animate-pulse border border-white/[0.04]" />
      ))}
    </div>
  );
}

// ---- Notification item ----

function NotificationItem({
  n,
  onRead,
}: {
  n: Notification;
  onRead: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const unread = !n.readAt;

  function handleClick() {
    setExpanded(e => !e);
    if (unread) onRead(n.id);
  }

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left glass rounded-xl px-5 py-4 border transition-colors ${
        unread
          ? 'border-indigo-500/20 hover:bg-indigo-500/[0.04]'
          : 'border-white/[0.04] hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-start gap-3">
        {unread && (
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
        )}
        {!unread && <span className="mt-1.5 w-1.5 h-1.5 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded border capitalize shrink-0 ${typeBadgeClass(n.type)}`}>
              {typeLabel(n.type)}
            </span>
            <span className="text-xs text-white/25 shrink-0">{relativeTime(n.createdAt)}</span>
          </div>
          <p className={`text-sm leading-snug ${unread ? 'text-white font-medium' : 'text-white/70'}`}>
            {n.title}
          </p>
          {expanded && n.body && (
            <p className="text-xs text-white/50 mt-1.5 leading-relaxed">{n.body}</p>
          )}
        </div>
      </div>
    </button>
  );
}

// ---- Conversation thread view ----

function ThreadView({
  conv,
  onBack,
}: {
  conv: Conversation;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<BidMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/sponsor/conversations/${conv.id}/messages`, { headers: getHeaders() })
      .then(r => r.json())
      .then(d => setMessages(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [conv.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/sponsor/conversations/${conv.id}/messages`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ content: content.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data.data]);
        setContent('');
      }
    } catch {
      // no-op
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="text-white/40 hover:text-white transition-colors text-sm"
        >
          ← Back
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{conv.item.publicTitle}</p>
          <p className="text-xs text-white/40">{conv.event.name} · {conv.tenant.name}</p>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-white/40 capitalize">
          {conv.status.replace('_', ' ')}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-0">
        {loading ? (
          <Skeleton />
        ) : messages.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center border border-white/[0.06]">
            <p className="text-white/30 text-sm">No messages yet</p>
            <p className="text-xs text-white/20 mt-1">Start the conversation below</p>
          </div>
        ) : (
          messages.map(msg => {
            const isSponsor = msg.authorType === 'sponsor';
            return (
              <div key={msg.id} className={`flex ${isSponsor ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                    isSponsor
                      ? 'bg-indigo-600/20 border border-indigo-500/20 text-white'
                      : 'glass border border-white/[0.06] text-white/80'
                  }`}
                >
                  {!isSponsor && (
                    <p className="text-[10px] text-white/30 mb-1">{msg.authorName}</p>
                  )}
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                  <p className="text-[10px] text-white/20 mt-1 text-right">{relativeTime(msg.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Write a message..."
          rows={2}
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 resize-none focus:outline-none focus:border-indigo-500/40 transition-colors"
        />
        <button
          onClick={sendMessage}
          disabled={!content.trim() || sending}
          className="px-4 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {sending ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

// ---- Notifications tab ----

function NotificationsTab() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    const url = filter === 'unread'
      ? `${API_URL}/api/sponsor/notifications?unreadOnly=true`
      : `${API_URL}/api/sponsor/notifications`;
    fetch(url, { headers: getHeaders() })
      .then(r => r.json())
      .then(d => setNotifications(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  function markRead(id: string) {
    fetch(`${API_URL}/api/sponsor/notifications/${id}/read`, {
      method: 'PATCH',
      headers: getHeaders(),
    }).catch(() => {});
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n),
    );
  }

  async function markAllRead() {
    await fetch(`${API_URL}/api/sponsor/notifications/read-all`, {
      method: 'PATCH',
      headers: getHeaders(),
    }).catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
  }

  const unreadCount = notifications.filter(n => !n.readAt).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1.5">
          {(['all', 'unread'] as const).map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setLoading(true); }}
              className={`px-3 py-1 rounded-lg text-xs transition-colors capitalize ${
                filter === f
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
                  : 'text-white/40 hover:text-white/60 border border-white/[0.06]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <Skeleton />
      ) : notifications.length === 0 ? (
        <div className="glass rounded-xl p-10 text-center border border-white/[0.06]">
          <p className="text-white/40 text-sm">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </p>
          <p className="text-xs text-white/20 mt-1">
            {filter === 'unread' ? 'You are all caught up' : 'Activity on your bids will appear here'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <NotificationItem key={n.id} n={n} onRead={markRead} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Conversations tab ----

function ConversationsTab() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/sponsor/conversations`, { headers: getHeaders() })
      .then(r => r.json())
      .then(d => setConversations(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (activeConv) {
    return <ThreadView conv={activeConv} onBack={() => setActiveConv(null)} />;
  }

  return (
    <div>
      {loading ? (
        <Skeleton />
      ) : conversations.length === 0 ? (
        <div className="glass rounded-xl p-10 text-center border border-white/[0.06]">
          <p className="text-white/40 text-sm">No active conversations</p>
          <p className="text-xs text-white/20 mt-1">
            Conversations open when a bid is accepted, countered, or under review
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map(conv => {
            const lastMsg = conv.messages[0];
            return (
              <button
                key={conv.id}
                onClick={() => setActiveConv(conv)}
                className="w-full text-left glass rounded-xl px-5 py-4 flex items-start gap-4 group hover:bg-white/[0.04] transition-colors border border-white/[0.04]"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0 text-xs text-indigo-300 mt-0.5">
                  {conv.event.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm text-white font-medium group-hover:text-indigo-300 transition-colors truncate">
                      {conv.item.publicTitle}
                    </span>
                  </div>
                  <div className="text-xs text-white/40 mb-1">{conv.event.name} · {conv.tenant.name}</div>
                  {lastMsg ? (
                    <div className="text-xs text-white/30 truncate">
                      {lastMsg.authorType === 'sponsor' ? 'You' : lastMsg.authorName}: {lastMsg.content}
                    </div>
                  ) : (
                    <div className="text-xs text-white/20">No messages yet — start the conversation</div>
                  )}
                </div>
                {lastMsg && (
                  <div className="text-[10px] text-white/25 shrink-0 mt-1">
                    {relativeTime(lastMsg.createdAt)}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- Main page ----

type Tab = 'notifications' | 'conversations';

export default function PortalMessagesPage() {
  const [tab, setTab] = useState<Tab>('notifications');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetch(`${API_URL}/api/sponsor/notifications/unread-count`, { headers: getHeaders() })
      .then(r => r.json())
      .then(d => setUnreadCount(d.count ?? 0))
      .catch(() => {});
  }, []);

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-1">Inbox</h1>
      <p className="text-white/40 text-sm mb-6">Notifications and conversations with event organizers</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-white/[0.06] pb-0">
        {(['notifications', 'conversations'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative px-4 py-2 text-sm font-medium transition-colors capitalize ${
              tab === t
                ? 'text-white border-b-2 border-indigo-500 -mb-px'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {t}
            {t === 'notifications' && unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-500 text-[10px] text-white font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'notifications' ? <NotificationsTab /> : <ConversationsTab />}
    </div>
  );
}
