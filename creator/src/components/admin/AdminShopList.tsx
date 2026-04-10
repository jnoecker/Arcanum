import { memo, useEffect, useState } from "react";
import { useAdminStore } from "@/stores/adminStore";
import { Badge, EmptyState } from "@/components/ui/FormWidgets";
import type { ShopEntry } from "@/types/admin";

const ShopRow = memo(function ShopRow({ shop }: { shop: ShopEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] transition-colors duration-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-accent/[0.04] focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none rounded-2xl"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-sm text-text-primary">
              {shop.name}
            </span>
            <span className="text-2xs text-text-muted">
              {shop.items.length} item{shop.items.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="mt-1 text-2xs text-text-muted">
            Room: <span className="font-mono text-text-secondary">{shop.roomId}</span>
          </div>
        </div>
        <span className="shrink-0 text-xs text-text-muted transition-transform duration-200"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          &#x25BC;
        </span>
      </button>

      {expanded && shop.items.length > 0 && (
        <div className="border-t border-[var(--chrome-stroke)] px-4 pb-3 pt-2">
          <div className="flex flex-col gap-1">
            {shop.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl bg-[var(--chrome-highlight)] px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-primary">{item.displayName}</span>
                  {item.slot && (
                    <Badge variant="info">
                      {item.slot}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-status-warning">
                  {item.basePrice.toLocaleString()}g
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export function AdminShopList() {
  const shops = useAdminStore((s) => s.shops);
  const fetchShops = useAdminStore((s) => s.fetchShops);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg text-text-primary">Shops</h3>
          <p className="mt-0.5 text-xs text-text-muted">
            All registered shops and their inventories.
          </p>
        </div>
        <span className="text-2xs uppercase tracking-wide-ui text-text-muted">
          {shops.length} registered
        </span>
      </div>

      {shops.length === 0 ? (
        <EmptyState title="No shops found" description="The server has no shops registered." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {shops.map((s) => (
            <ShopRow key={s.id} shop={s} />
          ))}
        </div>
      )}
    </div>
  );
}
