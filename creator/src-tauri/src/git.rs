use serde::Serialize;
use tauri::AppHandle;
use tokio::process::Command;

use crate::settings;

// ─── Return types ──────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct RepoStatus {
    pub is_repo: bool,
    pub branch: String,
    pub changed_files: u32,
    pub ahead: u32,
    pub behind: u32,
    pub has_remote: bool,
    pub remote_url: String,
}

#[derive(Debug, Serialize)]
pub struct CommitInfo {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub date: String,
}

#[derive(Debug, Serialize)]
pub struct PullResult {
    pub success: bool,
    pub had_conflicts: bool,
    pub summary: String,
}

#[derive(Debug, Serialize)]
pub struct PrResult {
    pub pr_url: String,
    pub branch_name: String,
}

// ─── Helpers ───────────────────────────────────────────────────────

/// Run a git command in the given directory and return stdout on success.
async fn run_git(path: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(path)
        .output()
        .await
        .map_err(|e| format!("Failed to run git: {e}"))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(stderr)
    }
}

/// Run git and return (success, stdout, stderr) without treating non-zero as error.
async fn run_git_raw(path: &str, args: &[&str]) -> Result<(bool, String, String), String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(path)
        .output()
        .await
        .map_err(|e| format!("Failed to run git: {e}"))?;

    Ok((
        output.status.success(),
        String::from_utf8_lossy(&output.stdout).trim().to_string(),
        String::from_utf8_lossy(&output.stderr).trim().to_string(),
    ))
}

/// Inject a PAT into an HTTPS GitHub URL for authentication.
/// `https://github.com/owner/repo.git` → `https://{pat}@github.com/owner/repo.git`
fn authenticated_url(remote_url: &str, pat: &str) -> String {
    if pat.is_empty() {
        return remote_url.to_string();
    }
    // Convert SSH to HTTPS if needed
    let url = if remote_url.starts_with("git@github.com:") {
        remote_url
            .replace("git@github.com:", "https://github.com/")
    } else {
        remote_url.to_string()
    };
    // Inject PAT after https://
    if let Some(rest) = url.strip_prefix("https://") {
        // Strip any existing auth
        let rest = if let Some(at_pos) = rest.find('@') {
            &rest[at_pos + 1..]
        } else {
            rest
        };
        format!("https://{}@{}", pat, rest)
    } else {
        url
    }
}

/// Extract (owner, repo) from a GitHub remote URL.
fn parse_owner_repo(remote_url: &str) -> Result<(String, String), String> {
    // Handle https://github.com/owner/repo.git and git@github.com:owner/repo.git
    let path = if let Some(rest) = remote_url.strip_prefix("git@github.com:") {
        rest.to_string()
    } else if remote_url.contains("github.com/") {
        remote_url
            .split("github.com/")
            .nth(1)
            .unwrap_or("")
            .to_string()
    } else {
        return Err("Not a GitHub URL".to_string());
    };

    let path = path.trim_end_matches(".git");
    let parts: Vec<&str> = path.split('/').collect();
    if parts.len() >= 2 {
        Ok((parts[0].to_string(), parts[1].to_string()))
    } else {
        Err(format!("Cannot parse owner/repo from: {remote_url}"))
    }
}

// ─── Tauri commands ────────────────────────────────────────────────

#[tauri::command]
pub async fn git_repo_status(path: String) -> Result<RepoStatus, String> {
    // Check if directory is a git repo
    let is_repo = run_git(&path, &["rev-parse", "--is-inside-work-tree"])
        .await
        .is_ok();

    if !is_repo {
        return Ok(RepoStatus {
            is_repo: false,
            branch: String::new(),
            changed_files: 0,
            ahead: 0,
            behind: 0,
            has_remote: false,
            remote_url: String::new(),
        });
    }

    let branch = run_git(&path, &["branch", "--show-current"])
        .await
        .unwrap_or_default();

    let changed_files = run_git(&path, &["status", "--porcelain"])
        .await
        .map(|out| if out.is_empty() { 0 } else { out.lines().count() as u32 })
        .unwrap_or(0);

    let remote_url = run_git(&path, &["remote", "get-url", "origin"])
        .await
        .unwrap_or_default();
    let has_remote = !remote_url.is_empty();

    let (ahead, behind) = if has_remote {
        run_git(&path, &["rev-list", "--count", "--left-right", "@{upstream}...HEAD"])
            .await
            .ok()
            .and_then(|out| {
                let parts: Vec<&str> = out.split('\t').collect();
                if parts.len() == 2 {
                    Some((
                        parts[1].parse::<u32>().unwrap_or(0),
                        parts[0].parse::<u32>().unwrap_or(0),
                    ))
                } else {
                    None
                }
            })
            .unwrap_or((0, 0))
    } else {
        (0, 0)
    };

    Ok(RepoStatus {
        is_repo: true,
        branch,
        changed_files,
        ahead,
        behind,
        has_remote,
        remote_url,
    })
}

