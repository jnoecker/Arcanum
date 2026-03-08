import { useCallback } from "react";
import { Command, type Child } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/stores/projectStore";
import { useServerStore } from "@/stores/serverStore";
import { useConfigStore } from "@/stores/configStore";
import { runPreflightChecks } from "@/lib/preflight";

export interface StartResult {
  success: boolean;
  preflightErrors?: string[];
}

// Module-level so the server handle survives component remounts
let activeChild: Child | null = null;

export function useServerManager() {
  const project = useProjectStore((s) => s.project);
  const config = useConfigStore((s) => s.config);
  const setStatus = useServerStore((s) => s.setStatus);
  const setPid = useServerStore((s) => s.setPid);
  const setLastError = useServerStore((s) => s.setLastError);
  const addLog = useServerStore((s) => s.addLog);

  const startServer = useCallback(async (): Promise<StartResult> => {
    if (!project) return { success: false, preflightErrors: ["No project open"] };

    const telnetPort = config?.server.telnetPort ?? 4000;
    const webPort = config?.server.webPort ?? 8080;

    // Run pre-flight checks
    addLog("INFO", "Running pre-flight checks...");
    const preflight = await runPreflightChecks(telnetPort, webPort);

    if (!preflight.passed) {
      const errors: string[] = [];
      if (preflight.javaError) {
        errors.push(preflight.javaError);
      }
      for (const conflict of preflight.portConflicts) {
        errors.push(`${conflict.label} port ${conflict.port} is already in use`);
      }
      addLog("ERROR", `Pre-flight checks failed: ${errors.join("; ")}`);
      return { success: false, preflightErrors: errors };
    }

    addLog("INFO", `Pre-flight OK: Java ${preflight.javaVersion}, ports ${telnetPort}/${webPort} available`);

    const { mudDir } = project;
    const gradlew = "gradlew.bat"; // Windows; future: detect platform

    setStatus("starting");
    setLastError(null);
    addLog("INFO", `Starting server: ${gradlew} run`);

    try {
      const command = Command.create("cmd", ["/C", `${gradlew} run`], {
        cwd: mudDir,
      });

      command.stdout.on("data", (line) => {
        addLog("STDOUT", line);
        if (line.includes("AmbonMUD listening on telnet port")) {
          setStatus("running");
        }
      });

      command.stderr.on("data", (line) => {
        addLog("STDOUT", line);
      });

      command.on("close", (data) => {
        addLog("INFO", `Server process exited with code ${data.code}`);
        setPid(null);
        activeChild = null;
        invoke("clear_server_pid").catch(() => {});

        const currentStatus = useServerStore.getState().status;
        if (currentStatus === "stopping") {
          setStatus("stopped");
        } else if (data.code !== 0 && data.code !== null) {
          setStatus("error");
          setLastError(`Process exited with code ${data.code}`);
        } else {
          setStatus("stopped");
        }
      });

      command.on("error", (error) => {
        addLog("ERROR", `Server error: ${error}`);
        setStatus("error");
        setLastError(error);
      });

      const child = await command.spawn();
      activeChild = child;
      setPid(child.pid);
      // Register PID with Rust so the process tree is killed on app exit
      await invoke("set_server_pid", { pid: child.pid, mudDir });
      addLog("INFO", `Server process started (PID: ${child.pid})`);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addLog("ERROR", `Failed to start server: ${message}`);
      setStatus("error");
      setLastError(message);
      return { success: false, preflightErrors: [message] };
    }
  }, [project, config, setStatus, setPid, setLastError, addLog]);

  const stopServer = useCallback(async () => {
    if (!activeChild) {
      setStatus("stopped");
      return;
    }

    setStatus("stopping");
    addLog("INFO", "Stopping server...");

    try {
      // Kill the entire process tree (cmd → gradle → java)
      await invoke("kill_server_tree");
      activeChild = null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addLog("ERROR", `Failed to stop server: ${message}`);
      setStatus("error");
      setLastError(message);
    }
  }, [setStatus, setLastError, addLog]);

  return { startServer, stopServer };
}
