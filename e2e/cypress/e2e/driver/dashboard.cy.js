const DRIVER_URL = Cypress.env('driverUrl');

const mockDriver = {
  _id: 'driver-456',
  name: 'Test Driver',
  email: 'driver@test.com',
  role: 'driver',
  rating: 4.8,
};

function visitDashboardAsDriver() {
  cy.clearLocalStorage();
  cy.intercept('GET', '**/socket.io/**', { statusCode: 400 });
  cy.intercept('POST', '**/api/auth/refresh', {
    statusCode: 200,
    body: { success: true, data: { accessToken: 'refreshed-mock-token' } },
  });
  cy.intercept('PUT', '**/api/location/drivers/status', { statusCode: 200, body: { success: true, data: { isOnline: true } } }).as('setStatus');
  cy.intercept('PUT', '**/api/profile/driver/status', { statusCode: 200, body: { success: true, data: { isOnline: true } } }).as('toggleStatus');

  cy.visit(`${DRIVER_URL}/dashboard`, {
    onBeforeLoad(win) {
      win.localStorage.setItem(
        'auth-storage',
        JSON.stringify({ state: { user: mockDriver, isAuthenticated: true }, version: 0 })
      );
      win.localStorage.setItem('accessToken', 'mock-token');
    },
  });
  cy.contains(mockDriver.name).should('be.visible');
}

describe('Driver — Dashboard', () => {
  context('unauthenticated', () => {
    it('redirects to /auth/login when not logged in', () => {
      cy.clearLocalStorage();
      cy.visit(`${DRIVER_URL}/dashboard`);
      cy.url().should('include', '/auth/login');
    });
  });

  context('authenticated as driver', () => {
    beforeEach(() => visitDashboardAsDriver());

    it('shows the driver name', () => {
      cy.contains(mockDriver.name).should('be.visible');
    });

    it('shows the driver rating', () => {
      cy.contains(mockDriver.rating.toFixed(1)).should('be.visible');
    });

    it('shows the online/offline toggle', () => {
      cy.contains(/Offline|Online/i).should('be.visible');
    });

    it('shows today and total earnings cards', () => {
      cy.contains('Today').should('be.visible');
      cy.contains('Total').should('be.visible');
    });

    it('toggles driver online status', () => {
      cy.intercept('PUT', '**/api/profile/driver/status', {
        statusCode: 200,
        body: { success: true, data: { isOnline: true } },
      }).as('goOnline');

      cy.contains(/Offline/i);
      cy.get('button').filter(':has(svg)').last().click();
      cy.wait('@goOnline');
      cy.contains(/Online/i).should('be.visible');
    });

    it('logs out and redirects to login', () => {
      cy.intercept('POST', '**/api/auth/logout', { statusCode: 200, body: { success: true } });
      cy.get('[data-cy="logout"]').click();
      cy.url().should('include', '/auth/login');
    });
  });
});
