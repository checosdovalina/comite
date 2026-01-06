# Design Guidelines: Committee Management System

## Design Approach: Productivity-Focused Design System

**Selected Approach:** Design System (Linear/Notion-inspired productivity patterns)

**Justification:** This is a data-dense, utility-focused application requiring clarity, efficiency, and consistent patterns for complex information architecture. Drawing from modern productivity tools that excel at managing hierarchical data and scheduling.

**Key Principles:**
- Clarity over decoration
- Information density with breathing room
- Scannable data hierarchy
- Efficient workflows

## Typography System

**Font Family:** Inter (via Google Fonts CDN)

**Hierarchy:**
- Page Headers: 32px/Bold (committee names, main sections)
- Section Titles: 24px/Semibold (dashboard widgets, calendar headers)
- Subsections: 18px/Medium (table headers, form sections)
- Body Text: 15px/Regular (data rows, descriptions)
- Labels: 13px/Medium (form labels, metadata)
- Caption: 12px/Regular (timestamps, helper text)

## Layout & Spacing System

**Tailwind Units:** Standardize on 2, 4, 6, 8, 12, 16, 20 units
- Tight spacing: p-2, gap-2 (badges, inline elements)
- Component padding: p-4 to p-6 (cards, form fields)
- Section spacing: py-8 to py-12 (page sections)
- Major gaps: mb-16, mt-20 (page divisions)

**Grid Structure:**
- Main container: max-w-7xl mx-auto
- Sidebar navigation: 240px fixed width
- Two-column layouts: 2/3 + 1/3 split for dashboard
- Table full-width with horizontal scroll on mobile

## Core Layout Architecture

**App Shell:**
- Fixed sidebar navigation (240px) with committee switcher at top
- Top bar with user profile, notifications icon, breadcrumb path
- Main content area with consistent px-6 to px-8 horizontal padding
- Nested navigation tabs below page header when needed

**Dashboard Layout:**
- Grid of metric cards (3 columns on desktop)
- Full-width calendar component
- Recent activity sidebar (280px)
- Quick actions always visible in top-right

**Calendar Views:**
- Month/Week/Day toggle buttons (segmented control style)
- Grid-based calendar with clear cell boundaries
- Role assignments shown as color-coded badges within cells
- Shift indicators (AM/PM) as compact pills

**Data Tables:**
- Sticky header row
- Alternating row backgrounds for scannability
- Action column pinned right
- Status badges inline with names
- Expand/collapse for nested committee data

## Component Library

**Navigation:**
- Sidebar with collapsible committee groups
- Active state: subtle background highlight + border-left accent
- Icons from Heroicons (outline for inactive, solid for active)

**Cards:**
- Subtle border, minimal shadow
- 8px border radius
- Metric cards: Large number (32px) + small label below
- List cards: Tight spacing (gap-3) for dense information

**Forms:**
- Floating labels that move up on focus/fill
- Input height: h-12
- Consistent border radius: 6px
- Error states below input with 12px red text
- Multi-select dropdowns with searchable interface

**Badges & Tags:**
- Role badges: px-3 py-1, rounded-full, 13px text
- Status indicators: 8px dot + text label
- Committee tags: Removable with × icon

**Buttons:**
- Primary: h-10, px-4, rounded-md, 15px font
- Secondary: border variant of primary
- Icon buttons: w-10 h-10 (square)
- Destructive actions: red variant

**Calendar Component:**
- Cell height: 80px minimum for day view
- User avatars: 24px circles, stacked with overlap
- Empty state: Dashed border with centered "+ Add" text
- Overflow indicator: "+3 more" style badge

**Modals:**
- Max-width: 640px for forms, 480px for confirmations
- Backdrop: Dark semi-transparent overlay
- Close icon top-right corner
- Footer with action buttons right-aligned

**Data Visualization:**
- Horizontal bar charts for attendance rates
- Simple color-coded progress rings for completion
- Minimal gridlines, emphasize data over decoration

## Page-Specific Layouts

**Login/Registration:**
- Centered card (max-w-md)
- Logo + app name at top
- Form with social login options separated by divider
- Remember me checkbox, forgot password link

**Dashboard:**
- Welcome header with committee selector dropdown
- 3-column metric grid
- Calendar preview (current week)
- Recent activity list (last 10 items)
- Quick action buttons floating bottom-right

**Committee Management:**
- Tab navigation (Members, Roles, Settings)
- Data table with filters above (search, role filter, status)
- Bulk actions toolbar appears on row selection
- Add member button prominent top-right

**Calendar Full View:**
- View switcher (Month/Week/Day) top-left
- Date navigation arrows + today button
- Filter by role/person in top-right
- Legend for role colors below navigation
- Side panel (collapsible) showing details on date selection

**User Profile:**
- Two-column: Photo + basic info left, forms right
- Committee memberships as expandable cards
- Role history timeline
- Notification preferences as toggle list

## Images & Visual Assets

**No Hero Images** - This is a productivity app, not marketing.

**Avatar Images:**
- User profile photos: 40px circles in lists, 80px in profile
- Committee logos: 32px square in switcher, 64px in settings
- Default avatars: Initials on colored backgrounds

**Icons:** Heroicons via CDN
- Navigation icons: 20px
- Action icons: 16px
- Status indicators: 12px dots

## Accessibility Standards

- All interactive elements min 44px touch target
- Focus states: 2px outline with offset
- Skip to main content link
- ARIA labels on icon-only buttons
- Keyboard navigation for all workflows
- Color not sole indicator of status (use icons/text too)

## Responsive Behavior

**Mobile (<768px):**
- Sidebar collapses to hamburger menu
- Tables switch to card view stacked vertically
- Calendar switches to agenda list view
- Metric cards stack single column
- Bottom navigation bar for primary actions

**Tablet (768-1024px):**
- Sidebar toggleable, main content expands
- Tables horizontal scroll if needed
- 2-column grid for metrics

**Desktop (>1024px):**
- Full sidebar always visible
- Multi-column layouts active
- Hover states for interactive elements