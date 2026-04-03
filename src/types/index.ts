export type UserRole = 'client' | 'cleaner' | 'operator';

export interface UserProfile {
  uid: string;
  role: UserRole;
  displayName: string;
  photoURL?: string;
  telegramId?: string;
  address?: string;
  phone?: string;
  rating?: number;
  isOnline?: boolean;
  skills?: string[];
  limitations?: string[];
  schedule?: any;
  properties?: Property[];
  balance?: number;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  description?: string;
  photos?: string[];
}

export interface PayoutRequest {
  id: string;
  cleanerId: string;
  amount: number;
  cardNumber: string;
  status: 'pending' | 'completed' | 'rejected';
  createdAt: string;
}

export type OrderStatus = 
  | 'created' 
  | 'searching' 
  | 'in_dialog' 
  | 'awaiting_payment' 
  | 'paid' 
  | 'pending_confirmation'
  | 'completed' 
  | 'cancelled';

export interface Order {
  id: string;
  clientId: string;
  cleanerId?: string;
  type: 'cleaning' | 'help';
  tasks: string[];
  customTasks?: string;
  status: OrderStatus;
  dateTime: string;
  isAsap: boolean;
  price: number;
  address: string;
  commission: number;
  payout: number;
  createdAt: string;
  updatedAt: string;
}

export interface Chat {
  id: string;
  orderId: string;
  participants: string[];
  lastMessage?: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  timestamp: string;
}

export interface Analytics {
  id: string;
  totalOrders: number;
  totalRevenue: number;
  activeUsers: number;
  updatedAt: string;
}
