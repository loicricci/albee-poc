# Password Reset Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PASSWORD RESET SYSTEM                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────┐          ┌──────────────────────┐        │
│  │   USER SELF-SERVICE  │          │   ADMIN RESET        │        │
│  │   (Email-based)      │          │   (Direct)           │        │
│  └──────────────────────┘          └──────────────────────┘        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## User Self-Service Flow (Email-Based)

```
┌────────────┐
│   USER     │
│  /login    │
└─────┬──────┘
      │ 1. Clicks "Forgot password?"
      ▼
┌─────────────────┐
│ /reset-password │
│                 │
│ [Enter Email]   │
│ [Send Link]     │
└─────┬───────────┘
      │ 2. Submits email
      ▼
┌──────────────────────┐
│  Supabase Auth API   │
│                      │
│  resetPasswordFor    │
│  Email()             │
└─────┬────────────────┘
      │ 3. Sends magic link email
      ▼
┌──────────────────────┐
│   USER'S EMAIL       │
│                      │
│  "Reset your         │
│   password"          │
│                      │
│  [Click Link] ───────┼──┐
└──────────────────────┘  │
                          │ 4. User clicks link
                          ▼
                    ┌─────────────────┐
                    │ /update-password│
                    │                 │
                    │ [New Password]  │
                    │ [Confirm]       │
                    │ [Update]        │
                    └─────┬───────────┘
                          │ 5. Updates password
                          ▼
                    ┌──────────────────────┐
                    │  Supabase Auth API   │
                    │                      │
                    │  updateUser()        │
                    └─────┬────────────────┘
                          │ 6. Password updated
                          ▼
                    ┌─────────────────┐
                    │   /login        │
                    │   (with success │
                    │    message)     │
                    └─────────────────┘
```

---

## Admin Reset Flow (Direct)

```
┌────────────────┐
│     ADMIN      │
│  /backoffice   │
└─────┬──────────┘
      │ 1. Navigates to Profiles tab
      ▼
┌─────────────────────────────┐
│  Profiles List              │
│                             │
│  @user1  [View] [Reset] [X] │
│  @user2  [View] [Reset] [X] │◄─── 2. Clicks "Reset Password"
│  @user3  [View] [Reset] [X] │
└─────┬───────────────────────┘
      │
      ▼
┌─────────────────────────────┐
│  Reset Password Modal       │
│                             │
│  Resetting for: @user1      │
│                             │
│  New Password:  [........]  │
│  Confirm:       [........]  │
│                             │
│  [Cancel]  [Reset Password] │◄─── 3. Enters new password
└─────┬───────────────────────┘
      │ 4. Submits
      ▼
┌─────────────────────────────────┐
│  Backend API                    │
│  POST /admin/profiles/          │
│       {user_id}/reset-password  │
└─────┬───────────────────────────┘
      │ 5. Authenticates admin
      │    (require_admin)
      ▼
┌─────────────────────────────────┐
│  Supabase Admin API             │
│  PUT /auth/v1/admin/users/      │
│      {user_id}                  │
│                                 │
│  Headers:                       │
│    Authorization: Bearer        │
│      $SUPABASE_SERVICE_ROLE_KEY │
│                                 │
│  Body: { "password": "..." }    │
└─────┬───────────────────────────┘
      │ 6. Password updated
      │    immediately
      ▼
┌─────────────────────────────┐
│  Success Response           │
│                             │
│  "Password reset            │
│   successfully for @user1"  │
└─────┬───────────────────────┘
      │ 7. User can now login
      │    with new password
      ▼
┌─────────────────────────────┐
│  User logs in with          │
│  new password               │
│  (no email notification)    │
└─────────────────────────────┘
```

---

## Authentication & Security Layers

```
┌──────────────────────────────────────────────────────────────┐
│                    SECURITY ARCHITECTURE                      │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  USER SELF-SERVICE                 ADMIN RESET               │
│  ┌─────────────────┐              ┌─────────────────┐       │
│  │ Email           │              │ Admin           │       │
│  │ Verification    │              │ Whitelist       │       │
│  │                 │              │                 │       │
│  │ ✓ Must have     │              │ ✓ Email must be │       │
│  │   access to     │              │   in ALLOWED_   │       │
│  │   email         │              │   ADMIN_EMAILS  │       │
│  │                 │              │                 │       │
│  │ ✓ Magic link    │              │ ✓ Requires      │       │
│  │   expires       │              │   session       │       │
│  │   (1 hour)      │              │   token         │       │
│  └─────────────────┘              └─────────────────┘       │
│          │                                 │                 │
│          ▼                                 ▼                 │
│  ┌─────────────────────────────────────────────────┐        │
│  │         Supabase Authentication                 │        │
│  │                                                 │        │
│  │  ┌──────────────┐      ┌──────────────┐       │        │
│  │  │ Anon Key     │      │ Service Role │       │        │
│  │  │ (Public)     │      │ Key (Private)│       │        │
│  │  │              │      │              │       │        │
│  │  │ - Limited    │      │ - Full admin │       │        │
│  │  │   access     │      │   access     │       │        │
│  │  │ - User ops   │      │ - Bypass RLS │       │        │
│  │  └──────────────┘      └──────────────┘       │        │
│  │                                                 │        │
│  └─────────────────────────────────────────────────┘        │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  app/(auth)/                                                 │
│  ├── login/page.tsx           ← "Forgot password?" link     │
│  ├── reset-password/page.tsx  ← Request reset link          │
│  └── update-password/page.tsx ← Set new password            │
│                                                              │
│  app/(app)/                                                  │
│  └── backoffice/page.tsx      ← Admin reset UI              │
│                                                              │
│  lib/                                                        │
│  ├── supabaseClient.ts        ← Supabase client config      │
│  └── api.ts                   ← API wrapper                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND (FastAPI)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  admin.py                                                    │
│  ├── require_admin()          ← Auth middleware             │
│  ├── ResetPasswordRequest     ← Pydantic model              │
│  └── POST /admin/profiles/                                  │
│      {user_id}/reset-password ← Admin reset endpoint        │
│                                                              │
│  auth_supabase.py                                            │
│  ├── get_current_user()       ← User auth                   │
│  └── get_current_user_id()    ← User ID extraction          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     SUPABASE (Backend)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Authentication Service                                      │
│  ├── /auth/v1/recover        ← User password reset          │
│  ├── /auth/v1/user           ← Update user password         │
│  └── /auth/v1/admin/users/   ← Admin update user            │
│      {id}                                                    │
│                                                              │
│  PostgreSQL Database                                         │
│  └── auth.users              ← User credentials             │
│                                                              │
│  Email Service (SMTP)                                        │
│  └── Send password reset emails                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Admin Reset Password

```
1. Admin Action
   ┌─────────────────────────┐
   │ Admin clicks            │
   │ "Reset Password"        │
   │ for user @john          │
   └──────────┬──────────────┘
              │
              ▼
