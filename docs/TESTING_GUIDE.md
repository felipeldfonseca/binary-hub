# Binary Hub Authentication Testing Guide

## 🚀 Quick Start Testing

### 1. Start Development Environment
```bash
npm run dev
```
- Frontend: http://localhost:3001
- Firebase Emulator UI: http://localhost:4445

### 2. Test Email/Password Authentication

#### Sign Up Test:
1. Navigate to: http://localhost:3001/auth/register
2. Click "Sign up with email"
3. Fill the modal form:
   - **Name**: Your Test Name
   - **Email**: test@example.com
   - **Password**: password123
   - **Confirm Password**: password123
4. Submit and verify redirect to dashboard

#### Sign In Test:
1. Navigate to: http://localhost:3001/auth/login
2. Click "Sign in with email"
3. Use same credentials from sign up
4. Verify successful login

### 3. Test Route Protection

#### Protected Routes:
- Try accessing http://localhost:3001/dashboard directly
- Should redirect to login if not authenticated
- Should show dashboard if authenticated

#### Public Routes:
- Try accessing auth pages while logged in
- Should redirect to dashboard

### 4. Test Form Validation

#### Email/Password Form:
- Try submitting empty fields
- Try invalid email format
- Try password less than 6 characters
- Try mismatched passwords (sign up)
- Verify error messages display correctly

## 🔧 Google OAuth Testing

### Setup Required:
1. **Firebase Console Setup:**
   - Go to Firebase Console → Authentication → Sign-in method
   - Enable Google provider
   - Add your domain to authorized domains

2. **Local Testing:**
   ```bash
   # In development, Google OAuth works with localhost
   # No additional setup needed for basic testing
   ```

### Test Google Authentication:
1. Navigate to auth pages
2. Click "Sign up with Google" or "Sign in with Google"
3. Use your Google account credentials
4. Verify profile creation and dashboard access

## 🍎 Apple OAuth Testing

### Setup Required:
1. **Firebase Console:**
   - Enable Apple provider
   - Configure Apple Developer settings

2. **Apple ID Testing:**
   - Use your Apple ID credentials
   - Test on both web and mobile Safari for best results

### Test Apple Authentication:
1. Navigate to auth pages
2. Click "Sign up with Apple" or "Sign in with Apple"
3. Use your Apple ID credentials
4. Verify authentication flow

## 🧪 Advanced Testing Scenarios

### 1. Session Persistence
- Log in and refresh the page
- Close browser and reopen
- Verify you stay logged in

### 2. Error Handling
- Try logging in with wrong credentials
- Test network disconnection scenarios
- Verify error messages are user-friendly

### 3. Loading States
- Test on slow connections
- Verify loading spinners appear
- Check loading screen during auth checks

### 4. Cross-Authentication Testing
- Sign up with email, then try Google with same email
- Test account linking scenarios
- Verify user profile consistency

## 📱 Mobile Testing

### Responsive Design:
- Test on mobile devices (iPhone/Android)
- Verify modals work correctly on small screens
- Test touch interactions

### Mobile OAuth:
- Apple OAuth works best on iOS Safari
- Google OAuth should work on all mobile browsers

## 🔍 Firebase Emulator Testing

### Emulator UI Access:
- URL: http://localhost:4445
- View created users in Authentication tab
- Check Firestore for user profiles

### Emulator Benefits:
- No real Firebase quota usage
- Faster development iteration
- Complete offline testing

## 🚨 Common Issues & Solutions

### Port Conflicts:
```bash
# If emulators fail to start
lsof -ti:4445 | xargs kill -9  # Kill UI process
lsof -ti:9088 | xargs kill -9  # Kill Auth emulator
npm run dev  # Restart
```

### OAuth Issues:
- Ensure Firebase project is configured
- Check authorized domains in Firebase Console
- Verify OAuth provider settings

### Form Validation:
- Check browser console for validation errors
- Verify error states display correctly
- Test edge cases (special characters, etc.)

## ✅ Testing Checklist

### Email/Password:
- [ ] Sign up with valid credentials
- [ ] Sign in with valid credentials
- [ ] Form validation works
- [ ] Error messages display
- [ ] Loading states work
- [ ] Dashboard redirect works

### Google OAuth:
- [ ] Sign up with Google works
- [ ] Sign in with Google works
- [ ] Profile creation in Firestore
- [ ] Dashboard redirect works

### Apple OAuth:
- [ ] Sign up with Apple works
- [ ] Sign in with Apple works
- [ ] Profile creation in Firestore
- [ ] Dashboard redirect works

### Route Protection:
- [ ] Dashboard requires authentication
- [ ] Auth pages redirect when logged in
- [ ] Loading states during auth checks
- [ ] Proper error handling

### User Experience:
- [ ] Smooth modal interactions
- [ ] Responsive design works
- [ ] Loading states are clear
- [ ] Error messages are helpful
- [ ] Navigation flows correctly

## 🎯 Production Testing Notes

Before deploying to production:
1. Test with real Firebase project (not emulator)
2. Verify OAuth providers are configured
3. Test on multiple devices and browsers
4. Validate security rules
5. Test error scenarios thoroughly

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Verify Firebase emulator is running
3. Check network connectivity
4. Review Firebase Console settings
5. Test with different browsers/devices 