const ADMIN_URL = Cypress.env('adminUrl');

const mockAdmin = {
  _id: 'admin-789',
  name: 'Test Admin',
  email: 'admin@test.com',
  role: 'admin',
};

const mockRides = [
  {
    _id: 'ride-001',
    status: 'completed',
    pickup: { address: 'Paris, France' },
    destination: { address: 'Lyon, France' },
    fare: { estimated: 45.0 },
    createdAt: new Date().toISOString(),
  },
  {
    _id: 'ride-002',
    status: 'searching',
    pickup: { address: 'Marseille, France' },
    destination: { address: 'Nice, France' },
    fare: { estimated: 22.5 },
    createdAt: new Date().toISOString(),
  },
];

const mockRevenue = { total: 67.5, count: 2, avgFare: 33.75 };

function visitDashboardAsAdmin() {
  cy.intercept('POST', '**/api/auth/refresh', {
    statusCode: 200,
    body: { success: true, data: { accessToken: 'refreshed-mock-token' } },
  });

  cy.intercept('GET', '**/api/rides**', {
    statusCode: 200,
    body: { success: true, data: { rides: mockRides, total: mockRides.length } },
  }).as('getRides');

  cy.intercept('GET', '**/api/payments/revenue**', {
    statusCode: 200,
    body: { success: true, data: mockRevenue },
  }).as('getRevenue');

  cy.visit(`${ADMIN_URL}/dashboard`, {
    onBeforeLoad(win) {
      win.localStorage.setItem(
        'admin-auth',
        JSON.stringify({ state: { user: mockAdmin, isAuthenticated: true }, version: 0 })
      );
      win.localStorage.setItem('accessToken', 'mock-token');
    },
  });

  cy.wait('@getRides');
  cy.wait('@getRevenue');
}

describe('Admin — Dashboard', () => {
  context('unauthenticated', () => {
    it('redirects to /login when not logged in', () => {
      cy.clearLocalStorage();
      cy.visit(`${ADMIN_URL}/dashboard`);
      cy.url().should('include', '/login');
    });
  });

  context('authenticated as admin', () => {
    beforeEach(() => visitDashboardAsAdmin());

    it('renders the admin sidebar', () => {
      cy.contains('Bougons').should('be.visible');
      cy.contains('Admin Panel').should('be.visible');
      cy.contains(mockAdmin.name).should('be.visible');
    });

    it('shows stat cards on the overview tab', () => {
      cy.contains('Total Rides').should('be.visible');
      cy.contains('Active Now').should('be.visible');
      cy.contains('Revenue').should('be.visible');
      cy.contains('Avg Fare').should('be.visible');
    });

    it('shows correct revenue from API', () => {
      cy.contains(`€${mockRevenue.total.toFixed(2)}`).should('be.visible');
    });

    it('shows the weekly revenue chart', () => {
      cy.contains('Weekly Revenue').should('be.visible');
    });

    it('switches to the Rides tab and shows the rides table', () => {
      cy.contains('button', 'Rides').click();
      cy.contains('Recent Rides').should('be.visible');
      cy.contains('Ride ID').should('be.visible');
      cy.contains('completed').should('be.visible');
      cy.contains('searching').should('be.visible');
    });

    it('shows ride pickup and destination in the Rides table', () => {
      cy.contains('button', 'Rides').click();
      cy.contains('Paris, France').should('be.visible');
      cy.contains('Lyon, France').should('be.visible');
    });

    it('switches to the Users tab', () => {
      cy.contains('button', 'Users').click();
      cy.contains('User management coming soon').should('be.visible');
    });

    it('refreshes data when Refresh button is clicked', () => {
      cy.intercept('GET', '**/api/rides**', {
        statusCode: 200,
        body: { success: true, data: { rides: mockRides, total: mockRides.length } },
      }).as('refreshRides');

      cy.contains('button', 'Refresh').click();
      cy.wait('@refreshRides');
    });

    it('logs out and redirects to /login', () => {
      cy.intercept('POST', '**/api/auth/logout', { statusCode: 200, body: { success: true } });
      cy.contains('Sign out').click();
      cy.url().should('include', '/login');
    });
  });
});