2. Frontend Request
   ┌─────────────────────────┐
   │ POST /admin/profiles/   │
   │ abc-123/reset-password  │
   │                         │
   │ Headers:                │
   │   Authorization: Bearer │
   │     {admin_token}       │
   │                         │
   │ Body:                   │
   │   {                     │
   │     user_id: "abc-123", │
   │     new_password: "..." │
   │   }                     │
   └──────────┬──────────────┘
              │
              ▼
3. Backend Validation
   ┌─────────────────────────┐
   │ • Check admin auth      │
   │ • Validate user_id      │
   │ • Check password length │
   │ • Verify profile exists │
   └──────────┬──────────────┘
              │
              ▼
4. Supabase Admin API
   ┌─────────────────────────┐
   │ PUT /auth/v1/admin/     │
   │     users/abc-123       │
   │                         │
   │ Headers:                │
   │   Authorization: Bearer │
   │     {service_role_key}  │
   │                         │
   │ Body:                   │
   │   {                     │
   │     password: "..."     │
   │   }                     │
   └──────────┬──────────────┘
              │
              ▼
5. Database Update
   ┌─────────────────────────┐
   │ auth.users              │
   │                         │
   │ UPDATE users            │
   │ SET encrypted_password  │
   │     = hash(new_password)│
   │ WHERE id = 'abc-123'    │
   └──────────┬──────────────┘
              │
              ▼
6. Response to Admin
   ┌─────────────────────────┐
   │ {                       │
   │   ok: true,             │
   │   message: "Password    │
   │     reset successfully  │
   │     for user john",     │
   │   user_id: "abc-123",   │
   │   handle: "john"        │
   │ }                       │
   └─────────────────────────┘
```

---

## Environment Variables Flow

```
┌──────────────────────────────────────────────────────────────┐
│                  ENVIRONMENT CONFIGURATION                    │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Backend (.env)              Frontend (.env.local)           │
│  ┌────────────────────┐     ┌────────────────────┐          │
│  │ SUPABASE_URL       │────▶│ NEXT_PUBLIC_       │          │
│  │                    │     │   SUPABASE_URL     │          │
│  │ SUPABASE_ANON_KEY  │────▶│                    │          │
│  │                    │     │ NEXT_PUBLIC_       │          │
│  │ SUPABASE_SERVICE_  │     │   SUPABASE_ANON_   │          │
│  │   ROLE_KEY ⚠️      │     │   KEY              │          │
│  │   (PRIVATE!)       │     │                    │          │
│  └────────────────────┘     └────────────────────┘          │
│                                                               │
│  ⚠️  NEVER expose Service Role Key to frontend!             │
│      Only used in backend API calls                          │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Error Handling Flow

```
User Reset Errors                Admin Reset Errors
┌──────────────────┐            ┌──────────────────┐
│ Invalid email    │            │ Not admin        │
│ ↓                │            │ ↓                │
│ Show error       │            │ 403 Forbidden    │
│ message          │            │                  │
└──────────────────┘            └──────────────────┘

┌──────────────────┐            ┌──────────────────┐
│ Email not found  │            │ Invalid user_id  │
│ ↓                │            │ ↓                │
│ Still show       │            │ 404 Not Found    │
│ success (privacy)│            │                  │
└──────────────────┘            └──────────────────┘

┌──────────────────┐            ┌──────────────────┐
│ Password mismatch│            │ Service key      │
│ ↓                │            │ missing          │
│ Show error       │            │ ↓                │
│ inline           │            │ 500 Config Error │
└──────────────────┘            └──────────────────┘
```

---

## Success States

```
User Flow Success              Admin Flow Success
┌──────────────────┐          ┌──────────────────┐
│ Email sent       │          │ Password updated │
│ ↓                │          │ ↓                │
│ Show success UI  │          │ Show alert       │
│ with email shown │          │ "Reset for @user"│
└──────────────────┘          └──────────────────┘

┌──────────────────┐          ┌──────────────────┐
│ Password updated │          │ User can login   │
│ ↓                │          │ immediately      │
│ Redirect to login│          │                  │
│ with ?success=1  │          │ No email sent    │
└──────────────────┘          └──────────────────┘
```

---

Generated: December 2025
Version: 1.0






