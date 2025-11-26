import { Minus, Plus, Trash2, Edit } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface IngredientCardProps {
  ingredient: {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    category: string | null;
    low_stock_threshold: number;
    supplier: string | null;
    price_per_unit: number | null;
  };
  onQuantityChange: (id: string, change: number) => void;
  onEdit: (ingredient: any) => void;
  onDelete: (id: string) => void;
}

export const InventoryCard = ({ ingredient, onQuantityChange, onEdit, onDelete }: IngredientCardProps) => {
  const isLowStock = ingredient.quantity <= ingredient.low_stock_threshold;
  const isOutOfStock = ingredient.quantity === 0;

  return (
    <div className="bg-card rounded-xl p-4 shadow-sm border border-border">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-base text-foreground">{ingredient.name}</h3>
          {ingredient.category && (
            <span className="text-xs text-muted-foreground">{ingredient.category}</span>
          )}
          {ingredient.supplier && (
            <div className="text-xs text-muted-foreground mt-1">
              Supplier: {ingredient.supplier}
            </div>
          )}
        </div>
        <Badge variant={isOutOfStock ? 'destructive' : isLowStock ? 'secondary' : 'default'}>
          {isOutOfStock ? 'Out' : isLowStock ? 'Low' : 'In Stock'}
        </Badge>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div>
          <div className="text-xl font-bold text-foreground">
            {ingredient.quantity} {ingredient.unit}
          </div>
          {ingredient.price_per_unit && (
            <div className="text-xs text-muted-foreground">
              ${ingredient.price_per_unit.toFixed(2)}/{ingredient.unit}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => onQuantityChange(ingredient.id, -1)}
            size="icon"
            variant="outline"
            className="h-10 w-10 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 border-0"
            disabled={ingredient.quantity === 0}
          >
            <Minus size={18} />
          </Button>
          <Button
            onClick={() => onQuantityChange(ingredient.id, 1)}
            size="icon"
            variant="outline"
            className="h-10 w-10 rounded-xl bg-green-100 text-green-700 hover:bg-green-200 border-0 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
          >
            <Plus size={18} />
          </Button>
        </div>
      </div>

      <div className="flex gap-2 mt-3 pt-3 border-t border-border">
        <Button
          onClick={() => onEdit(ingredient)}
          variant="ghost"
          size="sm"
          className="flex-1 text-xs"
        >
          <Edit size={14} className="mr-1" />
          Edit
        </Button>
        <Button
          onClick={() => onDelete(ingredient.id)}
          variant="ghost"
          size="sm"
          className="flex-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 size={14} className="mr-1" />
          Delete
        </Button>
      </div>
    </div>
  );
};
