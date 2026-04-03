import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order, UserProfile } from '../types';
import { Card, Badge } from '../App';
import { 
  BarChart3, 
  Users, 
  ShoppingBag, 
  TrendingUp,
  Activity,
  ShieldAlert,
  Search
} from 'lucide-react';
import { motion } from 'motion/react';

export const AdminPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubOrders = onSnapshot(collection(db, 'orders'), (snap) => {
      setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(doc => ({ ...doc.data() } as UserProfile)));
      setLoading(false);
    });

    return () => {
      unsubOrders();
      unsubUsers();
    };
  }, []);

  const stats = {
    totalRevenue: orders.reduce((acc, o) => acc + (o.status === 'paid' || o.status === 'completed' ? o.price : 0), 0),
    totalCommission: orders.reduce((acc, o) => acc + (o.status === 'paid' || o.status === 'completed' ? o.commission : 0), 0),
    activeOrders: orders.filter(o => !['completed', 'cancelled'].includes(o.status)).length,
    totalUsers: users.length,
    cleanersOnline: users.filter(u => u.role === 'cleaner' && u.isOnline).length
  };

  if (loading) return <div className="p-4">Загрузка панели управления...</div>;

  return (
    <div className="p-4 space-y-6 pb-24">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Панель оператора</h1>
        <Badge variant="error" className="flex items-center gap-1">
          <Activity size={12} />
          Live
        </Badge>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 space-y-2">
          <div className="text-blue-600 bg-blue-50 w-8 h-8 rounded-lg flex items-center justify-center">
            <TrendingUp size={18} />
          </div>
          <div className="text-2xl font-bold">{stats.totalCommission}₽</div>
          <div className="text-[10px] text-gray-400 uppercase font-bold">Доход сервиса</div>
        </Card>
        <Card className="p-4 space-y-2">
          <div className="text-green-600 bg-green-50 w-8 h-8 rounded-lg flex items-center justify-center">
            <ShoppingBag size={18} />
          </div>
          <div className="text-2xl font-bold">{stats.activeOrders}</div>
          <div className="text-[10px] text-gray-400 uppercase font-bold">Активные заказы</div>
        </Card>
        <Card className="p-4 space-y-2">
          <div className="text-purple-600 bg-purple-50 w-8 h-8 rounded-lg flex items-center justify-center">
            <Users size={18} />
          </div>
          <div className="text-2xl font-bold">{stats.totalUsers}</div>
          <div className="text-[10px] text-gray-400 uppercase font-bold">Всего пользователей</div>
        </Card>
        <Card className="p-4 space-y-2">
          <div className="text-yellow-600 bg-yellow-50 w-8 h-8 rounded-lg flex items-center justify-center">
            <ShieldAlert size={18} />
          </div>
          <div className="text-2xl font-bold">{stats.cleanersOnline}</div>
          <div className="text-[10px] text-gray-400 uppercase font-bold">Клинеров в сети</div>
        </Card>
      </div>

      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold">Последние заказы</h3>
          <button className="text-blue-600 text-sm font-medium">Все</button>
        </div>
        <div className="space-y-3">
          {orders.slice(0, 5).map(order => (
            <Card key={order.id} className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm font-bold">Заказ #{order.id.slice(-4)}</div>
                <div className="text-xs text-gray-400">{order.address}</div>
              </div>
              <div className="text-right space-y-1">
                <div className="text-sm font-bold">{order.price}₽</div>
                <Badge variant={order.status === 'paid' ? 'success' : 'default'}>
                  {order.status}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-bold">Аналитика</h3>
        <Card className="p-6 flex flex-col items-center justify-center space-y-4 text-center">
          <BarChart3 size={48} className="text-blue-100" />
          <div className="space-y-1">
            <div className="font-bold">Графики активности</div>
            <p className="text-xs text-gray-500">Визуализация данных будет доступна при накоплении 100+ заказов</p>
          </div>
        </Card>
      </section>
    </div>
  );
};
