import { supabase } from './supabase';

export type RestaurantRole = 'manager' | 'supervisor' | 'member' | 'none';
export type ViewContext = 'personal' | 'restaurant';

export interface PermissionFlags {
  canManageTeam: boolean;
  canEditRestaurant: boolean;
  canAddIngredients: boolean;
  canEditIngredients: boolean;
  canDeleteIngredients: boolean;
  canAddRecipes: boolean;
  canEditRecipes: boolean;
  canDeleteRecipes: boolean;
  isReadOnly: boolean;
}

export const getContextualPermissions = (role: RestaurantRole, context: ViewContext): PermissionFlags => {
  if (context === 'personal') {
    return {
      canManageTeam: role === 'manager',
      canEditRestaurant: role === 'manager',
      canAddIngredients: true,
      canEditIngredients: true,
      canDeleteIngredients: true,
      canAddRecipes: true,
      canEditRecipes: true,
      canDeleteRecipes: true,
      isReadOnly: false,
    };
  }

  switch (role) {
    case 'manager':
      return {
        canManageTeam: true,
        canEditRestaurant: true,
        canAddIngredients: true,
        canEditIngredients: true,
        canDeleteIngredients: true,
        canAddRecipes: true,
        canEditRecipes: true,
        canDeleteRecipes: true,
        isReadOnly: false,
      };

    case 'supervisor':
      return {
        canManageTeam: false,
        canEditRestaurant: false,
        canAddIngredients: true,
        canEditIngredients: true,
        canDeleteIngredients: false,
        canAddRecipes: true,
        canEditRecipes: true,
        canDeleteRecipes: false,
        isReadOnly: false,
      };

    case 'member':
      return {
        canManageTeam: false,
        canEditRestaurant: false,
        canAddIngredients: false,
        canEditIngredients: false,
        canDeleteIngredients: false,
        canAddRecipes: false,
        canEditRecipes: false,
        canDeleteRecipes: false,
        isReadOnly: true,
      };

    case 'none':
    default:
      return {
        canManageTeam: false,
        canEditRestaurant: false,
        canAddIngredients: false,
        canEditIngredients: false,
        canDeleteIngredients: false,
        canAddRecipes: false,
        canEditRecipes: false,
        canDeleteRecipes: false,
        isReadOnly: true,
      };
  }
};

export const getPermissionsForRole = (role: RestaurantRole): PermissionFlags => {
  return getContextualPermissions(role, 'restaurant');
};

export const getUserRestaurantRole = async (userId: string, restaurantId?: string): Promise<RestaurantRole> => {
  if (!restaurantId) {
    return 'none';
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, restaurant_id')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    return 'none';
  }

  if (profile.role === 'owner' && profile.restaurant_id === restaurantId) {
    return 'manager';
  }

  if (profile.role === 'employee' && profile.restaurant_id === restaurantId) {
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('role, teams!inner(restaurant_id)')
      .eq('profile_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (teamMember) {
      const teamRole = teamMember.role?.toLowerCase();
      if (teamRole === 'supervisor') {
        return 'supervisor';
      }
    }

    return 'member';
  }

  return 'none';
};

export const getRoleDisplayName = (role: RestaurantRole): string => {
  switch (role) {
    case 'manager':
      return 'Manager';
    case 'supervisor':
      return 'Supervisor';
    case 'member':
      return 'Member';
    case 'none':
    default:
      return 'No Role';
  }
};

export const getRoleDescription = (role: RestaurantRole): string => {
  switch (role) {
    case 'manager':
      return 'Full access to all restaurant features and team management';
    case 'supervisor':
      return 'Can add and edit restaurant items, but cannot delete or manage team';
    case 'member':
      return 'View-only access to restaurant items. Full access to personal items';
    case 'none':
    default:
      return 'No restaurant access. Full access to personal items';
  }
};

export const getRoleColor = (role: RestaurantRole): { bg: string; text: string; border: string } => {
  switch (role) {
    case 'manager':
      return {
        bg: 'from-blue-500 to-cyan-400',
        text: 'text-blue-600',
        border: 'border-blue-300'
      };
    case 'supervisor':
      return {
        bg: 'from-purple-500 to-pink-400',
        text: 'text-purple-600',
        border: 'border-purple-300'
      };
    case 'member':
      return {
        bg: 'from-green-500 to-emerald-400',
        text: 'text-green-600',
        border: 'border-green-300'
      };
    case 'none':
    default:
      return {
        bg: 'from-slate-400 to-slate-500',
        text: 'text-slate-600',
        border: 'border-slate-300'
      };
  }
};
