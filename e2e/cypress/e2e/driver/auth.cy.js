const DRIVER_URL = Cypress.env('driverUrl');

describe('Driver — Authentication', () => {
  beforeEach(() => cy.clearLocalStorage());

  describe('Login page', () => {
    beforeEach(() => cy.visit(`${DRIVER_URL}/auth/login`));

    it('renders the driver login form', () => {
      cy.contains('Sign in to your driver account');
      cy.get('input[name="email"]').should('exist');
      cy.get('input[name="password"]').should('exist');
      cy.get('button[type="submit"]').contains('Sign In');
    });

    it('links to the register page', () => {
      cy.contains('Sign up').click();
      cy.url().should('include', '/auth/register');
    });

    it('redirects to /dashboard on successful driver login', () => {
      cy.fixture('users').then(({ driver }) => {
        cy.intercept('POST', '**/api/auth/login', {
          statusCode: 200,
          body: { success: true, data: { user: driver, accessToken: 'mock-token' } },
        }).as('login');

        cy.get('input[name="email"]').type(driver.email);
        cy.get('input[name="password"]').type(driver.password);
        cy.get('button[type="submit"]').click();
        cy.wait('@login');
        cy.url().should('include', '/dashboard');
      });
    });

    it('rejects login with a non-driver account', () => {
      cy.fixture('users').then(({ rider }) => {
        cy.intercept('POST', '**/api/auth/login', {
          statusCode: 200,
          body: { success: true, data: { user: rider, accessToken: 'mock-token' } },
        }).as('loginRider');

        cy.get('input[name="email"]').type(rider.email);
        cy.get('input[name="password"]').type(rider.password);
        cy.get('button[type="submit"]').click();
        cy.wait('@loginRider');
        cy.contains('driver account').should('be.visible');
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

      cy.get('input[name="email"]').type('bad@test.com');
      cy.get('input[name="password"]').type('wrongpassword');
      cy.get('button[type="submit"]').click();
      cy.wait('@loginFail');
      cy.contains('Invalid credentials').should('be.visible');
    });
  });

  describe('Register page', () => {
    beforeEach(() => cy.visit(`${DRIVER_URL}/auth/register`));

    it('renders the driver registration form', () => {
      cy.contains('Create your driver account');
      cy.get('input[name="name"]').should('exist');
      cy.get('input[name="email"]').should('exist');
      cy.get('input[name="password"]').should('exist');
    });

    it('redirects to /dashboard on successful driver registration', () => {
      cy.fixture('users').then(({ driver }) => {
        cy.intercept('POST', '**/api/auth/register', {
          statusCode: 201,
          body: { success: true, data: { user: driver, accessToken: 'mock-token' } },
        }).as('register');

        cy.contains('button', '🚕 Driver').click();
        cy.get('input[name="name"]').type(driver.name);
        cy.get('input[name="email"]').type(driver.email);
        cy.get('input[name="password"]').type(driver.password);
        cy.get('button[type="submit"]').click();
        cy.wait('@register');
        cy.url().should('include', '/dashboard');
      });
    });
  });
});
