import {sqliteTable,text,integer,primaryKey} from 'drizzle-orm/sqlite-core';
export const subscriptions=sqliteTable('subscriptions',{
 userId:text('user_id').notNull(),
 serviceId:text('service_id').notNull(),
 name:text('name').notNull(),
 plan:text('plan'),
 amount:integer('amount'),
 currency:text('currency').notNull().default('KRW'),
 nextPayment:text('next_payment'),
 cycle:text('cycle').notNull().default('unknown'),
 channel:text('channel').notNull().default('unknown'),
 updatedAt:text('updated_at').notNull(),
 deletedAt:text('deleted_at'),
 billingObservedAt:text('billing_observed_at'),
 billingSyncedAt:text('billing_synced_at'),
 reminder3:integer('reminder_3').notNull().default(0),
 reminderDay:integer('reminder_day').notNull().default(0),
},table=>[primaryKey({columns:[table.userId,table.serviceId]})]);
export const pushDevices=sqliteTable('push_devices',{
 userId:text('user_id').notNull(),
 deviceId:text('device_id').notNull(),
 endpoint:text('endpoint').notNull(),
 updatedAt:text('updated_at').notNull(),
 lastSent:text('last_sent'),
},table=>[primaryKey({columns:[table.userId,table.deviceId]})]);
export const usageAlerts=sqliteTable('usage_alerts',{
 userId:text('user_id').notNull(),
 serviceId:text('service_id').notNull(),
 enabled:integer('enabled').notNull().default(0),
 threshold:integer('threshold').notNull().default(20),
 notified:integer('notified').notNull().default(0),
 updatedAt:text('updated_at').notNull(),
},table=>[primaryKey({columns:[table.userId,table.serviceId]})]);
export const usageSnapshots=sqliteTable('usage_snapshots',{
 userId:text('user_id').notNull(),
 serviceId:text('service_id').notNull(),
 observedAt:text('observed_at').notNull(),
 windows:text('windows').notNull(),
 updatedAt:text('updated_at').notNull(),
},table=>[primaryKey({columns:[table.userId,table.serviceId]})]);

export const billingCandidates=sqliteTable('billing_candidates',{
 userId:text('user_id').notNull(),
 serviceId:text('service_id').notNull(),
 observedAt:text('observed_at').notNull(),
 payload:text('payload').notNull(),
},table=>[primaryKey({columns:[table.userId,table.serviceId]})]);
export const billingSyncSettings=sqliteTable('billing_sync_settings',{
 userId:text('user_id').notNull(),
 serviceId:text('service_id').notNull(),
 enabled:integer('enabled').notNull().default(0),
 updatedAt:text('updated_at').notNull(),
},table=>[primaryKey({columns:[table.userId,table.serviceId]})]);
