# Routing Structure & Language Handling

## Overview

Binary Hub uses a **unified language-aware routing system** where all pages handle both English and Portuguese languages through query parameters, eliminating the need for separate language-specific routes.

## 🎯 Core Principles

### 1. **Single Source of Truth**
- Each page serves both languages from a single component
- No duplicate files for different languages
- Consistent behavior across all routes

### 2. **Query-Based Language Detection**
- Language preference stored in `localStorage`
- URL query parameter `?lang=pt` for Portuguese
- Automatic language detection from context

### 3. **SEO-Friendly URLs**
- Clean, consistent URLs without language prefixes
- Better search engine indexing
- Improved user experience

## 📁 Current Routing Structure

### **Pre-Login Pages**

| **Route** | **Component** | **Language Support** | **Language Detection** |
|-----------|---------------|---------------------|----------------------|
| `/` | `app/app/page.tsx` | English + Portuguese | Query parameter + localStorage |
| `/about` | `app/app/about/page.tsx` | English + Portuguese | Query parameter + localStorage |
| `/plans` | `app/app/plans/page.tsx` | English + Portuguese | Query parameter + localStorage |

### **Authentication Pages**

| **Route** | **Component** | **Language Support** | **Language Detection** |
|-----------|---------------|---------------------|----------------------|
| `/auth/login` | `app/app/auth/login/page.tsx` | English + Portuguese | Query parameter + localStorage |
| `/auth/register` | `app/app/auth/register/page.tsx` | English + Portuguese | Query parameter + localStorage |
| `/auth/forgot-password` | `app/app/auth/forgot-password/page.tsx` | English + Portuguese | Query parameter + localStorage |

### **Post-Login Pages**

| **Route** | **Component** | **Language Support** | **Language Detection** |
|-----------|---------------|---------------------|----------------------|
| `/dashboard` | `app/app/dashboard/page.tsx` | English + Portuguese | Query parameter + localStorage |
| `/dashboard/plans` | `app/app/dashboard/plans/page.tsx` | English + Portuguese | Query parameter + localStorage |

## 🔧 Language Handling Implementation

### **Language Context (`LanguageContext.tsx`)**

```typescript
// Priority order for language detection:
// 1. URL query parameter (?lang=pt)
// 2. localStorage preference
// 3. Pathname detection (legacy support)
```

### **Language Detection Priority**

1. **Query Parameter**: `?lang=pt` in URL
2. **Saved Preference**: `localStorage.getItem('binary-hub-language')`
3. **Legacy Path**: `/pt/` routes (deprecated)

### **Language Switching**

```typescript
// When switching language:
const newPath = `${currentPath}?${currentSearchParams.toString()}`
router.push(newPath)
```

## 🎨 Component Structure

### **Language-Aware Pages**

Each page follows this pattern:

```typescript
'use client'
import { useLanguage } from '@/lib/contexts/LanguageContext'

export default function PageName() {
  const { isPortuguese } = useLanguage()
  
  return (
    <div>
      {/* Conditional rendering based on language */}
      {isPortuguese ? <PortugueseContent /> : <EnglishContent />}
      
      {/* Or inline conditional text */}
      <h1>{isPortuguese ? 'Título' : 'Title'}</h1>
    </div>
  )
}
```

### **Language-Specific Components**

Components are organized by language:

```
components/
├── layout/
│   ├── LandingHeroSection.tsx      # English landing hero
│   ├── LandingHeroSectionPT.tsx    # Portuguese landing hero
│   ├── Footer.tsx                  # Language-aware footer
│   └── ...
├── dashboard/
│   ├── HeroSection.tsx             # English dashboard hero
│   ├── HeroSectionPT.tsx           # Portuguese dashboard hero
│   └── ...
```

## 🚀 Benefits of This Approach

### **1. Simplified Architecture**
- **Before**: Separate routes (`/`, `/pt`, `/plans`, `/pt/plans`)
- **After**: Single route with language detection (`/`, `/plans`)

### **2. Better SEO**
- **Before**: Duplicate content across different URLs
- **After**: Single URL per page, language handled via query params

### **3. Easier Maintenance**
- **Before**: Duplicate files for each language
- **After**: Single file per page, conditional rendering

### **4. Consistent User Experience**
- **Before**: Different URL structures for different languages
- **After**: Consistent URLs with language preference

### **5. Reduced Bundle Size**
- **Before**: Separate components for each language
- **After**: Shared components with conditional content

## 📋 Creating New Pages

### **Step 1: Create the Page Component**

```typescript
// app/app/your-page/page.tsx
'use client'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import YourPageContent from '@/components/your-page/YourPageContent'
import YourPageContentPT from '@/components/your-page/YourPageContentPT'

export default function YourPage() {
  const { isPortuguese } = useLanguage()
  
  return (
    <div>
      <Navbar />
      <main>
        {isPortuguese ? <YourPageContentPT /> : <YourPageContent />}
      </main>
      <Footer />
    </div>
  )
}
```

