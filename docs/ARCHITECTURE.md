# CCUI Architecture

## Project Structure

After consolidation, CCUI is now a single package with integrated frontend and backend:

```
ccui-backend/
├── src/
│   ├── web/              # React frontend code
│   │   ├── api/          # API client
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── pages/        # Route pages
│   │   ├── styles/       # CSS modules
│   │   └── main.tsx      # React entry point
│   ├── services/         # Backend services
│   ├── cli/              # CLI commands
│   └── ccui-server.ts    # Main server with vite-express
├── index.html            # Frontend HTML entry
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # Backend TypeScript config
├── tsconfig.web.json     # Frontend TypeScript config
├── tsconfig.base.json    # Shared TypeScript config
└── package.json          # Single package.json for all dependencies
```

## Key Changes

### 1. Single Port Architecture
- Both frontend and backend run on port 3001
- Uses `vite-express` for seamless integration
- Hot module replacement works in development
- Production build serves optimized static files

### 2. Unified Dependencies
- Single `node_modules` directory
- Single `npm install` command
- No duplicate dependencies between frontend and backend
- Simpler dependency management

### 3. TypeScript Configuration
- Separate configs for backend and frontend compilation
- Shared base configuration
- Backend compiles to CommonJS for Node.js
- Frontend uses ESNext modules for Vite

### 4. Build Process
- `npm run build` builds both frontend and backend
- Frontend built with Vite to `dist/` directory
- Backend compiled with TypeScript to `dist/` directory
- Single production deployment

## Development Workflow

1. **Start Development Server**
   ```bash
   npm run dev
   ```
   This starts the backend with tsx watch mode and vite-express handles the frontend with HMR.

2. **Access the Application**
   Navigate to `http://localhost:3001` - both API and UI are available here.

3. **Make Changes**
   - Backend changes: Automatically reloaded by tsx
   - Frontend changes: Hot module replacement via Vite

## Production Deployment

1. **Build**
   ```bash
   npm run build
   ```

2. **Run**
   ```bash
   NODE_ENV=production npm start
   ```

The server automatically serves the optimized React app alongside the API endpoints.