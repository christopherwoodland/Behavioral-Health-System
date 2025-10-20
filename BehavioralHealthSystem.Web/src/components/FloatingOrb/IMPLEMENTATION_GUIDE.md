# Floating Orb UI Components - Implementation Guide

## Overview
New immersive 3D UI for the agent experience featuring:
- **FloatingOrb.tsx**: 3D animated sphere using Three.js that responds to agent speaking state
- **ClosedCaptions.tsx**: Stylized floating captions at screen bottom
- Full agent color-coding system

## Components Created

### 1. FloatingOrb Component (`FloatingOrb.tsx`)
**Location**: `src/components/FloatingOrb/FloatingOrb.tsx`

**Features**:
- 3D sphere using Three.js with WebGL rendering
- Adaptive animations:
  - **Wave Animation**: Surface ripples continuously
  - **Pulsing**: Orb expands/contracts when agent speaks
  - **Rotation**: Constant gentle rotation
  - **Swirling**: Time-based shader displacement
- Color-coded by agent:
  - **Tars**: Blue (#4a90e2)
  - **Matron**: Pink/Magenta (#e24a90)
  - **PHQ-2**: Cyan (#4ae2e2)
  - **PHQ-9**: Purple (#a24ae2)
  - **Vocalist**: Orange (#e2a24a)
- Responsive sizing (300px → 150px depending on screen)

**Props**:
```typescript
interface FloatingOrbProps {
  isAgentSpeaking: boolean;  // Triggers pulsing animation
  isUserSpeaking: boolean;   // Dims intensity
  agentId: string;           // Determines orb color
}
```

### 2. ClosedCaptions Component (`ClosedCaptions.tsx`)
**Location**: `src/components/FloatingOrb/ClosedCaptions.tsx`

**Features**:
- Displays up to 3 captions simultaneously
- Auto-scrolling: older captions fade out and slide up
- Speaker labels (You, Tars, Matron, PHQ-2, PHQ-9, Vocalist)
- Color-coded borders matching agent colors
- Glassmorphism effect (frosted glass background)
- Smooth animations:
  - Slide up entrance (0.1s per staggered item)
  - Fade and drift on exit (5s total duration)
- Responsive for mobile/tablet/desktop

**Props**:
```typescript
interface ClosedCaptionsProps {
  captions: CaptionItem[];  // Array of captions to display
  maxCaptions?: number;     // Max simultaneous (default 3)
}

interface CaptionItem {
  id: string;
  text: string;
  speaker: 'user' | 'agent';
  agentId?: string;         // For color coding
  timestamp: number;
}
```

## CSS Files

### FloatingOrb.css
- Three.js canvas sizing and positioning
- Absolute centering on screen
- Responsive breakpoints

### ClosedCaptions.css
- Fixed bottom positioning (2rem from bottom)
- Glassmorphic backdrop blur with Safari support (`-webkit-backdrop-filter`)
- Agent-specific border colors
- Staggered animation delays
- Mobile-optimized sizing

## Integration with RealtimeAgentExperience

**To integrate into your existing component**:

```tsx
import { FloatingOrb, ClosedCaptions, CaptionItem } from '../components/FloatingOrb';

// In your component:
const [captions, setCaptions] = useState<CaptionItem[]>([]);

// When messages come in:
setMessages(prev => [...prev, message]);

// Add to captions
setCaptions(prev => [...prev, {
  id: message.id,
  text: message.content,
  speaker: message.role === 'user' ? 'user' : 'agent',
  agentId: currentAgent.id,
  timestamp: Date.now()
}]);

// In JSX:
<FloatingOrb
  isAgentSpeaking={speechDetection.isAISpeaking}
  isUserSpeaking={speechDetection.isUserSpeaking}
  agentId={currentAgent.id}
/>

<ClosedCaptions
  captions={captions}
  maxCaptions={3}
/>
```

## Technical Details

### Three.js Implementation
- **Geometry**: IcosahedronGeometry (6 subdivisions for smooth animation)
- **Material**: Custom ShaderMaterial with:
  - Vertex shader: Wave displacement on surface
  - Fragment shader: Glow effect
  - Uniform controls: time, intensity, baseColor
- **Lighting**: Two point lights for depth
- **Performance**: High-performance renderer settings

### Animation Timing
- Wave frequency: 3x on X, 2.5x on Y, 2x on Z (varied for organic motion)
- Pulse frequency: 20ms per sine wave cycle
- Rotation: Gentle X and Y axis rotation
- Caption exit: 5s total (85% visible, 15% fading)

### Browser Support
- Modern browsers with WebGL support
- Fallback: Graceful degradation (canvas won't render but app continues)
- Safari support: Includes `-webkit-` prefixes for backdrop-filter

## Color System
Uses CSS variables defined in ClosedCaptions.css:
```css
--agent-tars: #4a90e2;
--agent-matron: #e24a90;
--agent-phq2: #4ae2e2;
--agent-phq9: #a24ae2;
--agent-vocalist: #e2a24a;
```

## Responsive Behavior
- **Desktop (1024px+)**: 300px orb
- **Tablet (768-1023px)**: 250px orb
- **Mobile (480-767px)**: 200px orb
- **Small mobile (<480px)**: 150px orb

## Performance Considerations
- Three.js renderer runs at requestAnimationFrame (~60fps)
- Canvas is transparent (no unnecessary redraws)
- Shader-based animations are GPU-accelerated
- Captions use CSS animations (no JavaScript animation loop)

## Dependencies Added
- `three@r128` (or latest)
- `@types/three` (TypeScript support)

Install with:
```bash
npm install three @types/three
```

## Next Steps
1. Import components into RealtimeAgentExperience.tsx
2. Connect speechDetection state to FloatingOrb
3. Feed message stream to ClosedCaptions
4. Remove old message display UI (optional)
5. Test responsive behavior on different screen sizes
6. Adjust animation intensity/frequency as needed
