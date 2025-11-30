import { useState, useEffect } from 'react';
import { Building2, Users, Upload, UserPlus, Trash2, AlertCircle, CheckCircle, Store, ArrowLeft, User, Mail, Phone, MapPin, Shield, Folder, Edit, X, Plus, Lock, LogOut, Loader2, CreditCard } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { teamsService, teamMembersService, notificationsService, restaurantService, Team, TeamMember, Profile } from '../lib/database';
import { useAppContext } from '../context/AppContext';
import { usePermissions } from '../hooks/usePermissions';
import { RoleBadge } from './RoleBadge';
import { subscriptionService } from '../lib/subscriptionService';

interface Restaurant {
  id: string;
  name: string;
  address: string;
  phone: string;
  logo_url?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  restaurant_id?: string;
}

export const SettingsPage = () => {
  const { currentUser, setCurrentUser, setCurrentPage, isSubscribed, isAdmin, canAccessRestaurantFeatures } = useAppContext();
  const { restaurantRole, permissions } = usePermissions();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingRestaurant, setIsEditingRestaurant] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [restaurantFormData, setRestaurantFormData] = useState({
    name: '',
    address: '',
    phone: '',
    logo_url: ''
  });

  const [profileFormData, setProfileFormData] = useState({
    name: currentUser?.name || '',
    email: currentUser?.email || ''
  });

  const [employeeEmail, setEmployeeEmail] = useState('');
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);

  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMembers, setTeamMembers] = useState<Record<string, (TeamMember & { profiles: Profile })[]>>({});
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [selectedTeamForMember, setSelectedTeamForMember] = useState<string>('');
  const [selectedMemberRole, setSelectedMemberRole] = useState('member');
  const [addingToTeamId, setAddingToTeamId] = useState<string | null>(null);

  useEffect(() => {
    loadRestaurant();
    if (currentUser?.role === 'owner') {
      loadEmployees();
      if (currentUser?.restaurant_id) {
        loadTeams();
      }
    }
    setProfileFormData({
      name: currentUser?.name || '',
      email: currentUser?.email || ''
    });
  }, [currentUser]);

  const loadRestaurant = async () => {
    try {
      setIsLoading(true);
      setError('');

      if (currentUser?.restaurant_id) {
        const { data, error } = await supabase
          .from('restaurants')
          .select('*')
          .eq('id', currentUser.restaurant_id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setRestaurant(data);
          setRestaurantFormData({
            name: data.name,
            address: data.address,
            phone: data.phone,
            logo_url: data.logo_url || ''
          });
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      if (!currentUser?.restaurant_id) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('restaurant_id', currentUser.restaurant_id)
        .neq('id', currentUser.id);

      if (error) throw error;
      setEmployees(data || []);
    } catch (err: any) {
      console.error('Error loading employees:', err);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: profileFormData.name,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUser?.id);

      if (error) throw error;

      setCurrentUser({ ...currentUser!, name: profileFormData.name });
      setIsEditingProfile(false);
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const MAX_FILE_SIZE = 2 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        throw new Error('File size exceeds 2MB limit');
      }

      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload JPEG, PNG, or WEBP');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser?.id}-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('recipe-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('recipe-images')
        .getPublicUrl(filePath);

      setRestaurantFormData(prev => ({ ...prev, logo_url: data.publicUrl }));
      setSuccess('Logo uploaded successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleCreateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    console.log('Creating restaurant with data:', {
      name: restaurantFormData.name,
      address: restaurantFormData.address,
      phone: restaurantFormData.phone,
      currentUserId: currentUser?.id
    });

    if (!restaurantFormData.name || !restaurantFormData.address || !restaurantFormData.phone) {
      setError('Please fill in all required fields');
      return;
    }

    if (!currentUser?.id) {
      setError('User not authenticated. Please log out and log back in.');
      return;
    }

    try {
      console.log('Attempting to insert restaurant...');
      const { data: newRestaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .insert([{
          name: restaurantFormData.name,
          address: restaurantFormData.address,
          phone: restaurantFormData.phone,
          logo_url: restaurantFormData.logo_url || null,
          owner_id: currentUser.id
        }])
        .select()
        .single();

      if (restaurantError) {
        console.error('Restaurant creation error:', restaurantError);

        if (restaurantError.message.includes('recursion')) {
          throw new Error('Database configuration error. Please refresh the page and try again.');
        } else if (restaurantError.message.includes('permission denied') || restaurantError.message.includes('policy')) {
          throw new Error('You do not have permission to create a restaurant. Please contact support.');
        } else {
          throw new Error(`Failed to create restaurant: ${restaurantError.message}`);
        }
      }

      if (!newRestaurant) {
        throw new Error('Restaurant was not created. Please try again.');
      }

      console.log('Restaurant created successfully:', newRestaurant);
      console.log('Updating profile to owner...');

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          role: 'owner',
          restaurant_id: newRestaurant.id
        })
        .eq('id', currentUser.id);

      if (profileError) {
        console.error('Profile update error:', profileError);
        throw new Error(`Restaurant created but failed to update your profile. Please refresh the page.`);
      }

      console.log('Profile updated successfully');

      setRestaurant(newRestaurant);
      setCurrentUser({ ...currentUser, role: 'owner', restaurant_id: newRestaurant.id });
      setSuccess('Restaurant created successfully!');
      setTimeout(() => setSuccess(''), 3000);
      await loadRestaurant();
      await loadEmployees();
    } catch (err: any) {
      console.error('Error in handleCreateRestaurant:', err);
      setError(err.message || 'An error occurred while creating the restaurant');
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleUpdateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!restaurant) return;

    try {
      const { error } = await supabase
        .from('restaurants')
        .update({
          name: restaurantFormData.name,
          address: restaurantFormData.address,
          phone: restaurantFormData.phone,
          logo_url: restaurantFormData.logo_url || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', restaurant.id);

      if (error) throw error;

      await loadRestaurant();
      setIsEditingRestaurant(false);
      setSuccess('Restaurant updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAddEmployee = async () => {
    setError('');
    setSuccess('');
    setIsAddingEmployee(true);

    try {
      if (!employeeEmail) {
        throw new Error('Please enter an email address');
      }

      const trimmedEmail = employeeEmail.toLowerCase().trim();

      const { data: employeeData, error: findError } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', trimmedEmail)
        .maybeSingle();

      if (findError) {
        console.error('Error searching for profile:', findError);
        throw new Error(`Failed to search for user: ${findError.message}`);
      }

      if (!employeeData) {
        throw new Error('No account found with this email. The user must create an account first at the login page before they can be added to your restaurant.');
      }

      if (employeeData.id === currentUser?.id) {
        throw new Error('You cannot add yourself as an employee');
      }

      if (employeeData.restaurant_id === currentUser?.restaurant_id) {
        throw new Error('This user is already part of your restaurant');
      }

      if (employeeData.restaurant_id) {
        throw new Error(`This user is already assigned to another restaurant. They must leave their current restaurant before joining yours.`);
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          restaurant_id: currentUser?.restaurant_id,
          role: 'employee'
        })
        .eq('id', employeeData.id);

      if (updateError) {
        console.error('Error updating employee profile:', updateError);
        throw new Error(`Failed to add employee: ${updateError.message}`);
      }

      setEmployeeEmail('');
      await loadEmployees();
      setSuccess('Employee added successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsAddingEmployee(false);
    }
  };

  const handleRemoveEmployee = async (employeeId: string) => {
    if (!confirm('Are you sure you want to remove this employee?')) return;

    try {
      const { error: teamMemberError } = await supabase
        .from('team_members')
        .delete()
        .eq('profile_id', employeeId);

      if (teamMemberError) {
        console.error('Error removing team memberships:', teamMemberError);
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          restaurant_id: null,
          role: 'owner'
        })
        .eq('id', employeeId);

      if (profileError) throw profileError;

      await loadEmployees();
      await loadTeams();
      setSuccess('Employee removed successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const loadTeams = async () => {
    try {
      if (!currentUser?.restaurant_id) return;

      const teamsData = await teamsService.getAll(currentUser.restaurant_id);
      setTeams(teamsData);

      const membersData: Record<string, (TeamMember & { profiles: Profile })[]> = {};
      for (const team of teamsData) {
        const members = await teamMembersService.getByTeamId(team.id);
        membersData[team.id] = members;
      }
      setTeamMembers(membersData);
    } catch (err: any) {
      console.error('Error loading teams:', err);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim() || !currentUser?.restaurant_id) return;

    setIsCreatingTeam(true);
    try {
      await teamsService.create({
        restaurant_id: currentUser.restaurant_id,
        name: newTeamName.trim(),
        description: newTeamDescription.trim() || undefined
      });

      setNewTeamName('');
      setNewTeamDescription('');
      setShowCreateTeam(false);
      await loadTeams();
      setSuccess('Team created successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsCreatingTeam(false);
    }
  };

  const handleUpdateTeam = async (teamId: string) => {
    if (!editTeamName.trim()) return;

    try {
      await teamsService.update(teamId, { name: editTeamName.trim() });
      setEditingTeamId(null);
      setEditTeamName('');
      await loadTeams();
      setSuccess('Team updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team? This will remove all team members from the team.')) return;

    try {
      await teamsService.delete(teamId);
      await loadTeams();
      setSuccess('Team deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleAddMemberToTeam = async (employeeId: string, teamId: string, role: string) => {
    console.log('=== Adding member to team ===');
    console.log('Employee ID:', employeeId);
    console.log('Team ID:', teamId);
    console.log('Role:', role);

    if (!employeeId) {
      setError('Please select an employee');
      return;
    }

    if (!role) {
      setError('Please select a role');
      return;
    }

    const existingMember = teamMembers[teamId]?.find(tm => tm.profile_id === employeeId);
    if (existingMember) {
      console.log('Employee is already a team member:', existingMember);
      setError('Employee is already a member of this team');
      setTimeout(() => setError(''), 5000);
      return;
    }

    setAddingToTeamId(teamId);
    try {
      console.log('Calling addMemberToTeam service...');
      const result = await teamMembersService.addMemberToTeam(teamId, employeeId, role);
      console.log('Member added successfully:', result);

      await loadTeams();
      setSuccess('Employee added to team successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('=== Error adding member to team ===');
      console.error('Error object:', err);
      console.error('Error message:', err.message);
      console.error('Error details:', err.details);
      console.error('Error hint:', err.hint);
      console.error('Error code:', err.code);

      const errorMessage = err.message || err.details || err.hint || 'Failed to add employee to team';
      setError(errorMessage);
      alert(`Error adding employee to team:\n\n${errorMessage}\n\nCheck console for details.`);
      setTimeout(() => setError(''), 5000);
    } finally {
      setAddingToTeamId(null);
    }
  };

  const handleRemoveMemberFromTeam = async (teamId: string, profileId: string) => {
    if (!confirm('Remove this member from the team?')) return;

    try {
      await teamMembersService.removeMemberFromTeam(teamId, profileId);
      await loadTeams();
      setSuccess('Member removed from team!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
    try {
      await teamMembersService.updateRole(memberId, newRole);
      await loadTeams();
      setSuccess('Member role updated!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleLeaveRestaurant = async () => {
    const confirmMessage = 'Are you sure you want to leave this restaurant? You will lose access to all shared recipes and ingredients.';
    if (!confirm(confirmMessage)) return;

    try {
      console.log('Attempting to leave restaurant');
      await restaurantService.leaveRestaurant();
      console.log('Left restaurant successfully');
      setCurrentUser({ ...currentUser!, restaurant_id: null, role: 'owner' });
      setRestaurant(null);
      setSuccess('You have successfully left the restaurant');
      setTimeout(() => {
        setSuccess('');
        setCurrentPage('dashboard');
      }, 2000);
    } catch (err: any) {
      console.error('Error leaving restaurant:', err);
      const errorMessage = err.message || err.details || err.hint || 'Failed to leave restaurant';
      setError(errorMessage);
      alert(`Error leaving restaurant:\n\n${errorMessage}\n\nCheck console for details.`);
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleDeleteRestaurant = async () => {
    if (!restaurant) return;

    const confirmMessage = `Are you sure you want to DELETE "${restaurant.name}"? This action cannot be undone. All employees will be removed and all teams will be deleted.`;
    if (!confirm(confirmMessage)) return;

    const doubleConfirm = prompt(`Type "DELETE" to confirm deletion of ${restaurant.name}:`);

    console.log('Prompt returned:', doubleConfirm, 'Type:', typeof doubleConfirm);

    if (!doubleConfirm) {
      setError('Deletion cancelled.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const trimmedConfirm = doubleConfirm.trim();
    console.log('Trimmed value:', trimmedConfirm, 'Expected: DELETE');

    if (trimmedConfirm !== 'DELETE') {
      setError(`Deletion cancelled. You typed "${trimmedConfirm}" but must type exactly "DELETE" (all capitals).`);
      setTimeout(() => setError(''), 5000);
      return;
    }

    try {
      console.log('Attempting to delete restaurant:', restaurant.id);
      await restaurantService.deleteRestaurant(restaurant.id);
      console.log('Restaurant deleted successfully');
      setCurrentUser({ ...currentUser!, restaurant_id: null, role: 'owner' });
      setRestaurant(null);
      setSuccess('Restaurant deleted successfully');
      setTimeout(() => {
        setSuccess('');
        setCurrentPage('dashboard');
      }, 2000);
    } catch (err: any) {
      console.error('Error deleting restaurant:', err);
      const errorMessage = err.message || err.details || err.hint || 'Failed to delete restaurant';
      setError(errorMessage);
      alert(`Error deleting restaurant:\n\n${errorMessage}\n\nCheck console for details.`);
      setTimeout(() => setError(''), 5000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600 font-medium">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-50 min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <button
            onClick={() => setCurrentPage('dashboard')}
            className="group flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-blue-600 hover:bg-white/50 rounded-xl transition-all duration-300"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Back to Dashboard</span>
          </button>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              Settings
            </h1>
            {currentUser?.restaurant_id && <RoleBadge role={restaurantRole} size="md" />}
          </div>
          <p className="text-slate-600 text-lg">Manage your profile, restaurant, and team</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl flex items-start gap-3 shadow-sm">
            <AlertCircle size={24} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-900">Error</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-r-xl flex items-start gap-3 shadow-sm">
            <CheckCircle size={24} className="text-green-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-green-900">Success</p>
              <p className="text-green-700 text-sm">{success}</p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 to-emerald-400 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                  <User size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Personal Information</h2>
                  <p className="text-white/80 text-sm">Manage your account details</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {!isEditingProfile ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 uppercase tracking-wide">
                        <User size={16} />
                        Full Name
                      </label>
                      <p className="text-xl font-bold text-slate-900">{currentUser?.name}</p>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 uppercase tracking-wide">
                        <Mail size={16} />
                        Email Address
                      </label>
                      <p className="text-xl font-bold text-slate-900">{currentUser?.email}</p>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 uppercase tracking-wide">
                        <Shield size={16} />
                        Account Role
                      </label>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-400 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/30">
                          {currentUser?.role?.toUpperCase() || 'NONE'}
                        </span>
                        {currentUser?.restaurant_id && (
                          <RoleBadge role={restaurantRole} size="sm" showDescription={false} />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200">
                    <button
                      onClick={() => setIsEditingProfile(true)}
                      className="px-6 py-3 bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-800 hover:to-slate-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      Edit Profile
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={profileFormData.name}
                      onChange={(e) => setProfileFormData({ ...profileFormData, name: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      placeholder="Enter your full name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={profileFormData.email}
                      disabled
                      className="w-full px-4 py-3 bg-slate-100 border-2 border-slate-200 rounded-xl text-slate-500 cursor-not-allowed"
                    />
                    <p className="mt-2 text-xs text-slate-500">Email cannot be changed</p>
                  </div>

                  <div className="flex items-center gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingProfile(false);
                        setProfileFormData({
                          name: currentUser?.name || '',
                          email: currentUser?.email || ''
                        });
                      }}
                      className="flex-1 px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-semibold transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-400 text-white rounded-xl font-semibold shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 transition-all"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Subscription Section */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-pink-400 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                  <CreditCard size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Subscription</h2>
                  <p className="text-white/80 text-sm">Manage your plan and billing</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                {isAdmin ? (
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-5 h-5 text-purple-600" />
                      <p className="text-sm text-slate-600 font-medium uppercase tracking-wide">Admin Access</p>
                    </div>
                    <p className="text-xl font-bold text-slate-900">
                      Full Access Granted
                    </p>
                  </div>
                ) : isSubscribed ? (
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                    <p className="text-sm text-slate-600 font-medium uppercase tracking-wide mb-1">Current Plan</p>
                    <p className="text-3xl font-bold text-slate-900">
                      FlowStock Pro
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
                    <p className="text-sm text-slate-600 font-medium uppercase tracking-wide mb-1">Current Plan</p>
                    <p className="text-3xl font-bold text-slate-900">
                      Free
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  {!canAccessRestaurantFeatures ? (
                    <button
                      onClick={() => setCurrentPage('pricing')}
                      className="flex-1 px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-400 text-white rounded-xl font-bold shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transition-all"
                    >
                      Subscribe Now
                    </button>
                  ) : (
                    <button
                      onClick={() => setCurrentPage('pricing')}
                      className="flex-1 px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-400 text-white rounded-xl font-bold shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transition-all"
                    >
                      View Subscription
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {(currentUser?.role === 'owner' || currentUser?.role === 'none') && (
            <>
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-cyan-400 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                      <Building2 size={24} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Restaurant Information</h2>
                      <p className="text-white/80 text-sm">Manage your business details</p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {!restaurant ? (
                    <div>
                      <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-xl">
                        <p className="text-blue-900 font-medium">Set up your restaurant to unlock all features</p>
                      </div>

                      <form onSubmit={handleCreateRestaurant} className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                            Restaurant Name *
                          </label>
                          <input
                            type="text"
                            value={restaurantFormData.name}
                            onChange={(e) => setRestaurantFormData({ ...restaurantFormData, name: e.target.value })}
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            placeholder="e.g., The Golden Fork"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                            Address *
                          </label>
                          <input
                            type="text"
                            value={restaurantFormData.address}
                            onChange={(e) => setRestaurantFormData({ ...restaurantFormData, address: e.target.value })}
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            placeholder="123 Main Street, City"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                            Phone Number *
                          </label>
                          <input
                            type="tel"
                            value={restaurantFormData.phone}
                            onChange={(e) => setRestaurantFormData({ ...restaurantFormData, phone: e.target.value })}
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            placeholder="+1 (555) 123-4567"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                            Logo (Optional)
                          </label>
                          <div className="flex items-center gap-4">
                            {restaurantFormData.logo_url && (
                              <img src={restaurantFormData.logo_url} alt="Logo" className="w-20 h-20 rounded-xl object-cover border-2 border-slate-200" />
                            )}
                            <label className="flex items-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-all font-medium text-slate-700">
                              <Upload size={20} />
                              <span>Choose File</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>

                        <div className="pt-4">
                          <button
                            type="submit"
                            className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-cyan-400 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all"
                          >
                            Create Restaurant
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div>
                      {!isEditingRestaurant ? (
                        <div className="space-y-6">
                          <div className="flex items-start gap-6 p-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-100">
                            {restaurant.logo_url ? (
                              <img src={restaurant.logo_url} alt={restaurant.name} className="w-24 h-24 rounded-xl object-cover border-2 border-white shadow-lg" />
                            ) : (
                              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg">
                                <Store size={40} className="text-white" />
                              </div>
                            )}
                            <div className="flex-1 space-y-3">
                              <h3 className="text-2xl font-bold text-slate-900">{restaurant.name}</h3>
                              <div className="space-y-2">
                                <p className="flex items-center gap-2 text-slate-700">
                                  <MapPin size={18} className="text-blue-500" />
                                  {restaurant.address}
                                </p>
                                <p className="flex items-center gap-2 text-slate-700">
                                  <Phone size={18} className="text-blue-500" />
                                  {restaurant.phone}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                            <div>
                              {permissions.canEditRestaurant ? (
                                <button
                                  onClick={() => setIsEditingRestaurant(true)}
                                  className="px-6 py-3 bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-800 hover:to-slate-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                                >
                                  Edit Restaurant
                                </button>
                              ) : (
                                <div className="flex items-center gap-2 text-slate-500">
                                  <Lock size={18} />
                                  <span className="text-sm font-medium">Only managers can edit restaurant information</span>
                                </div>
                              )}
                            </div>
                            <div>
                              {currentUser?.role === 'owner' ? (
                                <button
                                  onClick={handleDeleteRestaurant}
                                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                                >
                                  <Trash2 size={18} />
                                  Delete Restaurant
                                </button>
                              ) : (
                                <button
                                  onClick={handleLeaveRestaurant}
                                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                                >
                                  <LogOut size={18} />
                                  Leave Restaurant
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <form onSubmit={handleUpdateRestaurant} className="space-y-4">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                              Restaurant Name *
                            </label>
                            <input
                              type="text"
                              value={restaurantFormData.name}
                              onChange={(e) => setRestaurantFormData({ ...restaurantFormData, name: e.target.value })}
                              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                              Address *
                            </label>
                            <input
                              type="text"
                              value={restaurantFormData.address}
                              onChange={(e) => setRestaurantFormData({ ...restaurantFormData, address: e.target.value })}
                              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                              Phone Number *
                            </label>
                            <input
                              type="tel"
                              value={restaurantFormData.phone}
                              onChange={(e) => setRestaurantFormData({ ...restaurantFormData, phone: e.target.value })}
                              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                              Logo (Optional)
                            </label>
                            <div className="flex items-center gap-4">
                              {restaurantFormData.logo_url && (
                                <img src={restaurantFormData.logo_url} alt="Logo" className="w-20 h-20 rounded-xl object-cover border-2 border-slate-200" />
                              )}
                              <label className="flex items-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-all font-medium text-slate-700">
                                <Upload size={20} />
                                <span>Change Logo</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleLogoUpload}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 pt-4">
                            <button
                              type="button"
                              onClick={() => {
                                setIsEditingRestaurant(false);
                                setRestaurantFormData({
                                  name: restaurant.name,
                                  address: restaurant.address,
                                  phone: restaurant.phone,
                                  logo_url: restaurant.logo_url || ''
                                });
                              }}
                              className="flex-1 px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-semibold transition-all"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-400 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all"
                            >
                              Save Changes
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {restaurant && permissions.canManageTeam && (
                <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-400 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                        <Users size={24} className="text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">Team Management</h2>
                        <p className="text-white/80 text-sm">Add and manage your employees</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    <div className="p-5 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-purple-100">
                      <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2 text-lg">
                        <UserPlus size={20} className="text-purple-600" />
                        Invite New Employee
                      </h3>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="email"
                          value={employeeEmail}
                          onChange={(e) => setEmployeeEmail(e.target.value)}
                          placeholder="employee@example.com"
                          className="w-full sm:flex-1 px-4 py-3 border-2 border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                        />
                        <button
                          onClick={handleAddEmployee}
                          disabled={isAddingEmployee || !employeeEmail}
                          className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-400 text-white rounded-xl font-semibold shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {isAddingEmployee ? 'Adding...' : 'Send Invite'}
                        </button>
                      </div>
                      <p className="mt-3 text-xs text-slate-600">The user must have an account before you can add them</p>
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-900 mb-4 text-lg">Current Team Members</h3>
                      {employees.length === 0 ? (
                        <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                          <Users size={48} className="text-slate-300 mx-auto mb-3" />
                          <p className="text-slate-500 font-medium">No employees added yet</p>
                          <p className="text-slate-400 text-sm mt-1">Invite your first team member above</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {employees.map((employee) => (
                            <div
                              key={employee.id}
                              className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-200 rounded-xl border border-slate-200 transition-all"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-400 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                  {employee.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900 text-lg">{employee.name}</p>
                                  <p className="text-slate-600 text-sm">{employee.email}</p>
                                  <span className="inline-block mt-1 px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full uppercase tracking-wide">
                                    {employee.role}
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemoveEmployee(employee.id)}
                                className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                title="Remove employee"
                              >
                                <Trash2 size={20} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {restaurant && teams.length >= 0 && permissions.canManageTeam && (
                <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                  <div className="bg-gradient-to-r from-orange-500 to-amber-400 px-6 py-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                          <Folder size={24} className="text-white" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-white">Teams & Groups</h2>
                          <p className="text-white/80 text-sm">Organize employees into specialized teams</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowCreateTeam(!showCreateTeam)}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-xl font-semibold transition-all"
                      >
                        <Plus size={18} />
                        Create Team
                      </button>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {showCreateTeam && (
                      <div className="p-5 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border-2 border-orange-100">
                        <h3 className="font-bold text-slate-900 mb-4 text-lg">Create New Team</h3>
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={newTeamName}
                            onChange={(e) => setNewTeamName(e.target.value)}
                            placeholder="Team name (e.g., Kitchen Staff, Waiters)"
                            className="w-full px-4 py-3 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                          />
                          <textarea
                            value={newTeamDescription}
                            onChange={(e) => setNewTeamDescription(e.target.value)}
                            placeholder="Team description (optional)"
                            rows={2}
                            className="w-full px-4 py-3 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all resize-none"
                          />
                          <div className="flex gap-3">
                            <button
                              onClick={() => {
                                setShowCreateTeam(false);
                                setNewTeamName('');
                                setNewTeamDescription('');
                              }}
                              className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-semibold transition-all"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleCreateTeam}
                              disabled={isCreatingTeam || !newTeamName.trim()}
                              className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-400 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/30 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isCreatingTeam ? 'Creating...' : 'Create Team'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {teams.length === 0 ? (
                      <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                        <Folder size={48} className="text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">No teams created yet</p>
                        <p className="text-slate-400 text-sm mt-1">Create your first team to organize employees</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {teams.map((team) => (
                          <div key={team.id} className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                            <div className="p-4 bg-white/50 border-b border-slate-200">
                              {editingTeamId === team.id ? (
                                <div className="flex items-center gap-3">
                                  <input
                                    type="text"
                                    value={editTeamName}
                                    onChange={(e) => setEditTeamName(e.target.value)}
                                    className="flex-1 px-3 py-2 border-2 border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleUpdateTeam(team.id)}
                                    className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all"
                                    title="Save"
                                  >
                                    <CheckCircle size={18} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingTeamId(null);
                                      setEditTeamName('');
                                    }}
                                    className="p-2 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded-lg transition-all"
                                    title="Cancel"
                                  >
                                    <X size={18} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                      <Folder size={20} className="text-orange-500" />
                                      {team.name}
                                    </h4>
                                    {team.description && (
                                      <p className="text-sm text-slate-600 mt-1">{team.description}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => {
                                        setEditingTeamId(team.id);
                                        setEditTeamName(team.name);
                                      }}
                                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                      title="Edit team"
                                    >
                                      <Edit size={18} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTeam(team.id)}
                                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                      title="Delete team"
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="p-4">
                              <div className="mb-3">
                                <h5 className="font-semibold text-slate-700">Team Members ({teamMembers[team.id]?.length || 0})</h5>
                              </div>

                              {!teamMembers[team.id] || teamMembers[team.id].length === 0 ? (
                                <div className="text-center py-6 bg-white rounded-lg border border-dashed border-slate-200">
                                  <Users size={32} className="text-slate-300 mx-auto mb-2" />
                                  <p className="text-slate-500 text-sm">No members in this team</p>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {teamMembers[team.id].map((member) => (
                                    <div
                                      key={member.id}
                                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-orange-300 transition-all"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-400 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">
                                          {member.profiles.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                          <p className="font-semibold text-slate-900">{member.profiles.name}</p>
                                          <p className="text-xs text-slate-600">{member.profiles.email}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <select
                                          value={member.role}
                                          onChange={(e) => handleUpdateMemberRole(member.id, e.target.value)}
                                          className="text-sm px-3 py-1 bg-orange-100 text-orange-700 border border-orange-200 rounded-lg font-medium focus:ring-2 focus:ring-orange-500"
                                        >
                                          <option value="manager">Manager</option>
                                          <option value="supervisor">Supervisor</option>
                                          <option value="member">Member</option>
                                          <option value="trainee">Trainee</option>
                                        </select>
                                        <button
                                          onClick={() => handleRemoveMemberFromTeam(team.id, member.profile_id)}
                                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                          title="Remove from team"
                                        >
                                          <X size={16} />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {employees.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-slate-200">
                                  <p className="text-sm font-medium text-slate-700 mb-2">Add Employee to Team:</p>
                                  <div className="flex gap-2">
                                    <select
                                      id={`select-employee-${team.id}`}
                                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                                    >
                                      <option value="">Select employee...</option>
                                      {employees
                                        .filter(emp => !teamMembers[team.id]?.some(tm => tm.profile_id === emp.id))
                                        .map(emp => (
                                          <option key={emp.id} value={emp.id}>{emp.name}</option>
                                        ))}
                                    </select>
                                    <select
                                      id={`select-role-${team.id}`}
                                      className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                                      defaultValue="member"
                                    >
                                      <option value="supervisor">Supervisor</option>
                                      <option value="member">Member</option>
                                    </select>
                                    <button
                                      onClick={() => {
                                        console.log('=== Button clicked ===');
                                        console.log('Team ID:', team.id);

                                        const employeeSelect = document.getElementById(`select-employee-${team.id}`) as HTMLSelectElement;
                                        const roleSelect = document.getElementById(`select-role-${team.id}`) as HTMLSelectElement;

                                        console.log('Employee select element:', employeeSelect);
                                        console.log('Role select element:', roleSelect);

                                        const employeeId = employeeSelect?.value;
                                        const role = roleSelect?.value;

                                        console.log('Selected employee ID:', employeeId);
                                        console.log('Selected role:', role);

                                        if (employeeId && role) {
                                          handleAddMemberToTeam(employeeId, team.id, role);
                                          employeeSelect.value = '';
                                        } else {
                                          console.warn('Missing employee ID or role');
                                          if (!employeeId) console.warn('Employee ID is empty or not selected');
                                          if (!role) console.warn('Role is empty or not selected');
                                        }
                                      }}
                                      disabled={addingToTeamId === team.id}
                                      className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-400 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
                                    >
                                      {addingToTeamId === team.id ? 'Adding...' : 'Add to Team'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {currentUser?.role === 'employee' && (
            <div className="bg-blue-50 border-l-4 border-blue-500 rounded-r-xl p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-500 rounded-xl">
                  <Building2 size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-blue-900 text-lg mb-2">Employee Account</h3>
                  <p className="text-blue-800">
                    You are currently working as an employee{restaurant && ` at ${restaurant.name}`}.
                  </p>
                  <p className="text-blue-700 text-sm mt-2">
                    Restaurant and team management features are only available to restaurant owners.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
