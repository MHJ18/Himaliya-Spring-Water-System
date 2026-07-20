import React from 'react';
import {
  MessageCircle,
  Plus,
  Search,
  Send,
  X,
  Phone,
  MapPin,
  LoaderCircle,
  MessagesSquare,
} from 'lucide-react';
import { toast } from 'react-toastify';
import PageShell from '../../components/PageShell/PageShell';
import LoadingState from '../../components/LoadingState/LoadingState';
import { getCustomerAvatar } from '../../utils/customerPhotos';
import {
  getAdminConversations,
  getAdminMessageableCustomers,
  getConversationMessages,
  markConversationRead,
  openAdminConversation,
  sendConversationMessage,
} from '../../services/api/messagingApi';
import './Messages.css';

function timeLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function messageTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function initials(name) {
  return String(name || 'C')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'C';
}

function Avatar({ person, index = 0 }) {
  if (person?.photo) {
    return <img src={person.photo} alt="" />;
  }
  return (
    <span className="msg-avatar-fallback" style={{ backgroundImage: `url(${getCustomerAvatar(index)})` }}>
      {initials(person?.name)}
    </span>
  );
}

export default function Messages() {
  const [conversations, setConversations] = React.useState([]);
  const [customers, setCustomers] = React.useState([]);
  const [activeId, setActiveId] = React.useState('');
  const [messages, setMessages] = React.useState([]);
  const [draft, setDraft] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [customerQuery, setCustomerQuery] = React.useState('');
  const threadRef = React.useRef(null);
  const requestRunning = React.useRef(false);

  const active = conversations.find((item) => item.id === activeId) || null;

  const loadConversations = React.useCallback(async (silent = false) => {
    if (requestRunning.current) return;
    requestRunning.current = true;
    if (!silent) setLoading(true);
    try {
      const [nextConversations, nextCustomers] = await Promise.all([
        getAdminConversations(),
        getAdminMessageableCustomers(),
      ]);
      setConversations(nextConversations);
      setCustomers(nextCustomers);
      setActiveId((current) => {
        if (current && nextConversations.some((item) => item.id === current)) return current;
        return (nextConversations[0] && nextConversations[0].id) || '';
      });
    } catch (error) {
      if (!silent) toast.error(error.message || 'Could not load messages.');
    } finally {
      requestRunning.current = false;
      if (!silent) setLoading(false);
    }
  }, []);

  React.useEffect(() => { loadConversations(false); }, [loadConversations]);

  React.useEffect(() => {
    const refresh = () => {
      if (!document.hidden) loadConversations(true);
    };
    const timer = window.setInterval(refresh, 12000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [loadConversations]);

  const loadMessages = React.useCallback(async (conversationId, silent = false) => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    try {
      const next = await getConversationMessages(conversationId);
      setMessages(next);
      const updated = await markConversationRead(conversationId, 'admin');
      if (updated) {
        setConversations((current) => current.map((item) => (
          item.id === updated.id ? { ...item, ...updated, customer: item.customer } : item
        )));
      }
    } catch (error) {
      if (!silent) toast.error(error.message || 'Could not load this chat.');
    }
  }, []);

  React.useEffect(() => {
    loadMessages(activeId, false);
    const timer = window.setInterval(() => {
      if (!document.hidden && activeId) loadMessages(activeId, true);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [activeId, loadMessages]);

  React.useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, activeId]);

  const filteredConversations = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((item) => {
      const name = (item.customer?.name || '').toLowerCase();
      const phone = (item.customer?.phone || '').toLowerCase();
      const preview = (item.lastMessagePreview || '').toLowerCase();
      return name.includes(query) || phone.includes(query) || preview.includes(query);
    });
  }, [conversations, search]);

  const availableCustomers = React.useMemo(() => {
    const openIds = new Set(conversations.map((item) => item.customerId));
    const query = customerQuery.trim().toLowerCase();
    return customers.filter((customer) => {
      if (openIds.has(customer.id) && conversations.some((item) => item.customerId === customer.id && item.lastMessageAt)) {
        // Still allow selecting existing chats via composer for convenience
      }
      if (!query) return true;
      return (
        customer.name.toLowerCase().includes(query)
        || customer.phone.toLowerCase().includes(query)
        || customer.email.toLowerCase().includes(query)
      );
    });
  }, [customers, conversations, customerQuery]);

  const totalUnread = conversations.reduce((sum, item) => sum + item.adminUnreadCount, 0);

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!active || !draft.trim() || sending) return;
    setSending(true);
    try {
      const created = await sendConversationMessage(active.id, draft, 'admin');
      setMessages((current) => [...current, created]);
      setDraft('');
      setConversations((current) => {
        const next = current.map((item) => (
          item.id === active.id
            ? {
              ...item,
              lastMessageAt: created.createdAt,
              lastMessagePreview: created.body,
              lastSenderRole: 'admin',
              adminUnreadCount: 0,
            }
            : item
        ));
        return next.sort((a, b) => (
          new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime()
        ));
      });
    } catch (error) {
      toast.error(error.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  const startConversation = async (customerId) => {
    try {
      const conversation = await openAdminConversation(customerId);
      setConversations((current) => {
        if (current.some((item) => item.id === conversation.id)) {
          return current.map((item) => (item.id === conversation.id ? conversation : item));
        }
        return [conversation, ...current];
      });
      setActiveId(conversation.id);
      setComposerOpen(false);
      setCustomerQuery('');
    } catch (error) {
      toast.error(error.message || 'Could not start this chat.');
    }
  };

  if (loading) {
    return (
      <PageShell title="Messages" subtitle="Chat with your customers in real time">
        <LoadingState label="Loading conversations..." variant="form" compact />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Messages"
      subtitle="Two-way chat with customer portal accounts"
      actions={(
        <button type="button" className="msg-new-chat" onClick={() => setComposerOpen(true)}>
          <Plus size={17} />
          New chat
        </button>
      )}
    >
      <section className="msg-shell">
        <aside className="msg-sidebar">
          <div className="msg-sidebar__head">
            <div>
              <p>Inbox</p>
              <h2>{conversations.length} chats</h2>
            </div>
            {totalUnread > 0 && <span className="msg-unread-pill">{totalUnread} unread</span>}
          </div>

          <label className="msg-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customers"
              aria-label="Search conversations"
            />
          </label>

          <div className="msg-conversation-list">
            {filteredConversations.map((conversation, index) => {
              const selected = conversation.id === activeId;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  className={`msg-conversation${selected ? ' is-active' : ''}${conversation.adminUnreadCount ? ' is-unread' : ''}`}
                  onClick={() => setActiveId(conversation.id)}
                >
                  <Avatar person={conversation.customer} index={index} />
                  <span className="msg-conversation__copy">
                    <strong>{conversation.customer?.name || 'Customer'}</strong>
                    <small>{conversation.lastMessagePreview || 'No messages yet'}</small>
                  </span>
                  <span className="msg-conversation__meta">
                    <time>{timeLabel(conversation.lastMessageAt || conversation.createdAt)}</time>
                    {conversation.adminUnreadCount > 0 && (
                      <em>{conversation.adminUnreadCount > 9 ? '9+' : conversation.adminUnreadCount}</em>
                    )}
                  </span>
                </button>
              );
            })}
            {!filteredConversations.length && (
              <div className="msg-sidebar-empty">
                <MessagesSquare size={28} />
                <strong>No conversations yet</strong>
                <span>Start a chat with a customer who has a portal account.</span>
              </div>
            )}
          </div>
        </aside>

        <div className="msg-main">
          {!active ? (
            <div className="msg-empty-state">
              <MessageCircle size={42} />
              <h2>Select a conversation</h2>
              <p>Message customers about deliveries, invoices, or support — they can reply from their portal.</p>
              <button type="button" className="msg-new-chat" onClick={() => setComposerOpen(true)}>
                <Plus size={17} />
                Start a chat
              </button>
            </div>
          ) : (
            <>
              <header className="msg-header">
                <Avatar person={active.customer} index={0} />
                <div className="msg-header__copy">
                  <strong>{active.customer?.name || 'Customer'}</strong>
                  <span>Customer portal · Online messaging</span>
                </div>
                <div className="msg-header__facts">
                  {active.customer?.phone && (
                    <span><Phone size={14} />{active.customer.phone}</span>
                  )}
                  {active.customer?.address && (
                    <span><MapPin size={14} />{active.customer.address}</span>
                  )}
                </div>
              </header>

              <div className="msg-thread" ref={threadRef} aria-live="polite">
                {!messages.length && (
                  <div className="msg-thread-empty">
                    <strong>Say hello</strong>
                    <span>This is the beginning of your chat with {active.customer?.name || 'this customer'}.</span>
                  </div>
                )}
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`msg-bubble-row${message.senderRole === 'admin' ? ' is-mine' : ''}`}
                  >
                    <div className="msg-bubble">
                      <p>{message.body}</p>
                      <time>{messageTime(message.createdAt)}</time>
                    </div>
                  </div>
                ))}
              </div>

              <form className="msg-compose" onSubmit={sendMessage}>
                <label className="sr-only" htmlFor="admin-message-draft">Type a message</label>
                <textarea
                  id="admin-message-draft"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={`Message ${active.customer?.name || 'customer'}…`}
                  rows={1}
                  maxLength={2000}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      sendMessage(event);
                    }
                  }}
                />
                <button type="submit" disabled={!draft.trim() || sending} aria-label="Send message">
                  {sending ? <LoaderCircle size={18} className="is-spinning" /> : <Send size={18} />}
                </button>
              </form>
            </>
          )}
        </div>
      </section>

      {composerOpen && (
        <div className="msg-composer-overlay" role="presentation" onClick={() => setComposerOpen(false)}>
          <div
            className="msg-composer-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="msg-composer-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="msg-composer-panel__head">
              <div>
                <p>New conversation</p>
                <h2 id="msg-composer-title">Message a customer</h2>
              </div>
              <button type="button" aria-label="Close" onClick={() => setComposerOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <label className="msg-search">
              <Search size={16} />
              <input
                value={customerQuery}
                onChange={(event) => setCustomerQuery(event.target.value)}
                placeholder="Search by name, phone, or email"
                autoFocus
              />
            </label>
            <div className="msg-composer-list">
              {availableCustomers.map((customer, index) => (
                <button key={customer.id} type="button" onClick={() => startConversation(customer.id)}>
                  <Avatar person={customer} index={index} />
                  <span>
                    <strong>{customer.name}</strong>
                    <small>{customer.phone || customer.email || 'Portal customer'}</small>
                  </span>
                </button>
              ))}
              {!availableCustomers.length && (
                <div className="msg-sidebar-empty">
                  <strong>No portal customers found</strong>
                  <span>Customers need a customer-app account before you can message them.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
