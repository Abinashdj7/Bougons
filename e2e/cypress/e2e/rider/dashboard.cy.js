const RIDER_URL = Cypress.env('riderUrl');

describe('Rider — Dashboard', () => {
  context('unauthenticated', () => {
    it('redirects to /auth/login when not logged in', () => {
      cy.clearLocalStorage();
      cy.visit(`${RIDER_URL}/dashboard`);
      cy.url().should('include', '/auth/login');
    });
  });

  context('authenticated', () => {
    beforeEach(() => {
      cy.clearLocalStorage();
      // Block socket.io WebSocket handshake so no real backend connection is made
      cy.intercept('GET', '**/socket.io/**', { statusCode: 400 });
      // Mock token refresh so the hard window.location redirect never fires
      cy.intercept('POST', '**/api/auth/refresh', {
        statusCode: 200,
        body: { success: true, data: { accessToken: 'refreshed-mock-token' } },
      });
      // Intercept the SSE notification stream (registered first so it can be overridden below)
      cy.intercept('GET', '**/api/notifications**', {
        statusCode: 200,
        body: { success: true, data: { notifications: [], unreadCount: 0 } },
      });
      // Stream-specific intercept registered last so it wins over the general one
      cy.intercept('GET', '**/api/notifications/stream**', {
        statusCode: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: '',
      });
      cy.visit(`${RIDER_URL}/dashboard`, {
        onBeforeLoad(win) {
          win.localStorage.setItem(
            'auth-storage',
            JSON.stringify({
              state: {
                user: { _id: 'rider-123', name: 'Test Rider', email: 'rider@test.com', role: 'rider' },
                isAuthenticated: true,
              },
              version: 0,
            })
          );
          win.localStorage.setItem('accessToken', 'mock-token');
        },
      });
      cy.contains('Test Rider').should('be.visible');
    });

    it('shows the rider dashboard', () => {
      cy.contains('Test Rider').should('be.visible');
    });

    it('has a Book a Ride button', () => {
      cy.contains('Book a Ride').should('be.visible');
    });

    it('has a Ride History link', () => {
      cy.contains('History').should('be.visible');
    });

    it('navigates to ride request page on Book a Ride', () => {
      cy.intercept('GET', '**/api/rides**', { body: { success: true, data: { rides: [], total: 0 } } });
      cy.contains('Book a Ride').click();
      cy.url().should('include', '/ride/request');
    });

    it('logs out and redirects to login', () => {
      cy.intercept('POST', '**/api/auth/logout', { statusCode: 200, body: { success: true } }).as('logout');
      cy.contains('Test Rider').should('be.visible');
      cy.get('[data-cy="logout"]').click();
      cy.url().should('include', '/auth/login');
    });
  });
});
