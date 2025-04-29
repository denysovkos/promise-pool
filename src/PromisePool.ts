import { EventEmitter } from 'events';

interface PoolOptions<T> {
    size: number;
    timeout: number;
    retries: number;
    onSuccess?: (result: T) => void;
    onFailure?: (error: unknown, retriesLeft: number) => void;
}

interface QueueItem<T> {
    task: (signal: AbortSignal) => Promise<T>;
    retries: number;
    priority: number;
}

export class PromisePool<T> extends EventEmitter {
    private readonly size: number;
    private readonly timeout: number;
    private readonly retries: number;
    private readonly onSuccess?: (result: T) => void;
    private readonly onFailure?: (error: unknown, retriesLeft: number) => void;

    private running = 0;
    private queue: QueueItem<T>[] = [];
    private activeControllers = new Set<AbortController>();

    constructor({
        size,
        timeout,
        retries,
        onSuccess,
        onFailure
    }: PoolOptions<T>) {
        super();
        if (size <= 0) throw new Error('Pool size must be greater than 0');
        if (retries < 0) throw new Error('Retries must be 0 or greater');
        this.size = size;
        this.timeout = timeout;
        this.retries = retries - 1;
        this.onSuccess = onSuccess;
        this.onFailure = onFailure;
    }

    add(task: (signal: AbortSignal) => Promise<T>, priority = 3, retries = this.retries): void {
        if (priority < 0 || priority > 5) {
            throw new Error('Priority must be between 0 (highest) and 5 (lowest)');
        }

        this.queue.push({ task, retries, priority });
        this.queue.sort((a, b) => a.priority - b.priority);
        this.processNext();
    }

    async shutdown(): Promise<void> {
        for (const controller of this.activeControllers) {
            controller.abort();
        }
        while (this.running > 0) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }

    private processNext(): void {
        if (this.running >= this.size) return;
        if (this.queue.length === 0) {
            if (this.running === 0) {
                this.emit('drain');
            }
            return;
        }

        const nextTask = this.queue.shift()!;
        this.running++;
        this.executeTask(nextTask)
            .catch(() => {})
            .finally(() => {
                this.running--;
                this.processNext();
            });

        if (this.running < this.size) {
            this.processNext();
        }
    }

    private async executeTask(item: QueueItem<T>): Promise<void> {
        const controller = new AbortController();
        this.activeControllers.add(controller);

        try {
            const result = await this.executeWithTimeout(item.task, controller);
            this.onSuccess?.(result);
        } catch (error) {
            this.onFailure?.(error, item.retries);
            if (item.retries > 0) {
                this.queue.push({
                    task: item.task,
                    retries: item.retries - 1,
                    priority: item.priority
                });
                this.queue.sort((a, b) => a.priority - b.priority);
                this.processNext();
            }
        } finally {
            this.activeControllers.delete(controller);
        }
    }

    private executeWithTimeout(
        task: (signal: AbortSignal) => Promise<T>,
        controller: AbortController
    ): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                controller.abort();
                reject(new Error("Timeout"));
            }, this.timeout);

            task(controller.signal)
                .then(result => {
                    clearTimeout(timeoutId);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    reject(error);
                });
        });
    }
}