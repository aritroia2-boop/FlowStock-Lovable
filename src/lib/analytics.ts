import { supabase } from './supabase';
import { Ingredient } from './database';
import { normalizeToBaseUnit } from './unitConverter';
import { ingredientsService } from './database';

export interface IngredientUsageData {
  name: string;
  quantity: number;
  unit: string;
  normalizedQuantity: number;
}

export interface RecipeUsageData {
  name: string;
  count: number;
}

export interface SpendingData {
  name: string;
  cost: number;
  quantity: number;
  unit: string;
}

export interface WeeklyAnalytics {
  mostUsedIngredients: IngredientUsageData[];
  mostPreparedRecipes: RecipeUsageData[];
  highestSpending: SpendingData[];
  totalSpending: number;
}

/**
 * Calculate analytics for the last 7 days
 */
export async function calculateWeeklyAnalytics(
  userId: string,
  restaurantId?: string | null
): Promise<WeeklyAnalytics> {
  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Fetch audit logs from last 7 days
  const { data: auditLogs, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', sevenDaysAgo.toISOString());

  if (error) throw error;

  // Process Recipe Completions
  const recipeCompletions = auditLogs.filter(
    log => log.operation.startsWith('Recipe:')
  );

  const recipeCountMap = new Map<string, number>();
  recipeCompletions.forEach(log => {
    const recipeName = log.operation.replace('Recipe: ', '');
    recipeCountMap.set(recipeName, (recipeCountMap.get(recipeName) || 0) + 1);
  });

  const mostPreparedRecipes: RecipeUsageData[] = Array.from(recipeCountMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Calculate Ingredient Usage
  const ingredientUsageMap = new Map<string, { quantity: number; unit: string }>();

  recipeCompletions.forEach(log => {
    const ingredientName = log.old_values?.name || log.new_values?.name;
    const amountUsed = log.old_values?.amount_used || 0;
    const unit = log.old_values?.unit || log.new_values?.unit || 'kg';

    if (ingredientName && amountUsed > 0) {
      const existing = ingredientUsageMap.get(ingredientName);
      if (existing) {
        existing.quantity += amountUsed;
      } else {
        ingredientUsageMap.set(ingredientName, { quantity: amountUsed, unit });
      }
    }
  });

  // Normalize quantities and sort
  const mostUsedIngredients: IngredientUsageData[] = Array.from(ingredientUsageMap.entries())
    .map(([name, { quantity, unit }]) => {
      const normalized = normalizeToBaseUnit(quantity, unit);
      return {
        name,
        quantity,
        unit,
        normalizedQuantity: normalized.value
      };
    })
    .sort((a, b) => b.normalizedQuantity - a.normalizedQuantity)
    .slice(0, 5);

  // Calculate Spending
  let allIngredients: Ingredient[];
  if (restaurantId) {
    const personal = await ingredientsService.getPersonal();
    const restaurant = await ingredientsService.getRestaurant(restaurantId);
    allIngredients = [...personal, ...restaurant];
  } else {
    allIngredients = await ingredientsService.getPersonal();
  }

  const spendingMap = new Map<string, { cost: number; quantity: number; unit: string }>();

  recipeCompletions.forEach(log => {
    const ingredientName = log.old_values?.name || log.new_values?.name;
    const amountUsed = log.old_values?.amount_used || 0;
    const unit = log.old_values?.unit || 'kg';

    if (ingredientName && amountUsed > 0) {
      const ingredient = allIngredients.find(ing => ing.name === ingredientName);
      const pricePerUnit = ingredient?.price_per_unit || 0;

      if (pricePerUnit > 0) {
        const cost = amountUsed * pricePerUnit;

        const existing = spendingMap.get(ingredientName);
        if (existing) {
          existing.cost += cost;
          existing.quantity += amountUsed;
        } else {
          spendingMap.set(ingredientName, { cost, quantity: amountUsed, unit });
        }
      }
    }
  });

  const highestSpending: SpendingData[] = Array.from(spendingMap.entries())
    .map(([name, { cost, quantity, unit }]) => ({ name, cost, quantity, unit }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5);

  const totalSpending = highestSpending.reduce((sum, item) => sum + item.cost, 0);

  return {
    mostUsedIngredients,
    mostPreparedRecipes,
    highestSpending,
    totalSpending
  };
}