#[tauri::command]
pub async fn git_init(path: String) -> Result<String, String> {
    run_git(&path, &["init"]).await?;

    // Create .gitignore if it doesn't exist
    let gitignore_path = std::path::Path::new(&path).join(".gitignore");
    if !gitignore_path.exists() {
        let default_gitignore = "# OS\n.DS_Store\nThumbs.db\ndesktop.ini\n\n# Editor\n.idea/\n.vscode/\n*.swp\n*.swo\n\n# Local overrides\nlocal.yaml\n";
        tokio::fs::write(&gitignore_path, default_gitignore)
            .await
            .map_err(|e| format!("Failed to create .gitignore: {e}"))?;
    }

    // Stage everything and create initial commit
    run_git(&path, &["add", "-A"]).await?;

    let (ok, _, stderr) = run_git_raw(&path, &["commit", "-m", "Initial commit"]).await?;
    if !ok && !stderr.contains("nothing to commit") {
        return Err(format!("Initial commit failed: {stderr}"));
    }

    Ok("Repository initialized".to_string())
}

#[tauri::command]
pub async fn git_set_remote(path: String, url: String) -> Result<(), String> {
    // Try set-url first (in case origin already exists), fall back to add
    let result = run_git(&path, &["remote", "set-url", "origin", &url]).await;
    if result.is_err() {
        run_git(&path, &["remote", "add", "origin", &url]).await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn git_commit(path: String, message: String) -> Result<String, String> {
    run_git(&path, &["add", "-A"]).await?;

    // Check if there is anything to commit
    let status = run_git(&path, &["status", "--porcelain"]).await?;
    if status.is_empty() {
        return Ok("Nothing to commit".to_string());
    }

    run_git(&path, &["commit", "-m", &message]).await?;
    let hash = run_git(&path, &["rev-parse", "--short", "HEAD"]).await?;
    Ok(format!("Committed: {hash}"))
}

#[tauri::command]
pub async fn git_push(app: AppHandle, path: String) -> Result<String, String> {
    let settings = settings::get_settings(app).await?;
    if settings.github_pat.is_empty() {
        return Err("GitHub PAT not configured. Set it in Settings.".to_string());
    }

    let remote_url = run_git(&path, &["remote", "get-url", "origin"]).await
        .map_err(|_| "No remote configured. Set a remote URL first.".to_string())?;

    let auth_url = authenticated_url(&remote_url, &settings.github_pat);
    let branch = run_git(&path, &["branch", "--show-current"]).await?;

    // Check if upstream is set
    let has_upstream = run_git(&path, &["rev-parse", "--abbrev-ref", "@{upstream}"]).await.is_ok();

    let args = if has_upstream {
        vec!["push", &auth_url, &branch]
    } else {
        vec!["push", "-u", &auth_url, &branch]
    };

    let (ok, stdout, stderr) = run_git_raw(&path, &args).await?;
    if !ok {
        return Err(format!("Push failed: {stderr}"));
    }

    let summary = if stderr.contains("Everything up-to-date") {
        "Already up to date".to_string()
    } else {
        format!("Pushed {branch} to origin")
    };

    // After push, set upstream tracking if it wasn't set
    if !has_upstream {
        let _ = run_git(&path, &["branch", "--set-upstream-to", &format!("origin/{branch}"), &branch]).await;
    }

    Ok(if stdout.is_empty() { summary } else { stdout })
}

#[tauri::command]
pub async fn git_pull(app: AppHandle, path: String) -> Result<PullResult, String> {
    let settings = settings::get_settings(app).await?;
    if settings.github_pat.is_empty() {
        return Err("GitHub PAT not configured. Set it in Settings.".to_string());
    }

    let remote_url = run_git(&path, &["remote", "get-url", "origin"]).await
        .map_err(|_| "No remote configured.".to_string())?;

    let auth_url = authenticated_url(&remote_url, &settings.github_pat);
    let branch = run_git(&path, &["branch", "--show-current"]).await?;

    // Fetch first
    run_git(&path, &["fetch", &auth_url]).await
        .map_err(|e| format!("Fetch failed: {e}"))?;

    // Update remote tracking ref so merge can find it
    let _ = run_git(&path, &["branch", "--set-upstream-to", &format!("origin/{branch}"), &branch]).await;

    // Attempt merge
    let (ok, stdout, stderr) = run_git_raw(&path, &["merge", &format!("origin/{branch}")]).await?;

    if ok {
        let summary = if stdout.contains("Already up to date") {
            "Already up to date".to_string()
        } else {
            "Pull successful".to_string()
        };
        return Ok(PullResult {
            success: true,
            had_conflicts: false,
            summary,
        });
    }

    // Check if it was a conflict
    let has_conflicts = stderr.contains("CONFLICT") || stderr.contains("Automatic merge failed");

    if has_conflicts {
        // Abort the merge to leave the working tree clean
        let _ = run_git(&path, &["merge", "--abort"]).await;
        Ok(PullResult {
            success: false,
            had_conflicts: true,
            summary: "Merge conflicts detected. Create a PR to resolve on GitHub.".to_string(),
        })
    } else {
        // Some other merge failure
        let _ = run_git(&path, &["merge", "--abort"]).await;
        Err(format!("Merge failed: {stderr}"))
    }
}

#[tauri::command]
pub async fn git_abort_merge(path: String) -> Result<(), String> {
    run_git(&path, &["merge", "--abort"]).await?;
    Ok(())
}

#[tauri::command]
pub async fn git_log(path: String, count: u32) -> Result<Vec<CommitInfo>, String> {
    let count_str = count.to_string();
    let (ok, stdout, _) = run_git_raw(
        &path,
        &[
            "log",
            "-n", &count_str,
            "--pretty=format:%H%x00%h%x00%s%x00%an%x00%aI",
        ],
    )
    .await?;

    if !ok || stdout.is_empty() {
        return Ok(vec![]);
    }

    let commits = stdout
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split('\0').collect();
            if parts.len() >= 5 {
                Some(CommitInfo {
                    hash: parts[0].to_string(),
                    short_hash: parts[1].to_string(),
                    message: parts[2].to_string(),
                    author: parts[3].to_string(),
                    date: parts[4].to_string(),
                })
            } else {
                None
            }
        })
        .collect();

    Ok(commits)
}

