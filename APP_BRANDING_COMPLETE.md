# App Branding Setup - Complete ✅

## Overview

A complete app branding system has been implemented, allowing you to customize your platform's logo, name, and other branding elements through an admin interface.

---

## ✅ What's Been Set Up

### 1. **Database**
- ✅ `app_config` table for storing platform configuration
- ✅ Default values (app_name, app_logo_url, app_cover_url, app_favicon_url)
- ✅ RLS policies for public read and authenticated update

### 2. **Storage**
- ✅ Storage bucket: `app-images` (or fallback to `avatars`)
- ✅ Public bucket configuration
- ✅ RLS policies for upload/read/update/delete
- ✅ Supports PNG, JPG, WEBP, SVG up to 10MB

### 3. **Backend API**
- ✅ `GET /config` - Get all app configuration (public)
- ✅ `GET /config/{key}` - Get specific config value
- ✅ `PUT /config/{key}` - Update config value (authenticated)
- ✅ Graceful fallback when table doesn't exist

### 4. **Frontend Components**
- ✅ Dynamic logo display in navigation (NewLayoutWrapper)
- ✅ Dynamic logo on landing page
- ✅ Admin page for uploading/managing app images
- ✅ Automatic refresh on config changes

---

## 📍 Where Your Logo Appears

### Current Implementation:

1. **Main App Navigation** (`/app`, `/profile`, `/my-agents`, etc.)
   - Top-left corner in the navigation bar
   - Replaces the default "A" icon and "AVEE" text
   - Max width: 200px, Height: 40px (auto-scaled)

2. **Landing Page** (`http://localhost:3000/`)
   - Header (top-left)
   - Footer (bottom-left)
   - Uses app name in copyright text

---

## 🎨 How to Upload Your Logo

### Method 1: Admin Interface (Recommended)

1. **Navigate to App Settings:**
   ```
   Backoffice → Click "App Settings" button (top-right)
   Or go directly to: /backoffice/app-settings
   ```

2. **Upload Logo:**
   - Drag and drop your PNG logo onto the upload area
   - Or click to browse and select your file
   - Wait for "uploaded successfully!" message

3. **Verify:**
   - Hard refresh your browser (Cmd+Shift+R or Ctrl+Shift+R)
   - Logo should appear in navigation immediately

### Method 2: Direct Database Update

If you have the Supabase URL of your uploaded image:

```sql
UPDATE app_config 
SET config_value = 'https://your-supabase-url/storage/v1/object/public/avatars/app-logo/your-logo.png'
WHERE config_key = 'app_logo_url';
```

---

## 🔧 Technical Details

### File Structure

```
backend/
├── migrations/
│   └── 009_app_images_bucket.sql    # Database setup
├── models.py                         # AppConfig model
└── main.py                          # API endpoints

frontend/
├── src/
│   ├── lib/
│   │   ├── config.ts                # API helper functions
│   │   └── upload.ts                # Image upload helper
│   ├── components/
│   │   └── NewLayoutWrapper.tsx     # Navigation with logo
│   ├── app/
│   │   ├── page.tsx                 # Landing page with logo
│   │   └── (app)/
│   │       └── backoffice/
│   │           └── app-settings/
│   │               └── page.tsx     # Admin upload interface
```

### API Endpoints

#### Public Endpoints (No Auth Required)

**Get all configuration:**
```bash
GET http://localhost:8000/config

Response:
{
  "app_name": "Gabee",
  "app_logo_url": "https://...",
  "app_cover_url": "",
  "app_favicon_url": ""
}
```

**Get specific config:**
```bash
GET http://localhost:8000/config/app_logo_url

Response:
{
  "key": "app_logo_url",
  "value": "https://...",
  "description": "Main platform logo URL"
}
```

#### Protected Endpoints (Auth Required)

**Update configuration:**
```bash
PUT http://localhost:8000/config/app_logo_url
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "config_value": "https://your-new-logo-url.png"
}
```

---

## 🎯 Recommended Logo Specifications

