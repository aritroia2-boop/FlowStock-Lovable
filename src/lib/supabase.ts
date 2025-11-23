import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const uploadRecipeImage = async (file: File, recipeId: string): Promise<string> => {
  // Validate file size (5MB limit)
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds 5MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Invalid file type. Please upload an image file (JPEG, PNG, WEBP, or GIF)`);
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `${recipeId}-${Date.now()}.${fileExt}`;
  const filePath = `recipes/${fileName}`;

  console.log('Uploading image:', { fileName, fileSize: file.size, fileType: file.type });

  const { error: uploadError } = await supabase.storage
    .from('recipe-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    throw new Error(`Failed to upload image: ${uploadError.message}`);
  }

  const { data } = supabase.storage
    .from('recipe-images')
    .getPublicUrl(filePath);

  console.log('Image uploaded successfully:', data.publicUrl);
  return data.publicUrl;
};

export const deleteRecipeImage = async (imageUrl: string): Promise<void> => {
  const path = imageUrl.split('/recipe-images/')[1];
  if (!path) return;

  const { error } = await supabase.storage
    .from('recipe-images')
    .remove([`recipes/${path}`]);

  if (error) throw error;
};

export interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  minimum_stock: number;
  category?: string;
  supplier?: string;
  owner_id?: string;
  restaurant_id?: string;
  is_shared?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Recipe {
  id: string;
  name: string;
  category: string;
  cost: number;
  description?: string;
  image_url?: string;
  owner_id?: string;
  restaurant_id?: string;
  is_shared?: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  ingredient_id?: string;
  ingredient_name: string;
  operation: string;
  amount: number;
  user_name: string;
  user_id?: string;
  timestamp: string;
  created_at: string;
}

export interface Restaurant {
  id: string;
  name: string;
  address: string;
  phone: string;
  logo_url?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: string;
  restaurant_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  profile_id: string;
  role: string;
  status?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  recipient_id: string;
  sender_id?: string;
  type: string;
  title: string;
  message: string;
  status: string;
  team_id?: string;
  metadata?: Record<string, any>;
  read_at?: string;
  created_at: string;
}
