# HomeTest Frontend

This is a Single Page Application (SPA) built with React and React Router, using Next.js as the build tool.

## Architecture

The application uses a hybrid approach:

- **Client-side routing**: [React Router](https://reactrouter.com/) for all navigation and routing
- **Build tool**: [Next.js](https://nextjs.org) for development server and static export
- **Production**: Static HTML/CSS/JS files served from a CDN or web server

### Key Components

- `src/app.tsx` - Main application entry point with React Router configuration
- `src/routes/` - Page components for each route
- `src/app/[[...slug]]/` - Next.js catch-all route that renders the React Router SPA

## Getting Started

First, run the development server:

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The application uses client-side routing with React Router. You can start editing pages by modifying files in `src/routes/`. The page auto-updates as you edit the file.

## Building for Production

Build the static export:

```bash
pnpm run build
```

This creates a `build/` directory with static HTML, CSS, and JavaScript files that can be deployed to any static hosting service.

### Serve Static Build Locally

To test the production build locally:

```bash
pnpm run serve:static
```

This builds the application and serves it at [http://localhost:8085](http://localhost:8085).

## Environment Variables

The application requires the following environment variables:

- `NEXT_PUBLIC_BACKEND_URL` - The backend API URL

### Local Development

For local development Terraform will create a `.env.local` file in the `ui` with the expected API gateway value.

## Routing

the technologies used in this project:

- [React Router Documentation](https://reactrouter.com/) - Client-side routing library
- [Next.js Documentation](https://nextjs.org/docs) - Build tool and development server
- [React Documentation](https://react.dev/) - UI library
- [NHS UK Frontend](https://nhsuk.github.io/nhsuk-frontend/) - NHS design system components

## Debugging State

In development, all React context state is accessible via `globalThis.__appDebug` in the browser console. Values are evaluated lazily via property getters, so you always see the current state. This is a no-op in production.

```js
__appDebug.order; // OrderContext — order answers collected through the journey
__appDebug.auth; // AuthContext — authenticated user
__appDebug.navigation; // NavigationContext — current step and step history
__appDebug.postcode; // PostcodeLookupContext — address lookup results
```

Debug registration follows a **boundary-style devtools pattern** — state providers contain no debug code. Instead, two dedicated devtools components handle all registration:

- `AppDevtools` (in `MainLayout`) — registers app-level state (auth)
- `JourneyDevtools` (in `JourneyLayout`) — registers journey-level state (order, navigation, postcode)

These components are env-gated and render nothing. The core utility is in `src/lib/utils/debug.ts`.

## Deployment

Since this is a static SPA, you can deploy the built files to any static hosting service:

1. Build the static files: `pnpm run build`
2. Deploy the `build/` directory to your hosting service (e.g., AWS S3, Azure Static Web Apps)
3. Configure the hosting service to serve `index.html` for all routes (for client-side routing support)

```bash
pnpm test
```

Run tests in watch mode:

```bash
pnpm run test:watch
```