### App Logo (Main Navigation)
- **Format**: PNG with transparent background (recommended)
- **Dimensions**: 200x50px or similar horizontal aspect ratio
- **File size**: Under 500KB
- **Best for**: Wordmark or horizontal logo

### Cover Image (Future Use)
- **Format**: JPG or PNG
- **Dimensions**: 1920x600px
- **File size**: Under 2MB
- **Best for**: Hero sections, banners

### Favicon (Future Use)
- **Format**: PNG or ICO
- **Dimensions**: 32x32px or 64x64px (square)
- **File size**: Under 100KB
- **Best for**: Browser tab icon

---

## 🛠️ Storage Configuration

### Current Setup

- **Primary bucket**: `app-images` (if RLS policies are set up)
- **Fallback bucket**: `avatars` (currently in use)
- **Upload path**: `avatars/app-logo/timestamp.png`

### Bucket Permissions

```sql
-- Public read for everyone
CREATE POLICY "Allow public to read app images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'app-images');

-- Authenticated users can upload
CREATE POLICY "Allow authenticated admins to upload app images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'app-images');
```

---

## 📊 Database Schema

### `app_config` Table

```sql
CREATE TABLE app_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT,
    description TEXT,
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Default Values

| config_key       | config_value | description                    |
|------------------|--------------|--------------------------------|
| app_name         | "Gabee"      | Platform name                  |
| app_logo_url     | ""           | Main platform logo URL         |
| app_cover_url    | ""           | Platform cover/hero image URL  |
| app_favicon_url  | ""           | Platform favicon URL           |

---

## 🔍 Troubleshooting

### Logo Not Displaying

**1. Check if URL is saved:**
```bash
curl http://localhost:8000/config | jq .app_logo_url
```

**2. Hard refresh browser:**
- Windows/Linux: `Ctrl+Shift+R`
- Mac: `Cmd+Shift+R`

**3. Check browser console:**
- Open DevTools (F12)
- Look for `[AppConfig] Loaded:` message
- Check for image loading errors

**4. Verify bucket is public:**
- Go to Supabase Dashboard → Storage
- Click on bucket → Settings
- Ensure "Public bucket" is checked ✅

### Upload Fails

**Error: "Bucket not found"**
- Run the migration SQL in Supabase SQL Editor
- Or manually create the bucket via Supabase UI

**Error: "new row violates row-level security policy"**
- Check RLS policies are set up correctly
- Ensure you're logged in (check auth token)

**Error: "Failed to load logo"**
- Image URL might be incorrect
- Bucket might not be public
- Check browser console for CORS errors

---

## 🚀 Future Enhancements

### Potential Features

1. **Cover Images**
   - Landing page hero backgrounds
   - Profile banners

2. **Favicon**
   - Browser tab icon
   - PWA icon

3. **Color Scheme**
   - Primary brand color
   - Accent colors
   - Dark mode colors

4. **Social Metadata**
   - og:image for social sharing
   - Twitter card images
   - Meta descriptions

5. **Multi-Logo Support**
   - Light mode logo
   - Dark mode logo
   - Mobile logo (compact version)

---

## 📝 Testing Checklist

- [x] Upload logo via admin interface
- [x] Logo displays in main navigation
- [x] Logo displays on landing page
- [x] Logo displays in footer
- [x] Logo scales properly on mobile
- [x] Fallback works when no logo is set
- [x] Error handling for broken images
- [x] Hard refresh shows updated logo
- [ ] Test with different image formats (PNG, SVG, JPG)
- [ ] Test with very large images (>5MB)
- [ ] Test with transparent backgrounds

---

## 🎉 Result

Your platform now has:
- ✅ Dynamic logo system
- ✅ Easy-to-use admin interface
- ✅ Automatic updates across all pages
- ✅ Graceful fallbacks
- ✅ Proper error handling
- ✅ Public API for configuration
- ✅ Scalable architecture for future branding needs

The logo system is production-ready and can be extended to support additional branding elements as needed!


