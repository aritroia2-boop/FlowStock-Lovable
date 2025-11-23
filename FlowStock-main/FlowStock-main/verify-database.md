# Database Verification Guide

This guide helps verify that the database policies are correctly configured and the infinite recursion issue is resolved.

## What Was Fixed

### Problem
The application had infinite recursion errors when creating restaurants due to circular dependencies in Row Level Security (RLS) policies:
- Restaurant INSERT policies checked profile data
- Profile SELECT policies checked restaurant data
- This created an infinite loop

### Solution
1. **Security Definer Functions**: Created helper functions that bypass RLS to prevent recursion
   - `get_my_restaurant_id()` - Gets current user's restaurant_id without triggering RLS
   - `i_own_restaurant(uuid)` - Checks if user owns a specific restaurant

2. **Simplified Policies**: Removed all circular dependencies
   - Profile policies now use security definer functions
   - Restaurant policies check owner_id directly without subqueries
   - No policy queries the same table recursively

3. **Enhanced Error Handling**: Added graceful error handling in the application code
   - Better error messages for users
   - Fallback to basic user data if profile fetch fails
   - Detailed logging for debugging

## Database Tables

### profiles
- `id` (uuid, primary key) - References auth.users.id
- `name` (text) - User's full name
- `email` (text) - User's email
- `role` (text) - User role: 'owner', 'employee', or 'none'
- `restaurant_id` (uuid, nullable) - Reference to restaurant
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### restaurants
- `id` (uuid, primary key)
- `name` (text) - Restaurant name
- `address` (text) - Restaurant address
- `phone` (text) - Restaurant phone number
- `logo_url` (text, nullable) - Logo image URL
- `owner_id` (uuid) - References profiles.id
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### teams
- `id` (uuid, primary key)
- `restaurant_id` (uuid) - References restaurants.id
- `name` (text) - Team name
- `description` (text, nullable) - Team description
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### team_members
- `id` (uuid, primary key)
- `team_id` (uuid) - References teams.id
- `profile_id` (uuid) - References profiles.id
- `role` (text) - Team member role
- `created_at` (timestamptz)

## RLS Policies

### Profile Policies
1. **profile_select_own** - Users can view their own profile
2. **profile_select_same_restaurant** - Users can view profiles in their restaurant
3. **profile_update_own** - Users can update their own profile
4. **profile_update_employees** - Restaurant owners can update employee profiles

### Restaurant Policies
1. **restaurant_insert_as_owner** - Authenticated users can create restaurants
2. **restaurant_select_own** - Users can view restaurants they own
3. **restaurant_select_assigned** - Users can view their assigned restaurant
4. **restaurant_update_own** - Owners can update their restaurant
5. **restaurant_delete_own** - Owners can delete their restaurant

## Testing Checklist

### 1. User Signup
- [ ] New users can create accounts
- [ ] Profile is automatically created
- [ ] User has role='none' by default

### 2. Restaurant Creation
- [ ] User with role='none' can create a restaurant
- [ ] User becomes restaurant owner after creation
- [ ] Restaurant appears in settings page
- [ ] No infinite recursion errors

### 3. Employee Management
- [ ] Restaurant owner can add employees
- [ ] Employees can view their restaurant
- [ ] Owner can update employee profiles
- [ ] Owner can remove employees

### 4. Team Management
- [ ] Owner can create teams
- [ ] Owner can add members to teams
- [ ] Owner can update team member roles
- [ ] Owner can delete teams

### 5. Data Access Control
- [ ] Users can only view their own profile or profiles in their restaurant
- [ ] Users can only update their own profile
- [ ] Restaurant owners can only update their own restaurant
- [ ] Employees cannot access other restaurants' data

## Common Issues and Solutions

### Issue: "infinite recursion detected in policy"
**Solution**: Applied in latest migration. The security definer functions break the recursion chain.

### Issue: "permission denied for table"
**Solution**: Check that RLS policies are correctly applied. User must be authenticated.

### Issue: Profile not found after signup
**Solution**: The `handle_new_user()` trigger automatically creates profiles. If missing, check trigger is active.

### Issue: Cannot create restaurant
**Solution**: Verify user is authenticated and has a valid profile. Check browser console for detailed errors.

## Application Features

### Restaurant Management
- Create restaurant with name, address, phone, and optional logo
- Update restaurant information
- View restaurant details
- Delete restaurant (removes all associated data)

### Employee Management
- Invite employees by email (they must have an account)
- View all employees in the restaurant
- Remove employees from the restaurant
- Employees automatically get role='employee'

### Team Management
- Create specialized teams (e.g., Kitchen Staff, Waiters)
- Add team descriptions
- Assign employees to teams with specific roles
- Update team member roles
- Remove members from teams
- Delete entire teams

### Inventory Management
- Add ingredients with quantities and units
- Track low stock items
- Update ingredient quantities
- View inventory history through audit logs

### Recipe Management
- Create recipes with detailed instructions
- Add ingredients to recipes with quantities
- Upload recipe images
- Prepare recipes (deducts ingredients from inventory)
- View recipe details in a modal

### Audit Logs
- Track all inventory changes
- View who made changes and when
- Filter by date, user, and operation type
- Searchable audit trail

## Security Best Practices

1. **Row Level Security**: All tables have RLS enabled
2. **No Broad Access**: No policies use `USING (true)`
3. **Authentication Required**: All policies require authenticated users
4. **Ownership Checks**: Policies verify ownership before allowing access
5. **Security Definer Functions**: Used carefully to break recursion without compromising security

## Next Steps

If you encounter any issues:

1. Check browser console for detailed error messages
2. Review the RLS policies in Supabase dashboard
3. Verify user authentication status
4. Check that migrations were applied in order
5. Ensure security definer functions exist and are executable

## Support

For additional help:
- Check the application logs in browser console
- Review Supabase logs in the dashboard
- Verify database schema matches expectations
- Test with a fresh user account
