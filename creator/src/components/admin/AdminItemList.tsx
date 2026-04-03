import { memo, useEffect } from "react";
import { useAdminStore } from "@/stores/adminStore";
import type { ItemEntry } from "@/types/admin";

const ItemRow = memo(function ItemRow({ item }: { item: ItemEntry }) {
  return (
    <div className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 py-3 transition-colors duration-200">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-sm text-text-primary">
            {item.displayName}
          </span>
          {item.slot && (
            <span className="rounded-full bg-stellar-blue/12 px-2 py-0.5 text-2xs text-stellar-blue">
              {item.slot}
            </span>
          )}
          {item.consumable && (
            <span className="rounded-full bg-status-success/12 px-2 py-0.5 text-2xs text-status-success">
              Consumable
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
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
        <span className="text-[11px] uppercase tracking-wide-ui text-text-muted">
          {items.length} registered
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-white/12 bg-white/4 px-6 py-12 text-center">
          <p className="font-display text-base text-text-secondary">No items found</p>
          <p className="mt-1 text-sm text-text-muted">
            The server has no items registered.
          </p>
        </div>
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
