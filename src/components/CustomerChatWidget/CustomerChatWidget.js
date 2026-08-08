import React from 'react';
import PropTypes from 'prop-types';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { SendHorizontal, X } from 'lucide-react';
import {
  getConversationMessages,
  getCustomerConversation,
  markConversationRead,
  sendConversationMessage,
} from '../../services/api/messagingApi';
import './CustomerChatWidget.css';

const GREETING = 'Welcome to Himaliya Spring Water. Ask us about a delivery, an invoice, or your next refill and the team will reply here.';
const TYPING_MS = 900;

// A small SVG mascot rather than an icon glyph, so the parts (head, eyes,
// antenna, arms) can be animated independently by CSS.
function RobotMascot({ className }) {
  return (
    <svg className={className} viewBox="0 0 48 48" role="presentation" focusable="false" aria-hidden="true">
      <g className="customer-chat__bot-antenna">
        <line x1="24" y1="9" x2="24" y2="14" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="24" cy="7" r="2.6" className="customer-chat__bot-spark" />
      </g>
      <g className="customer-chat__bot-arm customer-chat__bot-arm--left">
        <line x1="10" y1="27" x2="5" y2="32" strokeWidth="2.6" strokeLinecap="round" />
      </g>
      <g className="customer-chat__bot-arm customer-chat__bot-arm--right">
        <line x1="38" y1="27" x2="43" y2="32" strokeWidth="2.6" strokeLinecap="round" />
      </g>
      <g className="customer-chat__bot-head">
        <rect x="10" y="14" width="28" height="22" rx="8" className="customer-chat__bot-shell" />
        <circle cx="19" cy="24" r="2.7" className="customer-chat__bot-eye" />
        <circle cx="29" cy="24" r="2.7" className="customer-chat__bot-eye" />
        <path d="M19.5 30.5c1.6 1.6 7.4 1.6 9 0" strokeWidth="2" strokeLinecap="round" fill="none" className="customer-chat__bot-smile" />
      </g>
    </svg>
  );
}

RobotMascot.propTypes = { className: PropTypes.string };
RobotMascot.defaultProps = { className: '' };

function timeLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function CustomerChatWidget({ unreadCount, onOpenFullThread }) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = React.useState(false);
  const [typing, setTyping] = React.useState(false);
  const [greeted, setGreeted] = React.useState(false);
  const [messages, setMessages] = React.useState([]);
  const [conversationId, setConversationId] = React.useState('');
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState('');
  const inputRef = React.useRef(null);
  const threadRef = React.useRef(null);
  const panelId = 'customer-chat-panel';

  // The greeting is played once per session: a short typing indicator, then
  // the welcome line, so opening the widget feels like a reply rather than a
  // pre-filled transcript.
  React.useEffect(() => {
    if (!open || greeted) return undefined;
    setTyping(true);
    const timer = window.setTimeout(() => {
      setTyping(false);
      setGreeted(true);
    }, reduceMotion ? 0 : TYPING_MS);
    return () => window.clearTimeout(timer);
  }, [greeted, open, reduceMotion]);

  React.useEffect(() => {
    if (!open || conversationId) return undefined;
    let active = true;
    getCustomerConversation()
      .then(async (conversation) => {
        if (!active || !conversation) return;
        setConversationId(conversation.id);
        const thread = await getConversationMessages(conversation.id);
        if (!active) return;
        setMessages(thread || []);
        markConversationRead(conversation.id, 'customer').catch(() => {});
      })
      .catch(() => {
        // A failed history load should not block a new message being written.
        if (active) setMessages([]);
      });
    return () => { active = false; };
  }, [conversationId, open]);

  React.useEffect(() => {
    if (!open) return;
    const node = threadRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [greeted, messages, open, typing]);

  React.useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const openWidget = () => {
    setOpen(true);
    window.setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 120);
  };

  const submit = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError('');
    const optimistic = {
      id: `pending-${Date.now()}`,
      body: text,
      senderRole: 'customer',
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((current) => [...current, optimistic]);
    setDraft('');
    try {
      const id = conversationId || (await getCustomerConversation()).id;
      if (!conversationId) setConversationId(id);
      const saved = await sendConversationMessage(id, text, 'customer');
      setMessages((current) => current.map((item) => (
        item.id === optimistic.id ? (saved || { ...optimistic, pending: false }) : item
      )));
    } catch (sendError) {
      setMessages((current) => current.filter((item) => item.id !== optimistic.id));
      setDraft(text);
      setError(sendError.message || 'Message could not be sent. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="customer-chat">
      <AnimatePresence>
        {open && (
          <motion.section
            id={panelId}
            className="customer-chat__panel"
            role="dialog"
            aria-label="Chat with Himaliya Spring Water"
            initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="customer-chat__header">
              <span className={`customer-chat__avatar${typing ? ' is-typing' : ''}`} aria-hidden="true">
                <RobotMascot className="customer-chat__bot" />
                <i />
              </span>
              <div>
                <strong>Himaliya Support</strong>
                <small>{typing ? 'Typing…' : 'We reply during delivery hours'}</small>
              </div>
              <button
                type="button"
                className="customer-chat__close"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
              >
                <X size={17} aria-hidden="true" />
              </button>
            </header>

            <div className="customer-chat__thread" ref={threadRef} role="log" aria-live="polite">
              {typing && (
                <div className="customer-chat__bubble customer-chat__bubble--bot customer-chat__typing" aria-label="Support is typing">
                  <i /><i /><i />
                </div>
              )}

              {greeted && (
                <motion.div
                  className="customer-chat__greeting"
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                >
                  <span className="customer-chat__greeting-bot" aria-hidden="true">
                    <RobotMascot className="customer-chat__bot customer-chat__bot--lg" />
                  </span>
                  <p>{GREETING}</p>
                </motion.div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`customer-chat__bubble customer-chat__bubble--${message.senderRole === 'customer' ? 'mine' : 'bot'}${message.pending ? ' is-pending' : ''}`}
                >
                  <p>{message.body}</p>
                  <time>{message.pending ? 'Sending…' : timeLabel(message.createdAt)}</time>
                </div>
              ))}

              {error && <p className="customer-chat__error" role="alert">{error}</p>}
            </div>

            <form className="customer-chat__compose" onSubmit={submit}>
              <label className="sr-only" htmlFor="customer-chat-input">Write a message to Himaliya Spring Water</label>
              <textarea
                id="customer-chat-input"
                ref={inputRef}
                value={draft}
                onChange={(event) => { setDraft(event.target.value); setError(''); }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) submit(event);
                }}
                placeholder="Type your message…"
                rows={1}
                maxLength={2000}
              />
              <button type="submit" disabled={!draft.trim() || sending} aria-label="Send message">
                <SendHorizontal size={17} aria-hidden="true" />
              </button>
            </form>

            {onOpenFullThread && (
              <button type="button" className="customer-chat__expand" onClick={onOpenFullThread}>
                Open full conversation
              </button>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        className={`customer-chat__toggle${open ? ' is-open' : ''}`}
        onClick={() => (open ? setOpen(false) : openWidget())}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={
          open
            ? 'Close chat'
            : unreadCount
              ? `Open chat, ${unreadCount} unread`
              : 'Open chat with Himaliya Spring Water'
        }
        initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={reduceMotion ? undefined : { y: -2 }}
        whileTap={reduceMotion ? undefined : { scale: 0.94 }}
      >
        {open
          ? <X size={21} aria-hidden="true" />
          : <RobotMascot className="customer-chat__bot customer-chat__bot--toggle" />}
        {!open && unreadCount > 0 && <em>{unreadCount > 9 ? '9+' : unreadCount}</em>}
      </motion.button>
    </div>
  );
}

CustomerChatWidget.propTypes = {
  unreadCount: PropTypes.number,
  onOpenFullThread: PropTypes.func,
};

CustomerChatWidget.defaultProps = {
  unreadCount: 0,
  onOpenFullThread: null,
};
