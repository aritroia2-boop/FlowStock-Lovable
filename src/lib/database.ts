import { supabase, Ingredient, Recipe, RecipeIngredient, AuditLog, Team, TeamMember, Profile, Notification } from './supabase';

export type { Ingredient, Recipe, RecipeIngredient, AuditLog, Team, TeamMember, Profile, Notification };

export const restaurantService = {
  async leaveRestaurant() {
    const { error } = await supabase.rpc('leave_restaurant');
    if (error) throw error;
  },

  async deleteRestaurant(restaurantId: string) {
    console.log('[deleteRestaurant] Starting deletion for restaurant:', restaurantId);

    const { data, error } = await supabase.rpc('delete_restaurant', {
      p_restaurant_id: restaurantId
    });

    console.log('[deleteRestaurant] RPC response:', { data, error });

    if (error) {
      console.error('[deleteRestaurant] RPC error:', error);
      throw error;
    }

    const { data: verifyData, error: verifyError } = await supabase
      .from('restaurants')
      .select('id')
      .eq('id', restaurantId)
      .maybeSingle();

    console.log('[deleteRestaurant] Verification query:', { verifyData, verifyError });

    if (verifyData) {
      throw new Error('Restaurant deletion failed: Restaurant still exists in database after delete operation');
    }

    console.log('[deleteRestaurant] Deletion verified successfully');
  }
};

export const ingredientsService = {
  async getAll() {
    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .order('name');

    if (error) throw error;
    return data as Ingredient[];
  },

  async getPersonal() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('owner_id', user.id)
      .or('restaurant_id.is.null,is_shared.eq.false')
      .order('name');

    if (error) throw error;
    return data as Ingredient[];
  },

  async getRestaurant(restaurantId: string) {
    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_shared', true)
      .order('name');

    if (error) throw error;
    return data as Ingredient[];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as Ingredient | null;
  },

  async create(ingredient: Omit<Ingredient, 'id' | 'created_at' | 'updated_at'>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const ingredientWithOwner = {
      ...ingredient,
      owner_id: user.id,
      restaurant_id: ingredient.restaurant_id || null,
      is_shared: ingredient.is_shared || false
    };

    const { data, error } = await supabase
      .from('ingredients')
      .insert([ingredientWithOwner])
      .select()
      .single();

    if (error) throw error;
    return data as Ingredient;
  },

  async update(id: string, updates: Partial<Ingredient>) {
    const { data, error } = await supabase
      .from('ingredients')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Ingredient;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('ingredients')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async adjustQuantity(id: string, change: number, operation: string, userName: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const ingredient = await this.getById(id);
    if (!ingredient) throw new Error('Ingredient not found');

    const newQuantity = ingredient.quantity + change;
    const updated = await this.update(id, { quantity: newQuantity });

    await auditLogsService.create({
      user_id: user.id,
      user_name: userName,
      operation,
      table_name: 'ingredients',
      record_id: id,
      old_values: { quantity: ingredient.quantity, name: ingredient.name },
      new_values: { quantity: newQuantity, name: ingredient.name }
    });

    return updated;
  }
};

