import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../App';
import { Order, OrderStatus } from '../types';
import { motion } from 'motion/react';
import { MapPin, Clock, MessageSquare, CreditCard, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

export const OrdersPage = () => {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile) return;

    const q = profile.role === 'client' 
      ? query(collection(db, 'orders'), where('clientId', '==', profile.uid))
      : profile.role === 'cleaner'
        ? query(collection(db, 'orders'), where('status', 'in', ['searching', 'in_dialog', 'awaiting_payment', 'paid']))
        : query(collection(db, 'orders'));

    const unsubscribe = onSnapshot(q, (snap) => {
      const ords = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(ords.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setLoading(false);
    });

    return unsubscribe;
  }, [profile]);

  const getStatusInfo = (status: OrderStatus) => {
    const map: Record<OrderStatus, { label: string, color: string }> = {
      created: { label: 'Создан', color: 'bg-gray-100 text-gray-600' },
      searching: { label: 'Поиск исполнителя', color: 'bg-blue-100 text-blue-600' },
      in_dialog: { label: 'В диалоге', color: 'bg-purple-100 text-purple-600' },
      awaiting_payment: { label: 'Ожидает оплаты', color: 'bg-yellow-100 text-yellow-600' },
      paid: { label: 'Оплачен', color: 'bg-green-100 text-green-600' },
      completed: { label: 'Выполнен', color: 'bg-green-600 text-white' },
      cancelled: { label: 'Отменен', color: 'bg-red-100 text-red-600' },
    };
    return map[status];
  };

  const handleAction = async (order: Order) => {
    if (!profile) return;

    if (profile.role === 'cleaner' && order.status === 'searching') {
      await updateDoc(doc(db, 'orders', order.id), {
        cleanerId: profile.uid,
        status: 'in_dialog',
        updatedAt: new Date().toISOString()
      });
      
      const chatRef = await addDoc(collection(db, 'chats'), {
        orderId: order.id,
        participants: [order.clientId, profile.uid],
        updatedAt: new Date().toISOString()
      });

      // Notify client
      const clientSnap = await getDoc(doc(db, 'users', order.clientId));
      if (clientSnap.exists()) {
        const clientData = clientSnap.data();
        if (clientData.telegramId) {
          fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              telegramId: clientData.telegramId,
              message: `🤝 Исполнитель ${profile.displayName} откликнулся на ваш заказ!\n\nВы можете обсудить детали в чате.`
            })
          }).catch(console.error);
        }
      }
      
      navigate(`/chat/${chatRef.id}`);
    }
  };

  if (loading) return <div className="p-4">Загрузка заказов...</div>;

  return (
    <div className="p-4 space-y-6 pb-24">
      <h1 className="text-2xl font-bold">Мои заказы</h1>
      
      {orders.length === 0 ? (
        <div className="text-center py-12 space-y-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400">
            <AlertCircle size={32} />
          </div>
          <p className="text-gray-500">У вас пока нет активных заказов</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => {
            const status = getStatusInfo(order.status);
            return (
              <motion.div
                layout
                key={order.id}
                className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-4"
              >
                <div className="flex justify-between items-start">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${status.color}`}>
                    {status.label}
                  </span>
                  <span className="font-bold text-lg">{order.price}₽</span>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-gray-900">{order.type === 'cleaning' ? 'Уборка' : 'Помощь по дому'}</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <MapPin size={14} className="text-gray-400" />
                    {order.address}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock size={14} className="text-gray-400" />
                    {order.isAsap ? 'Как можно скорее' : order.dateTime}
                    <span className="text-gray-300">•</span>
                    <span>{formatDistanceToNow(new Date(order.createdAt), { addSuffix: true, locale: ru })}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  {profile.role === 'cleaner' && order.status === 'searching' && (
                    <button 
                      onClick={() => handleAction(order)}
                      className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-100 active:scale-95 transition-all"
                    >
                      Принять заказ
                    </button>
                  )}
                  {order.status === 'in_dialog' && (
                    <button 
                      onClick={() => navigate('/chats')}
                      className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                    >
                      <MessageSquare size={16} />
                      Чат
                    </button>
                  )}
                  {profile.role === 'client' && order.status === 'in_dialog' && (
                    <button 
                      className="flex-1 bg-green-600 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                      onClick={async () => {
                        await updateDoc(doc(db, 'orders', order.id), { status: 'awaiting_payment' });
                      }}
                    >
                      <CreditCard size={16} />
                      Оплатить
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
