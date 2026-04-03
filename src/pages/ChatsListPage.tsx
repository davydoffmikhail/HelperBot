import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../App';
import { Chat } from '../types';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, ChevronRight, User } from 'lucide-react';

export const ChatsListPage = () => {
  const { profile } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', profile.uid)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const c = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
      setChats(c.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    });

    return unsubscribe;
  }, [profile]);

  return (
    <div className="p-4 space-y-6 pb-24">
      <h1 className="text-2xl font-bold">Чаты</h1>

      {chats.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          У вас пока нет активных диалогов
        </div>
      ) : (
        <div className="divide-y divide-gray-100 bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => navigate(`/chat/${chat.id}`)}
              className="w-full p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                <User size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-gray-900">Заказ #{chat.orderId.slice(-4)}</div>
                <div className="text-sm text-gray-500 truncate">{chat.lastMessage || 'Начните общение...'}</div>
              </div>
              <ChevronRight size={20} className="text-gray-300" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
