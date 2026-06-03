const RIDER_URL = Cypress.env('riderUrl');

describe('Rider — Authentication', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
  });

  // ─── Login page ─────────────────────────────────────────────────────────────

  describe('Login page', () => {
    beforeEach(() => cy.visit(`${RIDER_URL}/auth/login`));

    it('renders the login form', () => {
      cy.contains('Sign in to your rider account');
      cy.get('input[name="email"]').should('exist');
      cy.get('input[name="password"]').should('exist');
      cy.get('button[type="submit"]').contains('Sign In');
    });

    it('links to the register page', () => {
      cy.contains('Sign up').click();
      cy.url().should('include', '/auth/register');
    });

    it('toggles password visibility', () => {
      cy.get('input[name="password"]').should('have.attr', 'type', 'password');
      cy.get('button[type="button"]').click();
      cy.get('input[name="password"]').should('have.attr', 'type', 'text');
    });

    it('redirects to /dashboard on successful login', () => {
      cy.fixture('users').then(({ rider }) => {
        cy.intercept('POST', '**/api/auth/login', {
          statusCode: 200,
          body: { success: true, data: { user: rider, accessToken: 'mock-token' } },
        }).as('login');

        cy.get('input[name="email"]').type(rider.email);
        cy.get('input[name="password"]').type(rider.password);
        cy.get('button[type="submit"]').click();
        cy.wait('@login');
        cy.url().should('include', '/dashboard');
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

    it('disables the submit button while loading', () => {
      cy.intercept('POST', '**/api/auth/login', (req) => {
        req.reply({ delay: 500, statusCode: 200, body: { success: true, data: { user: {}, accessToken: '' } } });
      }).as('slowLogin');

      cy.get('input[name="email"]').type('rider@test.com');
      cy.get('input[name="password"]').type('Password1!');
      cy.get('button[type="submit"]').click();
      cy.get('button[type="submit"]').should('be.disabled');
    });
  });

  // ─── Register page ───────────────────────────────────────────────────────────

  describe('Register page', () => {
    beforeEach(() => cy.visit(`${RIDER_URL}/auth/register`));

    it('renders the registration form', () => {
      cy.contains('Create your account');
      cy.get('input[name="name"]').should('exist');
      cy.get('input[name="email"]').should('exist');
      cy.get('input[name="password"]').should('exist');
      cy.get('button[type="submit"]').contains('Create Account');
    });

    it('links back to the login page', () => {
      cy.contains('Sign in').click();
      cy.url().should('include', '/auth/login');
    });

    it('defaults to rider role', () => {
      cy.contains('button', '🚗 Rider').should('have.class', 'border-primary-500');
    });

    it('switches role to driver', () => {
      cy.contains('button', '🚕 Driver').click();
      cy.contains('button', '🚕 Driver').should('have.class', 'border-primary-500');
    });

    it('redirects to /dashboard on successful registration', () => {
      cy.fixture('users').then(({ rider }) => {
        cy.intercept('POST', '**/api/auth/register', {
          statusCode: 201,
          body: { success: true, data: { user: rider, accessToken: 'mock-token' } },
        }).as('register');

        cy.get('input[name="name"]').type(rider.name);
        cy.get('input[name="email"]').type(rider.email);
        cy.get('input[name="password"]').type(rider.password);
        cy.get('button[type="submit"]').click();
        cy.wait('@register');
        cy.url().should('include', '/dashboard');
      });
    });

    it('shows error on registration failure', () => {
      cy.intercept('POST', '**/api/auth/register', {
        statusCode: 409,
        body: { success: false, message: 'Email already in use' },
      }).as('registerFail');

      cy.get('input[name="name"]').type('Test');
      cy.get('input[name="email"]').type('existing@test.com');
      cy.get('input[name="password"]').type('Password1!');
      cy.get('button[type="submit"]').click();
      cy.wait('@registerFail');
      cy.contains('Email already in use').should('be.visible');
    });
  });
});
