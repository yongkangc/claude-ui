# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Chat Frontend Architecture

The chat frontend is a React application that provides the web interface for interacting with Claude CLI processes.

### Key Architectural Components

**State Management**
- **ConversationsContext**: Global state for all conversations using React Context API
- **Custom Hooks Pattern**: Business logic isolated in hooks (`useConversationMessages`, `useStreaming`, etc.)
- **Unidirectional Data Flow**: API → Hooks → Components → UI

**Streaming Architecture**
- Uses newline-delimited JSON over HTTP streaming (NOT Server-Sent Events)
- `useStreaming` hook manages EventSource connections to `/api/stream/:streamingId`
- Automatic reconnection and error handling built into streaming hooks
- Messages update in real-time as Claude responds

**Component Organization**
```
components/
├── ConversationView/   # Main chat interface (MessageList + InputArea)
├── MessageList/        # Renders messages with auto-scroll and grouping
├── ToolRendering/      # Specialized renderers for different tool outputs
└── Home/               # Entry point with conversation list and creation
```

### Critical Implementation Details

**Message Rendering**
- Messages are grouped by type for better UX (consecutive assistant messages appear together)
- Tool use has dedicated rendering components in `ToolRendering/`
- Each message tracks its working directory for context

**Type Safety**
- Frontend imports backend types from `@/types/*`
- Additional frontend-specific types in `types/index.ts`
- All API calls are fully typed through the `services/api.ts` client

**Styling System**
- CSS Modules for component isolation (`.module.css` files)
- Global theme variables in `styles/theme.css`
- TUI-inspired design with monospace fonts and terminal aesthetics
- Mobile viewport handling for notched devices

### Key Patterns to Follow

1. **Adding New Components**: Create a folder with `ComponentName.tsx` and `ComponentName.module.css`
2. **API Integration**: All backend calls must go through `services/api.ts`
3. **Streaming Updates**: Use `useStreaming` hook for real-time data
4. **Message Handling**: Extend `ToolRendering` system for new tool types
5. **State Updates**: Use `ConversationsContext` for global conversation state

### Common Tasks

**Adding a New Tool Renderer**
1. Create component in `components/ToolRendering/tools/`
2. Add to `TOOL_RENDERERS` map in `ToolContent.tsx`
3. Follow existing pattern from `BashToolRenderer` or `EditToolRenderer`

**Modifying Message Display**
1. Update `MessageItem` for individual message changes
2. Update `MessageList` for message grouping or scroll behavior
3. Ensure mobile compatibility in viewport-constrained environments

**Extending API Client**
1. Add new methods to `services/api.ts`
2. Import backend types from `@/types/*`
3. Handle errors consistently with existing patterns

## Design System

### Color Palette
- **Backgrounds**: `--color-bg-primary/secondary/tertiary` (white to gray in light, dark grays in dark mode)
- **Text**: `--color-text-primary/secondary/muted` (hierarchical contrast)
- **Accent**: `#0066cc` (light) / `#4d9fff` (dark) for interactive elements
- **Status**: Success (green), Warning (yellow), Error (red), Info (blue)

### Typography
- **UI**: System fonts (`-apple-system, BlinkMacSystemFont, 'Segoe UI'`)
- **Code**: `'SF Mono', Monaco, 'Cascadia Code'` for technical content
- **Sizes**: 11px-16px scale, 13px base, 1.5-1.6 line height

### Spacing & Layout
- **Scale**: 4px base unit (xs:4px, sm:8px, md:16px, lg:24px, xl:32px)
- **Content**: Max-width 48rem for readability
- **Borders**: 4px-28px radius scale, 28px for pill shapes

### Component Patterns

**Buttons**
- Active: Text color as background, inverted text
- Disabled: Transparent background, secondary text
- Hover: 0.9 opacity
- Size: 32-36px circles for primary actions

**Input Areas**
- Pill-shaped containers (28px radius)
- Expandable with smooth transitions
- Focus: 2px accent outline

**Messages**
- User: Right-aligned, secondary background
- Assistant: Timeline with dots and connectors
- Tools: Collapsible dark-background sections

### States & Animation
- **Transitions**: 150ms (fast) / 250ms (normal) ease
- **Loading**: 3-dot bounce or shimmer effects
- **Focus**: 2px accent outline with offset
- **Mobile**: 768px breakpoint, 44px touch targets

### Best Practices
1. Use CSS variables for all theme values
2. CSS Modules for component isolation
3. Mobile-first responsive design
4. Maintain WCAG AA contrast ratios
5. Consistent use of spacing scale