export const recipesService = {
  async getAll() {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .order('name');

    if (error) throw error;
    return data as Recipe[];
  },

  async getPersonal() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('owner_id', user.id)
      .or('restaurant_id.is.null,is_shared.eq.false')
      .order('name');

    if (error) throw error;
    return data as Recipe[];
  },

  async getRestaurant(restaurantId: string) {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_shared', true)
      .order('name');

    if (error) throw error;
    return data as Recipe[];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as Recipe | null;
  },

  async create(recipe: Omit<Recipe, 'id' | 'created_at' | 'updated_at'>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const recipeWithOwner = {
      ...recipe,
      owner_id: user.id,
      restaurant_id: recipe.restaurant_id || null,
      is_shared: recipe.is_shared || false
    };

    const { data, error } = await supabase
      .from('recipes')
      .insert([recipeWithOwner])
      .select()
      .single();

    if (error) throw error;
    return data as Recipe;
  },

  async update(id: string, updates: Partial<Recipe>) {
    const { data, error } = await supabase
      .from('recipes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Recipe;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};

export const recipeIngredientsService = {
  async getByRecipeId(recipeId: string) {
    const { data, error } = await supabase
      .from('recipe_ingredients')
      .select(`
        *,
        ingredient:ingredients(*)
      `)
      .eq('recipe_id', recipeId);

    if (error) throw error;
    return data;
  },

  async create(recipeIngredient: Omit<RecipeIngredient, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('recipe_ingredients')
      .insert([recipeIngredient])
      .select()
      .single();

    if (error) throw error;
    return data as RecipeIngredient;
  },

  async update(id: string, updates: Partial<RecipeIngredient>) {
    const { data, error } = await supabase
      .from('recipe_ingredients')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as RecipeIngredient;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async deleteByRecipeId(recipeId: string) {
    const { error } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', recipeId);

    if (error) throw error;
  }
};

export const auditLogsService = {
  async getAll(limit = 100) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data as AuditLog[];
  },

  async create(log: Omit<AuditLog, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('audit_logs')
      .insert([log])
      .select()
      .single();

    if (error) throw error;
    return data as AuditLog;
  }
};

export const teamsService = {
  async getAll(restaurantId: string) {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('name');

    if (error) throw error;
    return data as Team[];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as Team | null;
  },

  async create(team: Omit<Team, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('teams')
      .insert([team])
      .select()
      .single();

    if (error) throw error;
    return data as Team;
  },

  async update(id: string, updates: Partial<Omit<Team, 'id' | 'created_at' | 'updated_at' | 'restaurant_id'>>) {
    const { data, error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Team;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};

export const teamMembersService = {
  async getByTeamId(teamId: string) {
    const { data, error } = await supabase
      .from('team_members')
      .select('*, profiles:profile_id(id, name, email, role)')
      .eq('team_id', teamId)
      .order('created_at');

    if (error) throw error;
    return data as (TeamMember & { profiles: Profile })[];
  },

  async getByProfileId(profileId: string) {
    const { data, error } = await supabase
      .from('team_members')
      .select('*, teams:team_id(id, name, description, restaurant_id)')
      .eq('profile_id', profileId)
      .order('created_at');

    if (error) throw error;
    return data as (TeamMember & { teams: Team })[];
  },

  async getByRestaurantId(restaurantId: string) {
    const { data, error } = await supabase
      .from('team_members')
      .select(`
        *,
        profiles:profile_id(id, name, email, role),
        teams:team_id(id, name, description, restaurant_id)
      `)
      .eq('teams.restaurant_id', restaurantId);

    if (error) throw error;
    return data as (TeamMember & { profiles: Profile; teams: Team })[];
  },

  async addMember(teamMember: Omit<TeamMember, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('team_members')
      .insert([teamMember])
      .select()
      .single();

    if (error) throw error;
    return data as TeamMember;
  },

  async updateRole(id: string, role: string) {
    const { data, error } = await supabase
      .from('team_members')
      .update({ role })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as TeamMember;
  },

  async removeMember(id: string) {
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async removeMemberFromTeam(teamId: string, profileId: string) {
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('profile_id', profileId);

    if (error) throw error;
  },

  async addMemberToTeam(teamId: string, profileId: string, role: string) {
    console.log('teamMembersService.addMemberToTeam called with:', { teamId, profileId, role });

    const { data, error } = await supabase
      .from('team_members')
      .insert([{
        team_id: teamId,
        profile_id: profileId,
        role: role,
        status: 'active'
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase error in addMemberToTeam:', error);
      throw error;
    }

    console.log('Team member added successfully:', data);
    return data as TeamMember;
  }
};

export const notificationsService = {
  async getMyNotifications(limit = 50) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data as Notification[];
  },

  async getUnreadCount() {
    const { data, error } = await supabase.rpc('get_unread_notification_count');

    if (error) throw error;
    return data as number;
  },

  async markAsRead(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId);

    if (error) throw error;
  },

  async markAllAsRead() {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null);

    if (error) throw error;
  },

  async acceptTeamInvite(notificationId: string, teamId: string) {
    const { data: notification, error: notifError } = await supabase
      .from('notifications')
      .select('metadata')
      .eq('id', notificationId)
      .single();

    if (notifError) throw notifError;

    const role = notification?.metadata?.role || 'member';

    const { error: memberError } = await supabase
      .from('team_members')
      .insert([{
        team_id: teamId,
        profile_id: (await supabase.auth.getUser()).data.user?.id,
        role: role,
        status: 'active'
      }]);

    if (memberError) throw memberError;

    const { error: updateError } = await supabase
      .from('notifications')
      .update({
        status: 'accepted',
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId);

    if (updateError) throw updateError;
  },

  async declineTeamInvite(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({
        status: 'declined',
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId);

    if (error) throw error;
  },

  async sendTeamInvite(recipientId: string, teamId: string, role: string) {
    const { data, error } = await supabase.rpc('create_team_invite_notification', {
      p_recipient_id: recipientId,
      p_team_id: teamId,
      p_role: role
    });

    if (error) {
      const errorMessage = error.message || 'Failed to send team invitation';
      throw new Error(errorMessage);
    }
    return data;
  },

  subscribeToNotifications(userId: string, callback: (notification: Notification) => void) {
    const subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`
        },
        (payload) => {
          callback(payload.new as Notification);
        }
      )
      .subscribe();

    return subscription;
  },

  async clearPendingTeamInvites() {
    const { error } = await supabase
      .from('notifications')
      .update({ status: 'cancelled', read_at: new Date().toISOString() })
      .eq('type', 'team_invite')
      .eq('status', 'pending');

    if (error) throw error;
  }
};
