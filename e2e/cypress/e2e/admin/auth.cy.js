const ADMIN_URL = Cypress.env('adminUrl');

describe('Admin — Authentication', () => {
  beforeEach(() => cy.clearLocalStorage());

  describe('Login page', () => {
    beforeEach(() => cy.visit(`${ADMIN_URL}/login`));

    it('renders the admin login form', () => {
      cy.contains('Admin Panel');
      cy.contains('Sign in to your admin account');
      cy.get('input[name="email"]').should('exist');
      cy.get('input[name="password"]').should('exist');
      cy.get('button[type="submit"]').contains('Sign In');
    });

    it('toggles password visibility', () => {
      cy.get('input[name="password"]').should('have.attr', 'type', 'password');
      cy.get('button[type="button"]').click();
      cy.get('input[name="password"]').should('have.attr', 'type', 'text');
    });

    it('redirects to /dashboard on successful admin login', () => {
      cy.intercept('GET', '**/api/rides**', {
        statusCode: 200,
        body: { success: true, data: { rides: [], total: 0 } },
      });
      cy.intercept('GET', '**/api/payments/revenue**', {
        statusCode: 200,
        body: { success: true, data: { total: 0, count: 0, avgFare: 0 } },
      });

      cy.fixture('users').then(({ admin }) => {
        cy.intercept('POST', '**/api/auth/login', {
          statusCode: 200,
          body: { success: true, data: { user: admin, accessToken: 'mock-token' } },
        }).as('login');

        cy.get('input[name="email"]').type(admin.email);
        cy.get('input[name="password"]').type(admin.password);
        cy.get('button[type="submit"]').click();
        cy.wait('@login');
        cy.url().should('include', '/dashboard');
      });
    });

    it('rejects login with a non-admin account', () => {
      cy.fixture('users').then(({ rider }) => {
        cy.intercept('POST', '**/api/auth/login', {
          statusCode: 200,
          body: { success: true, data: { user: rider, accessToken: 'mock-token' } },
        }).as('loginRider');

        cy.get('input[name="email"]').type(rider.email);
        cy.get('input[name="password"]').type(rider.password);
        cy.get('button[type="submit"]').click();
        cy.wait('@loginRider');
        cy.contains('Admin access required').should('be.visible');
        cy.url().should('not.include', '/dashboard');
      });
    });

    it('shows error toast on wrong credentials', () => {
      cy.intercept('POST', '**/api/auth/refresh', {
        statusCode: 200,
        body: { success: true, data: { accessToken: 'refreshed-token' } },
      });
      cy.intercept('POST', '**/api/auth/login', {
        statusCode: 401,
        body: { success: false, message: 'Invalid credentials' },
      }).as('loginFail');

      cy.get('input[name="email"]').type('wrong@test.com');
      cy.get('input[name="password"]').type('wrongpassword');
      cy.get('button[type="submit"]').click();
      cy.wait('@loginFail');
      cy.contains('Invalid credentials').should('be.visible');
    });

    it('disables submit while loading', () => {
      cy.intercept('POST', '**/api/auth/login', (req) => {
        req.reply({ delay: 500, statusCode: 200, body: { success: true, data: { user: {}, accessToken: '' } } });
      });

      cy.get('input[name="email"]').type('admin@test.com');
      cy.get('input[name="password"]').type('Password1!');
      cy.get('button[type="submit"]').click();
      cy.get('button[type="submit"]').should('be.disabled');
    });
  });

  describe('Root redirect', () => {
    it('redirects unauthenticated user from / to /login', () => {
      cy.clearLocalStorage();
      cy.visit(ADMIN_URL);
      cy.url().should('include', '/login');
    });

    it('redirects authenticated admin from / to /dashboard', () => {
      cy.fixture('users').then(({ admin }) => {
        cy.visit(ADMIN_URL, {
          onBeforeLoad(win) {
            win.localStorage.setItem(
              'admin-auth',
              JSON.stringify({ state: { user: admin, isAuthenticated: true }, version: 0 })
            );
          },
        });
        cy.url().should('include', '/dashboard');
      });
    });
  });
});
