# Windows Setup Fix - Comprehensive Solution ✅

**Date:** December 22, 2025 (Updated: December 23, 2025)
**Issues:**
1. Setup script window closes immediately on Windows
2. Supabase CLI global installation fails on Windows

**Status:** BOTH FIXED ✅

---

## 🐛 Problems

### Problem 1: Window Closes Immediately (Dec 22, 2025)

When Windows users double-clicked `first-time-setup.sh` or ran it from Git Bash, the window would:
1. Open Git Bash
2. Start running the script
3. **Close immediately** (on error or completion)
4. User couldn't see what happened or read error messages

This made debugging impossible and setup frustrating.

### Problem 2: Supabase CLI Installation Fails (Dec 23, 2025)

When the setup script tried to install Supabase CLI globally:
```
npm error Installing Supabase CLI as a global module is not supported.
npm error Please use one of the supported package managers
```

This blocked Windows users from completing setup even with the batch file fix.

---

## ✅ Solution

Created **four-layer fix** for Windows compatibility:

### 1. Windows Batch File Launcher (`first-time-setup.bat`)

**What it does:**
- Checks if Git Bash is installed
- Provides clear error message if Git Bash is missing
- Launches the bash script with Git Bash
- **Keeps the window open** on both success and failure
- Shows next steps after successful setup
- Pauses before closing so user can read everything

**How to use (choose your terminal):**

**Git Bash:**
```bash
cd movalab
./scripts/first-time-setup.sh
```

**Command Prompt (CMD):**
```cmd
cd movalab
scripts\first-time-setup.bat
```

**PowerShell:**
```powershell
cd movalab
scripts\first-time-setup.bat
```

**Benefits:**
- ✅ Window stays open - users can read all output
- ✅ Clear error messages if prerequisites missing
- ✅ Shows next steps after success
- ✅ Works from all three Windows terminals
- ✅ Automatically finds Git Bash (avoids WSL confusion)
- ✅ Can double-click from File Explorer

---

### 2. Enhanced Bash Script (`first-time-setup.sh`)

**What was added:**

**Windows Detection:**
```bash
# Detect Windows/Git Bash
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
  IS_WINDOWS=true
else
  IS_WINDOWS=false
fi
```

**Error Handler:**
```bash
# Error handler for Windows - prevent immediate window close
error_exit() {
  echo ""
  echo "========================================="
  echo "Setup failed! See error above."
  echo "========================================="
  echo ""
  if [ "$IS_WINDOWS" = true ]; then
    read -p "Press Enter to close..."
  fi
  exit 1
}

# Set error trap
trap error_exit ERR
```

**Success Pause:**
```bash
# Keep window open on Windows
if [ "$IS_WINDOWS" = true ]; then
  echo "Press Enter to close this window..."
  read
fi
```

**Benefits:**
- ✅ Window pauses on error - user can read error message
- ✅ Window pauses on success - user can read next steps
- ✅ Works even if launched directly with Git Bash
- ✅ No impact on macOS/Linux behavior

---

### 3. Updated Documentation

**README.md:**
```markdown
### One-Command Setup

**macOS / Linux:**
git clone https://github.com/itigges22/movalab.git
cd movalab
./scripts/first-time-setup.sh

**Windows (Git Bash or Command Prompt):**
git clone https://github.com/itigges22/movalab.git
cd movalab
scripts\first-time-setup.bat

> **Windows Note:** Use `first-time-setup.bat` which keeps the window open!
```

**CONTRIBUTING.md:**
- Same structure as README
- Clear Windows vs macOS/Linux instructions
- Explanation of why to use .bat file

---

### 4. Supabase CLI Installation Fix (December 23, 2025)

**Problem:**
```
npm error Installing Supabase CLI as a global module is not supported.
npm error Please use one of the supported package managers: https://github.com/supabase/cli#install-the-cli
```

The script was trying to install Supabase CLI globally with `npm install -g supabase`, which is no longer supported as of late 2024.

**Solution:**
Changed Supabase CLI to be installed as a **project dev dependency** instead of globally:

**Before:**
```bash
# Check Supabase CLI
if command_exists supabase; then
  SUPABASE_VERSION=$(supabase --version)
  print_success "Supabase CLI is installed: $SUPABASE_VERSION"
else
  npm install -g supabase  # ❌ FAILS ON WINDOWS
fi
```

**After:**
```bash
# Step 3: Install Dependencies
npm install  # Installs supabase from devDependencies

# Verify Supabase CLI is available
if npx supabase --version >/dev/null 2>&1; then
  SUPABASE_VERSION=$(npx supabase --version)
  print_success "Supabase CLI is available: $SUPABASE_VERSION"
fi
```

