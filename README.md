# AnyGym Admin

Admin portal for managing AnyGym gyms. This application uses Auth0 for authentication and integrates with the api.any-gym.com API.

## Features

- 🔐 Auth0 authentication
- 📊 Dashboard with gym management
- 🎨 Modern UI built with Tailwind CSS
- 🚀 Next.js 14 with App Router

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Auth0 account and application

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up Auth0:
   - Create an Auth0 account at https://auth0.com
   - Create a new application (Regular Web Application)
   - Configure the following:
     - Allowed Callback URLs: `http://localhost:3000/api/auth/callback`
     - Allowed Logout URLs: `http://localhost:3000`
     - Allowed Web Origins: `http://localhost:3000`

3. Configure environment variables:
   - Copy `.env.local.example` to `.env.local`
   - Fill in your Auth0 credentials:
     ```bash
     cp .env.local.example .env.local
     ```
   - Generate AUTH0_SECRET:
     ```bash
     openssl rand -hex 32
     ```
   - Update `.env.local` with your Auth0 values:
     - `AUTH0_ISSUER_BASE_URL`: Your Auth0 domain (e.g., `https://your-tenant.auth0.com`)
     - `AUTH0_CLIENT_ID`: Your Auth0 application client ID
     - `AUTH0_CLIENT_SECRET`: Your Auth0 application client secret
     - `AUTH0_BASE_URL`: `http://localhost:3000` (or your production URL)
     - `AUTH0_SECRET`: The generated secret from above

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
anygymAdmin/
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── [...auth0]/     # Auth0 API routes
│   ├── dashboard/              # Dashboard page (protected)
│   ├── globals.css             # Global styles with Tailwind
│   ├── layout.tsx              # Root layout with Auth0 provider
│   └── page.tsx                # Home page (redirects to login/dashboard)
├── .env.local.example          # Environment variables template
└── package.json
```

## Authentication Flow

1. User visits the site → redirected to Auth0 login
2. User logs in → redirected to `/dashboard`
3. Dashboard is protected and requires authentication
4. User can logout via the logout button

## API Integration

The application is set up to integrate with `api.any-gym.com`. You can add API calls in the dashboard or create additional pages to fetch and display gym data.

## Build for Production

```bash
npm run build
npm start
```

## License

See LICENSE file for details.
