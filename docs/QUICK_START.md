# Quick Start Guide

Get up and running with Gigafactory Canvas in 5 minutes!

## 🚀 First Steps

### 1. Create a Workspace
- **Right-click** anywhere on canvas, OR
- Press **`N`** or **`Space`** at your mouse position

### 2. Add a Task
- Click the workspace to select it
- Press **`T`** to add a task
- Type: "Write a hello world program"
- Press **`Ctrl+Enter`** (or **`Cmd+Enter`** on Mac) to run

### 3. Create a Chain
- Press **`C`** while workspace is selected
- Click empty space (creates new workspace)
- Press **`T`** on new workspace
- Type: "Review the code"
- Press **`Ctrl+Enter`** to run

## 🎯 Essential Shortcuts

| Key | Action |
|-----|--------|
| `N` / `Space` | Create workspace |
| `T` / `Enter` | Add task |
| `R` | Run task |
| `C` | Connect workspaces |
| `Tab` | Cycle workspaces |
| `Delete` | Delete workspace |
| `P` | Show performance stats |
| `0` | Reset zoom/pan |

## 🖱️ Mouse Controls

- **Left Click**: Select workspace
- **Right Click**: Context menu / Create workspace
- **Drag**: Draw workspace / Move workspace
- **Wheel**: Zoom in/out
- **Space + Drag**: Pan canvas

## 📋 Common Workflows

### Simple Chain
```
1. Create workspace A
2. Add task: "Generate data"
3. Press C, click empty space (creates B)
4. Add task to B: "Process data"
5. Press R on A → B runs automatically
```

### Parallel Processing
```
1. Create "Input" workspace
2. Connect to 3 new workspaces
3. Each processes independently
4. Connect all to "Merge" workspace
```

## 🎨 Visual Guide

### Workspace States
- **Gray** = Empty (needs task)
- **Blue** = Working (executing)
- **Green** = Success (completed)
- **Red** = Error (check logs)

### Ports
- **Blue (left)** = Input (receives data)
- **Green (right)** = Output (sends data)

## 💡 Pro Tips

1. **Quick Creation**: Press `C` then click empty space repeatedly to create connected chain
2. **Batch Run**: Use `Tab` + `R` to queue multiple tasks
3. **Export**: Press `Ctrl+E` to save your workflow
4. **Zoom**: Use mouse wheel to zoom, `0` to reset
5. **Pan**: Hold `Space` and drag to move around

## 🆘 Need Help?

- **Full Guide**: See `docs/USER_GUIDE.md`
- **Performance**: Press `P` to see FPS and stats
- **Context Menu**: Right-click workspace for more options
- **Reset**: Press `0` if navigation gets confusing

---

**Ready to build?** Start creating workspaces and connecting them together!
