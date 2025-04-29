import { PromisePool } from '../PromisePool';
import { once } from 'events';

describe('PromisePool Extended Tests', () => {
  let pool: PromisePool<string>;

  afterEach(async () => {
    await pool.shutdown();
  });

  it('should handle timeout correctly', async () => {
    const failures: unknown[] = [];
    pool = new PromisePool<string>({
      size: 1,
      timeout: 100,
      retries: 0,
      onFailure: (err) => failures.push(err)
    });

    pool.add(() => new Promise(res => setTimeout(() => res('too late'), 300)));

    await once(pool, 'drain');
    expect(failures.length).toBe(1);
    expect((failures[0] as Error).message).toBe('Timeout');
  });

  it('should handle AbortSignal correctly', async () => {
    const abortHandled = jest.fn();

    pool = new PromisePool<string>({
      size: 1,
      timeout: 1000,
      retries: 0
    });

    pool.add((signal) => new Promise((res) => {
      signal.addEventListener('abort', () => {
        abortHandled();
        res('aborted');
      });
    }));

    await pool.shutdown();
    expect(abortHandled).toHaveBeenCalled();
  });

  it('should handle a mix of successful and failing tasks', async () => {
    const successes: string[] = [];
    const failures: unknown[] = [];

    pool = new PromisePool<string>({
      size: 2,
      timeout: 100,
      retries: 2,
      onSuccess: (result) => successes.push(result),
      onFailure: (err) => failures.push(err),
    });

    pool.add(() => Promise.resolve('success1'));
    pool.add(() => Promise.reject('fail1'));
    pool.add(() => Promise.resolve('success2'));
    pool.add(() => Promise.reject('fail2'));

    await once(pool, 'drain');

    expect(successes).toEqual(['success1', 'success2']);
    expect(failures).toEqual(['fail1', 'fail2', 'fail1', 'fail2']);
  });

  it('should handle tasks added during execution', async () => {
    const results: string[] = [];

    pool = new PromisePool<string>({
      size: 1,
      timeout: 1000,
      retries: 0,
      onSuccess: (result) => {
        results.push(result);

        if (result === 'task1') {
          pool.add(() => Promise.resolve('dynamic-task'));
        }
      }
    });

    pool.add(() => Promise.resolve('task1'));
    pool.add(() => Promise.resolve('task2'));

    await once(pool, 'drain');

    expect(results).toEqual(['task1', 'task2', 'dynamic-task']);
  });
});