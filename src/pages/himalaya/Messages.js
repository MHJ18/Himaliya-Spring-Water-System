import React, { useState } from 'react';
import { motion } from 'framer-motion';
import PageShell from '../../components/PageShell/PageShell';
import { getCustomerAvatar } from '../../utils/customerPhotos';
import './UtilityPages.css';

const initialConversations = [
  { id: 'driver', name: 'Route Driver', preview: 'Start a new conversation', time: '', avatar: getCustomerAvatar(0) },
  { id: 'office', name: 'Gulshan Office', preview: 'Start a new conversation', time: '', avatar: getCustomerAvatar(2) },
  { id: 'home', name: 'DHA Customer', preview: 'Start a new conversation', time: '', avatar: getCustomerAvatar(4) },
];

const initialMessages = {
  driver: [],
  office: [],
  home: [],
};

export default function Messages() {
  const [activeId, setActiveId] = useState('driver');
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState('');
  const active = initialConversations.find((item) => item.id === activeId);

  const sendMessage = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const next = { id: Date.now(), mine: true, text, time: 'Now' };
    setMessages((current) => ({ ...current, [activeId]: [...(current[activeId] || []), next] }));
    setDraft('');
  };

  return (
    <PageShell title="Messages" subtitle="Customers, drivers, and dispatch">
      <motion.section className="chat-shell" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <aside className="chat-sidebar">
          <div className="chat-sidebar__heading"><span>Conversations</span><strong>{initialConversations.length} active</strong></div>
          <div className="chat-conversation-list">
            {initialConversations.map((conversation) => (
              <button key={conversation.id} type="button" className={`chat-conversation ${activeId === conversation.id ? 'is-active' : ''}`} onClick={() => setActiveId(conversation.id)}>
                <img src={conversation.avatar} alt="" />
                <span><strong>{conversation.name}</strong><small>{conversation.preview}</small></span>
                <time>{conversation.time}</time>
              </button>
            ))}
          </div>
        </aside>
        <div className="chat-main">
          <header className="chat-header"><img src={active.avatar} alt="" /><div><strong>{active.name}</strong><span>Available</span></div></header>
          <div className="chat-thread" aria-live="polite">
            {!(messages[activeId] || []).length && <div className="chat-empty"><strong>No messages yet</strong><span>Start a clean conversation with {active.name}.</span></div>}
            {(messages[activeId] || []).map((message) => (
              <motion.div
                key={message.id}
                className={`chat-message-row ${message.mine ? 'chat-message-row--mine' : ''}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <span className="chat-message-avatar"><img src={message.mine ? getCustomerAvatar(5) : active.avatar} alt="" /></span>
                <div className={`chat-bubble ${message.mine ? 'chat-bubble--mine' : ''}`}><p>{message.text}</p><time>{message.time}</time></div>
              </motion.div>
            ))}
          </div>
          <form className="chat-compose" onSubmit={sendMessage}>
            <label className="sr-only" htmlFor="message-draft">Type a message</label>
            <input id="message-draft" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Message ${active.name}`} autoComplete="off" maxLength={1000} />
            <button type="submit" disabled={!draft.trim()}>Send</button>
          </form>
        </div>
      </motion.section>
    </PageShell>
  );
}
