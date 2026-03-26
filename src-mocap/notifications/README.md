# Notifications System

Toast notifications, GPU error handling, and user alerts.

## Components

### ToastProvider

Sonner-based toast container with dark theme styling.

**Usage**:

```typescript
import { ToastProvider, toast } from '@/notifications';

// Wrap your app
<ToastProvider>
  <App />
</ToastProvider>

// Show toasts anywhere
toast.success('Operation completed!');
toast.error('Something went wrong');
toast.info('Processing...');
toast.warning('Be careful!');
```

**Features**:
- Dark theme matching app aesthetic
- Rich colors for different toast types
- Close button on all toasts
- Bottom-right positioning
- Auto-dismiss with configurable duration
- Stacking with expand/collapse

**Toast Types**:

```typescript
// Success
toast.success('File saved successfully!');

// Error
toast.error('Failed to load mesh');

// Info
toast.info('Processing 1024 vertices...');

// Warning
toast.warning('High polygon count detected');

// Loading (with promise)
toast.promise(
  fetchData(),
  {
    loading: 'Loading...',
    success: 'Data loaded!',
    error: 'Failed to load'
  }
);

// Custom
toast('Custom message', {
  duration: 5000,
  icon: '🎨'
});
```

### GpuDoctorListener

Real-time GPU error notifications that catch crashes and show them as dismissible toasts.

**The Problem**: GPU errors normally crash the app. You lose your work and have to restart.

**The Solution**: GPU Doctor catches errors, shows them as toasts, and lets you keep working while you fix the issue.

**Usage**:

```typescript
import { GpuDoctorListener } from '@/notifications';

// Add to your root layout
<ToastProvider>
  <GpuDoctorListener />
  <App />
</ToastProvider>
```

**Features**:
- Catches GPU errors before they crash the app
- Shows errors as dismissible toasts
- Color-coded by error category
- Copy error to clipboard
- Deduplicates identical errors
- Shows error context and timestamp
- Animated slide-in from right
- Your work is safe - fix and hot reload!

**Error Categories**:

- **Shader** 📜 - Shader compilation/validation errors
- **Buffer** 📦 - Buffer allocation/usage errors
- **Texture** 🖼️ - Texture creation/binding errors
- **Pipeline** 🔧 - Pipeline creation/configuration errors
- **Validation** ⚠️ - WebGPU validation errors
- **OutOfMemory** 💾 - GPU memory exhausted
- **DeviceLost** 💀 - GPU device lost (critical)
- **Other** ❓ - Uncategorized errors

**Backend Integration**:

The GPU Doctor listens for errors from the Rust backend:

```rust
// Rust backend (Tauri)
#[derive(Clone, serde::Serialize)]
struct GpuErrorPayload {
    error: String,
    category: GpuErrorCategory,
    context: String,
    timestamp: f64,
    error_hash: u64,
}

// Emit GPU error
app.emit_all("kos-gpu-error", GpuErrorPayload {
    error: error_message,
    category: GpuErrorCategory::Shader,
    context: "Sculpting pipeline".to_string(),
    timestamp: get_time(),
    error_hash: hash(&error_message),
}).ok();
```

**Error Deduplication**:

GPU Doctor uses error hashing to prevent showing the same error multiple times:

```typescript
// Same error won't show twice
error_hash: hash(error_message)
```

**Toast Actions**:

Each GPU error toast provides:
1. **Copy Error**: Copy full error message to clipboard
2. **Dismiss**: Close the toast
3. **Context**: Shows where the error occurred
4. **Timestamp**: When the error happened
5. **Tip**: Reminder that your work is safe

**Example Error Toast**:

```
🔧 GPU Pipeline Error
Sculpting pipeline

error: invalid bind group layout
  at create_pipeline (gpu/sculpt.rs:142)
... (click copy for full)

[Copy Error] [Copied!]  2.5s

💡 Your work is safe! Fix the issue and hot reload.
```

## State Management

The notification system uses simple state management:

```typescript
// Toast state (managed by Sonner)
import { toast } from 'sonner';

// GPU error state (internal)
let toasts: GpuToast[] = [];
let listeners: (() => void)[] = [];
```

## Styling

### Toast Styling

Toasts use dark theme with zinc colors:

