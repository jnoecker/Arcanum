import { useEffect, useMemo, useRef, useState } from "react";
import { useOpenProject } from "@/lib/useOpenProject";
import { loadUIState, removeRecentProject, type RecentProject } from "@/lib/uiPersistence";
import { useProjectStore } from "@/stores/projectStore";

interface ProjectSwitcherMenuProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onNewProject: () => void;
}

export function ProjectSwitcherMenu({ anchorRef, onClose, onNewProject }: ProjectSwitcherMenuProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const { openWithPicker, openDir } = useOpenProject();
  const currentProject = useProjectStore((s) => s.project);
  const [recents, setRecents] = useState<RecentProject[]>(
    () => loadUIState()?.recentProjects ?? [],
  );
  const [loadingPath, setLoadingPath] = useState<string | null>(null);

  const filteredRecents = useMemo(
    () => recents.filter((r) => r.path !== currentProject?.mudDir),
    [recents, currentProject?.mudDir],
  );

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKey);
    };
  }, [anchorRef, onClose]);

  const handleOpenRecent = async (project: RecentProject) => {
    setLoadingPath(project.path);
    try {
      const result = await openDir(project.path);
      if (!result.success) {
        removeRecentProject(project.path);
        setRecents((prev) => prev.filter((p) => p.path !== project.path));
        return;
      }
      onClose();
    } catch {
      removeRecentProject(project.path);
      setRecents((prev) => prev.filter((p) => p.path !== project.path));
    } finally {
      setLoadingPath(null);
    }
  };

  const handleOpenOther = async () => {
    const result = await openWithPicker();
    if (result?.success) {
      onClose();
    }
  };

  const handleNewProject = () => {
    onNewProject();
    onClose();
  };

  const handleRemoveRecent = (event: React.MouseEvent, path: string) => {
    event.stopPropagation();
    removeRecentProject(path);
    setRecents((prev) => prev.filter((p) => p.path !== path));
  };

  return (
    <div
      ref={panelRef}
      className="absolute left-0 top-full z-[70] mt-2 w-[min(22rem,calc(100vw-2rem))]"
    >
      <div
        role="menu"
        aria-label="Switch project"
        className="instrument-panel rounded-3xl p-3 shadow-panel"
      >
        <div className="space-y-3">
        {filteredRecents.length > 0 && (
          <div>
            <p className="px-2 text-2xs uppercase tracking-wide-ui text-text-muted">Recent worlds</p>
            <div className="mt-2 flex flex-col gap-1">
              {filteredRecents.map((project) => (
                <div key={project.path} className="group/recent flex items-center gap-1">
                  <button
                    role="menuitem"
                    onClick={() => void handleOpenRecent(project)}
                    disabled={loadingPath === project.path}
                    className="chrome-menu-item focus-ring flex min-h-11 min-w-0 flex-1 items-center rounded-2xl px-4 py-2 text-left text-sm disabled:opacity-40"
                    title={project.path}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-text-primary">{project.name}</div>
                      <div className="truncate text-2xs text-text-muted">{project.path}</div>
                    </div>
                    {loadingPath === project.path && (
                      <span className="ml-2 shrink-0 text-2xs text-text-muted">Opening...</span>
                    )}
                  </button>
                  <button
                    onClick={(e) => handleRemoveRecent(e, project.path)}
                    aria-label={`Forget ${project.name}`}
                    title="Forget this world"
                    className="focus-ring shrink-0 rounded-full border border-[var(--chrome-stroke)] px-2 py-1 text-2xs text-text-muted opacity-0 transition hover:border-status-danger/40 hover:text-status-danger focus:opacity-100 group-hover/recent:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="px-2 text-2xs uppercase tracking-wide-ui text-text-muted">Open</p>
          <div className="mt-2 grid gap-1">
            <button
              role="menuitem"
              onClick={() => void handleOpenOther()}
              className="chrome-menu-item focus-ring flex min-h-11 items-center rounded-2xl px-4 py-3 text-left text-sm"
            >
              Open another world...
            </button>
            <button
              role="menuitem"
              onClick={handleNewProject}
              className="chrome-menu-item focus-ring flex min-h-11 items-center rounded-2xl px-4 py-3 text-left text-sm"
            >
              New world...
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
