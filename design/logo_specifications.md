# Binary Hub Logo Specifications

**Reference Design**: Dashboard (Post-Login) Navigation  
**Status**: FINAL - DO NOT MODIFY  
**Version**: 1.0  
**Date**: January 2025  

---

## 🎯 Overview

This document defines the **exact specifications** for the Binary Hub logo as it appears in the dashboard navigation. This is the **reference design** that must be replicated across all pages and components.

**⚠️ IMPORTANT**: The dashboard logo should **NEVER** be modified. All other implementations must match these specifications exactly.

---

## 📐 Technical Specifications

### **HTML Structure**
```tsx
<Link href={user ? "/dashboard" : "/"} className="flex items-center">
  <div className="flex items-center space-x-1">
    <div className="logo-poly font-normal text-primary">
      binary
    </div>
    <div className="bg-primary text-dark-background px-2 py-0.5 rounded-15px font-poly text-dark-background font-normal" style={{fontSize: '23px'}}>
      hub
    </div>
  </div>
</Link>
```

### **CSS Classes**
- **"binary" text**: `logo-poly font-normal text-primary`
- **"hub" container**: `bg-primary text-dark-background px-2 py-0.5 rounded-15px font-poly text-dark-background font-normal`
- **"hub" text size**: `fontSize: '23px'` (inline style)

### **Typography**
- **Font Family**: `Poly` (serif)
- **"binary"**: 
  - Font size: Inherited from `.logo-poly` (25px)
  - Font weight: `font-normal` (400)
  - Color: `text-primary` (#E1FFD9)
- **"hub"**: 
  - Font size: `23px` (inline style)
  - Font weight: `font-normal` (400)
  - Color: `text-dark-background` (#505050)

### **Layout**
- **Container**: `flex items-center space-x-1`
- **Spacing**: `space-x-1` (0.25rem gap between elements)
- **Alignment**: `items-center` (vertical centering)

### **"hub" Background**
- **Background**: `bg-primary` (#E1FFD9)
- **Padding**: `px-2 py-0.5` (0.5rem horizontal, 0.125rem vertical)
- **Border Radius**: `rounded-15px` (15px border radius)
- **Text Color**: `text-dark-background` (#505050)

---

## 🎨 Visual Properties

### **Colors**
- **Primary Green**: `#E1FFD9` (used for "binary" text and "hub" background)
- **Dark Background**: `#505050` (used for "hub" text)

### **Dimensions**
- **"binary" text**: ~25px height (from CSS)
- **"hub" text**: 23px height (inline style)
- **"hub" background**: Auto-sized with padding
- **Total logo width**: ~120px (approximate)

### **Effects**
- **Text Shadow**: Applied via `.logo-poly` CSS class
- **Hover Effects**: Inherited from Link component
- **Transitions**: Inherited from Link component

---

## 📱 Responsive Behavior

### **Desktop (xl and above)**
- Full logo display
- All specifications as defined above

### **Mobile (below xl)**
- Same logo specifications
- May be hidden in mobile menu context
- Maintains exact same styling

---

## 🔧 Implementation Rules

### **DO ✅**
- Use exact HTML structure provided
- Apply all CSS classes as specified
- Use inline `fontSize: '23px'` for "hub" text
- Maintain `space-x-1` spacing
- Use `items-center` alignment

### **DON'T ❌**
- Modify the dashboard logo
- Change font sizes or weights
- Adjust spacing or padding
- Use different colors
- Remove or modify CSS classes
- Change the HTML structure

---

## 📍 Usage Locations

### **Current Implementations**
1. **✅ Dashboard Navigation** - Reference design (DO NOT MODIFY)
2. **⚠️ Pre-login Navigation** - Needs standardization
3. **⚠️ Auth Pages Loading** - Needs standardization
4. **⚠️ Footer** - Needs standardization

### **Future Implementations**
- All new pages must use these exact specifications
- Any logo component must follow this structure
- No variations allowed without design approval

---

## 🧪 Testing Checklist

### **Visual Verification**
- [ ] Logo matches dashboard exactly
- [ ] "binary" text is 25px height
- [ ] "hub" text is 23px height
- [ ] Colors match specifications
- [ ] Spacing is correct (space-x-1)
- [ ] Background padding is correct
- [ ] Border radius is 15px

### **Responsive Testing**
- [ ] Desktop display is correct
- [ ] Mobile display is correct
- [ ] No layout breaking on different screen sizes

---

## 📝 Notes

- This specification is based on the **dashboard implementation** as of January 2025
- Any future changes to the logo design must update this document
- The dashboard logo serves as the **single source of truth**
- All developers must reference this document for logo implementations

---

**Last Updated**: January 2025  
**Maintained By**: Design Team  
**Approved By**: Product Owner 