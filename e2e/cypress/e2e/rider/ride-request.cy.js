const RIDER_URL = Cypress.env('riderUrl');

const mockUser = {
  _id: 'rider-123',
  name: 'Test Rider',
  email: 'rider@test.com',
  role: 'rider',
};

const mockFare = {
  estimated: 12.5,
  distance: 4.2,
  duration: 14,
  surgeMultiplier: 1,
  breakdown: { baseFare: 3, distanceFare: 7, timeFare: 2.5 },
};

const mockRide = {
  _id: 'ride-abc-123',
  status: 'searching',
  fare: { estimated: 12.5 },
  pickup: { address: 'Paris, France' },
  destination: { address: 'Versailles, France' },
};

describe('Rider — Ride Request', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    // Block socket.io and stub token refresh to prevent hard redirects
    cy.intercept('GET', '**/socket.io/**', { statusCode: 400 });
    cy.intercept('POST', '**/api/auth/refresh', {
      statusCode: 200,
      body: { success: true, data: { accessToken: 'refreshed-mock-token' } },
    });

    cy.intercept('GET', 'https://nominatim.openstreetmap.org/**', (req) => {
      req.reply([{ lat: '48.8566', lon: '2.3522', display_name: req.url.includes('Versailles') ? 'Versailles' : 'Paris' }]);
    }).as('geocode');

    cy.intercept('GET', '**/api/rides/estimate**', {
      statusCode: 200,
      body: { success: true, data: mockFare },
    }).as('estimate');

    cy.intercept('POST', '**/api/rides', {
      statusCode: 201,
      body: { success: true, data: { ride: mockRide } },
    }).as('createRide');

    cy.visit(`${RIDER_URL}/ride/request`, {
      onBeforeLoad(win) {
        win.localStorage.setItem(
          'auth-storage',
          JSON.stringify({ state: { user: mockUser, isAuthenticated: true }, version: 0 })
        );
        win.localStorage.setItem('accessToken', 'mock-token');
      },
    });
    cy.contains('Book a Ride').should('be.visible');
  });

  it('redirects unauthenticated users to login', () => {
    cy.clearLocalStorage();
    cy.visit(`${RIDER_URL}/ride/request`);
    cy.url().should('include', '/auth/login');
  });

  it('renders the ride request form', () => {
    cy.contains('Book a Ride');
    cy.get('input[placeholder*="pickup"], input[placeholder*="Pickup"]').should('exist');
    cy.get('input[placeholder*="going"]').should('exist');
  });

  it('disables Get Estimate until both fields are filled', () => {
    cy.contains('button', 'Get Estimate').should('be.disabled');
    cy.get('input').first().type('Paris, France');
    cy.contains('button', 'Get Estimate').should('be.disabled');
  });

  it('shows fare estimate after filling both addresses', () => {
    cy.get('input[placeholder="Enter pickup address"]').clear();
    cy.get('input[placeholder="Enter pickup address"]').type('Paris, France');
    cy.get('input[placeholder="Where are you going?"]').type('Versailles, France');
    cy.get('input[placeholder="Enter pickup address"]').should('have.value', 'Paris, France');
    cy.get('input[placeholder="Where are you going?"]').should('have.value', 'Versailles, France');
    cy.contains('button', 'Get Estimate').should('not.be.disabled').click();
    cy.wait('@geocode');
    cy.contains(`€${mockFare.estimated}`).should('be.visible');
    cy.contains(`${mockFare.distance} km`).should('be.visible');
    cy.contains(`${mockFare.duration} min`).should('be.visible');
  });

  it('shows fare breakdown in the estimate card', () => {
    cy.get('input[placeholder="Enter pickup address"]').clear();
    cy.get('input[placeholder="Enter pickup address"]').type('Paris, France');
    cy.get('input[placeholder="Where are you going?"]').type('Versailles, France');
    cy.get('input[placeholder="Enter pickup address"]').should('have.value', 'Paris, France');
    cy.get('input[placeholder="Where are you going?"]').should('have.value', 'Versailles, France');
    cy.contains('button', 'Get Estimate').should('not.be.disabled').click();
    cy.wait('@geocode');
    cy.contains('Base fare').should('be.visible');
    cy.contains('Distance').should('be.visible');
    cy.contains('Time').should('be.visible');
  });

  it('confirms the ride and enters searching state', () => {
    cy.get('input[placeholder="Enter pickup address"]').clear();
    cy.get('input[placeholder="Enter pickup address"]').type('Paris, France');
    cy.get('input[placeholder="Where are you going?"]').type('Versailles, France');
    cy.get('input[placeholder="Enter pickup address"]').should('have.value', 'Paris, France');
    cy.get('input[placeholder="Where are you going?"]').should('have.value', 'Versailles, France');
    cy.contains('button', 'Get Estimate').should('not.be.disabled').click();
    cy.wait('@geocode');
    cy.contains('button', /Confirm Ride/i).click();
    cy.wait('@createRide');
    cy.contains('Finding your driver').should('be.visible');
  });

  it('shows surge pricing warning when surge > 1', () => {
    cy.intercept('GET', '**/api/rides/estimate**', {
      statusCode: 200,
      body: { success: true, data: { ...mockFare, surgeMultiplier: 1.5 } },
    }).as('surgeEstimate');

    cy.get('input[placeholder="Enter pickup address"]').clear();
    cy.get('input[placeholder="Enter pickup address"]').type('Paris, France');
    cy.get('input[placeholder="Where are you going?"]').type('Versailles, France');
    cy.get('input[placeholder="Enter pickup address"]').should('have.value', 'Paris, France');
    cy.get('input[placeholder="Where are you going?"]').should('have.value', 'Versailles, France');
    cy.contains('button', 'Get Estimate').should('not.be.disabled').click();
    cy.wait('@geocode');
    cy.contains('Surge pricing active').should('be.visible');
  });
});
