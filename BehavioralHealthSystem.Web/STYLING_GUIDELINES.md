# Styling Guidelines: Tailwind CSS + SCSS Coexistence

## Overview

This project successfully uses **Tailwind CSS** as the primary styling solution with **selective SCSS** for specialized functionality. This hybrid approach maximizes Tailwind's utility-first benefits while maintaining custom styles where needed.

## Current Architecture

### ✅ Primary: Tailwind CSS
- **Use For**: All new components, layout utilities, responsive design, dark mode
- **Benefits**: Consistent design system, smaller bundle size, faster development
- **Examples**: `bg-white dark:bg-gray-800`, `flex items-center justify-between`

### ⚠️ Secondary: Custom SCSS (Selective Use Only)
- **Use For**: Complex animations, specialized components, legacy functionality
- **Current SCSS Files**:
  - `dynamic-progress.scss` - Audio/processing progress bars with animations
  - `components.scss` - Toast notifications, toggles, specialized UI components  
  - `layouts.scss` - Dashboard grid systems, complex layout mixins

## Guidelines

### ✅ When to Use Tailwind CSS
- All new components and pages
- Standard UI patterns (buttons, cards, forms, navigation)
- Layout and spacing utilities
- Responsive design breakpoints
- Dark mode implementations
- State variants (hover, focus, active)

### ⚠️ When Custom SCSS is Acceptable
- Complex CSS animations that require keyframes
- Specialized progress bars or data visualizations
- Component-specific styles that don't fit Tailwind patterns
- Legacy components that would require extensive refactoring

### ❌ Avoid
- Creating new BEM classes when Tailwind utilities exist
- Duplicating Tailwind functionality in SCSS
- Custom color/spacing variables that conflict with Tailwind design tokens

## Recent Cleanup (September 2025)

### Removed Files
- ❌ `extended-risk-assessment.scss` (600+ lines) - Converted to Tailwind
- ❌ `extended-risk-assessment-button.scss` (200+ lines) - Orphaned file

### Retained Files  
- ✅ `dynamic-progress.scss` - Active progress bar animations
- ✅ `components.scss` - Toast/toggle components (minimal BEM usage)
- ✅ `layouts.scss` - Dashboard grid mixins

## Migration Strategy

### Phase 1: Complete ✅
- Convert major components to Tailwind (risk assessments, buttons, forms)
- Remove redundant SCSS files
- Establish hybrid architecture

### Phase 2: Future Optimization
- Evaluate `components.scss` for Tailwind migration opportunities
- Convert layout utilities where possible
- Maintain specialized animations in SCSS

## Best Practices

1. **Default to Tailwind**: Always try Tailwind utilities first
2. **Justify Custom CSS**: Document why SCSS is needed for specific cases
3. **Avoid Duplication**: Don't recreate Tailwind functionality in SCSS
4. **Bundle Size**: Monitor CSS bundle size when adding custom styles
5. **Dark Mode**: Use Tailwind's `dark:` variants, not custom CSS variables

## Bundle Impact

- **Current CSS Bundle**: 73.24 kB (gzipped: 11.76 kB)
- **Recent Reduction**: ~800 lines of redundant SCSS removed
- **Tailwind Adoption**: ~90% of components use Tailwind utilities

## Coexistence Benefits

✅ **Can live together**: Tailwind and SCSS work perfectly in combination  
✅ **Best of both worlds**: Utility-first for speed + custom CSS for specialization  
✅ **Gradual migration**: Can convert components to Tailwind incrementally  
✅ **Maintainable**: Clear guidelines prevent conflicts and confusion

---

*Last Updated: September 30, 2025*  
*Project: Behavioral Health System*  
*Styling Architecture: Tailwind CSS + Selective SCSS*