import React from 'react';
import { useAuth } from '../App';
import { auth, db } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { 
  User, 
  LogOut, 
  Settings, 
  ShieldCheck, 
  Star, 
  MapPin, 
  Phone,
  ChevronRight,
  CreditCard,
  History,
  RefreshCw,
  Plus,
  Trash2,
  Image as ImageIcon,
  Wallet,
  ArrowUpRight
} from 'lucide-react';
import { Property, PayoutRequest } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

export const ProfilePage = () => {
  const { profile, setRole } = useAuth();
  const [showAddProperty, setShowAddProperty] = React.useState(false);
  const [showPayoutModal, setShowPayoutModal] = React.useState(false);
  const [newProperty, setNewProperty] = React.useState<Partial<Property>>({ name: '', address: '', description: '', photos: [] });
  const [payoutAmount, setPayoutAmount] = React.useState('');
  const [cardNumber, setCardNumber] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleLogout = () => signOut(auth);

  const handleAddProperty = async () => {
    if (!profile || !newProperty.name || !newProperty.address) return;
    setLoading(true);
    try {
      const updatedProperties = [...(profile.properties || []), { ...newProperty, id: Math.random().toString(36).substr(2, 9) } as Property];
      await updateDoc(doc(db, 'users', profile.uid), { properties: updatedProperties });
      setShowAddProperty(false);
      setNewProperty({ name: '', address: '', description: '', photos: [] });
    } catch (error) {
      console.error("Error adding property:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProperty = async (id: string) => {
    if (!profile) return;
    try {
      const updatedProperties = (profile.properties || []).filter(p => p.id !== id);
      await updateDoc(doc(db, 'users', profile.uid), { properties: updatedProperties });
    } catch (error) {
      console.error("Error deleting property:", error);
    }
  };

  const handleRequestPayout = async () => {
    if (!profile || !payoutAmount || !cardNumber) return;
    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount <= 0 || amount > (profile.balance || 0)) {
      alert("Некорректная сумма");
      return;
    }
    setLoading(true);
    try {
      const request: Omit<PayoutRequest, 'id'> = {
        cleanerId: profile.uid,
        amount,
        cardNumber,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'payoutRequests'), request);
      // In a real app, we would also deduct the balance here or use a transaction
      // For now, we'll just show a success message
      alert("Заявка на вывод средств отправлена!");
      setShowPayoutModal(false);
      setPayoutAmount('');
      setCardNumber('');
    } catch (error) {
      console.error("Error requesting payout:", error);
    } finally {
      setLoading(false);
    }
  };

  const isAdminUser = profile?.displayName === 'Admin';

  return (
    <div className="p-4 space-y-6 pb-24">
      <header className="flex flex-col items-center py-6 space-y-3">
        <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 relative">
          <User size={48} />
          {profile?.role === 'cleaner' && (
            <div className="absolute bottom-0 right-0 w-6 h-6 bg-green-500 border-4 border-white rounded-full" />
          )}
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">{profile?.displayName}</h1>
          <p className="text-sm text-gray-500">
            {profile?.role === 'client' ? 'Клиент' : profile?.role === 'cleaner' ? 'Клинер' : 'Оператор'}
          </p>
        </div>
        {profile?.role === 'cleaner' && (
          <div className="flex items-center gap-1 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-bold">
            <Star size={14} fill="currentColor" />
            {profile.rating || '5.0'}
          </div>
        )}
      </header>

      {isAdminUser && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider px-2">Тестовые функции</h3>
          <div className="bg-blue-50 rounded-2xl border border-blue-100 overflow-hidden">
            <button 
              onClick={() => setRole(profile?.role === 'client' ? 'cleaner' : 'client')}
              className="w-full p-4 flex items-center gap-3 hover:bg-blue-100 transition-colors"
            >
              <RefreshCw size={20} className="text-blue-600" />
              <span className="flex-1 text-left text-sm font-medium text-blue-900">
                Переключиться на {profile?.role === 'client' ? 'Клинера' : 'Клиента'}
              </span>
              <ChevronRight size={16} className="text-blue-400" />
            </button>
          </div>
        </section>
      )}

      {profile?.role === 'cleaner' && (
        <section className="space-y-4">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-6 text-white shadow-lg shadow-blue-200">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm">
                <Wallet size={24} />
              </div>
              <div className="text-right">
                <div className="text-blue-100 text-xs uppercase tracking-wider font-bold">Баланс</div>
                <div className="text-3xl font-bold">{profile.balance || 0}₽</div>
              </div>
            </div>
            <button 
              onClick={() => setShowPayoutModal(true)}
              className="w-full py-3 bg-white text-blue-600 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors"
            >
              Вывести средства
              <ArrowUpRight size={16} />
            </button>
          </div>
        </section>
      )}

      {profile?.role === 'client' && (
        <section className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Мои помещения</h3>
            <button 
              onClick={() => setShowAddProperty(true)}
              className="text-blue-600 text-xs font-bold flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors"
            >
              <Plus size={14} />
              Добавить
            </button>
          </div>
          <div className="space-y-3">
            {profile.properties?.map(property => (
              <div key={property.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex gap-4 items-start">
                <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 overflow-hidden shrink-0">
                  {property.photos?.[0] ? (
                    <img src={property.photos[0]} alt={property.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <ImageIcon size={24} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-gray-900 truncate">{property.name}</div>
                  <div className="text-xs text-gray-500 truncate mb-1">{property.address}</div>
                  <div className="text-xs text-gray-400 line-clamp-2 italic">{property.description}</div>
                </div>
                <button 
                  onClick={() => handleDeleteProperty(property.id)}
                  className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {(!profile.properties || profile.properties.length === 0) && (
              <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <p className="text-xs text-gray-400">У вас пока нет сохраненных помещений</p>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2">Личные данные</h3>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
          <div className="p-4 flex items-center gap-3">
            <MapPin size={20} className="text-gray-400" />
            <div className="flex-1">
              <div className="text-xs text-gray-400">Адрес</div>
              <div className="text-sm font-medium">{profile?.address || 'Не указан'}</div>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </div>
          <div className="p-4 flex items-center gap-3">
            <Phone size={20} className="text-gray-400" />
            <div className="flex-1">
              <div className="text-xs text-gray-400">Телефон</div>
              <div className="text-sm font-medium">{profile?.phone || 'Не указан'}</div>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2">Настройки</h3>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
          <button className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors">
            <History size={20} className="text-gray-400" />
            <span className="flex-1 text-left text-sm font-medium">История заказов</span>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
          <button className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors">
            <CreditCard size={20} className="text-gray-400" />
            <span className="flex-1 text-left text-sm font-medium">Способы оплаты</span>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
          <button className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors">
            <Settings size={20} className="text-gray-400" />
            <span className="flex-1 text-left text-sm font-medium">Параметры приложения</span>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
        </div>
      </section>

      <button 
        onClick={handleLogout}
        className="w-full p-4 bg-red-50 text-red-600 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
      >
        <LogOut size={20} />
        Выйти из аккаунта
      </button>

      {/* Add Property Modal */}
      <AnimatePresence>
        {showAddProperty && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl p-6 space-y-6 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Новое помещение</h2>
                <button onClick={() => setShowAddProperty(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full">
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1">Название</label>
                  <input 
                    type="text" 
                    placeholder="Напр. Моя квартира" 
                    className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-blue-600"
                    value={newProperty.name}
                    onChange={e => setNewProperty({...newProperty, name: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1">Адрес</label>
                  <input 
                    type="text" 
                    placeholder="Улица, дом, кв" 
                    className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-blue-600"
                    value={newProperty.address}
                    onChange={e => setNewProperty({...newProperty, address: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1">Описание</label>
                  <textarea 
                    placeholder="Краткое описание квартиры..." 
                    className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-blue-600 min-h-[100px]"
                    value={newProperty.description}
                    onChange={e => setNewProperty({...newProperty, description: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1">Фото (URL)</label>
                  <input 
                    type="text" 
                    placeholder="https://..." 
                    className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-blue-600"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value;
                        if (val) {
                          setNewProperty({...newProperty, photos: [...(newProperty.photos || []), val]});
                          (e.target as HTMLInputElement).value = '';
                        }
                      }
                    }}
                  />
                  <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                    {newProperty.photos?.map((p, i) => (
                      <div key={i} className="w-12 h-12 rounded-lg bg-gray-100 relative shrink-0">
                        <img src={p} className="w-full h-full object-cover rounded-lg" referrerPolicy="no-referrer" />
                        <button 
                          onClick={() => setNewProperty({...newProperty, photos: newProperty.photos?.filter((_, idx) => idx !== i)})}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                        >
                          <Plus className="rotate-45" size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <button 
                onClick={handleAddProperty}
                disabled={loading || !newProperty.name || !newProperty.address}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold disabled:opacity-50 transition-opacity"
              >
                {loading ? 'Сохранение...' : 'Добавить помещение'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payout Modal */}
      <AnimatePresence>
        {showPayoutModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl p-6 space-y-6 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Вывод средств</h2>
                <button onClick={() => setShowPayoutModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full">
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <div className="text-xs text-blue-600 font-bold uppercase mb-1">Доступно к выводу</div>
                  <div className="text-2xl font-bold text-blue-900">{profile?.balance || 0}₽</div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1">Сумма</label>
                  <input 
                    type="number" 
                    placeholder="0" 
                    className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-blue-600"
                    value={payoutAmount}
                    onChange={e => setPayoutAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1">Номер карты</label>
                  <input 
                    type="text" 
                    placeholder="0000 0000 0000 0000" 
                    className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-blue-600"
                    value={cardNumber}
                    onChange={e => setCardNumber(e.target.value)}
                  />
                </div>
              </div>
              <button 
                onClick={handleRequestPayout}
                disabled={loading || !payoutAmount || !cardNumber}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold disabled:opacity-50 transition-opacity"
              >
                {loading ? 'Отправка...' : 'Оформить заявку'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
