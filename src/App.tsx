import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  useNavigate,
  useLocation
} from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithCustomToken } from 'firebase/auth';
import { doc, getDoc, setDoc, addDoc, collection, getDocFromServer, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { UserProfile, UserRole } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  User as UserIcon, 
  ClipboardList, 
  MessageSquare, 
  Shield, 
  X,
  ChevronRight,
  CheckCircle2,
  Clock,
  MapPin,
  CreditCard,
  Settings,
  LogOut,
  RefreshCw
} from 'lucide-react';
import { cn } from './lib/utils';

declare global {
  interface Window {
    Telegram: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
      };
    };
  }
}

// Pages
import { OrdersPage } from './pages/OrdersPage';
import { ChatPage } from './pages/ChatPage';
import { ChatsListPage } from './pages/ChatsListPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';

// --- Utils ---
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Context ---
interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  setRole: (role: UserRole) => Promise<void>;
  signIn: () => Promise<void>;
  loginWithPassword: (email: string, pass: string) => Promise<void>;
  signInWithTelegram: () => Promise<void>;
  generateAuthCode: () => Promise<{ code: string; botUsername: string }>;
  checkAuthCode: (code: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// --- Components ---
export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline', size?: 'sm' | 'md' | 'lg' }>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm',
      secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
      ghost: 'bg-transparent text-gray-600 hover:bg-gray-100',
      danger: 'bg-red-500 text-white hover:bg-red-600',
      outline: 'bg-transparent border border-gray-200 hover:bg-gray-50 text-gray-700',
    };
    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2',
      lg: 'px-6 py-3 text-lg font-medium',
    };
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

export const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden', className)}>
    {children}
  </div>
);

export const Badge = ({ children, className, variant = 'default' }: { children: React.ReactNode; className?: string; variant?: 'default' | 'success' | 'warning' | 'info' | 'error' }) => {
  const variants = {
    default: 'bg-gray-100 text-gray-600',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    info: 'bg-blue-100 text-blue-700',
    error: 'bg-red-100 text-red-700',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  );
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-red-50">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
            <X size={32} />
          </div>
          <h1 className="text-xl font-bold text-red-900 mb-2">Что-то пошло не так</h1>
          <p className="text-sm text-red-600 mb-6 max-w-xs mx-auto">
            Произошла ошибка в работе приложения. Попробуйте перезагрузить страницу.
          </p>
          <Button onClick={() => window.location.reload()} variant="danger">
            Обновить страницу
          </Button>
          <pre className="mt-8 p-4 bg-white rounded-lg text-left text-xs overflow-auto max-w-full border border-red-200 text-red-800">
            {this.state.error?.message}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Layout ---
const Navbar = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: 'Главная', icon: Home, path: '/', roles: ['client', 'cleaner', 'operator'] },
    { label: 'Заказы', icon: ClipboardList, path: '/orders', roles: ['client', 'cleaner', 'operator'] },
    { label: 'Чаты', icon: MessageSquare, path: '/chats', roles: ['client', 'cleaner'] },
    { label: 'Профиль', icon: UserIcon, path: '/profile', roles: ['client', 'cleaner'] },
    { label: 'Админ', icon: Shield, path: '/admin', roles: ['operator'] },
  ];

  const filteredItems = navItems.filter(item => profile && item.roles.includes(profile.role));

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-2 flex justify-around items-center z-50 pb-safe">
      {filteredItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              'flex flex-col items-center gap-1 p-2 transition-colors',
              isActive ? 'text-blue-600' : 'text-gray-400'
            )}
          >
            <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

// --- Pages ---

