import { memo, useEffect } from "react";
import { useAdminStore } from "@/stores/adminStore";
import { Badge, EmptyState } from "@/components/ui/FormWidgets";
import type { ItemEntry } from "@/types/admin";

const ItemRow = memo(function ItemRow({ item }: { item: ItemEntry }) {
  return (
    <div className="flex w-full items-center gap-3 rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] px-4 py-3 transition-colors duration-200">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-sm text-text-primary">
            {item.displayName}
          </span>
          {item.slot && (
            <Badge variant="info">
              {item.slot}
            </Badge>
          )}
          {item.consumable && (
            <Badge variant="success">
              Consumable
            </Badge>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-2xs">
          <span className="text-status-warning">
            {item.basePrice.toLocaleString()}g
          </span>
          {item.damage > 0 && (
            <span className="text-text-secondary">
              DMG {item.damage}
            </span>
          )}
          {item.armor > 0 && (
            <span className="text-text-secondary">
              ARM {item.armor}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

export function AdminItemList() {
  const items = useAdminStore((s) => s.items);
  const fetchItems = useAdminStore((s) => s.fetchItems);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg text-text-primary">Items</h3>
          <p className="mt-0.5 text-xs text-text-muted">
            All registered items in the world.
          </p>
        </div>
        <span className="text-2xs uppercase tracking-wide-ui text-text-muted">
          {items.length} registered
        </span>
      </div>

      {items.length === 0 ? (
        <EmptyState title="No items found" description="The server has no items registered." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
