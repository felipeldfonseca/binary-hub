# English Plans Page Documentation

## Overview
The English Plans page is implemented in two versions:
1. **Pre-login version**: `/plans` - Public plans page for unauthenticated users
2. **Post-login version**: `/dashboard/plans` - Authenticated plans page with current plan indication

## Page Structure

### 1. Hero Section
**Location**: Top of both pages  
**Component**: Hero section with title, description, and additional info

#### Title
- **Text**: "Choose the plan that fuels your trading journey"
- **Styling**: 
  - Font: `font-poly` (Poly font family)
  - Size: `text-3xl md:text-4xl lg:text-5xl` (responsive sizing)
  - Weight: `font-bold`
  - Color: `text-white`
  - Highlight: "your trading journey" in `text-primary` (green)

#### Description
- **Text**: "Start for free. Unlock premium analytics whenever you're ready."
- **Styling**:
  - Font: `font-montserrat`
  - Size: `text-xl`
  - Weight: `font-semibold`
  - Color: `text-white`
  - Highlight: "Start for free." in `text-primary` (green)
  - Layout: `max-w-3xl mx-auto` (centered, max width)

#### Additional Info
- **Text**: "Cancel anytime • No hidden fees"
- **Styling**:
  - Font: `font-montserrat`
  - Size: `text-base`
  - Weight: `font-normal`
  - Color: `text-white`
  - Layout: `text-center` (centered)
  - Position: Below plan cards

### 2. Plan Cards Section
**Layout**: 3-column grid (`md:grid-cols-3 gap-8`)

#### Free Plan Card
**Subtitle**: "Forever free"  
**Price**: "$0"  
**Features**:
- Trade imports: "100 / month"
- Manual journal
- CSV import (Ebinex)
- Basic KPIs (Win Rate, Net P&L, Result)
- Performance Heatmap
- AI Insights: Weekly
- Economic calendar: High-impact events
- Data export: CSV
- Priority support: Community

**CTA Button**:
- **Pre-login**: "Get Started" (standard button)
- **Post-login**: "Your current plan" with checkmark icon
  - Background: `bg-gray-600`
  - Text: `text-primary` (green)
  - Icon: SVG checkmark
  - Cursor: `cursor-default` (non-clickable)

#### Premium Plan Card
**Subtitle**: "Most popular"  
**Price**: "$19"  
**Features**:
- Trade imports: "Unlimited"
- Manual journal
- CSV import (Ebinex)
- Basic KPIs (Win Rate, Net P&L, Result)
- Advanced analytics (Equity curve, R:R, Drawdown)
- Strategy KPIs (per model / time of day)
- Performance Heatmap
- AI Insights: Daily
- Edge Report PDF
- Economic calendar: All events + filters
- Custom dashboards: 2
- Data export: CSV · Excel · JSON
- Priority support: Within 24 h
- Free trial: 14 days

**CTA Button**: "Get Started" (standard button)

#### Enterprise Plan Card
**Subtitle**: "Custom"  
**Price**: "Contact Sales"  
**Features**:
- Trade imports: "Unlimited + auto sync"
- Manual journal
- CSV import (Ebinex)
- API integrations: All brokers + custom
- Basic KPIs (Win Rate, Net P&L, Result)
- Advanced analytics (Equity curve, R:R, Drawdown)
- Strategy KPIs (per model / time of day)
- Performance Heatmap
- AI Insights: Real-time
- Edge Report PDF (white-label)
- Economic calendar: All + team alerts
- Custom dashboards: Unlimited
- Team management (10+ seats)
- Data export: API & Webhooks
- Priority support: Dedicated CSM
- Branding: Custom logo & colors
- Free trial: Pilot project

**CTA Button**: "Contact Sales" (standard button)

## Navigation Integration

### Navbar Links
- **Pre-login users**: Plans link points to `/plans`
- **Post-login users**: Plans link points to `/dashboard/plans`

### Implementation Details
- **File**: `app/components/layout/Navbar.tsx`
- **Logic**: Different navigation arrays for landing vs dashboard
- **Dashboard nav items**: `{ href: '/dashboard/plans', label: 'Plans' }`

## Styling Specifications

### Color Scheme
- **Background**: Dark theme (`#505050`)
- **Primary accent**: Green (`#00E28A`)
- **Text**: White (`text-white`)
- **Cards**: Slightly lighter background (`#3A3A3A`)

### Typography
- **Logo font**: Etna
- **Headings**: Montaga (Poly)
- **Body/UI**: Montserrat Light

### Responsive Design
- **Mobile**: Single column layout
- **Tablet**: 3-column grid with gaps
- **Desktop**: Full 3-column layout

## File Structure

### Main Files
- `app/app/plans/page.tsx` - Pre-login plans page
- `app/app/dashboard/plans/page.tsx` - Post-login plans page
- `app/components/layout/Navbar.tsx` - Navigation with plans links

### Key Components
- Hero section with title and description
- Plan cards with feature lists
- CTA buttons with conditional styling
- Responsive grid layout

## Recent Updates

### Title Change
- **From**: "Choose the plan that fits your trading journey"
- **To**: "Choose the plan that fuels your trading journey"
- **Applied to**: Both pre-login and post-login pages

### Post-login Button Styling
- **Free plan button**: Shows "Your current plan" with checkmark
- **Background**: Grey (`bg-gray-600`)
- **Text**: Green (`text-primary`)
- **Icon**: SVG checkmark
- **Behavior**: Non-clickable (`cursor-default`)

## Technical Implementation

### Conditional Rendering
- Different button text and styling based on authentication status
- Different navigation links based on user state

### Responsive Design
- Mobile-first approach
- Breakpoint-based layout changes
- Flexible typography scaling

### Accessibility
- Semantic HTML structure
- Proper heading hierarchy
- Color contrast compliance
- Screen reader friendly

## Future Considerations

### Potential Enhancements
- Plan comparison modal
- Feature tooltips
- Interactive pricing calculator
- Plan upgrade/downgrade flow
- Payment integration
- Usage analytics display

### Maintenance Notes
- Keep plan features synchronized between pre-login and post-login versions
- Update pricing and features in both files
- Maintain consistent styling across both pages
- Test responsive behavior on all breakpoints

