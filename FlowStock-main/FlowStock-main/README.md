# FlowStock - Restaurant Inventory Management System

A comprehensive restaurant management application with inventory tracking, recipe management, team collaboration, and audit logging.

## Features

### Restaurant Management
- Create and manage restaurant profiles
- Upload restaurant logos
- Track restaurant details (name, address, phone)
- Owner dashboard with full control

### Employee & Team Management
- Invite employees to your restaurant
- Create specialized teams (Kitchen Staff, Waiters, etc.)
- Assign roles to team members (Manager, Supervisor, Member, Trainee)
- View all team members and their assignments

### Inventory Management
- Track ingredients with quantities and units
- Low stock alerts and filtering
- Quick quantity adjustments
- Real-time inventory updates
- Support for multiple unit types (kg, g, L, mL, pieces, etc.)

### Recipe Management
- Create recipes with detailed instructions
- Add ingredients with precise quantities
- Upload recipe images
- One-click recipe preparation (auto-deducts from inventory)
- View comprehensive recipe details

### Audit Logging
- Complete history of all inventory changes
- Track who made changes and when
- Filter by date, operation type, and user
- Searchable audit trail
- Export capabilities

## Technology Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Build Tool**: Vite
- **Authentication**: Supabase Auth with email/password

## Database Schema

### Core Tables
- **profiles** - User profiles with roles (owner, employee, none)
- **restaurants** - Restaurant information
- **teams** - Team organization within restaurants
- **team_members** - Team membership and roles
- **ingredients** - Inventory items
- **recipes** - Recipe definitions
- **recipe_ingredients** - Recipe-ingredient relationships
- **audit_logs** - Inventory change history

### Security
- Row Level Security (RLS) enabled on all tables
- Security definer functions to prevent recursion
- Policies ensure users can only access their own restaurant's data
- Owners have full control over their restaurant
- Employees have read-only access to inventory and recipes

## Getting Started

### Prerequisites
- Node.js 18+ installed
- Supabase account
- Environment variables configured

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables in `.env`:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Build for production:
   ```bash
   npm run build
   ```

## Usage Guide

### First Time Setup

1. **Sign Up**: Create a new account with your name, email, and password
2. **Create Restaurant**: Go to Settings and create your restaurant profile
3. **Add Employees**: Invite team members by their email (they must have accounts)
4. **Create Teams**: Organize employees into specialized teams
5. **Add Inventory**: Start adding ingredients to track
6. **Create Recipes**: Build your recipe library

### Daily Operations

1. **Check Inventory**: View low stock items on the dashboard
2. **Update Quantities**: Adjust inventory as needed
3. **Prepare Recipes**: One-click recipe preparation automatically deducts ingredients
4. **View Audit Logs**: Track all changes for accountability
5. **Manage Team**: Add/remove employees, update team assignments

## Key Features Explained

### Security Definer Functions
The application uses PostgreSQL security definer functions to prevent infinite recursion in RLS policies:
- `get_my_restaurant_id()` - Gets current user's restaurant without triggering RLS
- `i_own_restaurant(uuid)` - Checks restaurant ownership efficiently

### Unit Conversion
Built-in unit converter supports:
- Weight: kg, g, mg
- Volume: L, mL
- Count: pieces, items, units
- Portions, servings

### Recipe Preparation
When preparing a recipe:
1. System checks if all ingredients are available
2. Calculates required quantities
3. Deducts from inventory
4. Creates audit log entries
5. Updates ingredient quantities

## Database Migrations

All migrations are in `supabase/migrations/` and are applied in chronological order:
1. Core table creation (profiles, restaurants, teams)
2. Recipe and inventory tables
3. Audit logging setup
4. Security policy configuration
5. Recursion fix with security definer functions

See `verify-database.md` for detailed database documentation.

## Troubleshooting

### Cannot Create Restaurant
- Verify you're logged in
- Check browser console for errors
- Ensure you don't already have a restaurant
- Try refreshing the page

### Cannot Add Employee
- Employee must have an account first
- Employee cannot already be assigned to a restaurant
- Check that you're the restaurant owner

### Inventory Not Updating
- Verify you have permission to update
- Check that the ingredient exists
- Review audit logs for changes
- Refresh the page if data seems stale

### Profile Errors
- Log out and log back in
- Clear browser cache
- Check Supabase connection
- Verify environment variables are correct

## Development

### Project Structure
```
src/
├── components/       # React components
│   ├── Dashboard.tsx
│   ├── InventoryPage.tsx
│   ├── RecipesPage.tsx
│   ├── AuditLogPage.tsx
│   ├── SettingsPage.tsx
│   └── LoginPage.tsx
├── context/         # React context providers
│   └── AppContext.tsx
├── lib/            # Utility libraries
│   ├── auth.ts
│   ├── database.ts
│   ├── supabase.ts
│   └── unitConverter.ts
└── assets/         # Static assets
```

### Code Quality
- TypeScript for type safety
- ESLint for code quality
- Proper error handling throughout
- Comprehensive logging for debugging

## Security

- All sensitive operations require authentication
- Row Level Security prevents unauthorized data access
- Passwords are never stored in plaintext
- API keys are kept in environment variables
- XSS protection through React
- CSRF protection through Supabase

## Contributing

This is a production-ready restaurant management system. All core features are implemented and tested.

## License

Proprietary - All rights reserved

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review `verify-database.md` for database issues
3. Check browser console for detailed errors
4. Review Supabase dashboard for database logs
