export type Concern = {
  id: number
  mobile: string
  name: string
  email?: string | null
  role?: string | null
}

export type ExpenseStatus =
  | 'submitted'
  | 'approved'
  | 'PostedToSAP'
  | 'paid'
  | 'rejected'
  | string

export type Expense = {
  id: number
  category: string
  gl_code?: string | null
  amount: number | string
  vendor: string | null
  vendor_card_code?: string | null
  bill_date: string | null
  bill_description: string | null
  remarks: string | null
  status: ExpenseStatus
  submitted_by: string | null
  anju_rejected_reason: string | null
  billImageUrl?: string | null
  created_at?: string | null
}

export type Option = { key: string; label: string; sub?: string; raw: Record<string, unknown> }