const LandingPage = () => {
  const { user, profile, setRole, signIn, loginWithPassword, signInWithTelegram, generateAuthCode, checkAuthCode } = useAuth();
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [showTelegramCode, setShowTelegramCode] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [botUsername, setBotUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isTelegram, setIsTelegram] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg?.initData) {
      setIsTelegram(true);
    }
  }, []);

  if (profile) return <Navigate to="/" replace />;

  const handleTelegramLogin = async () => {
    setIsLoggingIn(true);
    setError('');
    try {
      await signInWithTelegram();
    } catch (err: any) {
      console.error('Telegram login error:', err);
      setError(err.message || 'Ошибка входа через Telegram');
      setIsLoggingIn(false);
    }
  };

  const handleGenerateCode = async () => {
    setError('');
    try {
      const { code, botUsername } = await generateAuthCode();
      setAuthCode(code);
      setBotUsername(botUsername);
      setShowTelegramCode(true);
      
      // Start polling
      const interval = setInterval(async () => {
        const success = await checkAuthCode(code);
        if (success) {
          clearInterval(interval);
        }
      }, 3000);
      
      return () => clearInterval(interval);
    } catch (err: any) {
      setError('Не удалось создать код подтверждения');
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const trimmedEmail = email.trim();
      const loginEmail = trimmedEmail.toLowerCase() === 'admin' ? 'admin@admin.ru' : trimmedEmail;
      console.log("Attempting login for:", loginEmail);
      await loginWithPassword(loginEmail, password);
    } catch (err: any) {
      console.error("Login error details:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Вход по паролю отключен в консоли Firebase. Пожалуйста, включите Email/Password в разделе Authentication.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('Неверный логин или пароль.');
      } else {
        setError(`Ошибка: ${err.message || 'Попробуйте снова'}`);
      }
    }
  };

  const handleSetRole = async (role: UserRole) => {
    setError('');
    try {
      await setRole(role);
    } catch (err: any) {
      let msg = 'Ошибка при выборе роли';
      try {
        const parsed = JSON.parse(err.message);
        msg = parsed.error || msg;
      } catch {
        msg = err.message || msg;
      }
      setError(msg);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-sm w-full space-y-8">
        <div className="space-y-2">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-blue-200">
            <Home className="text-white" size={40} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">HelperHub</h1>
          <p className="text-gray-500">Ваш надежный помощник по дому в Telegram</p>
        </div>

        {!user ? (
          <div className="space-y-4">
            {!showPasswordLogin && !showTelegramCode ? (
              <>
                {isTelegram && (
                  <Button size="lg" onClick={handleTelegramLogin} disabled={isLoggingIn} className="w-full h-14 flex gap-3 bg-[#24A1DE] hover:bg-[#208ec4]">
                    {isLoggingIn ? (
                      <RefreshCw className="animate-spin" size={20} />
                    ) : (
                      <MessageSquare size={20} />
                    )}
                    {isLoggingIn ? 'Вход...' : 'Войти через Telegram'}
                  </Button>
                )}
                <Button variant="outline" size="lg" onClick={signIn} className="w-full h-14 flex gap-3">
                  <UserIcon size={20} />
                  Войти через Google
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setShowPasswordLogin(true)} className="flex-1">
                    Логин/Пароль
                  </Button>
                  <Button variant="ghost" onClick={handleGenerateCode} className="flex-1">
                    Вход по коду
                  </Button>
                </div>
              </>
            ) : showTelegramCode ? (
              <div className="space-y-6 text-center">
                <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm space-y-4">
                  <p className="text-sm text-gray-500">Откройте бота и отправьте этот код:</p>
                  <div className="text-4xl font-mono font-bold tracking-widest text-blue-600">
                    {authCode}
                  </div>
                  <p className="text-xs text-gray-400 italic">Или просто нажмите на кнопку в боте после запуска</p>
                </div>
                <Button variant="ghost" onClick={() => setShowTelegramCode(false)} className="w-full">
                  Назад
                </Button>
              </div>
            ) : (
              <form onSubmit={handlePasswordLogin} className="space-y-4 text-left">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Логин (или email)</label>
                  <input 
                    type="text" 
                    className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-600 outline-none"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@admin.ru"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Пароль</label>
                  <input 
                    type="password" 
                    className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-600 outline-none"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    required
                  />
                </div>
                {error && <p className="text-red-500 text-xs text-center">{error}</p>}
                <Button type="submit" size="lg" className="w-full h-14">Войти</Button>
                <Button variant="ghost" onClick={() => setShowPasswordLogin(false)} className="w-full">
                  Назад
                </Button>
              </form>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            <p className="text-sm text-gray-500">Выберите вашу роль в системе</p>
            {error && <p className="text-red-500 text-xs text-center">{error}</p>}
            <Button size="lg" onClick={() => handleSetRole('client')} className="w-full h-16 flex justify-between px-6">
              <span>Я Клиент</span>
              <ChevronRight size={20} />
            </Button>
            <Button size="lg" variant="secondary" onClick={() => handleSetRole('cleaner')} className="w-full h-16 flex justify-between px-6">
              <span>Я Клинер</span>
              <ChevronRight size={20} />
            </Button>
            <Button size="lg" variant="ghost" onClick={() => handleSetRole('operator')} className="w-full">
              Вход для операторов
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

const HomePage = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile?.role === 'operator') {
      navigate('/admin');
    }
  }, [profile, navigate]);

  return (
    <div className="p-4 space-y-6 pb-24">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Привет, {profile?.displayName}!</h1>
          <p className="text-gray-500 text-sm">Чем мы можем помочь сегодня?</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
          {profile?.displayName?.[0]}
        </div>
      </header>

      {profile?.role === 'client' && (
        <>
          <Card className="bg-blue-600 text-white p-6 relative overflow-hidden">
            <div className="relative z-10 space-y-4">
              <h2 className="text-xl font-bold">Нужна уборка?</h2>
              <p className="text-blue-100 text-sm">Закажите профессионального помощника прямо сейчас</p>
              <Button variant="secondary" onClick={() => navigate('/create-order')} className="bg-white text-blue-600 hover:bg-blue-50">
                Создать заявку
              </Button>
            </div>
            <div className="absolute -right-8 -bottom-8 opacity-20">
              <Home size={160} />
            </div>
          </Card>
          <section className="space-y-4">
            <h3 className="font-bold text-gray-900">Популярные услуги</h3>
            <div className="grid grid-cols-2 gap-4">
              <button className="p-4 bg-white rounded-2xl border border-gray-100 text-left space-y-2 shadow-sm">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
                  <CheckCircle2 size={24} />
                </div>
                <div className="font-bold text-sm">Уборка</div>
                <div className="text-xs text-gray-400">От 1500₽</div>
              </button>
              <button className="p-4 bg-white rounded-2xl border border-gray-100 text-left space-y-2 shadow-sm">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
                  <Settings size={24} />
                </div>
                <div className="font-bold text-sm">Помощь</div>
                <div className="text-xs text-gray-400">От 800₽</div>
              </button>
            </div>
          </section>
        </>
      )}

      {profile?.role === 'cleaner' && (
        <>
          <Card className={cn("p-6 transition-colors", profile.isOnline ? "bg-green-50 border-green-100" : "bg-gray-50 border-gray-200")}>
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-bold text-gray-900">{profile.isOnline ? "Вы на линии" : "Вы не в сети"}</h2>
                <p className="text-sm text-gray-500">{profile.isOnline ? "Ожидайте новые заказы" : "Включите, чтобы видеть заказы"}</p>
              </div>
              <div 
                className={cn("w-14 h-8 rounded-full p-1 transition-colors cursor-pointer", profile.isOnline ? "bg-green-500" : "bg-gray-300")}
                onClick={async () => {
                   if (profile.uid) await setDoc(doc(db, 'users', profile.uid), { isOnline: !profile.isOnline }, { merge: true });
                }}
              >
                <div className={cn("w-6 h-6 bg-white rounded-full transition-transform", profile.isOnline ? "translate-x-6" : "translate-x-0")} />
              </div>
            </div>
          </Card>
          <section className="space-y-4">
            <h3 className="font-bold text-gray-900">Доступные заказы</h3>
            <p className="text-sm text-gray-500">Перейдите в раздел "Заказы", чтобы увидеть актуальные предложения.</p>
            <Button className="w-full" onClick={() => navigate('/orders')}>Смотреть все заказы</Button>
          </section>
        </>
      )}
    </div>
  );
};

const CreateOrderPage = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [orderData, setOrderData] = useState({
    type: 'cleaning',
    tasks: [] as string[],
    dateTime: '',
    isAsap: false,
    address: '',
    price: 1500
  });

  const tasks = [
    { id: 'standard', label: 'Стандартная уборка', price: 1500 },
    { id: 'floors', label: 'Мытье полов', price: 400 },
    { id: 'sink', label: 'Мытье раковины', price: 200 },
    { id: 'laundry', label: 'Стирка белья', price: 300 },
    { id: 'hanging', label: 'Развешивание белья', price: 200 },
    { id: 'ironing', label: 'Глажка вещей', price: 500 },
    { id: 'kitchen', label: 'Уборка на кухне', price: 600 },
    { id: 'dishes', label: 'Помыть посуду', price: 300 },
    { id: 'trash', label: 'Вынести мусор', price: 100 },
    { id: 'windows', label: 'Помыть окна', price: 800 },
  ];

  const handleToggleTask = (taskId: string, price: number) => {
    setOrderData(prev => {
      const isSelected = prev.tasks.includes(taskId);
      return {
        ...prev,
        tasks: isSelected ? prev.tasks.filter(id => id !== taskId) : [...prev.tasks, taskId],
        price: isSelected ? prev.price - price : prev.price + price
      };
    });
  };

  const handleCreateOrder = async () => {
    if (!profile) return;
    const newOrder = {
      clientId: profile.uid,
      type: orderData.type,
      tasks: orderData.tasks,
      status: 'searching',
      dateTime: orderData.isAsap ? 'ASAP' : new Date().toLocaleString(),
      isAsap: orderData.isAsap,
      price: orderData.price,
      address: orderData.address,
      commission: Math.round(orderData.price * 0.15),
      payout: Math.round(orderData.price * 0.85),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await addDoc(collection(db, 'orders'), newOrder);
    
    // Notify client
    if (profile.telegramId) {
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: profile.telegramId,
          message: `✅ Ваш заказ на сумму ${orderData.price}₽ успешно создан! Мы ищем исполнителя.`
        })
      }).catch(console.error);
    }

    // Notify all cleaners
    try {
      const cleanersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'cleaner')));
      cleanersSnap.docs.forEach(doc => {
        const cleanerData = doc.data();
        if (cleanerData.telegramId && cleanerData.uid !== profile.uid) {
          fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              telegramId: cleanerData.telegramId,
              message: `🆕 Новый заказ!\n\nУслуга: ${orderData.type === 'cleaning' ? 'Уборка' : 'Помощь'}\nЦена: ${orderData.price}₽\nАдрес: ${orderData.address}`
            })
          }).catch(console.error);
        }
      });
    } catch (err) {
      console.error("Error notifying cleaners:", err);
    }

    navigate('/orders');
  };

  return (
    <div className="min-h-screen bg-white p-4 pb-24">
      <header className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="sm" onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)}>
          <X size={20} />
        </Button>
        <h1 className="text-xl font-bold">Новая заявка ({step}/3)</h1>
      </header>

      {step === 1 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <h2 className="text-lg font-bold">Что нужно сделать?</h2>
          <div className="grid gap-3">
            {tasks.map(task => (
              <button
                key={task.id}
                onClick={() => handleToggleTask(task.id, task.price)}
                className={cn("p-4 rounded-2xl border text-left flex justify-between items-center transition-all", orderData.tasks.includes(task.id) ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-gray-100 bg-gray-50")}
              >
                <div>
                  <div className="font-bold text-sm">{task.label}</div>
                  <div className="text-xs text-gray-400">+{task.price}₽</div>
                </div>
                {orderData.tasks.includes(task.id) && <CheckCircle2 className="text-blue-600" size={20} />}
              </button>
            ))}
          </div>
          <Button className="w-full" size="lg" onClick={() => setStep(2)}>Далее</Button>
        </motion.div>
      )}

      {step === 2 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <h2 className="text-lg font-bold">Когда и куда?</h2>
          
          {profile?.properties && profile.properties.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">Мои помещения</label>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {profile.properties.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setOrderData({...orderData, address: p.address})}
                    className={cn(
                      "shrink-0 p-3 rounded-2xl border text-left min-w-[140px] transition-all",
                      orderData.address === p.address ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-gray-100 bg-gray-50"
                    )}
                  >
                    <div className="font-bold text-xs truncate">{p.name}</div>
                    <div className="text-[10px] text-gray-400 truncate">{p.address}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Адрес</label>
              <input type="text" placeholder="Город, улица, дом, кв" className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-blue-600" value={orderData.address} onChange={e => setOrderData({...orderData, address: e.target.value})} />
            </div>
            <div className="flex gap-4">
              <button onClick={() => setOrderData({...orderData, isAsap: true})} className={cn("flex-1 p-4 rounded-2xl border font-bold text-sm", orderData.isAsap ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 border-gray-100")}>Как можно скорее</button>
              <button onClick={() => setOrderData({...orderData, isAsap: false})} className={cn("flex-1 p-4 rounded-2xl border font-bold text-sm", !orderData.isAsap ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 border-gray-100")}>Запланировать</button>
            </div>
          </div>
          <Button className="w-full" size="lg" onClick={() => setStep(3)} disabled={!orderData.address}>К оплате</Button>
        </motion.div>
      )}

      {step === 3 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mx-auto"><CreditCard size={40} /></div>
          <h2 className="text-2xl font-bold">Итого: {orderData.price}₽</h2>
          <p className="text-gray-500">Вы оплачиваете услуги сервиса и работу исполнителя</p>
          <div className="bg-gray-50 p-4 rounded-2xl text-left space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Услуга</span><span className="font-medium">Уборка</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Задачи</span><span className="font-medium">{orderData.tasks.length} шт.</span></div>
            <div className="flex justify-between text-sm border-t border-gray-200 pt-2 mt-2"><span className="font-bold">К оплате</span><span className="font-bold text-blue-600">{orderData.price}₽</span></div>
          </div>
          <Button className="w-full h-14" size="lg" onClick={handleCreateOrder}>Оплатить и опубликовать</Button>
        </motion.div>
      )}
    </div>
  );
};

// --- Auth Provider ---
const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
        }
      }
    };
    testConnection();

    // Initialize Telegram WebApp
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const path = `users/${u.uid}`;
        try {
          const docRef = doc(db, 'users', u.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) setProfile(docSnap.data() as UserProfile);
          else setProfile(null);
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, path);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Sign in error:", error);
    }
  };

  const loginWithPassword = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error: any) {
      console.log("Login error:", error.code, error.message);
      // If user doesn't exist or invalid credentials and it's the admin test user, try to create it
      const isTestAdmin = email === 'admin@admin.ru' && pass === 'Admin123';
      if (isTestAdmin && (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password')) {
        try {
          console.log("Test admin not found or wrong creds, attempting to create...");
          await createUserWithEmailAndPassword(auth, email, pass);
        } catch (createError: any) {
          console.log("Create test admin error:", createError.code, createError.message);
          // If creation fails (e.g. user already exists but password was wrong), throw original error
          throw error;
        }
      } else {
        throw error;
      }
    }
  };

  const setRole = async (role: UserRole) => {
    if (!user) return;
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const path = `users/${user.uid}`;
    
    const newProfile: UserProfile = {
      uid: user.uid,
      role,
      displayName: user.displayName || (user.email === 'admin@admin.ru' ? 'Admin' : (tgUser?.first_name || 'Пользователь')),
    };

    if (role === 'cleaner') {
      newProfile.balance = 0;
      newProfile.rating = 5.0;
      newProfile.isOnline = false;
    } else if (role === 'client') {
      newProfile.properties = [];
    }

    if (user.photoURL) newProfile.photoURL = user.photoURL;
    if (tgUser?.id) newProfile.telegramId = tgUser.id.toString();

    try {
      // Remove undefined fields for Firestore
      const cleanedProfile = JSON.parse(JSON.stringify(newProfile));
      await setDoc(doc(db, 'users', user.uid), cleanedProfile);
      setProfile(cleanedProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const signInWithTelegram = async () => {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) throw new Error('Приложение запущено не в Telegram');

    const res = await fetch('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Ошибка авторизации');
    }

    const { customToken } = await res.json();
    await signInWithCustomToken(auth, customToken);
  };

  const generateAuthCode = async () => {
    const res = await fetch('/api/auth/generate-code', { method: 'POST' });
    return res.json();
  };

  const checkAuthCode = async (code: string) => {
    try {
      const res = await fetch('/api/auth/check-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      if (res.ok) {
        const { customToken } = await res.json();
        await signInWithCustomToken(auth, customToken);
        return true;
      }
    } catch (err) {
      console.error('Check code error:', err);
    }
    return false;
  };

  return <AuthContext.Provider value={{ user, profile, loading, setRole, signIn, loginWithPassword, signInWithTelegram, generateAuthCode, checkAuthCode }}>{children}</AuthContext.Provider>;
};

// --- Main App ---
export default function App() {
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-gray-50 font-sans text-gray-900 selection:bg-blue-100">
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/login" element={<LandingPage />} />
                <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
                <Route path="/create-order" element={<ProtectedRoute><CreateOrderPage /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
                <Route path="/chats" element={<ProtectedRoute><ChatsListPage /></ProtectedRoute>} />
                <Route path="/chat/:chatId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AnimatePresence>
            <ConditionalNavbar />
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { profile, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen">Загрузка...</div>;
  if (!profile) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const ConditionalNavbar = () => {
  const { profile } = useAuth();
  const location = useLocation();
  if (!profile || location.pathname === '/login' || location.pathname === '/create-order' || location.pathname.startsWith('/chat/')) return null;
  return <Navbar />;
};
