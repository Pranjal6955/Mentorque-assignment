# Mentorque - Availability Tracker

A mentorship platform that connects users with mentors based on availability, skills, and preferences.

## Credentials

All accounts use password: `password123`

### Admin

| Email | Role |
|-------|------|
| admin@mentorque.com | ADMIN |

### Mentors

| Email | Name | Tags |
|-------|------|------|
| aris.thorne@mentorque.com | Dr. Aris Thorne | Tech, Big company, Ireland, Senior Developer, Good communication |
| elena.rostova@mentorque.com | Elena Rostova | Tech, Public company, India, Senior Developer, Good communication |
| marcus.vance@mentorque.com | Marcus Vance | Tech, Big company, Ireland, Senior Developer |
| sophia.chen@mentorque.com | Sophia Chen | Non-tech, Public company, India, Good communication |
| devon.okafor@mentorque.com | Devon Okafor | Tech, Public company, Ireland, Senior Developer, Good communication |

### Users

| Email | Name | Tags |
|-------|------|------|
| alice.smith@example.com | Alice Smith | Tech, Asks a lot of questions |
| bob.johnson@example.com | Bob Johnson | Tech, Good communication |
| carol.white@example.com | Carol White | Non-tech, Good communication, Asks a lot of questions |
| david.miller@example.com | David Miller | Tech, Asks a lot of questions |
| eva.green@example.com | Eva Green | Tech, Good communication |
| frank.wright@example.com | Frank Wright | Non-tech, Asks a lot of questions |
| grace.taylor@example.com | Grace Taylor | Tech, Good communication |
| hank.adams@example.com | Hank Adams | Tech, Asks a lot of questions |
| ivy.patel@example.com | Ivy Patel | Non-tech, Good communication |
| jack.robinson@example.com | Jack Robinson | Tech, Asks a lot of questions |

## Tech Stack

- **Backend:** Node.js, Express, Prisma, PostgreSQL
- **Frontend:** React, Vite

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Get current user |
| GET | /api/availability/template | Get availability template |
| PUT | /api/availability/template | Update availability template |
| POST | /api/meetings/request | Request a meeting |
| POST | /api/meetings/:id/accept | Accept meeting |
| POST | /api/meetings/:id/reject | Reject meeting |
| GET | /api/meetings | Get user meetings |
| GET | /api/admin/users | Get all users (admin) |
| GET | /api/admin/mentors | Get all mentors (admin) |

## Environment Variables

```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
FRONTEND_URL=https://your-frontend.vercel.app
```

## Run Locally

```bash
# Install dependencies
yarn

# Setup database
npx prisma generate
npx prisma db push

# Seed database
yarn seed

# Start dev server
yarn dev
```
