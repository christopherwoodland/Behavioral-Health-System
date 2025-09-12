# CSS Organization Documentation

## Overview
This document outlines the CSS organization structure for the BehavioralHealthSystem Web application. All inline styles have been moved to external CSS files to improve maintainability, performance, and separation of concerns.

## File Structure

```
src/
├── index.css                     # Main Tailwind CSS file with base styles
├── styles/
│   ├── dynamic-progress.css      # Progress bars and charts with dynamic values
│   ├── components.css            # Reusable component styles
│   └── layouts.css               # Page-specific layouts and complex components
```

## File Descriptions

### `index.css`
- Main Tailwind CSS configuration with @tailwind directives
- Base styles, component classes, and utility classes
- Theme variables for light/dark mode
- Accessibility-focused styles (focus indicators, screen reader classes)
- Global form controls, buttons, cards, and status indicators

### `styles/dynamic-progress.css`
- Progress bars that use CSS custom properties for dynamic width/height
- Audio progress indicators for playback
- Processing progress bars with animation
- Risk assessment chart bars
- Replaces all inline `style={{}}` attributes with CSS classes

### `styles/components.css`
- Toast notification styles
- Toggle switch components
- File upload dropzone styling
- Status badge variants
- Reusable component patterns used across multiple pages

### `styles/layouts.css`
- Dashboard grid layouts with responsive breakpoints
- Predictions chart containers with background patterns
- Audio waveform visualization styles
- Session timeline components
- Upload progress indicators
- Risk assessment heatmaps
- Mobile-specific responsive styles

## Migration Changes

### Before (Inline Styles)
```tsx
<div 
  className="progress-bar"
  style={{ width: `${progress}%` }}
/>
```

### After (CSS Classes)
```tsx
<div 
  className="progress-dynamic progress-animated"
  style={{ '--progress-width': `${progress}%` } as React.CSSProperties}
/>
```

## Benefits

1. **Performance**: Reduced inline styles improve rendering performance
2. **Maintainability**: Centralized styling makes updates easier
3. **Consistency**: Reusable classes ensure consistent styling across components
4. **Separation of Concerns**: Clear separation between logic and presentation
5. **Accessibility**: Centralized focus management and responsive design
6. **Bundle Size**: CSS can be cached separately from JavaScript

## CSS Custom Properties Usage

The migration uses CSS custom properties for dynamic values:

```css
.progress-dynamic {
  width: var(--progress-width, 0%);
}

.chart-bar-dynamic {
  height: var(--chart-height, 8%);
}
```

This approach maintains the dynamic nature of the styles while keeping them in external CSS files.

## Import Order

CSS files are imported in main.tsx in this specific order:
1. `index.css` - Base Tailwind styles
2. `dynamic-progress.css` - Dynamic styling utilities  
3. `components.css` - Component-specific styles
4. `layouts.css` - Layout and page-specific styles

## Dark Mode Support

All CSS files include dark mode variants using the `.dark` class prefix:

```css
.component {
  background-color: rgb(249 250 251);
}

.dark .component {
  background-color: rgb(17 24 39);
}
```

## Responsive Design

Layout CSS includes mobile-first responsive breakpoints:

```css
@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
```

## Next Steps

1. Monitor CSS bundle size and consider splitting if needed
2. Add CSS minification for production builds
3. Consider CSS-in-JS migration if dynamic styling becomes more complex
4. Implement CSS purging to remove unused Tailwind classes