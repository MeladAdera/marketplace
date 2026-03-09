# Marketplace Backend — Full Feature Documentation

Complete technical documentation of how the marketplace backend was built: architecture, features, data flow, and implementation details.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Request Flow & Middleware Stack](#2-request-flow--middleware-stack)
3. [Authentication System](#3-authentication-system)
4. [RBAC (Role-Based Access Control)](#4-rbac-role-based-access-control)
5. [Error Handling & i18n](#5-error-handling--i18n)
6. [Database Schema](#6-database-schema)
7. [Feature: Auth](#7-feature-auth)
8. [Feature: Vendor Management](#8-feature-vendor-management)
9. [Feature: Products & Variants](#9-feature-products--variants)
10. [Feature: Inventory](#10-feature-inventory)
11. [Feature: Cart](#11-feature-cart)
12. [Feature: Orders & Checkout](#12-feature-orders--checkout)
13. [Feature: Staff Invitations](#13-feature-staff-invitations)
14. [Feature: Platform Admin — Vendor Management](#14-feature-platform-admin--vendor-management)
15. [Feature: Audit Logging](#15-feature-audit-logging)
16. [Redis Caching](#16-redis-caching)
17. [API Endpoints Reference](#17-api-endpoints-reference)

---

## 1. Architecture Overview

### Layered Architecture

```
Request → Router → Middleware (auth, validate, authorize) → Controller → Service → Repository → Database
```

| Layer | Responsibility | Location |
|-------|----------------|----------|
| **Routes** | HTTP method + path mapping, middleware composition | `src/routes/` |
| **Controllers** | Parse request, call service, format response | `src/controllers/` |
| **Services** | Business logic, orchestration, transactions | `src/services/` |
| **Repositories** | Data access, raw SQL via `pg` | `src/repository/` |
| **Validations** | Zod schemas for body/params/query | `src/validations/` |
| **Errors** | Domain-specific `AppError` subclasses | `src/errors/` |

### Tech Stack

- **Runtime**: Node.js
- **Framework**: Express 5
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL 15, raw SQL (no ORM)
- **Cache**: Redis 7 (ioredis)
- **Validation**: Zod
- **i18n**: i18next (ar, en, es)
- **Security**: Helmet, CORS, rate limiting, bcrypt, HTTP-only cookies

### Data Flow Pattern

1. **Controller** receives `req`, extracts input, calls **Service**
2. **Service** performs business logic, may use multiple **Repositories**
3. **Repository** runs SQL via `pool.query()` or `client.query()` (in transactions)
4. **Service** returns domain objects; **Controller** maps to API response
5. Errors bubble up; **errorHandler** middleware formats them (with i18n when applicable)

---

## 2. Request Flow & Middleware Stack

### Global Middleware Order (in `server.ts`)

1. **Helmet** — Security headers
2. **CORS** — Allow `FRONTEND_URL`, credentials
3. **express.json()** — Parse JSON body
4. **cookieParser** — Parse cookies
5. **i18next** — Language detection (Accept-Language, query `lng`)
6. **Routes** — Mounted at root

### Route-Level Middleware

Typical protected route:

```
validate(schema) → authMiddleware → authorize(Permission.X) → controller
```

- **validate**: Zod schema for `body`, `params`, `query`; returns 400 on failure
- **authMiddleware**: Reads `session_token` cookie, hashes it; checks Redis cache for session, else queries `sessions` JOIN `users`; sets `req.user`
- **authorize**: Checks `req.user.role` against `ROLE_PERMISSIONS`; returns 403 if missing permission

### Rate Limiters

| Limiter | Window | Max | Applied To |
|---------|--------|-----|------------|
| `loginLimiter` | 15 min | 5 | Login (failed attempts only) |
| `signupLimiter` | 1 hour | 3 | Signup |
| `apiLimiter` | 1 min | 100 | General API (if applied) |

---

## 3. Authentication System

### Session-Based Auth

- **Token**: 32-byte random hex, stored in HTTP-only cookie `session_token`
- **Storage**: Only `SHA-256` hash of token stored in `sessions.session_token_hash`
- **Cookie options**: `httpOnly`, `secure` in prod, `sameSite: lax`, `path: /`

### Auth Flow

1. **Login/Signup**: `auth.service` creates user (if signup), creates session, returns token → controller sets cookie
2. **Protected request**: `authMiddleware` reads cookie → hashes token → checks Redis cache (`session:{hash}`) → on miss, queries `sessions` JOIN `users` → caches result → sets `req.user`
3. **Refresh**: `POST /auth/refresh` with cookie → revokes old session, creates new one, sets new cookie
4. **Logout**: Clears cookie, revokes session (`revoked_at = NOW()`)

### Session Validation (auth.middleware)

```sql
SELECT s.id, s.user_id, u.email, u.role, u.organization_id
FROM sessions s
JOIN users u ON s.user_id = u.id
WHERE s.session_token_hash = $1
  AND s.revoked_at IS NULL
  AND s.expires_at > NOW()
```

- Session lifetime: 30 minutes
- `last_seen_at` can be updated on each request (not shown in current impl)

### User Blocking

- `users.is_active` — if false, login fails with generic "Invalid credentials"
- `users.blocked`, `users.blocked_at`, `users.blocked_by` — (migration 013) for vendor-admin and platform-admin blocking (suspend/restore)

---

## 4. RBAC (Role-Based Access Control)

### Roles (`UserRole`)

| Role | Description |
|------|-------------|
| `super_admin` | Full platform access |
| `platform_admin` | Same as super_admin |
| `vendor_admin` | Full vendor org access (products, inventory, staff, orders) |
| `vendor_staff` | Read-only vendor (products, inventory, orders) |
| `support` | Read + refund only |
| `customer` | Cart, orders, profile |

### Permissions (`Permission`)

Format: `resource:action` (e.g. `product:create`)

- **Profile**: `profile:read`, `profile:update`
- **Product**: `product:create`, `product:read`, `product:update`, `product:delete`
- **Inventory**: `inventory:read`, `inventory:update`
- **Staff**: `staff:invite`, `staff:read`, `staff:revoke`
- **Order**: `order:create`, `order:read`, `order:update`, `order:refund`
- **Cart**: `cart:read`, `cart:create`, `cart:update`, `cart:delete`
- **Vendor stats**: `vendor:stats:read`
- **Platform Admin (vendor management)**: `platform:vendor:read`, `platform:vendor:update`, `platform:vendor:suspend`, `platform:vendor:activate`, `platform:vendor:delete`

### Role → Permissions Mapping

Defined in `src/constants/permissions.ts` as `ROLE_PERMISSIONS`. The `authorize` middleware uses `AuthorizationService.hasPermissions(role, permissions)` to check access.

### Authorize Middleware

```ts
authorize(Permission.PRODUCT_UPDATE)
authorize([Permission.ORDER_READ, Permission.ORDER_UPDATE], { requireAll: true })
authorize(Permission.PROFILE_UPDATE, { condition: async (req) => {...} })
```

- `condition`: Optional async function for ownership checks (e.g. product belongs to user's org)

---

## 5. Error Handling & i18n

### AppError

Base class with: `statusCode`, `errorCode`, `isOperational`, `details`, `translationKey`, `translationParams`.

Subclasses: `ValidationError`, `NotFoundError`, `ConflictError`, `ForbiddenError`, `InternalServerError`, plus domain errors in `auth.errors`, `vendor.errors`, `product.errors`, etc.

### Error Handler Flow

1. **ZodError** → 400, `VALIDATION_ERROR`, `details` with field paths
2. **PostgresError** → 23505 → 409 `DUPLICATE_ENTRY`; 23503 → 400 `INVALID_REFERENCE`; else 500
3. **AppError** (with `translationKey`) → `req.t(translationKey)` for message
4. **Generic** → 500, message from `req.t('common.internal_error')` in prod

### i18n

- **Backend**: `i18next-fs-backend`, loads from `locales/{{lng}}/{{ns}}.json`
- **Namespaces**: `auth`, `errors`, `product`, `vendor`, `inventory`
- **Languages**: `ar` (fallback), `en`, `es`
- **Detection**: `Accept-Language` header or `?lng=` query

---

## 6. Database Schema

### Core Entities

| Table | Purpose |
|-------|---------|
| `organizations` | Vendors (companies); `slug` unique; `deleted_at` for soft delete (migration 014) |
| `users` | All users; `organization_id` nullable (customers have null); `blocked`, `blocked_at`, `blocked_by` for admin blocking |
| `sessions` | Session tokens (hashed), expiry, revocation |
| `products` | Products per org; `soft_deleted_at` for soft delete |
| `variants` | SKU, price_cents, stock_quantity per product |
| `carts` | One per user (`user_id` unique) |
| `cart_items` | (cart_id, variant_id, quantity); unique per cart+variant |
| `orders` | Customer order; `order_number`, `client_request_id` (idempotency) |
| `vendor_orders` | Per-vendor sub-order; status: pending→accepted→packed→shipped→delivered |
| `order_items` | Line items with price_snapshot, sku_snapshot |
| `inventory_movements` | reserve, release, restock, manual_adjustment |
| `invitations` | Pending staff invites; token_hash, expires_at |
| `audit_logs` | actor_user_id, action, entity_type, entity_id, old_values, new_values |

### Key Constraints

- `organizations.status`: `active`, `suspended`; `organizations.deleted_at` for soft delete
- `users.role`: `customer`, `vendor_admin`, `vendor_staff`, `support`, `platform_admin`
- `orders.status`: `pending_payment`, `paid`, `cancelled`
- `vendor_orders.status`: `pending`, `accepted`, `packed`, `shipped`, `delivered`, `cancelled`, `refunded`
- `invitations`: unique (org, email) where status = pending

### Migrations

Run in order: `000_enable_extensions.sql` through `014_*`. Custom migration runner in `src/utils/migrate.ts` tracks executed migrations in `migrations` table. Key migrations: `013_add_user_blocking_columns.sql`, `014_add_soft_delete_to_organizations.sql`.

---

## 7. Feature: Auth

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | No | Login, set session cookie |
| POST | `/auth/signup` | No | Signup (customer/vendor_admin/vendor_staff) |
| POST | `/auth/logout` | No | Revoke session, clear cookie |
| POST | `/auth/refresh` | Cookie | Rotate session, new cookie |
| GET | `/auth/me` | Yes | Current user profile |

### Implementation

- **auth.service**: `loginService`, `signupService`, `refreshSession` — bcrypt compare/hash, session create
- **auth.controller**: Extracts IP/user-agent, calls service, sets/clears cookie
- **Sessions**: Stored hashed; old session revoked on refresh
- **Signup roles**: Only `CUSTOMER`, `VENDOR_ADMIN`, `VENDOR_STAFF` allowed

---

## 8. Feature: Vendor Management

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/vendors/register` | No | Register org + admin user |
| GET | `/vendors/me` | Yes | Vendor profile + stats |
| PATCH | `/vendors/me` | Yes | Update org (name, slug, status) |

### Register Flow

1. Validate email not exists, slug not exists
2. **Transaction**: Create org → create user (vendor_admin) → create session → audit log
3. Return user, org, session token (cookie set by controller if using auth flow)

### Profile

- Fetches org, admin, staff list, product count, staff count
- `totalOrders`, `totalRevenue`, `pendingOrders` — placeholders (0) until wired

---

## 9. Feature: Products & Variants

### Vendor Product Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/vendors/products` | Yes | List products (paginated, filter by active, search) |
| POST | `/vendors/products` | Yes | Create product + variants |
| GET | `/vendors/products/:id` | Yes | Product by ID |
| PATCH | `/vendors/products/:id` | Yes | Update product |
| DELETE | `/vendors/products/:id` | Yes | Soft delete (set soft_deleted_at) |

### Public Product Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/products` | No | List products (vendor slug, pagination, price range) |
| GET | `/products/:id` | No | Product detail with variants |

### Data Model

- **Product**: name, description, active, organization_id
- **Variant**: product_id, sku (unique), name, price_cents, stock_quantity, active
- Products scoped by `organization_id`; vendor routes enforce org via `req.user.organization_id`

### Product Service (vendor)

- `createProduct`: Creates product, then variants in sequence
- `updateProduct`: Updates product, optionally variants (add/update/delete)
- `deleteProduct`: Soft delete

---

## 10. Feature: Inventory

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PATCH | `/vendors/inventory/:variantId` | Yes | Set stock (manual adjustment) |
| GET | `/vendors/inventory/history` | Yes | Movement history (optional variantId) |
| GET | `/vendors/inventory/check` | Yes | Check stock for variant + quantity |

### Stock Update Flow

1. **Transaction**: Lock variant (`getVariantForUpdate` with `FOR UPDATE`)
2. Validate new quantity >= 0
3. Update `variants.stock_quantity`
4. Insert `inventory_movements` (type: `manual_adjustment`)
5. Audit log

### Movement Types

- `reserve` — Checkout reserves stock
- `release` — Order cancelled, release reservation
- `restock` — Refund restocks
- `manual_adjustment` — Vendor dashboard update

---

## 11. Feature: Cart

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/cart` | Yes | Get cart grouped by vendor |
| POST | `/cart` | Yes | Add item (variantId, quantity) |
| PATCH | `/cart/items/:id` | Yes | Update quantity |
| DELETE | `/cart/items/:id` | Yes | Remove item |
| DELETE | `/cart` | Yes | Clear cart |

### Implementation

- **Lazy cart**: `getOrCreateCart` — INSERT ... ON CONFLICT (user_id) DO UPDATE
- **Add**: Validate variant exists, active, sufficient stock; upsert cart_items (ON CONFLICT cart_id+variant_id DO UPDATE quantity)
- **Get**: `getUserCartGroupedByVendor` — groups items by vendor (organization)
- **Stock**: Checked at add/update; not locked until checkout

### Audit

- `CART_ITEM_ADDED`, `CART_ITEM_UPDATED`, `CART_ITEM_REMOVED`, `CART_CLEARED` — logged via AuditService

---

## 12. Feature: Orders & Checkout

### Customer Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/orders/checkout` | Yes | Checkout cart → create order |
| GET | `/orders` | Yes | List orders (filters: status, fromDate, toDate) |
| GET | `/orders/:id` | Yes | Order detail |
| POST | `/orders/:id/cancel` | Yes | Customer cancel (if not shipped) |
| POST | `/orders/:id/refund` | Yes | Admin refund (support/vendor_admin) |

### Checkout Flow (createOrderTransaction)

1. **Idempotency**: If `client_request_id` + user already has order → return existing
2. **Transaction**:
   - `lockCartItemsForCheckout`: Lock cart_items + variants (FOR UPDATE), validate stock
   - Group items by vendor (organization)
   - For each vendor: create `vendor_order`, create `order_items`, reserve inventory (movement type `reserve`), decrement variant stock
   - Create parent `order`, link vendor_orders
   - Clear cart
3. **Order number**: `ORD-YYYYMMDD-NNNNNN` (per-day sequence)

### Vendor Order Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/vendor/orders` | Yes | List vendor's orders |
| GET | `/vendor/orders/:id` | Yes | Vendor order detail |
| PATCH | `/vendor/orders/:id` | Yes | Update status (e.g. packed, shipped) |

### Refund Flow

1. Lock order (FOR UPDATE)
2. Validate not already cancelled
3. `processRefund`: Set vendor_orders to refunded, create `restock` movements, increment variant stock
4. Audit log

---

## 13. Feature: Staff Invitations

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/vendors/users/invite` | Yes | Invite by email + role |
| POST | `/vendors/invitations/accept` | Yes | Accept invite (token in body) |
| GET | `/vendors/invitations` | Yes | List invitations |
| DELETE | `/vendors/invitations/:id` | Yes | Revoke invitation |

### Invite Flow

1. Check user not already in org
2. Check no pending invite for same email+org (partial unique index)
3. Create invitation: store token_hash (SHA-256 of plain token), expires_at
4. In dev: log invite link to console (no real email yet)
5. Return invitation without plain token

### Accept Flow

1. Lookup by token (hash provided token, query by hash)
2. Validate status, expiration
3. **Transaction**: Create user (or link existing) with org + role, mark invitation accepted
4. Optionally create session for immediate login

---

## 14. Feature: Platform Admin — Vendor Management

Platform admins can manage all vendors (organizations) from a central dashboard. Requires `platform_admin` or `super_admin` role.

### Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/platform/admin/vendors` | `platform:vendor:read` | List vendors (paginated, filter by status, search) |
| GET | `/platform/admin/vendors/:id` | `platform:vendor:read` | Vendor details + stats + staff list |
| PATCH | `/platform/admin/vendors/:id` | `platform:vendor:update` | Update vendor (name, slug) |
| PATCH | `/platform/admin/vendors/:id/suspend` | `platform:vendor:suspend` | Suspend vendor (block login) |
| PATCH | `/platform/admin/vendors/:id/activate` | `platform:vendor:activate` | Reactivate suspended vendor |
| DELETE | `/platform/admin/vendors/:id` | `platform:vendor:delete` | Soft delete vendor |
| POST | `/platform/admin/vendors/:id/restore` | `platform:vendor:delete` | Restore soft-deleted vendor |

### List Filters

- `page`, `limit` — pagination
- `status` — `active`, `suspended`, `deleted`
- `search` — by name or slug
- `sortBy` — `created_at`, `name`, `status`
- `sortOrder` — `asc`, `desc`

### Suspend Flow

1. Validate org exists and is not already suspended
2. **Transaction**: Block all `vendor_admin` and `vendor_staff` users → set org status to `suspended`
3. Audit log with reason, duration_hours (optional)

### Activate Flow

1. Validate org is suspended
2. **Transaction**: Unblock vendor users → set org status to `active`
3. Audit log with note

### Soft Delete Flow

1. **Safety checks**: No active products, no pending/processing orders, no active cart items
2. **Transaction**: Set `organizations.deleted_at`, block all vendor users
3. Audit log

### Restore Flow

1. Validate org is soft-deleted
2. **Transaction**: Clear `deleted_at`, set status to `active`, unblock users
3. Audit log

### Implementation

- **Service**: `platform-admin.service.ts` — orchestration, transactions, audit
- **Repository**: `platform-admin.repo.ts` + `users.repo.ts` (block/unblock)
- **Validation**: Zod schemas in `vendor.validation.ts` (listAdminVendorsSchema, updateAdminVendorSchema, etc.),
- **i18n**: `vendor` namespace (`list_success`, `details_success`, etc.)

---

## 15. Feature: Audit Logging

### Schema

`audit_logs`: `actor_user_id`, `organization_id`, `action`, `entity_type`, `entity_id`, `old_values`, `new_values`, `metadata`, `created_at`

### Usage

```ts
AuditService.log({
  actorUserId,
  organizationId,
  action: "PRODUCT_CREATED",
  entityType: "product",
  entityId,
  newValues: { name, ... },
});
```

- Used in: vendor registration, profile update, product CRUD, inventory update, cart actions, order create/cancel/refund, invitations, platform admin vendor actions
- Optional `client` for same-transaction audit (e.g. vendor registration)

---

## 16. Redis Caching

Redis is used to cache read-heavy data and reduce database load. The app degrades gracefully if Redis is unavailable (falls back to DB).

### Setup

- **Docker**: Redis 7 Alpine in `docker-compose.yml` (port 6379)
- **Env**: `REDIS_URL=redis://localhost:6379` (see `.env.example`)
- **Client**: `src/db/redis.ts` — ioredis with retry, lazy connect
- **Health**: `GET /health` returns `redis: "connected" | "disconnected"`

### Cache Service

`src/services/cache.service.ts`:

| Function | Purpose |
|----------|---------|
| `cacheGet<T>(key)` | Get value, parse JSON; returns `null` on miss/error |
| `cacheSet(key, value, ttl?)` | Set with optional TTL (seconds) |
| `cacheDel(key)` | Delete single key |
| `cacheDelPattern(pattern)` | Delete keys matching pattern (e.g. `product:list:*`) |
| `cacheKeys` | Key builders: `publicProduct(id)`, `publicProductList(hash)`, `session(tokenHash)` |

### Cached Data

| Cache | Key | TTL | Invalidation |
|-------|-----|-----|--------------|
| **Session** | `session:{tokenHash}` | 30 min | Logout, refresh |
| **Product list** | `product:list:{md5(filters)}` | 2 min | Product create/update/delete |
| **Product detail** | `product:public:{id}` | 10 min | Product update/delete |

### Endpoints Affected

- **Session cache**: All protected routes (auth middleware runs first)
- **Product list**: `GET /products` (query params: page, limit, vendor, min_price, max_price, search)
- **Product detail**: `GET /products/:id`

### Invalidation

- **Logout** (`POST /auth/logout`): `cacheDel(session:{tokenHash})`
- **Refresh** (`POST /auth/refresh`): `cacheDel(session:{tokenHash})` for old token
- **Product create/update/delete**: `cacheDel(product:public:{id})` + `cacheDelPattern(product:list:*)`

### Debug Logs

When testing, `[CACHE]` logs indicate hit/miss/invalidation:

- `[CACHE] session HIT — user: email`
- `[CACHE] session MISS — fetched from DB, caching for: email`
- `[CACHE] product detail HIT — id: uuid`
- `[CACHE] product list MISS — fetching from DB, filters: {...}`
- `[CACHE] session INVALIDATED — logout`

---

## 17. API Endpoints Reference

### Auth
- `POST /auth/login` — body: `{ email, password }`
- `POST /auth/signup` — body: `{ email, password, role?, organizationId? }`
- `POST /auth/logout` — no body
- `POST /auth/refresh` — cookie required
- `GET /auth/me` — auth required

### Vendors
- `POST /vendors/register` — body: `{ companyName, companySlug, adminEmail, adminPassword }`
- `GET /vendors/me` — auth
- `PATCH /vendors/me` — auth, body: `{ name?, slug?, status? }`

### Vendor Products
- `GET /vendors/products` — auth, query: `page`, `limit`, `active`, `search`
- `POST /vendors/products` — auth, body: product + variants
- `GET /vendors/products/:id` — auth
- `PATCH /vendors/products/:id` — auth
- `DELETE /vendors/products/:id` — auth

### Vendor Inventory
- `PATCH /vendors/inventory/:variantId` — auth, body: `{ quantity, reason? }`
- `GET /vendors/inventory/history` — auth, query: `variantId`, `page`, `limit`
- `GET /vendors/inventory/check` — auth, query: `variantId`, `quantity`

### Vendor Staff
- `POST /vendors/users/invite` — auth, body: `{ email, role }`
- `GET /vendors/invitations` — auth
- `DELETE /vendors/invitations/:id` — auth
- `POST /vendors/invitations/accept` — auth, body: `{ token }`

### Public Products (cached)
- `GET /products` — query: `vendorSlug`, `page`, `limit`, `minPrice`, `maxPrice`, `search` — cached by filters hash
- `GET /products/:id` — path — cached by product id

### Cart
- `GET /cart` — auth
- `POST /cart` — auth, body: `{ variantId, quantity }`
- `PATCH /cart/items/:id` — auth, body: `{ quantity }`
- `DELETE /cart/items/:id` — auth
- `DELETE /cart` — auth

### Orders
- `POST /orders/checkout` — auth, body: `{ client_request_id, payment_method, shipping_address?, notes? }`
- `GET /orders` — auth, query: `status`, `fromDate`, `toDate`, `page`, `limit`
- `GET /orders/:id` — auth
- `POST /orders/:id/cancel` — auth
- `POST /orders/:id/refund` — auth (support/vendor_admin), body: `{ reason, restock_inventory? }`

### Vendor Orders
- `GET /vendor/orders` — auth, query: `status`, `page`, `limit`
- `GET /vendor/orders/:id` — auth
- `PATCH /vendor/orders/:id` — auth, body: `{ status }`

### Vendor Admin (stats, staff management)
- `GET /vendor/admin/stats` — auth
- `GET /vendor/admin/staff` — auth
- `PATCH /vendor/admin/staff/:id/block` — auth
- `PATCH /vendor/admin/staff/:id/role` — auth

### Platform Admin (vendor management)
- `GET /platform/admin/vendors` — auth, query: `page`, `limit`, `status`, `search`, `sortBy`, `sortOrder`
- `GET /platform/admin/vendors/:id` — auth
- `PATCH /platform/admin/vendors/:id` — auth, body: `{ name?, slug? }`
- `PATCH /platform/admin/vendors/:id/suspend` — auth, body: `{ reason, duration_hours? }`
- `PATCH /platform/admin/vendors/:id/activate` — auth, body: `{ note? }`
- `DELETE /platform/admin/vendors/:id` — auth, body: `{ confirm: true }`
- `POST /platform/admin/vendors/:id/restore` — auth, body: `{ note? }` (optional)

---

## Summary

The marketplace backend is a layered Express + TypeScript API with:

- **Redis caching** for sessions, product list, and product detail (graceful fallback if Redis down)
- **Session-based auth** (HTTP-only cookies, hashed tokens)
- **RBAC** via roles and granular permissions
- **Multi-vendor** model: organizations, products, variants, per-vendor orders
- **Cart → Checkout** with idempotency, stock reservation, and vendor-order splitting
- **Inventory** tracking with movements (reserve, release, restock, manual)
- **Staff invitations** with token-based flow
- **Platform admin** vendor management (list, suspend, activate, soft delete, restore)
- **Audit logging** for key actions
- **i18n** for error messages
- **Validation** with Zod, **error handling** with AppError and Postgres error mapping