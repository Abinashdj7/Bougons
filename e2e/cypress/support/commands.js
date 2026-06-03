// ─── Auth state helpers ───────────────────────────────────────────────────────

/**
 * Seed Zustand persist state + accessToken so the app boots as logged-in.
 * storageKey matches the `name` option in each app's persist() middleware.
 */
function seedAuth(storageKey, user) {
  localStorage.setItem(
    storageKey,
    JSON.stringify({ state: { user, isAuthenticated: true }, version: 0 })
  );
  localStorage.setItem('accessToken', 'mock-access-token');
}

Cypress.Commands.add('setRiderAuth', (overrides = {}) => {
  cy.fixture('users').then(({ rider }) => {
    cy.window().then((win) => {
      win.localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: { user: { ...rider, ...overrides }, isAuthenticated: true },
          version: 0,
        })
      );
      win.localStorage.setItem('accessToken', 'mock-access-token');
    });
  });
});

Cypress.Commands.add('setDriverAuth', (overrides = {}) => {
  cy.fixture('users').then(({ driver }) => {
    cy.window().then((win) => {
      win.localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: { user: { ...driver, ...overrides }, isAuthenticated: true },
          version: 0,
        })
      );
      win.localStorage.setItem('accessToken', 'mock-access-token');
    });
  });
});

Cypress.Commands.add('setAdminAuth', (overrides = {}) => {
  cy.fixture('users').then(({ admin }) => {
    cy.window().then((win) => {
      win.localStorage.setItem(
        'admin-auth',
        JSON.stringify({
          state: { user: { ...admin, ...overrides }, isAuthenticated: true },
          version: 0,
        })
      );
      win.localStorage.setItem('accessToken', 'mock-access-token');
    });
  });
});

// ─── Login flow helpers ───────────────────────────────────────────────────────

Cypress.Commands.add('loginAsRider', () => {
  cy.fixture('users').then(({ rider }) => {
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: { success: true, data: { user: rider, accessToken: 'mock-access-token' } },
    }).as('loginRequest');

    cy.visit(`${Cypress.env('riderUrl')}/auth/login`);
    cy.get('input[name="email"]').type(rider.email);
    cy.get('input[name="password"]').type(rider.password);
    cy.get('button[type="submit"]').click();
    cy.wait('@loginRequest');
  });
});

Cypress.Commands.add('loginAsDriver', () => {
  cy.fixture('users').then(({ driver }) => {
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: { success: true, data: { user: driver, accessToken: 'mock-access-token' } },
    }).as('loginRequest');

    cy.visit(`${Cypress.env('driverUrl')}/auth/login`);
    cy.get('input[name="email"]').type(driver.email);
    cy.get('input[name="password"]').type(driver.password);
    cy.get('button[type="submit"]').click();
    cy.wait('@loginRequest');
  });
});

Cypress.Commands.add('loginAsAdmin', () => {
  cy.fixture('users').then(({ admin }) => {
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: { success: true, data: { user: admin, accessToken: 'mock-access-token' } },
    }).as('loginRequest');

    cy.visit(`${Cypress.env('adminUrl')}/login`);
    cy.get('input[name="email"]').type(admin.email);
    cy.get('input[name="password"]').type(admin.password);
    cy.get('button[type="submit"]').click();
    cy.wait('@loginRequest');
  });
});
