# REST API Reference — Billora

## Response Envelope
All API endpoints return a standardized JSON envelope:
```json
{
  "success": true,
  "data": {},
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```
Error envelope:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | CONFLICT | BUSINESS_RULE_VIOLATION",
    "message": "Human-readable error description",
    "fieldErrors": {}
  }
}
```

## Endpoints Summary
- **Auth:** `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/verify-email`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
- **Users & Roles:** `GET/POST /api/employees`, `PATCH /api/employees/[id]`, `GET/POST /api/customers`, `GET/PATCH /api/customers/[id]`
- **Catalog & Plans:** `GET/POST/PATCH /api/products`, `POST/PATCH /api/products/[id]/variants`, `GET/POST/PATCH /api/plans`, `GET/POST/PATCH /api/taxes`, `GET/POST/PATCH /api/discounts`
- **Sales & Lifecycle:** `GET/POST /api/quotation-templates`, `GET/POST /api/quotations`, `POST /api/quotations/preview`, `POST /api/quotations/[id]/status`, `POST /api/quotations/[id]/convert`, `GET/POST /api/subscriptions`, `GET /api/subscriptions/[id]`, `POST /api/subscriptions/[id]/transition`
- **Billing, Invoices & Payments:** `POST /api/billing/run`, `GET /api/billing/jobs`, `GET /api/invoices`, `GET /api/invoices/[id]`, `POST /api/invoices/[id]/status`, `GET /api/invoices/[id]/pdf`, `GET/POST /api/payments`, `POST /api/payments/razorpay/order`, `POST /api/payments/razorpay/verify`, `POST /api/webhooks/razorpay`
- **Intelligence & System:** `GET /api/analytics/dashboard`, `GET /api/analytics/export`, `GET /api/forecasting`, `POST /api/assistant/query`, `GET/PATCH /api/notifications`, `GET /api/audit-logs`
