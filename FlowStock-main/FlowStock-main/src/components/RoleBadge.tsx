import { Crown, Star, User, Shield } from 'lucide-react';
import { RestaurantRole, getRoleDisplayName, getRoleDescription, getRoleColor } from '../lib/permissions';

interface RoleBadgeProps {
  role: RestaurantRole;
  size?: 'sm' | 'md' | 'lg';
  showDescription?: boolean;
  className?: string;
}

export const RoleBadge = ({ role, size = 'md', showDescription = false, className = '' }: RoleBadgeProps) => {
  const colors = getRoleColor(role);
  const displayName = getRoleDisplayName(role);
  const description = getRoleDescription(role);

  const getIcon = () => {
    switch (role) {
      case 'manager':
        return <Crown size={iconSize} className="text-white" />;
      case 'supervisor':
        return <Star size={iconSize} className="text-white" />;
      case 'member':
        return <User size={iconSize} className="text-white" />;
      case 'none':
      default:
        return <Shield size={iconSize} className="text-white" />;
    }
  };

  const iconSize = size === 'sm' ? 12 : size === 'md' ? 16 : 20;
  const textSize = size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base';
  const padding = size === 'sm' ? 'px-2 py-1' : size === 'md' ? 'px-3 py-1.5' : 'px-4 py-2';

  if (showDescription) {
    return (
      <div className={`inline-flex flex-col gap-2 ${className}`}>
        <div className={`inline-flex items-center gap-2 ${padding} bg-gradient-to-r ${colors.bg} rounded-lg shadow-lg text-white font-medium ${textSize}`}>
          <div className="bg-white/20 backdrop-blur-sm p-1 rounded">
            {getIcon()}
          </div>
          <span>{displayName}</span>
        </div>
        <p className="text-xs text-slate-600 max-w-xs">{description}</p>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 ${padding} bg-gradient-to-r ${colors.bg} rounded-lg shadow-lg text-white font-medium ${textSize} ${className}`}>
      <div className="bg-white/20 backdrop-blur-sm p-1 rounded">
        {getIcon()}
      </div>
      <span>{displayName}</span>
    </div>
  );
};
