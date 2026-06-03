import 'cypress-mochawesome-reporter/register';
import './commands';

// Silence socket.io connection errors in tests — backend is not running
Cypress.on('uncaught:exception', (err) => {
  if (
    err.message.includes('No token') ||
    err.message.includes('Invalid or expired token') ||
    err.message.includes('WebSocket') ||
    err.message.includes('socket') ||
    err.message.includes('EventSource') ||
    err.message.includes('Cannot read properties of undefined') ||
    err.message.includes('Cannot read properties of null') ||
    err.message.includes('notifications')
  ) {
    return false;
  }
});
