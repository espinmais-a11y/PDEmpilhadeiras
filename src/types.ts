export type UserRole = 'Admin' | 'Employee' | 'Customer';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  is_approved: boolean;
  avatar_url: string | null;
  created_at: string;
}

export interface Brand {
  id: string;
  name: string;
  created_at: string;
}

export interface Model {
  id: string;
  brand_id: string;
  name: string;
  created_at: string;
}

export interface BatteryType {
  id: string;
  name: string;
  created_at: string;
}

export interface ChargerType {
  id: string;
  name: string;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  tax_id: string;
  birth_date: string | null;
  contact_email: string;
  phone: string | null;
  whatsapp: string | null;
  cep: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  gender: string | null;
  discovery_source: string | null;
  interests: string | null;
  terms_accepted: boolean;
  created_at: string;
}

export type EnergyType = 'GLP' | 'Diesel' | 'Eletrica';
export type MastType = 'Simplex' | 'Duplex' | 'Triplex';

export interface Machine {
  id: string;
  customer_id: string;
  brand: string;
  model: string;
  serial_number: string;
  internal_id: string | null;
  mfg_year: number | null;
  energy_type: EnergyType;
  battery_model: string | null;
  charger_model: string | null;
  load_capacity_tons: number | null;
  mast_type: MastType | null;
  max_elevation_meters: number | null;
  current_hour_meter: number;
  daily_usage_avg_hours: number;
  status: string;
  created_at: string;
}

export type OSStatus = 'Pending' | 'In Route' | 'Executing' | 'Maintenance Done' | 'Cancelled';

export interface ServiceOrder {
  id: string;
  customer_id: string;
  machine_id: string;
  employee_id: string | null;
  title: string;
  description: string | null;
  problem_photo_url: string | null;
  hour_meter_at_service: number | null;
  work_hours: number;
  status: OSStatus;
  check_in_at: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_out_at: string | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  vibe_signature: string | null;
  technical_notes: string | null;
  total_value: number;
  is_paid: boolean;
  is_preventive?: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UsedPart {
  id: string;
  service_order_id: string;
  part_name: string;
  quantity: number;
  unit_price: number;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  display_order: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ChecklistAnswer {
  id: string;
  service_order_id: string;
  item_id: string;
  answer: 'ok' | 'pending';
  answered_by: string | null;
  answered_at: string;
}

export interface ServiceOrderPhoto {
  id: string;
  service_order_id: string;
  photo_url: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  category: string;
  location: string;
  quantity: number;
  unit_price: number;
  min_stock: number;
  created_at: string;
  updated_at?: string;
}

export interface InventoryHistory {
  id: string;
  item_id: string;
  item_name: string;
  item_code: string;
  type: 'entrada' | 'saida' | 'ajuste';
  quantity: number;
  reason: string;
  location: string;
  user_name: string;
  created_at: string;
}

export interface EmailLog {
  id: string;
  service_order_id: string;
  recipient_email: string;
  customer_name: string;
  subject: string;
  html_body: string;
  text_body: string;
  status: 'sent' | 'failed';
  sent_at: string;
}

export type RentalStatus = 'Active' | 'Completed' | 'Pending' | 'Cancelled';

export interface ForkliftRental {
  id: string;
  machine_id: string;
  customer_id: string;
  start_date: string;
  end_date: string;
  monthly_value: number;
  status: RentalStatus;
  contract_number: string | null;
  notes: string | null;
  created_at: string;
}

// forced sync