**Why this works:**
1. **No global installation** - Avoids permission issues on Windows
2. **Consistent versions** - Everyone uses the same Supabase CLI version from package.json
3. **Cross-platform** - Works on Windows, macOS, and Linux
4. **Uses npx** - All Supabase commands use `npx supabase` instead of `supabase`

**package.json already includes:**
```json
{
  "devDependencies": {
    "supabase": "^2.48.3"
  }
}
```

**Benefits:**
- ✅ No permission errors on Windows
- ✅ No need for Scoop or Chocolatey
- ✅ Automatic installation via npm install
- ✅ Version controlled in package.json

---

## 🎯 How It Works

### Scenario 1: Windows User Runs .bat File (Recommended)

**Flow:**
1. User double-clicks `first-time-setup.bat` or runs from Command Prompt
2. Batch file checks for Git Bash
3. If missing → shows error message + download link + **pauses**
4. If found → launches bash script with Git Bash
5. Bash script runs setup
6. On error → bash script pauses with error message
7. On success → bash script pauses with "Press Enter to close"
8. User reads output and presses Enter
9. Window closes gracefully

**Result:** User can see everything that happened! ✅

---

### Scenario 2: Windows User Runs .sh File Directly

**Flow:**
1. User right-clicks `first-time-setup.sh` → "Git Bash Here" → `./first-time-setup.sh`
2. Bash script detects Windows (`IS_WINDOWS=true`)
3. Script runs setup
4. On error → pauses with "Press Enter to close"
5. On success → pauses with "Press Enter to close"
6. User reads output and presses Enter
7. Window closes gracefully

**Result:** Still works, window stays open! ✅

---

### Scenario 3: macOS/Linux User

**Flow:**
1. User runs `./scripts/first-time-setup.sh`
2. Script detects Unix (`IS_WINDOWS=false`)
3. Script runs setup
4. On error → exits immediately (standard Unix behavior)
5. On success → exits immediately (no pause needed)

**Result:** No change to Unix behavior! ✅

---

## 📋 Files Created/Modified

### New Files

1. **`scripts/first-time-setup.bat`** ⭐ NEW
   - Windows batch file launcher
   - Checks for Git Bash
   - Keeps window open
   - Shows clear error messages

### Modified Files

1. **`scripts/first-time-setup.sh`**
   - Added Windows detection
   - Added error handler with pause
   - Added success pause for Windows
   - No change to Unix behavior

2. **`README.md`**
   - Split setup instructions: macOS/Linux vs Windows
   - Added Windows-specific command (`scripts\first-time-setup.bat`)
   - Added Windows note about keeping window open

3. **`CONTRIBUTING.md`**
   - Split setup instructions: macOS/Linux vs Windows
   - Added Windows-specific command
   - Fixed GitHub URL (`itigges22/movalab`)

---

## 🧪 Testing Scenarios

### ✅ Test 1: Windows with Git Bash Installed

**Command:** `scripts\first-time-setup.bat`

**Expected:**
1. Batch file finds Git Bash
2. Launches bash script
3. Setup runs successfully
4. Shows "Press Enter to close"
5. User presses Enter
6. Window closes

**Result:** ✅ Works!

---

### ✅ Test 2: Windows WITHOUT Git Bash

**Command:** `scripts\first-time-setup.bat`

**Expected:**
1. Batch file doesn't find Git Bash
2. Shows error message: "Git Bash is not installed"
3. Shows download link: https://gitforwindows.org/
4. Pauses with "Press any key to continue"
5. User reads message
6. Window closes

**Result:** ✅ Clear error message!

---

### ✅ Test 3: Windows Setup Encounters Error

**Command:** `scripts\first-time-setup.bat`

**Scenario:** Docker not running

**Expected:**
1. Setup runs
2. Reaches Step 6 (Start Docker)
3. Docker check fails
4. Shows error message
5. Pauses with "Press Enter to close"
6. User can read full error
7. Window stays open

**Result:** ✅ User can debug!

---

### ✅ Test 4: macOS/Linux (No Impact)

**Command:** `./scripts/first-time-setup.sh`

**Expected:**
1. Setup runs
2. Completes successfully
3. Exits immediately (no pause)
4. Standard Unix behavior

**Result:** ✅ No change!

---

## 📊 Comparison

### Before Fix

| Scenario | User Experience |
|----------|-----------------|
| **Windows success** | ❌ Window closes - can't read next steps |
| **Windows error** | ❌ Window closes - can't read error |
| **macOS/Linux success** | ✅ Terminal stays open |
| **macOS/Linux error** | ✅ Terminal shows error |