#[tauri::command]
pub async fn git_create_pr(
    app: AppHandle,
    path: String,
    branch_name: String,
    title: String,
    body: String,
) -> Result<PrResult, String> {
    let settings = settings::get_settings(app).await?;
    if settings.github_pat.is_empty() {
        return Err("GitHub PAT not configured.".to_string());
    }

    let remote_url = run_git(&path, &["remote", "get-url", "origin"]).await?;
    let main_branch = run_git(&path, &["branch", "--show-current"]).await?;
    let auth_url = authenticated_url(&remote_url, &settings.github_pat);

    // Create the new branch from current HEAD
    run_git(&path, &["checkout", "-b", &branch_name]).await?;

    // Push the new branch
    let (ok, _, stderr) = run_git_raw(&path, &["push", "-u", &auth_url, &branch_name]).await?;
    if !ok {
        // Switch back to main branch on failure
        let _ = run_git(&path, &["checkout", &main_branch]).await;
        let _ = run_git(&path, &["branch", "-D", &branch_name]).await;
        return Err(format!("Failed to push branch: {stderr}"));
    }

    // Switch back to main branch
    run_git(&path, &["checkout", &main_branch]).await?;

    // Create PR via GitHub API
    let (owner, repo) = parse_owner_repo(&remote_url)?;
    let pr_url = create_github_pr(
        &settings.github_pat,
        &owner,
        &repo,
        &branch_name,
        &main_branch,
        &title,
        &body,
    )
    .await?;

    Ok(PrResult {
        pr_url,
        branch_name,
    })
}

/// Create a pull request on GitHub and return the HTML URL.
async fn create_github_pr(
    pat: &str,
    owner: &str,
    repo: &str,
    head: &str,
    base: &str,
    title: &str,
    body: &str,
) -> Result<String, String> {
    let url = format!("https://api.github.com/repos/{owner}/{repo}/pulls");

    let payload = serde_json::json!({
        "title": title,
        "body": body,
        "head": head,
        "base": base,
    });

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {pat}"))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "AmbonArcanum")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("GitHub API request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("GitHub API error ({status}): {text}"));
    }

    let resp: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse GitHub response: {e}"))?;

    resp.get("html_url")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "No PR URL in GitHub response".to_string())
}