```typescript
toastOptions: {
  style: {
    background: 'rgb(24 24 27)', // zinc-900
    border: '1px solid rgb(63 63 70)', // zinc-700
    color: 'rgb(250 250 250)', // zinc-50
  }
}
```

### GPU Error Styling

GPU errors use category-specific colors:

- **Shader**: Purple (`bg-purple-500/20`, `border-purple-500/50`)
- **Buffer**: Blue (`bg-blue-500/20`, `border-blue-500/50`)
- **Texture**: Green (`bg-green-500/20`, `border-green-500/50`)
- **Pipeline**: Orange (`bg-orange-500/20`, `border-orange-500/50`)
- **Validation**: Yellow (`bg-yellow-500/20`, `border-yellow-500/50`)
- **OutOfMemory**: Red (`bg-red-500/20`, `border-red-500/50`)
- **DeviceLost**: Dark Red (`bg-red-600/30`, `border-red-600/50`)
- **Other**: Gray (`bg-gray-500/20`, `border-gray-500/50`)

## Best Practices

### When to Use Toasts

Use toasts for:
- ✅ Success confirmations
- ✅ Error messages
- ✅ Warnings
- ✅ Progress updates
- ✅ Non-critical information

Don't use toasts for:
- ❌ Critical errors (use modal dialogs)
- ❌ Long-form content (use panels)
- ❌ Persistent information (use status bar)
- ❌ User input (use forms)

### Toast Duration

```typescript
// Quick confirmation (2s)
toast.success('Saved!', { duration: 2000 });

// Standard message (4s - default)
toast.info('Processing...');

// Important warning (6s)
toast.warning('High memory usage', { duration: 6000 });

// Persistent (manual dismiss)
toast.error('Critical error', { duration: Infinity });
```

### GPU Error Handling

When implementing GPU operations:

1. **Catch errors**: Wrap GPU calls in try-catch
2. **Emit events**: Send errors to GPU Doctor
3. **Provide context**: Include operation name
4. **Hash errors**: Prevent duplicates
5. **Continue gracefully**: Don't crash the app

```rust
// Example: Safe GPU operation
pub fn safe_gpu_operation() -> Result<(), String> {
    match unsafe_gpu_operation() {
        Ok(result) => Ok(result),
        Err(e) => {
            emit_gpu_error(
                e.to_string(),
                GpuErrorCategory::Pipeline,
                "safe_gpu_operation".to_string()
            );
            Err(e.to_string())
        }
    }
}
```

## Performance Considerations

### Toast Performance

- Toasts are lightweight (minimal DOM)
- Auto-dismiss prevents accumulation
- Stacking limits visible toasts
- Animations use CSS transforms (GPU-accelerated)

### GPU Doctor Performance

- Error deduplication prevents spam
- Ring buffer limits memory (max 100 errors)
- Dismissed toasts removed after animation
- Event listeners cleaned up on unmount

## Testing

### Unit Tests

```typescript
describe('ToastProvider', () => {
  it('should show success toast', () => {
    render(<ToastProvider><App /></ToastProvider>);
    toast.success('Test');
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});

describe('GpuDoctorListener', () => {
  it('should catch GPU errors', async () => {
    render(<GpuDoctorListener />);
    
    // Simulate GPU error event
    emit('kos-gpu-error', {
      error: 'Test error',
      category: 'Shader',
      context: 'Test',
      timestamp: 1.0,
      error_hash: 12345
    });
    
    expect(screen.getByText(/GPU Shader Error/)).toBeInTheDocument();
  });
});
```

## Future Enhancements

Potential additions:

1. **Toast Queue**: Limit simultaneous toasts
2. **Toast History**: View past notifications
3. **Custom Toast Types**: App-specific toast styles
4. **Sound Effects**: Audio feedback for errors
5. **Desktop Notifications**: OS-level notifications
6. **Error Analytics**: Track error frequency
7. **Auto-Recovery**: Attempt to recover from GPU errors

## Related

- [Developer Tools](../shared/dev-tools/README.md) - Console panel
- [Error Handling](../error/README.md) - Error boundaries
- [State Management](../shared/state/README.md) - Zustand stores
- [Sonner Documentation](https://sonner.emilkowal.ski/) - Toast library
