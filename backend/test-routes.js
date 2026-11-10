// Quick test to verify routes are registered
import express from 'express';
import chargerRoutes from './src/routes/charger.routes.js';

const app = express();
app.use(express.json());
app.use('/api/chargers', chargerRoutes);

// List all registered routes
function printRoutes(stack, basePath = '') {
  stack.forEach(layer => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
      console.log(`${methods} ${basePath}${layer.route.path}`);
    } else if (layer.name === 'router' && layer.handle.stack) {
      const path = layer.regexp.source
        .replace('\\/?(?=\\/|$)', '')
        .replace(/\\\//g, '/')
        .replace(/^\^/, '')
        .replace(/\?.*$/, '');
      printRoutes(layer.handle.stack, basePath + path);
    }
  });
}

console.log('\n=== Registered Routes ===\n');
printRoutes(app._router.stack);
console.log('\n========================\n');
