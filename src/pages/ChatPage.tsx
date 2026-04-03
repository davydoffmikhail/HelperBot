import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../App';
import { Message, Chat } from '../types';
import { Send, ChevronLeft, User } from 'lucide-react';
import { motion } from 'motion/react';

export const ChatPage = () => {
  const { chatId } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chatId) return;

    const chatRef = doc(db, 'chats', chatId);
    getDoc(chatRef).then(snap => {
      if (snap.exists()) setChat({ id: snap.id, ...snap.data() } as Chat);
    });

    const q = query(
      collection(db, `chats/${chatId}/messages`),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    return unsubscribe;
  }, [chatId]);

  const handleSend = async (e?: React.FormEvent, textOverride?: string) => {
    if (e) e.preventDefault();
    const msg = textOverride || newMessage;
    if (!msg.trim() || !chatId || !profile) return;

    if (!textOverride) setNewMessage('');

    await addDoc(collection(db, `chats/${chatId}/messages`), {
      chatId,
      senderId: profile.uid,
      text: msg,
      timestamp: serverTimestamp()
    });

    const recipientId = chat?.participants.find(p => p !== profile.uid);
    if (recipientId) {
      const recipientSnap = await getDoc(doc(db, 'users', recipientId));
      if (recipientSnap.exists()) {
        const recipientData = recipientSnap.data();
        if (recipientData?.telegramId) {
          fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              telegramId: recipientData.telegramId,
              message: `💬 Новое сообщение от ${profile.displayName}:\n\n${msg}`
            })
          }).catch(console.error);
        }
      }
    }
  };

  const templates = [
    "Я могу прийти в ",
    "Подтверждаю заказ ✅",
    "Буду через 5 минут 🏃‍♂️",
    "Здравствуйте! 👋",
    "Закончил работу! ✨"
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 p-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-1 hover:bg-gray-100 rounded-full">
          <ChevronLeft size={24} />
        </button>
        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
          <User size={20} />
        </div>
        <div>
          <div className="font-bold text-sm">Чат по заказу</div>
          <div className="text-[10px] text-green-500 font-medium">В сети</div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.senderId === profile?.uid;
          return (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              key={msg.id}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm ${
                  isMe
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-white text-gray-900 rounded-tl-none border border-gray-100'
                }`}
              >
                {msg.text}
              </div>
            </motion.div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      <div className="bg-white border-t border-gray-100">
        {profile?.role === 'cleaner' && (
          <div className="p-2 flex gap-2 overflow-x-auto no-scrollbar border-b border-gray-50">
            {templates.map((template, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (template.endsWith(' ')) {
                    setNewMessage(template);
                  } else {
                    handleSend(undefined, template);
                  }
                }}
                className="whitespace-nowrap px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-xs font-medium transition-colors"
              >
                {template}
              </button>
            ))}
          </div>
        )}
        
        <form onSubmit={(e) => handleSend(e)} className="p-4 flex gap-2 pb-safe">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Напишите сообщение..."
            className="flex-1 bg-gray-100 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center disabled:opacity-50 transition-transform active:scale-90"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};
