# AI Rules for SIGMA Web Application

## Tech Stack

- **React 18.3.1** - Frontend UI library with hooks and functional components
- **TypeScript** - Static typing for JavaScript to catch errors early
- **Vite 5.3.4** - Fast build tool and development server
- **Supabase 2.91.1** - Backend-as-a-Service for database, auth, and real-time features
- **React Router** - Client-side routing for single-page application navigation
- **Tailwind CSS** - Utility-first CSS framework for styling
- **Lucide React** - Beautiful & consistent icon library
- **shadcn/ui** - High-quality component library built on Radix UI

## Component Architecture Rules

### File Structure
- **Pages** (`src/pages/`) - Main application pages with full functionality
- **Components** (`src/components/`) - Reusable UI components
- **Utils** (`src/utils/`) - Utility functions and configurations
- **Styles** (`src/*.css`) - Global styles and component-specific styles

### Component Creation Rules
1. **Always create new files** for components, even small ones
2. **Keep components focused** - Single responsibility principle
3. **Maximum 100 lines** per component file
4. **Use TypeScript** for all components and props
5. **Export components as default** unless specifically named

### Styling Rules
1. **Always use Tailwind CSS** for styling
2. **No custom CSS classes** unless absolutely necessary
3. **Use responsive design** with Tailwind's breakpoints
4. **Follow existing patterns** in the codebase
5. **Use shadcn/ui components** when available

### State Management
1. **Use React hooks** (`useState`, `useEffect`) for local state
2. **Supabase for data** - Use `useEffect` for data fetching
3. **No global state management** library unless specifically requested
4. **Keep state close to where it's used**

### Data Fetching
1. **Always use Supabase** for database operations
2. **Use async/await** for all async operations
3. **Handle loading states** with `useState`
4. **Show error messages** to users when operations fail
5. **Use proper error boundaries** for error handling

### Form Handling
1. **Controlled components** for form inputs
2. **Validation** before submission
3. **Show loading states** during form submission
4. **Reset forms** after successful submission
5. **Use proper input types** (email, tel, etc.)

### Routing
1. **Keep routes in `src/App.tsx`**
2. **Use React Router** for navigation
3. **Route parameters** for dynamic pages
4. **404 handling** for unknown routes

### Icons
1. **Always use Lucide React** icons
2. **Import icons specifically** (don't use generic icon libraries)
3. **Consistent icon sizing** (16px, 20px, 24px)
4. **Use appropriate icons** for actions (save, delete, search, etc.)

### Supabase Usage
1. **Use the `supabase` utility** from `src/utils/supabase.js`
2. **Always handle errors** from Supabase operations
3. **Use proper typing** for Supabase responses
4. **Implement proper authentication** flows
5. **Use real-time subscriptions** where appropriate

### Component Patterns
1. **Button components** - Use consistent button styling
2. **Input components** - Consistent input styling and validation
3. **Modal components** - Reusable modal patterns
4. **Table components** - Consistent table styling
5. **Search components** - Consistent search patterns

### Performance Rules
1. **Lazy load components** when appropriate
2. **Use React.memo** for expensive components
3. **Optimize re-renders** with proper state management
4. **Code splitting** for large pages
5. **Virtual scrolling** for long lists

### Accessibility
1. **Semantic HTML** elements
2. **ARIA labels** for interactive elements
3. **Keyboard navigation** support
4. **Focus management** for modals and forms
5. **Color contrast** compliance

### Testing
1. **No testing framework** unless specifically requested
2. **Manual testing** in development
3. **Browser compatibility** testing
4. **Responsive testing** across devices

### Code Quality
1. **TypeScript strict mode** enabled
2. **ESLint** configuration for consistent code style
3. **Prettier** for code formatting
4. **No console.log** in production code
5. **Proper error handling** with try/catch where appropriate

### Security
1. **No hardcoded secrets** in frontend code
2. **Supabase Row Level Security** for data protection
3. **Input validation** on all forms
4. **XSS prevention** with proper escaping
5. **CSRF protection** through Supabase

### Development Workflow
1. **Component-first development** - Build small components first
2. **Incremental features** - Add functionality step by step
3. **Refactor when needed** - Keep code clean and maintainable
4. **Documentation** - Add comments for complex logic
5. **Version control** - Use meaningful commit messages

### Library Usage Guidelines

#### Use These Libraries:
- **React** for UI components and state
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Supabase** for backend operations
- **Lucide React** for icons
- **shadcn/ui** for pre-built components

#### Avoid These Libraries:
- **Redux/MobX** - Use React hooks instead
- **jQuery** - Use React patterns
- **Bootstrap** - Use Tailwind CSS
- **Moment.js** - Use native Date or date-fns
- **Lodash** - Use native JS methods or create utilities

#### Conditional Usage:
- **React Router** - Only for client-side routing
- **Form libraries** - Only if complex forms are needed
- **State management** - Only for global state if absolutely necessary
- **Animation libraries** - Only for complex animations