### **Step 2: Create Language-Specific Components**

```typescript
// components/your-page/YourPageContent.tsx (English)
export default function YourPageContent() {
  return (
    <div>
      <h1>Your Page Title</h1>
      <p>Your page content in English</p>
    </div>
  )
}

// components/your-page/YourPageContentPT.tsx (Portuguese)
export default function YourPageContentPT() {
  return (
    <div>
      <h1>Título da Sua Página</h1>
      <p>Conteúdo da sua página em português</p>
    </div>
  )
}
```

### **Step 3: Update Navigation**

```typescript
// In Navbar.tsx or other navigation components
const getNavItems = (): NavItem[] => [
  { 
    href: isPortuguese ? '/your-page?lang=pt' : '/your-page', 
    label: isPortuguese ? 'Sua Página' : 'Your Page' 
  },
  // ... other items
]
```

## 🔗 Navigation Patterns

### **Internal Links**

```typescript
// Always use query parameters for language-aware navigation
<Link href={isPortuguese ? '/plans?lang=pt' : '/plans'}>
  {isPortuguese ? 'Planos' : 'Plans'}
</Link>
```

### **Programmatic Navigation**

```typescript
// Use router.push with query parameters
router.push(isPortuguese ? '/dashboard?lang=pt' : '/dashboard')
```

### **Form Submissions**

```typescript
// Maintain language context in form redirects
const handleSubmit = () => {
  router.push(isPortuguese ? '/success?lang=pt' : '/success')
}
```

## 🧪 Testing Language Handling

### **Manual Testing**

1. **Switch Language**: Use language toggle in navbar
2. **Direct URL**: Visit `/plans?lang=pt`
3. **Navigation**: Click links and verify language persistence
4. **Browser Refresh**: Verify language preference is maintained

### **URL Examples**

| **URL** | **Expected Language** | **Description** |
|---------|---------------------|-----------------|
| `/` | English | Default landing page |
| `/?lang=pt` | Portuguese | Portuguese landing page |
| `/plans` | English | English plans page |
| `/plans?lang=pt` | Portuguese | Portuguese plans page |
| `/auth/login` | English | English login page |
| `/auth/login?lang=pt` | Portuguese | Portuguese login page |

## 🚫 Legacy Routes (Removed)

The following legacy routes have been removed to simplify the architecture:

| **Legacy Route** | **Replacement** | **Reason** |
|------------------|-----------------|------------|
| `/pt` | `/?lang=pt` | Unified routing |
| `/pt/plans` | `/plans?lang=pt` | Unified routing |
| `/pt/about` | `/about?lang=pt` | Unified routing |

## 🔄 Migration from Legacy Routes

If you encounter any remaining references to legacy routes:

1. **Update Links**: Change `/pt/route` to `/route?lang=pt`
2. **Update Navigation**: Use query-based routing
3. **Update Tests**: Update test URLs to use query parameters
4. **Update Documentation**: Update any documentation references

## 📊 Performance Benefits

### **Bundle Size Reduction**
- **Before**: Separate components for each language
- **After**: Shared components with conditional rendering
- **Savings**: ~30-40% reduction in component duplication

### **SEO Benefits**
- **Before**: Duplicate content across different URLs
- **After**: Single URL per page with language variants
- **Impact**: Better search engine indexing and ranking

### **Maintenance Benefits**
- **Before**: Duplicate files to maintain
- **After**: Single source of truth per page
- **Impact**: Reduced maintenance overhead and bug potential

## 🎯 Best Practices

### **1. Always Use Language Context**
```typescript
// ✅ Good
const { isPortuguese } = useLanguage()

// ❌ Bad
const isPortuguese = pathname.startsWith('/pt')
```

### **2. Consistent Navigation Patterns**
```typescript
// ✅ Good
href={isPortuguese ? '/page?lang=pt' : '/page'}

// ❌ Bad
href={isPortuguese ? '/pt/page' : '/page'}
```

### **3. Conditional Rendering**
```typescript
// ✅ Good
{isPortuguese ? <PortugueseComponent /> : <EnglishComponent />}

// ❌ Bad
{pathname.startsWith('/pt') ? <PortugueseComponent /> : <EnglishComponent />}
```

### **4. Language-Aware Links**
```typescript
// ✅ Good
<Link href={isPortuguese ? '/about?lang=pt' : '/about'}>
  {isPortuguese ? 'Sobre' : 'About'}
</Link>
```

## 🔮 Future Considerations

### **Potential Enhancements**
1. **Server-Side Language Detection**: Detect language from browser headers
2. **Language-Specific Meta Tags**: SEO optimization per language
3. **Language-Specific Sitemaps**: Better search engine indexing
4. **Language-Specific Analytics**: Track usage by language

### **Scalability**
- Easy to add new languages by extending the language context
- Consistent pattern for all new pages
- Maintainable architecture as the application grows

---

**Last Updated**: December 2024  
**Version**: 1.0  
**Maintainer**: Development Team 