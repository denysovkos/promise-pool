# PromisePool

A generic, typed, event-driven promise pool for concurrent task execution with prioritization, timeouts, and retries — implemented in TypeScript.

## Features

- Limit the number of concurrent asynchronous tasks.
- Support for task timeouts and automatic abortion.
- Retry logic with configurable attempt limits.
- Priority-based task queuing (0 = highest, 5 = lowest).
- Optional success/failure callbacks.
- Graceful shutdown and pause/resume support.
- Emits `drain` event when the queue is empty and all tasks complete.

## Installation

```bash
npm install your-library-name
```

## Usage

```ts
import { PromisePool } from './PromisePool';

const pool = new PromisePool<string>({
  size: 3,
  timeout: 1000,
  retries: 2,
  onSuccess: (res) => console.log('✅ Success:', res),
  onFailure: (err, left) => console.warn('❌ Failed:', err, 'Retries left:', left)
});

pool.on('drain', () => console.log('All tasks complete.'));

pool.add((signal) => someAsyncFunction(signal), 1);
pool.add((signal) => anotherTask(signal), 3);
```

## API

### Constructor

```ts
new PromisePool<T>({
  size: number;
  timeout: number; // in milliseconds
  retries: number;
  onSuccess?: (result: T) => void;
  onFailure?: (error: unknown, retriesLeft: number) => void;
});
```

### Methods

#### `add(task, priority = 3, retries?)`
Add a task to the pool with optional priority and retry count.

#### `pause()`
Temporarily halt task processing.

#### `resume()`
Resume processing after pause.

#### `setConcurrency(size)`
Dynamically adjust the concurrency level.

#### `shutdown()`
Gracefully stop processing and abort running tasks.

#### Events

- `drain`: Emitted when the queue is empty and no tasks are running.

## Task Format

Tasks should return a `Promise<T>` and accept an `AbortSignal`:

```ts
const task = (signal: AbortSignal) => {
  return new Promise<string>((resolve, reject) => {
    if (signal.aborted) return reject(new Error('Aborted'));
    // Perform async work
  });
};
```

## License

MIT
```