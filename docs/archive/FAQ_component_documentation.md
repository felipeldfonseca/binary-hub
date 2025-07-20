# FAQ Component Documentation

## Overview
This document contains the complete configuration, structure, content, animations, and implementation details for the FAQ (Frequently Asked Questions) component used in the Fast Drop landing page.

## Component Location
- **File Path**: `apps/web/src/components/landing/FAQ.tsx`
- **Component Name**: `FAQ`
- **Export**: Default export

## Dependencies

### Required Packages
```json
{
  "lucide-react": "^0.525.0",
  "react": "^18",
  "react-dom": "^18"
}
```

### Icon Dependencies
- `Plus` icon from `lucide-react`
- `Minus` icon from `lucide-react` (imported but not used in current implementation)

## Component Structure

### TypeScript Interface
```typescript
interface FAQItem {
  question: string;
  answer: string;
}
```

### State Management
```typescript
const [openIndex, setOpenIndex] = useState<number | null>(null);
```

## FAQ Content Data

### Current FAQ Items
```typescript
const faqs = [
  {
    question: "Is my private key safe?",
    answer: "Your spending key is encrypted client-side; servers only see signed TX.",
  },
  {
    question: "What if the pool has no liquidity?",
    answer: "Fast Drop retries with fallback routes; if all fail, nothing is sold.",
  },
  {
    question: "Which airdrops are supported?",
    answer: "Any SPL token with a public claim program—just add a plugin or request one.",
  },
];
```

## Styling Configuration

### CSS Custom Properties (Variables)
```css
:root {
  --brand-bg: #0d0f14;
  --brand-fg: #fcfcfd;
  --brand-accent: #02d27f;
  --brand-accent-2: #8247e5;
  --brand-muted: #9ca3af;
  
  /* Fast Drop specific tokens */
  --fd-primary: #14f195;
  --fd-accent: #9945ff;
  --fd-bg: #0b0124;
  --fd-surface: #121212;
}
```

### Tailwind CSS Classes Used
- **Container**: `pt-24 sm:pt-32 pb-24 sm:pb-32` (padding top/bottom responsive)
- **Max Width**: `max-w-4xl` (maximum width constraint)
- **Centering**: `mx-auto` (horizontal centering)
- **Padding**: `px-6 lg:px-8` (horizontal padding responsive)
- **Text**: `text-center`, `text-3xl`, `font-bold`, `text-lg`, `font-semibold`, `leading-7`
- **Layout**: `flex`, `flex-col`, `items-start`, `justify-between`, `w-full`
- **Spacing**: `mt-12`, `py-6`, `ml-6`, `pb-6`
- **Colors**: `text-[--brand-muted]` (custom color variable)
- **Borders**: `divide-y divide-white/10 border-b border-white/10`
- **Grid**: `grid`, `grid-rows-[1fr]`, `grid-rows-[0fr]`
- **Overflow**: `overflow-hidden`
- **Transitions**: `transition-all duration-500 ease-in-out`, `transition-transform duration-500`

## Animation Details

### Icon Rotation Animation
- **Icon**: Plus icon from Lucide React
- **Animation**: 45-degree rotation when FAQ is open
- **CSS Classes**: 
  - `transform transition-transform duration-500`
  - `rotate-45` (when open)
- **Duration**: 500ms
- **Easing**: Default (linear)

### Content Expansion Animation
- **Method**: CSS Grid animation using `grid-rows`
- **Open State**: `grid-rows-[1fr]` (full height)
- **Closed State**: `grid-rows-[0fr]` (zero height)
- **CSS Classes**: 
  - `transition-all duration-500 ease-in-out`
- **Duration**: 500ms
- **Easing**: `ease-in-out`

## Interactive Behavior

### Toggle Function
```typescript
const toggleFAQ = (index: number) => {
  setOpenIndex(openIndex === index ? null : index);
};
```

### Click Handler
- **Element**: Button wrapping each FAQ question
- **Action**: Calls `toggleFAQ(index)` on click
- **Accessibility**: Includes `aria-hidden="true"` on icon

## Accessibility Features

### ARIA Attributes
- `aria-hidden="true"` on the Plus icon
- Semantic HTML structure with `<dl>`, `<dt>`, and `<dd>` elements

### Keyboard Navigation
- Button elements are naturally keyboard accessible
- Focus management handled by browser defaults

## Responsive Design

### Breakpoint Classes
- **Small screens**: `sm:pt-32`, `sm:pb-32` (increased padding)
- **Large screens**: `lg:px-8` (increased horizontal padding)

### Layout Adaptations
- **Mobile**: Standard padding and spacing
- **Desktop**: Increased padding for better visual hierarchy

## Component Usage

### Import Statement
```typescript
import FAQ from "@/components/landing/FAQ";
```

### Basic Usage
```tsx
<FAQ />
```

### Integration in Landing Page
The FAQ component is typically placed within the landing page layout, often after other content sections.

## Customization Guide

### Adding New FAQ Items
1. Add new objects to the `faqs` array
2. Follow the structure: `{ question: string, answer: string }`
3. No additional configuration needed

### Modifying Animations
1. **Duration**: Change `duration-500` to desired duration (e.g., `duration-300`)
2. **Easing**: Modify `ease-in-out` to other options like `ease-in`, `ease-out`
3. **Icon Rotation**: Adjust `rotate-45` to different angles

### Styling Customization
1. **Colors**: Modify CSS custom properties in `landing.css`
2. **Spacing**: Adjust Tailwind classes for padding/margins
3. **Typography**: Change font sizes and weights using Tailwind classes

## Browser Compatibility
- **React 18+**: Required for hooks usage
- **Modern Browsers**: CSS Grid and transitions support
- **Mobile**: Responsive design with touch-friendly interactions

## Performance Considerations
- **State Management**: Minimal state with single `openIndex` value
- **Rendering**: Only re-renders when FAQ state changes
- **Animations**: Hardware-accelerated CSS transitions
- **Bundle Size**: Small footprint with only Lucide React icons

## Troubleshooting

### Common Issues
1. **Icons not showing**: Ensure `lucide-react` is installed
2. **Animations not working**: Check Tailwind CSS configuration
3. **Styling issues**: Verify CSS custom properties are loaded

### Debug Steps
1. Check browser console for errors
2. Verify all dependencies are installed
3. Ensure Tailwind CSS is properly configured
4. Test responsive behavior on different screen sizes

## Future Enhancements
- Add support for multiple open FAQs simultaneously
- Implement smooth scroll to FAQ when navigating from other sections
- Add search functionality for FAQ items
- Consider adding FAQ categories or tags
- Implement analytics tracking for FAQ interactions