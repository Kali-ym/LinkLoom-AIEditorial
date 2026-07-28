import { AppError } from '../../domain/errors.js';
import type { LocalStore } from '../LocalStore.js';
import { LogService } from '../LogService.js';
import type { ServiceContext } from '../ServiceContext.js';

export class ScheduleRouteService {
  constructor(
    private readonly store: LocalStore,
    private readonly context: ServiceContext
  ) {}

  listSchedules() {
    return this.store.listSchedules();
  }

  async saveSchedule(schedule: any) {
    await this.store.saveSchedule(schedule);
    if (schedule.enabled) {
      this.context.schedulerService.startSchedule(schedule);
    } else {
      this.context.schedulerService.stopSchedule(schedule.id);
    }
    return { status: 'success' };
  }

  async deleteSchedule(id: string) {
    this.context.schedulerService.stopSchedule(id);
    await this.store.deleteSchedule(id);
    return { status: 'success' };
  }

  listTaskLogs(query: any) {
    return this.store.listTaskLogs({
      limit: query.limit ? parseInt(query.limit) : 50,
      offset: query.offset ? parseInt(query.offset) : 0,
      taskId: query.taskId
    });
  }

  async runNow(id: string) {
    const schedule = await this.store.getSchedule(id);
    if (!schedule) {
      throw new AppError(404, `Schedule ${id} not found`);
    }
    this.context.schedulerService
      .runNow(id)
      .catch((err) => LogService.error(`Manual run for ${id} failed: ${err}`));
    return { status: 'success', message: 'Task triggered' };
  }
}
