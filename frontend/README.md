# React Project

This project was created using React 18, Tailwind CSS, and Vite.

## Setup Instructions

1. Install dependencies:
   ```
   npm install
   ```

2. Start the development server:
   ```
   npm run dev
   ```

3. Build for production:
   ```
   npm run build
   ```

4. Preview the production build:
   ```
   npm run preview
   ```

## Important Notes

### Modern React Architecture
This project uses React 18 with Vite for optimal development experience. All dependencies are carefully selected for compatibility:

- **Icons**: Uses `@heroicons/react` or `lucide-react` for beautiful, accessible icons
- **Styling**: Tailwind CSS for utility-first styling
- **Build Tool**: Vite for lightning-fast HMR and builds

### Tailwind CSS

This project uses Tailwind CSS for styling. The configuration is in `tailwind.config.js`.

#### Key files:
- `src/index.css`: Contains the Tailwind directives
- `tailwind.config.js`: Contains the Tailwind configuration
- `postcss.config.js`: Configures PostCSS for Tailwind

### Troubleshooting

If you encounter dependency issues:
1. Make sure you're using Node.js 18 or later
2. Run `npm install`
3. If styles are not applying:
   - Make sure `src/index.css` is imported in `src/main.jsx`
   - Check that `tailwind.config.js` has the correct content paths
   - Run `npm run dev` to start the development server

## Project Structure

- `src/`: Source files
  - `components/`: React components
  - `pages/`: Page components
  - `App.jsx`: Main application component
  - `main.jsx`: Application entry point
  - `index.css`: Global styles and Tailwind directives
- `public/`: Static assets
- `index.html`: HTML entry point
- `tailwind.config.js`: Tailwind CSS configuration
- `vite.config.js`: Vite configuration

## Dependencies

All dependencies are carefully selected for React 18 compatibility and optimal performance. The project uses modern libraries and follows best practices for maintainability.
