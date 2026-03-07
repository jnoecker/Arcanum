import { Toolbar } from "./Toolbar";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { MainArea } from "./MainArea";
import { StatusBar } from "./StatusBar";

export function AppShell() {
  return (
    <div className="flex h-screen flex-col bg-bg-primary">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TabBar />
          <MainArea />
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
