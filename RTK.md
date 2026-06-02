# RTK — Token Optimization Rules

Use `rtk` for all shell commands to reduce token consumption by 60-90%.

## MANDATORY: Prefix shell commands with rtk

When running commands via bash/shell, ALWAYS prefix with `rtk` when available:

| Instead of | Run |
|-----------|-----|
| `git status` | `rtk git status` |
| `git diff` | `rtk git diff` |
| `git log` | `rtk git log` |
| `git add .` | `rtk git add .` |
| `git commit -m "msg"` | `rtk git commit -m "msg"` |
| `git push` | `rtk git push` |
| `git pull` | `rtk git pull` |
| `ls -la` | `rtk ls .` |
| `find . -name "*.go"` | `rtk find "*.go" .` |
| `grep -r "pattern" .` | `rtk grep "pattern" .` |
| `cat file.go` | `rtk read file.go` |
| `cargo test` | `rtk cargo test` |
| `go test ./...` | `rtk go test ./...` |
| `npm test` | `rtk npm test` |
| `docker ps` | `rtk docker ps` |

## Rules

1. **ALWAYS use `rtk` prefix** for supported commands — it filters noise and saves tokens.
2. **Use `rtk read`** instead of `cat`/`head`/`tail` for file reading in shell.
3. **Use `rtk grep`** instead of `grep`/`rg` for searching.
4. **Use `rtk find`** instead of `find` for file discovery.
5. **Use `rtk ls`** instead of `ls`/`tree` for directory listing.
6. For unsupported commands, run them directly — rtk passes through transparently.

## Analytics

- `rtk gain` — view token savings stats
- `rtk gain --graph` — ASCII savings graph
- `rtk discover` — find commands that could benefit from rtk
