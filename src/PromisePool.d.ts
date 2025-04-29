import { EventEmitter } from 'events';

export interface PoolOptions<T> {
    size: number;
    timeout: number;
    retries: number;
    onSuccess?: (result: T) => void;
    onFailure?: (error: unknown, retriesLeft: number) => void;
}

export class PromisePool<T> extends EventEmitter {
    constructor(options: PoolOptions<T>);

    add(
        task: (signal: AbortSignal) => Promise<T>,
        priority?: number,
        retries?: number
    ): void;

    shutdown(): Promise<void>;

    on(event: 'drain', listener: () => void): this;
}
