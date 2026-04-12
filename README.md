# ✦ Inkwell — Write & Share

A beautiful, modern platform for writers to create, publish, and analyze their articles. Built with React, TypeScript, Supabase, and Vercel.

## ✨ Features

### 🎨 **Design & Experience**
- 🌓 **Dark/Light Mode Toggle** — Warm paper tones for light theme
- 📱 **Fully Responsive** — Desktop, tablet, and mobile optimized
- ⚡ **Smooth Animations** — Elegant transitions and interactions
- ♿ **Accessible** — Semantic HTML and keyboard navigation

### 📦 **Progressive Web App**
- 📲 **Installable** — Works like a native app on iOS/Android
- 🔌 **Offline Support** — Service Worker with network-first caching
- ⚡ **Fast Loading** — Optimized bundle with lazy loading

### 🔧 **Technology Stack**
- **Frontend:** React 19 + TypeScript + Vite
- **Authentication:** Supabase Auth
- **Database:** Supabase PostgreSQL
- **AI Integration:** Grok API (XAI)
- **Analytics:** Vercel Web Analytics
- **Deployment:** Vercel

### 📊 **Application Pages**
- **Dashboard** — Overview of articles and stats
- **Articles** — Browse and manage published articles
- **Write** — Rich article editor with AI assistance
- **Analytics** — Track article performance
- **Profile** — User settings and information

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/lebrondeno/inkwell.git
cd inkwell

# Install dependencies
npm install

# Create .env file with your credentials
cp .env.example .env

# Start development server
npm run dev
```

### Environment Variables

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
VITE_GROK_API_KEY=your_grok_api_key
```

## 📦 Build & Deploy

```bash
# Build for production
npm run build

# Preview build locally
npm run preview

# Deploy to Vercel
vercel
```

## 🎯 Features in Detail

### Theme System
- Persistent theme preference stored in localStorage
- Smooth CSS variable-based transitions
- Light theme with warm (#8b6f47) accents
- Dark theme maintains original aesthetic

### Mobile Navigation
- Fixed top bar (56px) with logo and theme toggle
- Fixed bottom navigation (64px) with 5 main tabs
- Touch-optimized 40px+ tap targets
- Hides desktop sidebar on tablets/mobile

### PWA Support
- Service Worker with intelligent caching
- `manifest.json` for home screen installation
- Works offline with cached assets
- Cross-browser compatibility

### Analytics
- Vercel Web Analytics integration
- Real-time visitor tracking
- Core Web Vitals monitoring
- Performance insights dashboard

## 🛠️ Development

### Available Scripts

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

### Project Structure

```
src/
├── components/     # Reusable React components
├── pages/         # Page-level components
├── context/       # React Context (Auth, Theme)
├── lib/           # Utilities (Supabase, AI)
├── hooks/         # Custom React hooks
├── types/         # TypeScript type definitions
└── index.css      # Global styles with theme variables
```

## 🔐 Security

- API keys stored in environment variables (never in code)
- Supabase RLS (Row Level Security) enabled
- Input validation on all forms
- HTTPS-only deployment

## 📝 License

MIT License - feel free to use this as inspiration for your own projects!

---

### ✍️ Made with ✦ by **lebrondeno**

This project represents a modern approach to web application development, combining beautiful design with powerful functionality. Built with passion for writers everywhere.

**GitHub:** [@lebrondeno](https://github.com/lebrondeno)
**Live:** [inkwell.vercel.app](https://inkwell.vercel.app)
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
