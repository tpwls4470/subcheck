import {sqliteTable,text,integer,primaryKey} from 'drizzle-orm/sqlite-core';
export const subscriptions=sqliteTable('subscriptions',{
 userId:text('user_id').notNull(),
 serviceId:text('service_id').notNull(),
 name:text('name').notNull(),
 plan:text('plan'),
 amount:integer('amount'),
 nextPayment:text('next_payment'),
 cycle:text('cycle').notNull().default('unknown'),
 channel:text('channel').notNull().default('unknown'),
 updatedAt:text('updated_at').notNull(),
 deletedAt:text('deleted_at'),
},table=>[primaryKey({columns:[table.userId,table.serviceId]})]);
