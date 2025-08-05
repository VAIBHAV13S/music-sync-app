# MusicSync - Real-time Music Streaming App

A collaborative music streaming application that allows users to create rooms and listen to music together in real-time.

## 🚀 Features

- **Real-time synchronization** - Listen to music together with perfect sync
- **Room management** - Create public or private rooms
- **User authentication** - Secure login and registration
- **YouTube integration** - Search and play YouTube videos
- **Cross-platform** - Works on desktop and mobile

## 🛠️ Setup & Development

### Environment Variables

Create a `.env.local` file:
```bash
# For local development
VITE_SOCKET_SERVER_URL=http://localhost:3001

# For production deployment
VITE_SOCKET_SERVER_URL=https://music-sync-server-nz0r.onrender.com
```

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 🌐 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions and troubleshooting.

### Quick Vercel Deployment

1. Set environment variable in Vercel dashboard:
   - `VITE_SOCKET_SERVER_URL=https://music-sync-server-nz0r.onrender.com`
2. Deploy from GitHub
3. Visit your deployed app

## 🔧 Debug Tools

In development, visit `/debug` to access connection debugging tools.

---

## Technical Setup (Original Vite Template)

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  plugins: {
    // Add the react-x and react-dom plugins
    'react-x': reactX,
    'react-dom': reactDom,
  },
  rules: {
    // other rules...
    // Enable its recommended typescript rules
    ...reactX.configs['recommended-typescript'].rules,
    ...reactDom.configs.recommended.rules,
  },
})
```