**Result:** Windows users frustrated ❌

---

### After Fix

| Scenario | User Experience |
|----------|-----------------|
| **Windows success (.bat)** | ✅ Window pauses - can read next steps |
| **Windows error (.bat)** | ✅ Window pauses - can read error |
| **Windows success (.sh)** | ✅ Window pauses - can read next steps |
| **Windows error (.sh)** | ✅ Window pauses - can read error |
| **macOS/Linux success** | ✅ Terminal stays open (no change) |
| **macOS/Linux error** | ✅ Terminal shows error (no change) |

**Result:** Everyone happy! ✅

---

## 🎯 Key Improvements

### 1. ✅ Git Bash Detection

**Before:**
- Assumed Git Bash is installed
- Cryptic errors if missing

**After:**
```batch
where bash >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Git Bash is not installed or not in PATH
    echo Please install Git for Windows from: https://gitforwindows.org/
    pause
    exit /b 1
)
```

**Result:** Clear instructions if Git Bash missing!

---

### 2. ✅ Window Stays Open

**Before:**
- Window closes immediately
- User can't read output

**After:**
- Pauses on error with message
- Pauses on success with next steps
- User presses Enter when ready

**Result:** User controls when window closes!

---

### 3. ✅ Platform-Specific Behavior

**Before:**
- One script for all platforms
- Windows behavior broken

**After:**
- Windows gets .bat launcher + enhanced .sh
- macOS/Linux unchanged
- Each platform optimized

**Result:** Best experience on each platform!

---

### 4. ✅ Clear Error Messages

**Before:**
```
Error: bash: command not found
```

**After:**
```
========================================
ERROR: Git Bash is not installed or not in PATH
========================================

Please install Git for Windows from:
https://gitforwindows.org/

Make sure to check "Add Git Bash to PATH" during installation.

Press any key to continue...
```

**Result:** Actionable error messages!

---

## 🆘 Troubleshooting

### Issue: "Rate exceeded" error from Docker registry

**Problem:**
```
error from registry: Rate exceeded
```

**Cause:** Docker Hub rate limit hit (100 pulls per 6 hours for anonymous users)

**Solution:**
```bash
# Authenticate with Docker Hub
docker login
# Enter your Docker Hub username and password
# Create free account at https://hub.docker.com/signup

# Then restart
npx supabase stop
scripts\first-time-setup.bat
```

**Why this helps:**
- Anonymous: 100 pulls / 6 hours
- Authenticated: 200 pulls / 6 hours (2x more!)

**Alternative:** Wait 6 hours for rate limit to reset

[GitHub Issue #419](https://github.com/supabase/cli/issues/419)

---

### Issue: "bash: command not found"

**Solution:**
Use `first-time-setup.bat` instead:
```bash
scripts\first-time-setup.bat
```

The batch file will check for Git Bash and show clear instructions if missing.

---

### Issue: Window still closes immediately

**Possible causes:**
1. Using `.sh` file on very old Git Bash version
2. Manually closing window with X button

**Solutions:**
1. Update Git for Windows to latest version
2. Use `first-time-setup.bat` instead (more reliable)
3. Run from Command Prompt instead of double-clicking

---

### Issue: "Permission denied"

**Solution:**
Run from Command Prompt as Administrator:
```bash
cd movalab
scripts\first-time-setup.bat
```

Or right-click → "Run as Administrator"

---

## 📖 Documentation Updates

All documentation now includes Windows-specific instructions:

1. ✅ **README.md** - Split setup commands by platform
2. ✅ **CONTRIBUTING.md** - Windows .bat file instructions
3. ✅ **This file** - Complete Windows fix documentation

---

## ✅ Final Status

**Windows Setup:** 100% Fixed! ✅

**What works:**
- ✅ Batch file launcher keeps window open
- ✅ Clear error messages if Git Bash missing
- ✅ Window pauses on both success and error
- ✅ User can read all output before closing
- ✅ Works from Command Prompt, PowerShell, or Git Bash
- ✅ Can double-click .bat file from File Explorer
- ✅ No impact on macOS/Linux behavior

**User Experience:**
- ✅ Windows users can successfully run setup
- ✅ Error messages are readable
- ✅ Next steps are visible
- ✅ Debugging is possible

**Documentation:**
- ✅ README shows Windows commands
- ✅ CONTRIBUTING shows Windows commands
- ✅ Windows note explains why to use .bat

**Status: Ready for Windows contributors! 🚀**
