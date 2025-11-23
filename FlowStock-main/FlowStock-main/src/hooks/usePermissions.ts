import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { getUserRestaurantRole, getContextualPermissions, RestaurantRole, PermissionFlags, ViewContext } from '../lib/permissions';

export interface PermissionsHook {
  restaurantRole: RestaurantRole;
  permissions: PermissionFlags;
  isLoading: boolean;
  getPermissionsForContext: (context: ViewContext) => PermissionFlags;
}

export const usePermissions = (): PermissionsHook => {
  const { currentUser } = useApp();
  const [restaurantRole, setRestaurantRole] = useState<RestaurantRole>('none');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPermissions = async () => {
      if (!currentUser?.id) {
        setRestaurantRole('none');
        setIsLoading(false);
        return;
      }

      try {
        const role = await getUserRestaurantRole(currentUser.id, currentUser.restaurant_id);
        setRestaurantRole(role);
      } catch (error) {
        console.error('Error loading permissions:', error);
        setRestaurantRole('none');
      } finally {
        setIsLoading(false);
      }
    };

    loadPermissions();
  }, [currentUser?.id, currentUser?.restaurant_id]);

  const getPermissionsForContext = useMemo(() => {
    return (context: ViewContext) => getContextualPermissions(restaurantRole, context);
  }, [restaurantRole]);

  const permissions = useMemo(() => {
    return getContextualPermissions(restaurantRole, 'restaurant');
  }, [restaurantRole]);

  return {
    restaurantRole,
    permissions,
    isLoading,
    getPermissionsForContext,
  };
};
