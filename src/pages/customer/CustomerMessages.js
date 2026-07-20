import React from 'react';
import PropTypes from 'prop-types';
import { withRouter, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Droplets,
  LoaderCircle,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'react-toastify';
import LoadingState from '../../components/LoadingState/LoadingState';
import useCustomerTheme from './useCustomerTheme';
import {
  getConversationMessages,
  getCustomerConversation,
  markConversationRead,
  sendConversationMessage,
} from '../../services/api/messagingApi';
import './CustomerMessages.css';

function messageTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function CustomerMessages({ history }) {
  const { theme } = useCustomerTheme();
  const [conversation, setConversation] = React.useState(null);
  const [messages, setMessages] = React.useState([]);
  const [draft, setDraft] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const threadRef = React.useRef(null);

  const refresh = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const nextConversation = await getCustomerConversation();
      setConversation(nextConversation);
      const nextMessages = await getConversationMessages(nextConversation.id);
      setMessages(nextMessages);
      if (nextConversation.customerUnreadCount > 0) {
        const updated = await markConversationRead(nextConversation.id, 'customer');
        setConversation((current) => ({ ...current, ...updated }));
      }
    } catch (error) {
      if (!silent) toast.error(error.message || 'Could not open messages.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  React.useEffect(() => { refresh(false); }, [refresh]);

  React.useEffect(() => {
    const poll = () => {
      if (!document.hidden) refresh(true);
    };
    const timer = window.setInterval(poll, 8000);
    document.addEventListener('visibilitychange', poll);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [refresh]);

  React.useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!conversation || !draft.trim() || sending) return;
    setSending(true);
    try {
      const created = await sendConversationMessage(conversation.id, draft, 'customer');
      setMessages((current) => [...current, created]);
      setDraft('');
      setConversation((current) => ({
        ...current,
        lastMessageAt: created.createdAt,
        lastMessagePreview: created.body,
        lastSenderRole: 'customer',
        customerUnreadCount: 0,
      }));
    } catch (error) {
      toast.error(error.message || 'Could not send your message.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <LoadingState label="Opening your messages..." variant="portal" className={`customer-theme--${theme}`} />;
  }

  return (
    <main className={`customer-messages-page customer-theme--${theme}`}>
      <div className="customer-messages-shell">
        <header className="customer-messages-topbar">
          <button type="button" className="customer-messages-back" onClick={() => history.push('/customer/app')}>
            <ArrowLeft size={18} />
            <span>Back</span>
          </button>
          <Link to="/customer/app" className="customer-messages-brand">
            <span><Droplets size={20} /></span>
            <div>
              <strong>Himaliya Spring</strong>
              <small>Customer support</small>
            </div>
          </Link>
        </header>

        <motion.section
          className="customer-messages-card"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <header className="customer-messages-header">
            <span className="customer-messages-mark" aria-hidden="true"><Droplets size={22} /></span>
            <div>
              <strong>Himaliya Support</strong>
              <span>Usually replies during delivery hours</span>
            </div>
            <em><ShieldCheck size={15} /> Secure chat</em>
          </header>

          <div className="customer-messages-thread" ref={threadRef} aria-live="polite">
            {!messages.length && (
              <div className="customer-messages-empty">
                <strong>Message the team anytime</strong>
                <span>Ask about deliveries, invoices, address changes, or empty gallons — we&apos;ll reply here.</span>
              </div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`customer-messages-bubble-row${message.senderRole === 'customer' ? ' is-mine' : ''}`}
              >
                <div className="customer-messages-bubble">
                  <p>{message.body}</p>
                  <time>{messageTime(message.createdAt)}</time>
                </div>
              </div>
            ))}
          </div>

          <form className="customer-messages-compose" onSubmit={sendMessage}>
            <label className="sr-only" htmlFor="customer-message-draft">Type a message</label>
            <textarea
              id="customer-message-draft"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write a message to Himaliya…"
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
        </motion.section>
      </div>
    </main>
  );
}

CustomerMessages.propTypes = {
  history: PropTypes.shape({
    push: PropTypes.func.isRequired,
  }).isRequired,
};

export default withRouter(CustomerMessages);
