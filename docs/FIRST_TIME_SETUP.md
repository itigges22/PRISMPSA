# First-Time Setup Guide

This guide explains how to set up the first superadmin account for a fresh MovaLab deployment. This is required for cloud deployments (Vercel, etc.) where no seed data exists.

---

## Overview

When deploying MovaLab to a new environment, you'll encounter a chicken-and-egg problem: you need a superadmin to assign roles, but there's no way to create a superadmin without one already existing.

MovaLab solves this with a **secure one-time setup mechanism** that:
- Only works when zero superadmins exist in the database
- Requires a secret key stored in environment variables
- Automatically disables after the first superadmin is created

---

## Prerequisites

Before starting, ensure you have:
- A Supabase project with the MovaLab schema deployed
- Access to your Supabase SQL Editor
- Access to your deployment's environment variables (Vercel, etc.)

---

## Setup Steps

### Step 1: Run the Base Schema SQL Script

The base schema script creates essential roles and departments needed for the application to function.

1. Open your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/setup-base-schema.sql`
4. Paste and run the script

**What this creates:**
- 5 core departments (Leadership, Marketing, Design, Development, Operations)
- 15 predefined roles with appropriate permissions
- System roles (Superadmin, Client, No Assigned Role)

> **Note:** The script uses `ON CONFLICT DO NOTHING`, so it's safe to run multiple times.

### Step 2: Configure the Setup Secret

Generate a secure random string for your setup secret:

```bash
# Using OpenSSL (recommended)
openssl rand -hex 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add this to your environment variables:

**For Vercel:**
1. Go to your project settings
2. Navigate to Environment Variables
3. Add: `SETUP_SECRET` = `your-generated-secret`

**For local `.env.local`:**
```env
SETUP_SECRET=your-generated-secret
```

### Step 3: Create Your Account

1. Navigate to your MovaLab deployment
2. Click **Sign Up** and create an account with your email
3. Verify your email if required

### Step 4: Become Superadmin

1. Navigate to `/setup?key=YOUR_SETUP_SECRET`
   - Replace `YOUR_SETUP_SECRET` with your actual secret
   - Example: `https://your-app.vercel.app/setup?key=abc123...`

2. You'll see a setup form confirming:
   - SQL schema is ready
   - SETUP_SECRET is configured
   - You're logged in

3. Enter your setup secret and click **"Become Superadmin"**

4. You'll be redirected to the Admin panel as a superadmin

---

## Security Features

### One-Time Use
The setup mechanism automatically disables after the first superadmin is created. Any subsequent visits to `/setup` will show "Setup Complete" with no option to create another superadmin via this method.

### Secret Verification
The setup secret must match exactly what's stored in the environment variable. This prevents unauthorized users from becoming superadmin even if they discover the `/setup` route.

### Authentication Required
Users must sign up and be logged in before they can use the setup mechanism. This ensures the superadmin account is tied to a verified email address.

---

## Troubleshooting

### "Configuration Required" Error
**Cause:** The `SETUP_SECRET` environment variable is not set.

**Solution:**
1. Add `SETUP_SECRET` to your environment variables
2. Redeploy your application (for Vercel) or restart the dev server

### "Setup Complete" Message
**Cause:** A superadmin already exists in the database.

**Solution:** This is expected behavior. The setup mechanism is one-time use. If you need to:
- Add more superadmins: Have the existing superadmin assign the role via Admin > Role Management
- Reset everything: Clear the database and start fresh (development only)

### "Create Your Account First" Message
**Cause:** You're not logged in.

**Solution:**
1. Click the link to sign up or log in
2. Return to the setup page after authentication
3. The URL will preserve your setup key

### Invalid Setup Secret Error
**Cause:** The secret you entered doesn't match the environment variable.

**Solution:**
1. Double-check the `SETUP_SECRET` value in your environment
2. Ensure no extra spaces or characters
3. Try copying the full secret again

---

## After Setup

Once you're a superadmin, you can:

1. **Assign Roles to Users**
   - Go to Admin > Role Management
   - Find users and assign appropriate roles

2. **Create Accounts**
   - Go to Admin > Accounts
   - Create client accounts and assign account managers

3. **Manage Departments**
   - Go to Admin > Departments
   - Customize department structure if needed

4. **Configure Workflows**
   - Go to Admin > Workflows
   - Create workflow templates for your processes

---

## Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `SETUP_SECRET` | Yes* | Secret key for first-time superadmin setup |

*Required only for initial setup. Can be removed after setup is complete for added security.

---

## Related Documentation

- [Demo Mode Guide](./DEMO_MODE.md) - Local development with pre-loaded data
- [Docker Setup](./docker-setup.md) - Local development environment
- [Security Guide](./security/SECURITY.md) - Security architecture overview
