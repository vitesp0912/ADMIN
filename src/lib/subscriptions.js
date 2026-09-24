import { formatISTDate } from './datetime'
import { formatInr } from './format'

/** Map subscription.status → StatusPill tone */
export function subscriptionStatusTone(status) {
  const s = (status || '').toLowerCase()
  if (s === 'active') return 'ok'
  if (s === 'pending') return 'warn'
  if (s === 'expired') return 'danger'
  return 'neutral'
}

export function formatSubscriptionStatus(status) {
  if (!status) return 'No subscription'
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}

export function formatPlanName(plan) {
  if (!plan) return 'No plan'
  return plan.name || plan.code || 'Unknown plan'
}

export function formatPlanMeta(plan) {
  if (!plan) return null
  const parts = []
  if (plan.duration_months) parts.push(`${plan.duration_months} mo`)
  else if (plan.duration_days) parts.push(`${plan.duration_days} days`)
  if (plan.price_total_inr != null) parts.push(formatInr(plan.price_total_inr, { digits: 0 }))
  return parts.length ? parts.join(' · ') : null
}

export function formatSubscriptionRange(sub) {
  if (!sub) return null
  const start = sub.start_date ? formatISTDate(sub.start_date) : null
  const end = sub.end_date ? formatISTDate(sub.end_date) : null
  if (start && end) return `${start} → ${end}`
  if (start) return `From ${start}`
  if (end) return `Until ${end}`
  return null
}

/**
 * Compute subscription end from a start date + plan.
 * Prefers duration_days; falls back to duration_months.
 */
export function computeSubscriptionEndDate(startDate, plan) {
  if (!startDate || !plan) return null
  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) return null

  const end = new Date(start)
  if (plan.duration_days && Number(plan.duration_days) > 0) {
    end.setUTCDate(end.getUTCDate() + Number(plan.duration_days))
  } else if (plan.duration_months && Number(plan.duration_months) > 0) {
    end.setUTCMonth(end.getUTCMonth() + Number(plan.duration_months))
  } else {
    return null
  }
  return end.toISOString()
}

/**
 * Normalize a subscriptions row (with optional embedded plans) for UI.
 */
export function normalizeSubscriptionRow(row) {
  if (!row) return null
  const plan = Array.isArray(row.plans) ? row.plans[0] : row.plans
  return {
    id: row.id,
    pump_id: row.pump_id,
    status: row.status,
    start_date: row.start_date,
    end_date: row.end_date,
    plan_id: row.plan_id,
    plan: plan || null,
  }
}

export const SUBSCRIPTION_SELECT =
  'id, pump_id, status, start_date, end_date, plan_id, plans(id, code, name, duration_days, duration_months, price_base_inr, price_total_inr, gst_rate, is_active)'

export const PLANS_SELECT =
  'id, code, name, duration_days, duration_months, price_base_inr, price_total_inr, gst_rate, is_active, sort_order'

export const SUBSCRIPTION_STATUSES = ['pending', 'active', 'expired']
