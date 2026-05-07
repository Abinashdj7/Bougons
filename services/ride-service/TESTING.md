# Ride Service Testing Guide

## Setup

### 1. Install Dependencies
```bash
cd services/ride-service
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Run Tests

#### All Tests
```bash
npm test
```

#### Watch Mode
```bash
npm run test:watch
```

#### With Coverage
```bash
npm test -- --coverage
```

#### Specific Test File
```bash
npm test -- fareCalculator.test.js
npm test -- ride.service.test.js
npm test -- ride.controller.test.js
npm test -- ride.routes.test.js
```

## Test Structure

### Unit Tests
- **fareCalculator.test.js** - Tests distance calculation, duration estimation, fare calculation, and surge pricing
- **ride.service.test.js** - Tests business logic (ride creation, acceptance, completion, cancellation, rating)
- **ride.controller.test.js** - Tests HTTP request handlers and status codes

### Integration Tests
- **ride.routes.test.js** - Tests complete request/response flow with authentication and validation

## Key Test Coverage

### Fare Calculator
- ✅ Distance calculation using Haversine formula
- ✅ Duration estimation
- ✅ Fare calculation with surge pricing
- ✅ Minimum fare enforcement
- ✅ Edge cases (same coordinates, negative coordinates)

### Ride Service
- ✅ Ride request creation
- ✅ Driver acceptance (prevents race conditions)
- ✅ Status transitions (arriving → in_progress → completed)
- ✅ Ride cancellation with proper authorization
- ✅ Rating submission with validation

### Controllers
- ✅ Request validation
- ✅ Authorization checks
- ✅ Error response formatting
- ✅ Proper HTTP status codes

### Routes
- ✅ Authentication middleware
- ✅ Authorization (rider/driver roles)
- ✅ Input validation with Joi
- ✅ Request pagination

## Running Tests in Development

```bash
# Start with MongoDB running locally
npm run dev

# In another terminal
npm test
```

## Expected Test Output

```
 PASS  src/utils/fareCalculator.test.js
 PASS  src/services/ride.service.test.js
 PASS  src/controllers/ride.controller.test.js
 PASS  src/routes/ride.routes.test.js

Test Suites: 4 passed, 4 total
Tests:       50+ passed, 50+ total
Time:        ~2-3s
```

## Common Issues

### Jest Not Found
```bash
npm install --save-dev jest supertest
```

### MongoDB Connection Error
- Ensure MongoDB is running on localhost:27017
- Or configure MONGO_URI in .env

### JWT Error
- Set JWT_SECRET in .env
- Tests use 'test-secret' internally

## Adding New Tests

1. Create test file: `src/path/feature.test.js`
2. Follow existing test patterns
3. Use descriptive test names
4. Mock external dependencies
5. Run: `npm test`

## Performance

All tests should complete in under 5 seconds. If slower:
- Check for unresolved promises
- Verify database is responsive
- Profile with: `npm test -- --detectOpenHandles`
