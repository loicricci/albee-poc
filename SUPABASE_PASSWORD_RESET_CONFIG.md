# Supabase Configuration Checklist for Password Reset

## 🔧 Required Configuration Steps

### 1. Get Service Role Key
**Location:** Supabase Dashboard → Settings → API

```
┌─────────────────────────────────────────┐
│ Project API Keys                        │
├─────────────────────────────────────────┤
│                                         │
│ anon / public                           │
│ [eyJh...xyz]                    [Copy]  │
│ ✓ This key is safe to use in a browser │
│                                         │
│ service_role / secret                   │
│ [eyJh...abc]                    [Copy]  │◄─── COPY THIS!
│ ⚠️  This key has admin privileges      │
│                                         │
└─────────────────────────────────────────┘
```

**Add to `backend/.env`:**
```bash
SUPABASE_SERVICE_ROLE_KEY=eyJh...abc
```

---

### 2. Configure Email Template
**Location:** Supabase Dashboard → Authentication → Email Templates

**Select:** Reset Password

**Default Template:**
```html
<h2>Reset Password</h2>
<p>Follow this link to reset the password for your user:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
```

**Recommended Update:**
```html
<h2>Reset Your Password</h2>
<p>Hello,</p>
<p>Someone requested a password reset for your account.</p>
<p>Click the button below to choose a new password:</p>
<p><a href="{{ .ConfirmationURL }}" style="background-color: #2E3A59; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a></p>
<p style="color: #666; font-size: 14px; margin-top: 20px;">
  If you didn't request this, you can safely ignore this email.
  This link expires in 1 hour.
</p>
```

**Important Variables:**
- `{{ .ConfirmationURL }}` - Auto-generated magic link
- `{{ .SiteURL }}` - Your site URL
- `{{ .Token }}` - Reset token (included in ConfirmationURL)

---

### 3. Configure Redirect URLs
**Location:** Supabase Dashboard → Authentication → URL Configuration

**Add these URLs:**

For **Local Development:**
```
http://localhost:3000/update-password
```

For **Production:**
```
https://yourdomain.com/update-password
https://www.yourdomain.com/update-password
```

For **Staging:**
```
https://staging.yourdomain.com/update-password
```

**Screenshot Location:**
```
┌─────────────────────────────────────────┐
│ URL Configuration                       │
├─────────────────────────────────────────┤
│                                         │
│ Site URL                                │
│ [https://yourdomain.com]                │
│                                         │
│ Redirect URLs                           │
│ [http://localhost:3000/*]       [Add]   │
│ [https://yourdomain.com/*]      [Add]   │◄─── ADD THESE
│                                         │
│ ✓ Wildcard (*) allows any path         │
│                                         │
└─────────────────────────────────────────┘
```

---

### 4. Configure SMTP Settings (Optional but Recommended)
**Location:** Supabase Dashboard → Settings → SMTP Settings

**Default:** Uses Supabase email service (limited to 3 emails/hour per user)

**For Production:** Configure your own SMTP

**Recommended Services:**
- SendGrid (Free tier: 100 emails/day)
- AWS SES (Very cheap)
- Postmark (Developer friendly)
- Mailgun (Good reliability)

**SMTP Configuration Example:**
```
Host: smtp.sendgrid.net
Port: 587
Username: apikey
Password: [your_sendgrid_api_key]
Sender Name: Your App Name
Sender Email: noreply@yourdomain.com
```

---

### 5. Security Settings
**Location:** Supabase Dashboard → Authentication → Settings

**Recommended Settings:**

```
┌─────────────────────────────────────────┐
│ Security and User Management            │
├─────────────────────────────────────────┤
│                                         │
│ Enable email confirmations              │
│ ☑ Require email confirmation           │
│                                         │
│ Password Minimum Length                 │
│ [6] characters                          │
│                                         │
│ Magic Link Expiry                       │
│ [3600] seconds (1 hour)                 │
│                                         │
│ Email Rate Limits                       │
│ ☑ Enable rate limiting                 │
│   [3] emails per hour per user          │
│                                         │
└─────────────────────────────────────────┘
```

---

## 📋 Verification Checklist

### Backend Configuration
- [ ] `SUPABASE_URL` set in `backend/.env`
- [ ] `SUPABASE_ANON_KEY` set in `backend/.env`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set in `backend/.env` ⚠️
- [ ] Backend server restarted after adding keys

### Frontend Configuration
- [ ] `NEXT_PUBLIC_SUPABASE_URL` set in `frontend/.env.local`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` set in `frontend/.env.local`
- [ ] Frontend rebuilt/restarted after adding keys

### Supabase Dashboard
- [ ] Service Role Key copied to backend
- [ ] Email template customized
- [ ] Redirect URLs added for all environments
- [ ] SMTP configured (for production)
- [ ] Rate limiting enabled
- [ ] Password minimum length set

### Testing
- [ ] User can request password reset
- [ ] Email is received with reset link
- [ ] Reset link redirects to correct page
- [ ] Password can be updated successfully
- [ ] User can login with new password
- [ ] Admin can reset any user password
- [ ] Admin reset works without email

---

## 🚨 Common Issues

### "Email not sent"
✅ **Check:** SMTP settings in Supabase  
✅ **Check:** Email rate limits (3/hour default)  
✅ **Check:** Spam folder  
✅ **Check:** Email template configuration  

### "Invalid redirect URL"
✅ **Check:** URL is added to Redirect URLs list  
✅ **Check:** Protocol matches (http vs https)  
✅ **Check:** No trailing slash in configuration  

### "Supabase configuration missing"
✅ **Check:** `SUPABASE_SERVICE_ROLE_KEY` is in `backend/.env`  
✅ **Check:** Backend server restarted  
✅ **Check:** Key is service_role not anon key  

### "Admin reset fails"
✅ **Check:** Admin email is in `ALLOWED_ADMIN_EMAILS`  
✅ **Check:** Service Role Key has correct permissions  
✅ **Check:** User ID is valid UUID  

---

## 🔗 Quick Links

**Supabase Dashboard Sections:**
- API Keys: `https://app.supabase.com/project/[your-project]/settings/api`
- Email Templates: `https://app.supabase.com/project/[your-project]/auth/templates`
- URL Config: `https://app.supabase.com/project/[your-project]/auth/url-configuration`
- SMTP Settings: `https://app.supabase.com/project/[your-project]/settings/smtp`
- Auth Settings: `https://app.supabase.com/project/[your-project]/auth/settings`

**Documentation:**
- [PASSWORD_RESET_GUIDE.md](./PASSWORD_RESET_GUIDE.md) - Complete guide
- [PASSWORD_RESET_SUMMARY.md](./PASSWORD_RESET_SUMMARY.md) - Quick reference
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)

---

**Last Updated:** December 2025  
**Version:** 1.0








