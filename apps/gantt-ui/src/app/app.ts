import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type AriadneProject = {
  slug: string;
  name: string;
  bugsOpen?: number;
  improvementsOpen?: number;
};

type TaskDependencyLink = {
  raw?: string;
  id: string;
  relation: 'FS' | 'SS' | 'FF' | 'SF';
  fromAnchor?: 'start' | 'end';
  toAnchor?: 'start' | 'end';
  lagBusinessDays?: number;
  lagIaHours?: number;
  sequential?: boolean;
};

type DependencyDraftRow = {
  id: string;
  relation: 'FS' | 'SS' | 'FF' | 'SF';
  lagValue: string;
  lagUnit: 'd' | 'h';
};

type GanttTask = {
  id: string;
  title: string;
  status: string;
  type: string;
  priority: string;
  durationDays: number;
  durationIaHours: number;
  startDay: number;
  endDay: number;
  startIaHour: number;
  endIaHour: number;
  startDate: string;
  endDate: string;
  startCalendarDay?: number;
  endCalendarDay?: number;
  lane: 'bugs' | 'mejoras';
  dependencies: string[];
  dependencyLinks?: TaskDependencyLink[];
  pendingDependencies: string[];
  canRunInParallel: boolean;
};

type DependencyEdge = {
  fromId: string;
  toId: string;
  relation?: 'FS' | 'SS' | 'FF' | 'SF';
  fromAnchor?: 'start' | 'end';
  toAnchor?: 'start' | 'end';
  lagBusinessDays?: number;
  lagIaHours?: number;
  sequential?: boolean;
};

type GanttVisibleRow = {
  task: GanttTask;
  depth: number;
  hasChildren: boolean;
};

type AiModelConfig = {
  key: string;
  name: string;
  initials: string;
  maxParallel: number;
  requiresOperator: boolean;
  operatorId?: string;
  operatorName: string;
  enabled: boolean;
};

type AiOperatorConfig = {
  id: string;
  name: string;
  active: boolean;
  maxParallel: number;
  hoursPerDay: number;
};

type AiBadge = {
  key: string;
  label: string;
  initials: string;
};

type AiCapacityStorage = {
  version?: number;
  capacity: number;
  aiModels: AiModelConfig[];
  operators?: AiOperatorConfig[];
};

type BulkTaskEditReport = {
  project: string;
  dryRun: boolean;
  received: number;
  updateKeys: string[];
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  updated: Array<{ id: string; file: string; changes: string[] }>;
  skipped: Array<{ id: string; reason: string }>;
  errors: Array<{ id: string; reason: string }>;
};

type BulkTaskEditUpdates = {
  estimateIaHours?: number;
  estimateDays?: number;
  startedDate?: string;
  dueDate?: string;
  assignees?: string[];
};

type GanttRouteStep = {
  id: string;
  title: string;
  durationDays: number;
  durationIaHours: number;
  priority: string;
};

type GanttResponse = {
  project: { slug: string; name: string };
  parameters: {
    capacity: number;
    includeDone: boolean;
    iaHoursPerDay: number;
    startDate: string;
    holidays: string[];
    workOnSaturday: boolean;
  };
  summary: {
    totalTasks: number;
    doneTasks: number;
    pendingTasks: number;
    completionRate: number;
    estimatedPendingIaHours: number;
    estimatedPendingDays: number;
    blockedByDependencies: number;
    unresolvedDependencies: number;
    cycleDetected: boolean;
  };
  criticalPath: {
    route: GanttRouteStep[];
    estimatedIaHours: number;
  };
  parallelGroups: { startIaHour: number; startDay: number; startDate: string; ids: string[] }[];
  dependencyEdges?: DependencyEdge[];
  monthMarkers: {
    monthKey: string;
    monthLabel: string;
    atIaHour: number;
    atBusinessDay?: number;
    atCalendarDay?: number;
    date: string;
  }[];
  dayMarkers?: {
    dayIndex: number;
    date: string;
    monthKey: string;
    monthLabel: string;
    dayLabel: string;
    dayNumber: number;
    isWorking: boolean;
    isSaturday: boolean;
    isSunday: boolean;
    isHoliday: boolean;
  }[];
  tasks: GanttTask[];
  generatedAt: string;
};

@Component({
  selector: 'app-root',
  imports: [CommonModule, HttpClientModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly http = inject(HttpClient);
  private preferredProjectSlug: string | null = null;
  private readonly proxyBase = '/ariadne-api';
  private readonly directBase = this.readApiBaseUrl();
  private dragScrollTarget: HTMLElement | null = null;
  private dragPointerId: number | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartLeft = 0;
  private dragStartTop = 0;
  private dragMoved = false;
  private suppressNextTimelineOpen = false;
  private aiCapacityStatusResetHandle: ReturnType<typeof setTimeout> | null = null;

  private readApiBaseUrl(): string {
    const configured = (globalThis as { __ARIADNE_API_BASE_URL__?: string }).__ARIADNE_API_BASE_URL__;
    return String(configured || '').trim().replace(/\/$/, '');
  }

  protected readonly projects = signal<AriadneProject[]>([]);
  protected readonly selectedProject = signal('');
  protected readonly capacity = signal(3);
  protected readonly includeDone = signal(true);
  protected readonly iaHoursPerDay = signal(8);
  protected readonly startDate = signal(new Date().toISOString().slice(0, 10));
  protected readonly holidaysInput = signal('');
  protected readonly useColombiaHolidays = signal(true);
  protected readonly workOnSaturday = signal(false);
  protected readonly zoom = signal(30);
  protected readonly timelineFrom = signal('');
  protected readonly timelineTo = signal('');
  protected readonly laneFilter = signal<'all' | 'bugs' | 'mejoras'>('all');
  protected readonly bulkLaneFilter = signal<'all' | 'bugs' | 'mejoras'>('all');
  protected readonly bulkStatusFilter = signal<'all' | 'pending' | 'in-progress' | 'done' | 'blocked'>('all');
  protected readonly bulkCriticalOnly = signal(false);
  protected readonly bulkEstimateIaHours = signal('');
  protected readonly bulkEstimateDays = signal('');
  protected readonly bulkStartedDate = signal('');
  protected readonly bulkDueDate = signal('');
  protected readonly bulkAssignees = signal('');
  protected readonly bulkEditState = signal<'idle' | 'saving' | 'done' | 'error'>('idle');
  protected readonly bulkEditMessage = signal('');
  protected readonly bulkEditReport = signal<BulkTaskEditReport | null>(null);
  protected readonly selectedTaskId = signal<string | null>(null);
  protected readonly dependencyDraftRows = signal<DependencyDraftRow[]>([]);
  protected readonly dependencySaveState = signal<'idle' | 'saving' | 'done' | 'error'>('idle');
  protected readonly dependencySaveMessage = signal('');
  protected readonly showCriticalPath = signal(true);
  protected readonly showRoutePanel = signal(false);
  protected readonly showAllDependencies = signal(false);
  protected readonly showAdvancedUi = signal(false);
  protected readonly isTimelineModalOpen = signal(false);
  protected readonly collapsedTaskIds = signal<Set<string>>(new Set());
  protected readonly aiModels = signal<AiModelConfig[]>([
    {
      key: 'gpt',
      name: 'GPT-5.3-Codex',
      initials: 'GPT',
      maxParallel: 2,
      requiresOperator: true,
      operatorId: 'op-1',
      operatorName: 'AI Operator 1',
      enabled: true,
    },
    {
      key: 'cla',
      name: 'Claude Sonnet',
      initials: 'CLA',
      maxParallel: 1,
      requiresOperator: false,
      operatorId: '',
      operatorName: '',
      enabled: true,
    },
    {
      key: 'gem',
      name: 'Gemini Pro',
      initials: 'GEM',
      maxParallel: 1,
      requiresOperator: false,
      operatorId: '',
      operatorName: '',
      enabled: true,
    },
    {
      key: 'llm',
      name: 'Llama 3.1',
      initials: 'LLM',
      maxParallel: 1,
      requiresOperator: false,
      operatorId: '',
      operatorName: '',
      enabled: false,
    },
  ]);
  protected readonly aiOperators = signal<AiOperatorConfig[]>([
    { id: 'op-1', name: 'AI Operator 1', active: true, maxParallel: 2, hoursPerDay: 8 },
  ]);
  protected readonly gantt = signal<GanttResponse | null>(null);
  protected readonly aiCapacitySyncState = signal<'idle' | 'saving' | 'synced' | 'local-only'>('idle');

  protected readonly isDarkTheme = signal(false);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly filteredTasks = computed(() => {
    const data = this.gantt();
    if (!data) return [] as GanttTask[];
    const lane = this.laneFilter();
    if (lane === 'all') return data.tasks;
    return data.tasks.filter((task) => task.lane === lane);
  });

  protected readonly bulkCandidateTasks = computed(() => {
    const tasks = this.gantt()?.tasks ?? [];
    const lane = this.bulkLaneFilter();
    const status = this.bulkStatusFilter();
    const criticalOnly = this.bulkCriticalOnly();
    const criticalIds = new Set((this.gantt()?.criticalPath?.route ?? []).map((step) => step.id));

    return tasks.filter((task) => {
      if (lane !== 'all' && task.lane !== lane) return false;
      if (criticalOnly && !criticalIds.has(task.id)) return false;
      if (status !== 'all' && this.taskStateBucket(task) !== status) return false;
      return true;
    });
  });

  protected readonly bulkCandidateCount = computed(() => this.bulkCandidateTasks().length);

  protected readonly dependencyEditorCandidateTasks = computed(() => {
    const selected = this.selectedTaskId();
    return [...(this.gantt()?.tasks ?? [])]
      .filter((task) => task.id !== selected)
      .sort((a, b) => a.id.localeCompare(b.id));
  });

  protected readonly totalDays = computed(() => {
    const markers = this.gantt()?.dayMarkers ?? [];
    if (markers.length > 0) return markers.length;
    const tasks = this.filteredTasks();
    const last = tasks.reduce((max, task) => Math.max(max, task.endDay), 0);
    return Math.max(10, last + 1);
  });

  protected readonly dayTicks = computed(() => {
    const markers = this.gantt()?.dayMarkers ?? [];
    if (markers.length > 0) {
      return markers.map((marker) => ({
        dayIndex: marker.dayIndex,
        businessDayIndex: undefined as number | undefined,
        date: marker.date,
        monthKey: marker.monthKey,
        monthLabel: marker.monthLabel,
        dayLabel: marker.dayLabel,
        dayNumber: marker.dayNumber,
        isWorking: marker.isWorking,
        isSaturday: marker.isSaturday,
        isSunday: marker.isSunday,
        isHoliday: marker.isHoliday,
        holidayName: this.holidayNameForDate(marker.date, marker.isHoliday),
      }));
    }

    const tasks = this.filteredTasks();
    const maxBusinessDay = tasks.length ? Math.max(...tasks.map((task) => task.endDay ?? 0)) : 20;
    const calendar: Array<{
      dayIndex: number;
      businessDayIndex?: number;
      date: string;
      monthKey: string;
      monthLabel: string;
      dayLabel: string;
      dayNumber: number;
      isWorking: boolean;
      isSaturday: boolean;
      isSunday: boolean;
      isHoliday: boolean;
      holidayName: string;
    }> = [];

    const holidaySet = new Set(this.gantt()?.parameters?.holidays ?? []);
    const workOnSaturday = this.gantt()?.parameters?.workOnSaturday ?? this.workOnSaturday();
    const baseDate = this.parseIsoDate(this.gantt()?.parameters?.startDate || this.startDate());
    const dayName = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];

    let businessIndex = 0;
    let offsetDays = 0;
    while (businessIndex <= maxBusinessDay || calendar.length < 40) {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() + offsetDays);
      const iso = this.formatIsoDate(date);
      const dow = date.getDay();
      const isSaturday = dow === 6;
      const isSunday = dow === 0;
      const isHoliday = holidaySet.has(iso);
      const isWorking = !isSunday && !(isSaturday && !workOnSaturday) && !isHoliday;

      const marker = {
        dayIndex: calendar.length,
        businessDayIndex: isWorking ? businessIndex : undefined,
        date: iso,
        monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        monthLabel: this.formatMonthLabel(date),
        dayLabel: dayName[dow],
        dayNumber: date.getDate(),
        isWorking,
        isSaturday,
        isSunday,
        isHoliday,
        holidayName: this.holidayNameForDate(iso, isHoliday),
      };
      calendar.push(marker);

      if (isWorking) businessIndex += 1;
      offsetDays += 1;

      if (calendar.length > 380) break;
    }

    return calendar;
  });

  protected readonly todayInRange = computed(() => this.todayColumnLeft() !== null);

  protected readonly todayIndicatorText = computed(() =>
    this.todayInRange() ? 'Hoy en rango' : 'Hoy fuera de rango'
  );

  protected readonly nonWorkingBands = computed(() =>
    this.visibleDayTicks().flatMap((day, visibleIndex) => {
      if (!day.isHoliday) return [] as Array<{ key: string; left: number; type: 'holiday' }>;
      return [{
        key: `${day.dayIndex}-${day.date}`,
        left: visibleIndex * this.zoom(),
        type: 'holiday',
      }];
    })
  );

  protected readonly effectiveDependencyEdges = computed(() => {
    const direct = this.gantt()?.dependencyEdges ?? [];
    if (direct.length > 0) {
      return direct.map((edge) => {
        const relation = edge.relation || 'FS';
        const fromAnchor = edge.fromAnchor || (relation === 'SS' || relation === 'SF' ? 'start' : 'end');
        const toAnchor = edge.toAnchor || (relation === 'SS' || relation === 'FS' ? 'start' : 'end');
        const sequential = edge.sequential ?? (relation === 'FS' || relation === 'SF');
        return {
          ...edge,
          relation,
          fromAnchor,
          toAnchor,
          lagBusinessDays: Number(edge.lagBusinessDays || 0),
          lagIaHours: Number(edge.lagIaHours || 0),
          sequential,
        };
      });
    }

    const taskIds = new Set(this.filteredTasks().map((task) => task.id));
    const fallback: DependencyEdge[] = [];
    for (const task of this.filteredTasks()) {
      for (const dep of task.dependencies ?? []) {
        if (taskIds.has(dep)) {
          fallback.push({
            fromId: dep,
            toId: task.id,
            relation: 'FS',
            fromAnchor: 'end',
            toAnchor: 'start',
            lagBusinessDays: 0,
            lagIaHours: 0,
            sequential: true,
          });
        }
      }
    }
    return fallback;
  });

  protected readonly dependencyTargets = computed(() => {
    const set = new Set<string>();
    for (const edge of this.effectiveDependencyEdges()) set.add(edge.toId);
    return set;
  });

  protected readonly dependencyChildren = computed(() => {
    const tasks = this.filteredTasks();
    const taskIds = new Set(tasks.map((task) => task.id));
    const byId = new Map(tasks.map((task) => [task.id, task]));
    const children = new Map<string, string[]>();
    for (const task of tasks) children.set(task.id, []);

    for (const edge of this.effectiveDependencyEdges()) {
      if (!taskIds.has(edge.fromId) || !taskIds.has(edge.toId)) continue;
      children.get(edge.fromId)?.push(edge.toId);
    }

    for (const [taskId, list] of children.entries()) {
      const uniqueSorted = [...new Set(list)].sort((a, b) => {
        const left = byId.get(a);
        const right = byId.get(b);
        if (!left || !right) return a.localeCompare(b);
        return this.taskStartDay(left) - this.taskStartDay(right) || a.localeCompare(b);
      });
      children.set(taskId, uniqueSorted);
    }

    return children;
  });

  protected readonly visibleTaskRows = computed(() => {
    const tasks = this.filteredTasks();
    if (tasks.length === 0) return [] as GanttVisibleRow[];
    const byId = new Map(tasks.map((task) => [task.id, task]));
    const children = this.dependencyChildren();

    const incoming = new Map<string, number>();
    for (const task of tasks) incoming.set(task.id, 0);
    for (const [fromId, list] of children.entries()) {
      if (!byId.has(fromId)) continue;
      for (const toId of list) incoming.set(toId, (incoming.get(toId) ?? 0) + 1);
    }

    const sortBySchedule = (left: GanttTask, right: GanttTask) =>
      this.taskStartDay(left) - this.taskStartDay(right) || left.startIaHour - right.startIaHour || left.id.localeCompare(right.id);

    const roots = tasks
      .filter((task) => (incoming.get(task.id) ?? 0) === 0)
      .sort(sortBySchedule)
      .map((task) => task.id);

    const ordered: GanttVisibleRow[] = [];
    const visited = new Set<string>();

    const walk = (taskId: string, depth: number): void => {
      if (visited.has(taskId)) return;
      const task = byId.get(taskId);
      if (!task) return;
      visited.add(taskId);
      const childIds = children.get(taskId) ?? [];
      ordered.push({ task, depth, hasChildren: childIds.length > 0 });
      if (this.isTaskCollapsed(taskId)) return;
      for (const childId of childIds) walk(childId, depth + 1);
    };

    for (const rootId of roots) walk(rootId, 0);
    for (const task of [...tasks].sort(sortBySchedule)) walk(task.id, 0);

    return ordered;
  });

  protected readonly visibleStartDay = computed(() => {
    const ticks = this.dayTicks();
    const from = this.timelineFrom();
    if (!ticks.length || !from) return 0;
    const index = ticks.findIndex((tick) => tick.date && tick.date >= from);
    return index >= 0 ? index : 0;
  });

  protected readonly visibleEndDay = computed(() => {
    const ticks = this.dayTicks();
    const to = this.timelineTo();
    if (!ticks.length || !to) return Math.max(0, ticks.length - 1);
    let last = -1;
    for (let i = 0; i < ticks.length; i += 1) {
      const date = ticks[i].date;
      if (!date || date > to) break;
      last = i;
    }
    return last >= 0 ? last : Math.max(0, ticks.length - 1);
  });

  protected readonly visibleDayTicks = computed(() => {
    const ticks = this.dayTicks();
    if (!ticks.length) return ticks;
    const from = Math.max(0, this.visibleStartDay());
    const to = Math.max(from, Math.min(ticks.length - 1, this.visibleEndDay()));
    return ticks.slice(from, to + 1);
  });

  protected readonly visibleMonthMarkers = computed(() => {
    const start = this.visibleStartDay();
    const end = this.visibleEndDay();
    return (this.gantt()?.monthMarkers ?? [])
      .map((month) => ({
        ...month,
        anchorDay: month.atCalendarDay ?? month.atBusinessDay ?? 0,
      }))
      .filter((month) => month.anchorDay >= start && month.anchorDay <= end)
      .map((month) => ({ ...month, localDay: month.anchorDay - start }));
  });

  protected readonly visibleMonthBands = computed(() => {
    const ticks = this.visibleDayTicks();
    if (!ticks.length) return [] as { key: string; label: string; days: number; left: number }[];

    const bands: { key: string; label: string; days: number; left: number }[] = [];
    let currentKey = ticks[0].monthKey || `${ticks[0].date.slice(0, 7)}-fallback`;
    let currentLabel = ticks[0].monthLabel || ticks[0].date.slice(0, 7);
    let startIndex = 0;

    for (let i = 1; i <= ticks.length; i += 1) {
      const tick = ticks[i];
      const key = tick?.monthKey || (tick?.date ? `${tick.date.slice(0, 7)}-fallback` : '__end__');
      if (i === ticks.length || key !== currentKey) {
        const days = i - startIndex;
        bands.push({
          key: `${currentKey}-${startIndex}`,
          label: currentLabel,
          days,
          left: startIndex,
        });
        startIndex = i;
        if (i < ticks.length) {
          currentKey = key;
          currentLabel = tick?.monthLabel || tick?.date?.slice(0, 7) || 'Mes';
        }
      }
    }

    return bands;
  });

  protected readonly visibleRangeLabel = computed(() => {
    const ticks = this.visibleDayTicks();
    if (!ticks.length) return 'Sin rango';
    const first = ticks[0];
    const last = ticks[ticks.length - 1];
    const from = this.formatShortDate(first.date);
    const to = this.formatShortDate(last.date);
    return `${from} - ${to}`;
  });

  protected readonly canShiftPrevious = computed(() => this.visibleStartDay() > 0);

  protected readonly canShiftNext = computed(() => this.visibleEndDay() < this.dayTicks().length - 1);

  protected readonly todayColumnLeft = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    const index = this.visibleDayTicks().findIndex((tick) => tick.date === today);
    if (index < 0) return null;
    return index * this.zoom();
  });

  protected readonly todayMarkerLeft = computed(() => {
    const col = this.todayColumnLeft();
    if (col === null) return null;
    return col + Math.floor(this.zoom() / 2);
  });

  protected readonly timelineWidth = computed(() => this.visibleDayTicks().length * this.zoom());

  protected readonly rowPitch = computed(() => 40);

  protected readonly dependencyLines = computed(() => {
    const selected = this.selectedTaskId();
    const allEdges = this.effectiveDependencyEdges();
    const hasSelectedRelations = selected
      ? allEdges.some((edge) => edge.fromId === selected || edge.toId === selected)
      : false;
    const edges = allEdges.filter((edge) => {
      if (this.showAllDependencies()) return true;
      if (!selected) return false;
      if (!hasSelectedRelations) return false;
      return edge.fromId === selected || edge.toId === selected;
    });
    const rows = this.visibleTaskRows();
    const byId = new Map(rows.map((row, index) => [row.task.id, { task: row.task, index }]));
    const px = this.zoom();
    const row = this.rowPitch();

    return edges
      .map((edge) => {
        const from = byId.get(edge.fromId);
        const to = byId.get(edge.toId);
        if (!from || !to) return null;
        const relation = edge.relation || 'FS';
        const fromAnchor = edge.fromAnchor || (relation === 'SS' || relation === 'SF' ? 'start' : 'end');
        const toAnchor = edge.toAnchor || (relation === 'SS' || relation === 'FS' ? 'start' : 'end');
        const fromDay = fromAnchor === 'start' ? this.taskStartDay(from.task) : this.taskEndDay(from.task) + 1;
        const toDay = toAnchor === 'start' ? this.taskStartDay(to.task) : this.taskEndDay(to.task) + 1;
        const offset = this.visibleStartDay();
        const width = this.timelineWidth();
        const x1Raw = (fromDay - offset) * px + (fromAnchor === 'start' ? 2 : -2);
        const x2Raw = (toDay - offset) * px + (toAnchor === 'start' ? 2 : -2);
        if ((x1Raw < 0 && x2Raw < 0) || (x1Raw > width && x2Raw > width)) return null;
        const x1 = Math.max(0, Math.min(width, x1Raw));
        const x2 = Math.max(0, Math.min(width, x2Raw));
        const y1 = from.index * row + 20;
        const y2 = to.index * row + 20;
        const delta = x2 - x1;
        const bendSpan = Math.min(36, Math.max(14, Math.abs(delta) * 0.4));
        const bendX = delta >= 0 ? x1 + bendSpan : x1 - bendSpan;
        const d = `M ${x1} ${y1} L ${bendX} ${y1} L ${bendX} ${y2} L ${x2} ${y2}`;
        const lineClass = `dep-line rel-${relation.toLowerCase()} ${edge.sequential === false ? 'rel-parallel' : 'rel-sequential'}`;
        const dotClass = `dep-dot rel-${relation.toLowerCase()}`;
        return { key: `${edge.fromId}-${edge.toId}-${relation}-${edge.lagBusinessDays || 0}`, d, x2, y2, lineClass, dotClass };
      })
      .filter(Boolean) as { key: string; d: string; x2: number; y2: number; lineClass: string; dotClass: string }[];
  });

  protected readonly timelineBodyHeight = computed(() => Math.max(64, this.visibleTaskRows().length * this.rowPitch()));

  protected readonly autoHolidayCount = computed(() => this.currentAutoHolidays().length);

  protected readonly aiCapacitySyncText = computed(() => {
    const state = this.aiCapacitySyncState();
    if (state === 'saving') return 'Guardando en backend...';
    if (state === 'synced') return 'Sincronizado con backend';
    if (state === 'local-only') return 'Guardado local (backend no disponible)';
    return 'Sin cambios pendientes';
  });

  protected readonly activeAiModels = computed(() => this.aiModels().filter((model) => model.enabled));

  protected readonly aiModelParallelSlots = computed(() =>
    this.activeAiModels().reduce((sum, model) => sum + model.maxParallel, 0)
  );

  protected readonly aiOperatorLoad = computed(() =>
    this.activeAiModels().filter((model) => model.requiresOperator).length
  );

  protected readonly activeAiOperators = computed(() =>
    this.aiOperators().filter((operator) => operator.active)
  );

  protected readonly aiOperatorParallelSlots = computed(() =>
    this.activeAiOperators().reduce((sum, operator) => sum + operator.maxParallel, 0)
  );

  protected readonly aiOperatorAvailableCount = computed(() => this.activeAiOperators().length);

  protected readonly effectiveCapacity = computed(() => {
    const humanCapacity = this.capacity();
    const modelSlots = Math.max(1, this.aiModelParallelSlots());
    const needsOperator = this.aiOperatorLoad() > 0;
    const operatorSlots = needsOperator ? Math.max(1, this.aiOperatorParallelSlots()) : modelSlots;
    return Math.max(1, Math.min(humanCapacity, modelSlots, operatorSlots));
  });

  protected readonly criticalIds = computed(() => new Set((this.gantt()?.criticalPath.route ?? []).map((step) => step.id)));

  async ngOnInit(): Promise<void> {
    this.initializeTheme();
    this.preferredProjectSlug = new URLSearchParams(window.location.search).get('project');
    await this.loadProjects();
  }

  private initializeTheme(): void {
    let dark = false;
    try {
      const storedTheme = localStorage.getItem('ariadne-gantt-theme');
      if (storedTheme === 'dark') {
        dark = true;
      } else if (storedTheme === 'light') {
        dark = false;
      } else {
        dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
    } catch {
      dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    this.applyTheme(dark);
  }

  private applyTheme(dark: boolean): void {
    this.isDarkTheme.set(dark);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }

  protected toggleTheme(): void {
    const nextThemeIsDark = !this.isDarkTheme();
    this.applyTheme(nextThemeIsDark);

    try {
      localStorage.setItem('ariadne-gantt-theme', nextThemeIsDark ? 'dark' : 'light');
    } catch {
      // Persisting theme is optional; UI state is already applied.
    }
  }

  protected async loadProjects(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const data = await this.getAriadne<AriadneProject[]>('/api/projects');
      const projects = data ?? [];
      this.projects.set(projects);
      if (projects.length === 0) {
        this.selectedProject.set('');
        this.gantt.set(null);
        return;
      }
      const current = this.selectedProject();
      const preferred = this.preferredProjectSlug;
      if (preferred && projects.some((project) => project.slug === preferred)) {
        this.selectedProject.set(preferred);
        this.preferredProjectSlug = null;
      } else if (!projects.some((project) => project.slug === current)) {
        this.selectedProject.set(projects[0].slug);
      }
      await this.loadAiCapacityConfigForProject(this.selectedProject());
      await this.refreshGantt();
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'No se pudo cargar proyectos de Ariadne');
    } finally {
      this.loading.set(false);
    }
  }

  protected async refreshGantt(): Promise<void> {
    const project = this.selectedProject();
    if (!project) return;
    const previousTaskId = this.selectedTaskId();
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const params = new URLSearchParams({
        capacity: String(this.effectiveCapacity()),
        includeDone: this.includeDone() ? '1' : '0',
        iaHoursPerDay: String(this.iaHoursPerDay()),
        startDate: this.startDate(),
      });
      const holidaysCsv = this.effectiveHolidaysCsv();
      if (holidaysCsv) params.set('holidays', holidaysCsv);
      if (this.workOnSaturday()) params.set('workOnSaturday', '1');
      const path = `/api/projects/${encodeURIComponent(project)}/gantt?${params.toString()}`;
      const data = await this.getAriadne<GanttResponse>(path);
      this.gantt.set(data ?? null);
      if (data) this.ensureDefaultTimelineWindow(data);
      this.collapsedTaskIds.set(new Set());
      const nextTaskId = data?.tasks?.find((task) => task.id === previousTaskId)?.id
        ?? data?.tasks?.[0]?.id
        ?? null;
      this.selectedTaskId.set(nextTaskId);
      this.initializeDependencyEditor(nextTaskId);
      this.syncProjectQueryParam(project);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'No se pudo cargar el Gantt');
    } finally {
      this.loading.set(false);
    }
  }

  protected updateCapacity(value: string): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    this.capacity.set(Math.max(1, Math.min(12, Math.round(parsed))));
    void this.persistAiCapacityConfig();
  }

  protected async onProjectChange(slug: string): Promise<void> {
    this.selectedProject.set(slug);
    await this.loadAiCapacityConfigForProject(slug);
    await this.refreshGantt();
  }

  protected updateAiModelParallel(modelKey: string, value: string): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const next = Math.max(1, Math.min(6, Math.round(parsed)));
    this.aiModels.update((models) =>
      models.map((model) => (model.key === modelKey ? { ...model, maxParallel: next } : model))
    );
    void this.persistAiCapacityConfig();
    this.refreshGantt();
  }

  protected toggleAiModelEnabled(modelKey: string): void {
    this.aiModels.update((models) =>
      models.map((model) =>
        model.key === modelKey ? { ...model, enabled: !model.enabled } : model
      )
    );
    void this.persistAiCapacityConfig();
    this.refreshGantt();
  }

  protected toggleAiModelOperator(modelKey: string): void {
    const defaultOperator = this.aiOperators().find((operator) => operator.active) ?? this.aiOperators()[0] ?? null;
    this.aiModels.update((models) =>
      models.map((model) => {
        if (model.key !== modelKey) return model;
        const requiresOperator = !model.requiresOperator;
        if (!requiresOperator) return { ...model, requiresOperator };
        if (model.operatorId) return { ...model, requiresOperator };
        return {
          ...model,
          requiresOperator,
          operatorId: defaultOperator?.id || '',
          operatorName: defaultOperator?.name || model.operatorName,
        };
      })
    );
    void this.persistAiCapacityConfig();
    this.refreshGantt();
  }

  protected updateAiModelOperatorAssignment(modelKey: string, value: string): void {
    const operatorId = String(value || '').trim();
    const selected = this.aiOperators().find((operator) => operator.id === operatorId);
    this.aiModels.update((models) =>
      models.map((model) =>
        model.key === modelKey
          ? {
              ...model,
              operatorId,
              operatorName: selected?.name || '',
            }
          : model
      )
    );
    void this.persistAiCapacityConfig();
  }

  protected addAiOperator(): void {
    const nextIndex = this.aiOperators().length + 1;
    const operator: AiOperatorConfig = {
      id: `op-${Date.now()}`,
      name: `Operador ${nextIndex}`,
      active: true,
      maxParallel: 1,
      hoursPerDay: 8,
    };
    this.aiOperators.update((operators) => [...operators, operator]);
    void this.persistAiCapacityConfig();
    this.refreshGantt();
  }

  protected removeAiOperator(operatorId: string): void {
    this.aiOperators.update((operators) => operators.filter((operator) => operator.id !== operatorId));
    this.aiModels.update((models) =>
      models.map((model) =>
        model.operatorId === operatorId
          ? {
              ...model,
              operatorId: '',
              operatorName: '',
            }
          : model
      )
    );
    void this.persistAiCapacityConfig();
    this.refreshGantt();
  }

  protected toggleAiOperatorActive(operatorId: string): void {
    this.aiOperators.update((operators) =>
      operators.map((operator) =>
        operator.id === operatorId ? { ...operator, active: !operator.active } : operator
      )
    );
    void this.persistAiCapacityConfig();
    this.refreshGantt();
  }

  protected updateAiOperatorName(operatorId: string, value: string): void {
    const normalized = String(value || '').trim();
    this.aiOperators.update((operators) =>
      operators.map((operator) =>
        operator.id === operatorId ? { ...operator, name: normalized } : operator
      )
    );
    this.aiModels.update((models) =>
      models.map((model) =>
        model.operatorId === operatorId ? { ...model, operatorName: normalized } : model
      )
    );
    void this.persistAiCapacityConfig();
  }

  protected updateAiOperatorSlots(operatorId: string, value: string): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const slots = Math.max(1, Math.min(6, Math.round(parsed)));
    this.aiOperators.update((operators) =>
      operators.map((operator) =>
        operator.id === operatorId ? { ...operator, maxParallel: slots } : operator
      )
    );
    void this.persistAiCapacityConfig();
    this.refreshGantt();
  }

  protected updateAiOperatorHours(operatorId: string, value: string): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const hours = Math.max(1, Math.min(24, Math.round(parsed)));
    this.aiOperators.update((operators) =>
      operators.map((operator) =>
        operator.id === operatorId ? { ...operator, hoursPerDay: hours } : operator
      )
    );
    void this.persistAiCapacityConfig();
  }

  protected updateZoom(value: string): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    this.zoom.set(Math.max(18, Math.min(48, Math.round(parsed))));
  }

  protected resetTimelineRange(): void {
    this.timelineFrom.set('');
    this.timelineTo.set('');
  }

  protected shiftTimelineWindow(direction: -1 | 1): void {
    const ticks = this.dayTicks();
    if (!ticks.length) return;

    let span = Math.max(1, this.visibleEndDay() - this.visibleStartDay() + 1);
    if (span >= ticks.length && ticks.length > 45) {
      span = 45;
      const end = Math.min(ticks.length - 1, span - 1);
      this.timelineFrom.set(ticks[0]?.date || '');
      this.timelineTo.set(ticks[end]?.date || '');
    }
    const step = Math.max(1, Math.floor(span / 2));
    const maxStart = Math.max(0, ticks.length - span);
    const nextStart = Math.max(0, Math.min(maxStart, this.visibleStartDay() + direction * step));
    const nextEnd = Math.min(ticks.length - 1, nextStart + span - 1);

    this.timelineFrom.set(ticks[nextStart]?.date || '');
    this.timelineTo.set(ticks[nextEnd]?.date || '');
    this.resetTimelineScrollToStart();
  }

  protected shiftTimelineByMonths(direction: -1 | 1): void {
    const ticks = this.dayTicks();
    if (!ticks.length) return;

    const span = Math.max(1, this.visibleEndDay() - this.visibleStartDay() + 1);
    const currentStartIndex = this.visibleStartDay();
    const currentStartDate = this.parseIsoDate(ticks[currentStartIndex]?.date || ticks[0].date);
    const targetDate = new Date(currentStartDate);
    targetDate.setDate(targetDate.getDate() + direction * 14);
    const targetIso = this.formatIsoDate(targetDate);

    let targetIndex = ticks.findIndex((tick) => tick.date >= targetIso);
    if (targetIndex < 0) targetIndex = direction > 0 ? Math.max(0, ticks.length - span) : 0;

    const maxStart = Math.max(0, ticks.length - span);
    const start = Math.max(0, Math.min(maxStart, targetIndex));
    const end = Math.min(ticks.length - 1, start + span - 1);

    this.timelineFrom.set(ticks[start]?.date || '');
    this.timelineTo.set(ticks[end]?.date || '');
    this.resetTimelineScrollToStart();
  }

  protected openTimelineModal(): void {
    this.isTimelineModalOpen.set(true);
  }

  protected onMainTimelineClick(): void {
    if (this.suppressNextTimelineOpen) {
      this.suppressNextTimelineOpen = false;
      return;
    }
    this.openTimelineModal();
  }

  protected closeTimelineModal(): void {
    this.isTimelineModalOpen.set(false);
  }

  protected zoomBy(delta: number): void {
    const next = Math.max(16, Math.min(64, this.zoom() + delta));
    this.zoom.set(next);
  }

  protected onTimelinePointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    const origin = event.target;
    if (origin instanceof Element) {
      const interactive = origin.closest(
        'button, input, select, textarea, a, label, .task-row-left, .task-bar, .task-bar-label'
      );
      if (interactive) return;
    }
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;

    this.dragScrollTarget = target;
    this.dragPointerId = event.pointerId;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragStartLeft = target.scrollLeft;
    this.dragStartTop = target.scrollTop;
    this.dragMoved = false;

    target.classList.add('is-grabbing');
    target.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  protected onTimelinePointerMove(event: PointerEvent): void {
    if (!this.dragScrollTarget || this.dragPointerId !== event.pointerId) return;

    const dx = event.clientX - this.dragStartX;
    const dy = event.clientY - this.dragStartY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.dragMoved = true;

    this.dragScrollTarget.scrollLeft = this.dragStartLeft - dx;
    this.dragScrollTarget.scrollTop = this.dragStartTop - dy;
  }

  protected onTimelinePointerUp(event: PointerEvent): void {
    if (!this.dragScrollTarget || this.dragPointerId !== event.pointerId) return;

    this.dragScrollTarget.classList.remove('is-grabbing');
    try {
      this.dragScrollTarget.releasePointerCapture(event.pointerId);
    } catch {
      // releasePointerCapture can throw if capture was already released.
    }

    this.suppressNextTimelineOpen = this.dragMoved;
    this.dragScrollTarget = null;
    this.dragPointerId = null;
    this.dragMoved = false;
  }

  protected onTimelineWheel(event: WheelEvent): void {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;

    const dominantDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    target.scrollLeft += dominantDelta;
    event.preventDefault();
  }

  protected centerTimelineOnToday(): void {
    const ticks = this.dayTicks();
    if (!ticks.length) return;
    const today = new Date().toISOString().slice(0, 10);
    const todayIndex = ticks.findIndex((tick) => tick.date === today);
    if (todayIndex < 0) return;

    const span = Math.max(1, this.visibleEndDay() - this.visibleStartDay() + 1);
    const half = Math.floor(span / 2);
    const maxStart = Math.max(0, ticks.length - span);
    const start = Math.max(0, Math.min(maxStart, todayIndex - half));
    const end = Math.min(ticks.length - 1, start + span - 1);

    this.timelineFrom.set(ticks[start]?.date || '');
    this.timelineTo.set(ticks[end]?.date || '');
    this.resetTimelineScrollToStart();
  }

  protected setZoomPreset(preset: 'compact' | 'balanced' | 'detail'): void {
    const byPreset: Record<'compact' | 'balanced' | 'detail', number> = {
      compact: 22,
      balanced: 30,
      detail: 40,
    };
    this.zoom.set(byPreset[preset]);
  }

  protected selectTask(taskId: string): void {
    this.selectedTaskId.set(taskId);
    this.initializeDependencyEditor(taskId);
  }

  private dependencyDraftRowsFromTask(task: GanttTask | null): DependencyDraftRow[] {
    if (!task) return [];
    const links = Array.isArray(task.dependencyLinks) && task.dependencyLinks.length > 0
      ? task.dependencyLinks
      : (task.dependencies || []).map((id) => ({
          id,
          relation: 'FS' as const,
          lagBusinessDays: 0,
          lagIaHours: 0,
        }));

    const iaHours = Math.max(1, this.iaHoursPerDay());
    return links.map((link) => {
      const relation = (String(link.relation || 'FS').toUpperCase() as 'FS' | 'SS' | 'FF' | 'SF');
      const lagHours = Number(link.lagIaHours || 0);
      const lagDays = Number(link.lagBusinessDays || 0);
      const preferHours = lagHours !== 0 && (lagHours % iaHours !== 0);
      const lagValue = preferHours ? lagHours : lagDays;

      return {
        id: String(link.id || '').trim(),
        relation: ['FS', 'SS', 'FF', 'SF'].includes(relation) ? relation : 'FS',
        lagValue: String(Number.isFinite(lagValue) ? lagValue : 0),
        lagUnit: preferHours ? 'h' : 'd',
      };
    });
  }

  private initializeDependencyEditor(taskId: string | null): void {
    const task = taskId ? (this.gantt()?.tasks || []).find((item) => item.id === taskId) ?? null : null;
    this.dependencyDraftRows.set(this.dependencyDraftRowsFromTask(task));
    this.dependencySaveState.set('idle');
    this.dependencySaveMessage.set('');
  }

  protected addDependencyDraftRow(): void {
    const candidates = this.dependencyEditorCandidateTasks();
    const used = new Set(this.dependencyDraftRows().map((row) => row.id));
    const nextCandidate = candidates.find((task) => !used.has(task.id)) ?? candidates[0];
    const next: DependencyDraftRow = {
      id: nextCandidate?.id || '',
      relation: 'FS',
      lagValue: '0',
      lagUnit: 'd',
    };
    this.dependencyDraftRows.update((rows) => [...rows, next]);
  }

  protected removeDependencyDraftRow(index: number): void {
    this.dependencyDraftRows.update((rows) => rows.filter((_, rowIndex) => rowIndex !== index));
  }

  protected updateDependencyDraftTask(index: number, taskId: string): void {
    this.dependencyDraftRows.update((rows) =>
      rows.map((row, rowIndex) => (rowIndex === index ? { ...row, id: String(taskId || '').trim() } : row))
    );
  }

  protected updateDependencyDraftRelation(index: number, relation: string): void {
    const normalized = String(relation || 'FS').toUpperCase();
    const safe = (['FS', 'SS', 'FF', 'SF'].includes(normalized) ? normalized : 'FS') as 'FS' | 'SS' | 'FF' | 'SF';
    this.dependencyDraftRows.update((rows) =>
      rows.map((row, rowIndex) => (rowIndex === index ? { ...row, relation: safe } : row))
    );
  }

  protected updateDependencyDraftLagValue(index: number, lagValue: string): void {
    this.dependencyDraftRows.update((rows) =>
      rows.map((row, rowIndex) => (rowIndex === index ? { ...row, lagValue: String(lagValue || '0') } : row))
    );
  }

  protected updateDependencyDraftLagUnit(index: number, lagUnit: string): void {
    const safe = String(lagUnit || 'd').toLowerCase() === 'h' ? 'h' : 'd';
    this.dependencyDraftRows.update((rows) =>
      rows.map((row, rowIndex) => (rowIndex === index ? { ...row, lagUnit: safe } : row))
    );
  }

  private dependencyToken(row: DependencyDraftRow): string | null {
    const id = String(row.id || '').trim();
    if (!id) return null;
    const relation = String(row.relation || 'FS').toUpperCase();
    const safeRelation = ['FS', 'SS', 'FF', 'SF'].includes(relation) ? relation : 'FS';
    const lag = Math.round(Number(row.lagValue || '0'));
    if (!Number.isFinite(lag) || lag === 0) return `${id}:${safeRelation}`;
    const unit = row.lagUnit === 'h' ? 'h' : 'd';
    const signed = lag > 0 ? `+${lag}` : String(lag);
    return `${id}:${safeRelation}${signed}${unit}`;
  }

  protected async saveSelectedTaskDependencies(): Promise<void> {
    const projectSlug = this.selectedProject();
    const taskId = this.selectedTaskId();
    if (!projectSlug || !taskId) {
      this.dependencySaveState.set('error');
      this.dependencySaveMessage.set('Selecciona proyecto y tarea para guardar dependencias.');
      return;
    }

    const seen = new Set<string>();
    const tokens: string[] = [];
    for (const row of this.dependencyDraftRows()) {
      const token = this.dependencyToken(row);
      if (!token) continue;
      const depId = token.split(':')[0];
      if (depId.toLowerCase() === taskId.toLowerCase()) {
        this.dependencySaveState.set('error');
        this.dependencySaveMessage.set('Una tarea no puede depender de sí misma.');
        return;
      }
      if (seen.has(depId.toLowerCase())) continue;
      seen.add(depId.toLowerCase());
      tokens.push(token);
    }

    this.dependencySaveState.set('saving');
    this.dependencySaveMessage.set('Guardando dependencias...');
    try {
      const path = `/api/projects/${encodeURIComponent(projectSlug)}/tasks/dependencies`;
      await this.postAriadne(path, { id: taskId, dependencies: tokens });
      this.dependencySaveState.set('done');
      this.dependencySaveMessage.set(`Dependencias guardadas (${tokens.length}).`);
      await this.refreshGantt();
      this.selectTask(taskId);
    } catch (error) {
      this.dependencySaveState.set('error');
      this.dependencySaveMessage.set(error instanceof Error ? error.message : 'No se pudieron guardar dependencias');
    }
  }

  protected toggleTaskCollapse(taskId: string): void {
    const next = new Set(this.collapsedTaskIds());
    if (next.has(taskId)) next.delete(taskId);
    else next.add(taskId);
    this.collapsedTaskIds.set(next);
  }

  protected isTaskCollapsed(taskId: string): boolean {
    return this.collapsedTaskIds().has(taskId);
  }

  protected taskIsCritical(taskId: string): boolean {
    return this.criticalIds().has(taskId);
  }

  protected laneLabel(lane: string): string {
    return lane === 'bugs' ? 'Bugs' : 'Mejoras';
  }

  protected taskBarStyle(task: GanttTask): Record<string, string> {
    const px = this.zoom();
    const windowStart = this.visibleStartDay();
    const windowEnd = this.visibleEndDay();
    const startDay = this.taskStartDay(task);
    const endDay = this.taskEndDay(task);
    if (endDay < windowStart || startDay > windowEnd) {
      return { display: 'none' };
    }
    const clampedStart = Math.max(startDay, windowStart);
    const clampedEnd = Math.min(endDay, windowEnd);
    const left = (clampedStart - windowStart) * px;
    const width = Math.max(10, (clampedEnd - clampedStart + 1) * px - 4);
    return { left: `${left}px`, width: `${width}px` };
  }

  protected taskLabelStyle(task: GanttTask): Record<string, string> {
    const px = this.zoom();
    const windowStart = this.visibleStartDay();
    const windowEnd = this.visibleEndDay();
    const startDay = this.taskStartDay(task);
    const endDay = this.taskEndDay(task);
    if (endDay < windowStart || startDay > windowEnd) {
      return { display: 'none' };
    }
    const clampedEnd = Math.min(endDay, windowEnd);
    const preferredLeft = (clampedEnd - windowStart + 1) * px + 12;
    const boundedLeft = Math.min(preferredLeft, Math.max(12, this.timelineWidth() - 220));
    return { left: `${boundedLeft}px` };
  }

  protected dependencySummary(task: GanttTask): string {
    if (!task.dependencies?.length) return 'Sin dependencias';
    return task.dependencies.join(', ');
  }

  protected selectedTask(): GanttTask | null {
    const taskId = this.selectedTaskId();
    if (!taskId) return null;
    return this.filteredTasks().find((task) => task.id === taskId) ?? null;
  }

  protected taskClass(task: GanttTask): string {
    const classes = [`lane-${task.lane}`];
    if (this.taskIsCritical(task.id) && this.showCriticalPath()) classes.push('critical');
    if (this.selectedTaskId() === task.id) classes.push('selected');
    if (task.canRunInParallel) classes.push('parallel-ready');
    if (this.dependencyTargets().has(task.id)) classes.push('has-dependency');
    return classes.join(' ');
  }

  protected taskTooltip(task: GanttTask): string {
    const critical = this.taskIsCritical(task.id) ? 'Si' : 'No';
    const slackHours = this.taskSlackIaHours(task);
    const slackDays = this.taskSlackCalendarDays(task);
    const deps = task.dependencies?.length ? task.dependencies.join(', ') : 'Sin dependencias';
    return [
      `${task.id} · ${task.title}`,
      `Ruta critica: ${critical}`,
      `Ventana: ${task.startDate} -> ${task.endDate}`,
      `Duracion: ${task.durationIaHours} h IA`,
      `Holgura estimada: ${slackHours} h IA (${slackDays} dias calendario)`,
      `Dependencias: ${deps}`,
    ].join('\n');
  }

  protected assigneesForTask(task: GanttTask): AiBadge[] {
    const pool = this.activeAiModels().map((model) => ({
      key: model.key,
      label: model.name,
      initials: model.initials,
    }));
    const fallbackPool: AiBadge[] = [
      { key: 'gpt', label: 'GPT-5.3-Codex', initials: 'GPT' },
      { key: 'cla', label: 'Claude Sonnet', initials: 'CLA' },
      { key: 'gem', label: 'Gemini Pro', initials: 'GEM' },
    ];
    const source = pool.length > 0 ? pool : fallbackPool;
    let hash = 0;
    for (let i = 0; i < task.id.length; i += 1) hash = (hash * 31 + task.id.charCodeAt(i)) >>> 0;
    const count = Math.max(1, Math.min(3, Math.ceil(task.durationIaHours / 16)));
    return Array.from({ length: count }, (_, index) => source[(hash + index) % source.length]);
  }

  protected primaryModelForTask(task: GanttTask): AiBadge | null {
    const assigned = this.assigneesForTask(task);
    return assigned[0] ?? null;
  }

  protected assigneeClass(badgeKey: string): string {
    const palette: Record<string, string> = {
      gpt: 'tone-ma',
      cla: 'tone-qa',
      gem: 'tone-be',
      llm: 'tone-fe',
    };
    return palette[badgeKey] ?? 'tone-ma';
  }

  protected assigneeInitials(badge: AiBadge): string {
    return badge.initials;
  }

  protected statusLabel(task: GanttTask): string {
    const raw = (task.status || '').trim().toLowerCase();
    if (raw.includes('done') || raw.includes('closed') || raw.includes('complete')) return 'Done';
    if (raw.includes('progress') || raw.includes('doing') || raw.includes('active')) return 'En curso';
    if (task.pendingDependencies.length > 0) return 'Bloqueada';
    return 'Pendiente';
  }

  private taskStateBucket(task: GanttTask): 'pending' | 'in-progress' | 'done' | 'blocked' {
    const label = this.statusLabel(task);
    if (label === 'Done') return 'done';
    if (label === 'En curso') return 'in-progress';
    if (label === 'Bloqueada') return 'blocked';
    return 'pending';
  }

  protected statusClass(task: GanttTask): string {
    const label = this.statusLabel(task);
    if (label === 'Done') return 'status-done';
    if (label === 'En curso') return 'status-progress';
    if (label === 'Bloqueada') return 'status-blocked';
    return 'status-pending';
  }

  protected statusIcon(task: GanttTask): string {
    const label = this.statusLabel(task);
    if (label === 'Done') return '✓';
    if (label === 'En curso') return '◔';
    if (label === 'Bloqueada') return '!';
    return '○';
  }

  protected taskProgressPercent(task: GanttTask): number {
    const status = this.statusLabel(task);
    if (status === 'Done') return 100;
    if (status === 'En curso') return 65;
    if (status === 'Bloqueada') return 25;
    if (task.pendingDependencies.length > 0) return 15;
    return 10;
  }

  protected shortWeekday(dayLabel: string, dayIndex: number): string {
    const key = (dayLabel || '').trim().toLowerCase();
    if (!key) return ['L', 'M', 'X', 'J', 'V', 'S', 'D'][dayIndex % 7];

    const map: Record<string, string> = {
      mon: 'L',
      monday: 'L',
      lun: 'L',
      lunes: 'L',
      tue: 'M',
      tuesday: 'M',
      mar: 'M',
      martes: 'M',
      wed: 'X',
      wednesday: 'X',
      mie: 'X',
      miercoles: 'X',
      mié: 'X',
      miércoles: 'X',
      thu: 'J',
      thursday: 'J',
      jue: 'J',
      jueves: 'J',
      fri: 'V',
      friday: 'V',
      vie: 'V',
      viernes: 'V',
      sat: 'S',
      saturday: 'S',
      sab: 'S',
      sabado: 'S',
      sáb: 'S',
      sábado: 'S',
      sun: 'D',
      sunday: 'D',
      dom: 'D',
      domingo: 'D',
    };

    return map[key] ?? key.charAt(0).toUpperCase();
  }

  protected dayTickTitle(day: { date: string; isHoliday: boolean; holidayName: string; isSaturday: boolean; isSunday: boolean }): string {
    const date = day.date || 'Sin fecha';
    if (day.isHoliday) return `${date} · ${day.holidayName || 'Festivo'}`;
    if (day.isSunday) return `${date} · Domingo`;
    if (day.isSaturday) return `${date} · Sabado`;
    return date;
  }

  private holidayNameForDate(date: string, isHoliday: boolean): string {
    if (!isHoliday || !date) return '';

    const known = this.colombiaHolidayNameMapForDate(date);
    if (known) return known;

    const configured = new Set(this.gantt()?.parameters?.holidays ?? []);
    if (configured.has(date)) return 'Festivo configurado';

    return 'Festivo';
  }

  private colombiaHolidayNameMapForDate(date: string): string | null {
    const year = Number(date.slice(0, 4));
    if (!Number.isFinite(year)) return null;
    const map = new Map<string, string>();
    for (const y of [year - 1, year, year + 1]) {
      for (const entry of this.colombiaHolidayEntries(y)) {
        map.set(entry.date, entry.name);
      }
    }
    return map.get(date) ?? null;
  }

  private colombiaHolidayEntries(year: number): { date: string; name: string }[] {
    return [
      { date: `${year}-01-01`, name: 'Ano Nuevo' },
      { date: this.moveToMonday(year, 1, 6), name: 'Reyes Magos' },
      { date: this.moveToMonday(year, 3, 19), name: 'San Jose' },
      { date: this.shiftDate(this.easterDate(year), -3), name: 'Jueves Santo' },
      { date: this.shiftDate(this.easterDate(year), -2), name: 'Viernes Santo' },
      { date: `${year}-05-01`, name: 'Dia del Trabajo' },
      { date: this.moveToMondayDate(this.shiftDateObj(this.easterDate(year), 43)), name: 'Ascension' },
      { date: this.moveToMondayDate(this.shiftDateObj(this.easterDate(year), 64)), name: 'Corpus Christi' },
      { date: this.moveToMondayDate(this.shiftDateObj(this.easterDate(year), 71)), name: 'Sagrado Corazon' },
      { date: this.moveToMonday(year, 6, 29), name: 'San Pedro y San Pablo' },
      { date: `${year}-07-20`, name: 'Independencia de Colombia' },
      { date: `${year}-08-07`, name: 'Batalla de Boyaca' },
      { date: this.moveToMonday(year, 8, 15), name: 'Asuncion de la Virgen' },
      { date: this.moveToMonday(year, 10, 12), name: 'Dia de la Raza' },
      { date: this.moveToMonday(year, 11, 1), name: 'Todos los Santos' },
      { date: this.moveToMonday(year, 11, 11), name: 'Independencia de Cartagena' },
      { date: `${year}-12-08`, name: 'Inmaculada Concepcion' },
      { date: `${year}-12-25`, name: 'Navidad' },
    ];
  }

  private formatShortDate(isoDate: string): string {
    if (!isoDate) return '-';
    const [year, month, day] = isoDate.split('-');
    if (!year || !month || !day) return isoDate;
    return `${day}/${month}/${year.slice(2)}`;
  }

  private aiCapacityStorageKey(projectSlug: string): string {
    return `ariadne-ai-capacity:${projectSlug || 'default'}`;
  }

  private async loadAiCapacityConfigForProject(projectSlug: string): Promise<void> {
    if (!projectSlug) return;
    try {
      const fromApi = await this.getAriadne<{ project: string; config: AiCapacityStorage | null }>(
        `/api/projects/${encodeURIComponent(projectSlug)}/ai-capacity-config`
      );
      if (fromApi?.config) {
        this.applyAiCapacityConfig(fromApi.config);
        await this.loadAiOperatorsForProject(projectSlug);
        this.markAiCapacitySynced();
        try {
          localStorage.setItem(this.aiCapacityStorageKey(projectSlug), JSON.stringify(fromApi.config));
        } catch {
          // ignore storage sync errors
        }
        return;
      }

      const raw = localStorage.getItem(this.aiCapacityStorageKey(projectSlug));
      if (!raw) return;
      const parsed = JSON.parse(raw) as AiCapacityStorage;
      this.applyAiCapacityConfig(parsed);
      await this.loadAiOperatorsForProject(projectSlug);
      this.aiCapacitySyncState.set('local-only');
    } catch {
      // Ignore invalid local storage payloads.
    }
  }

  private async persistAiCapacityConfig(): Promise<void> {
    const projectSlug = this.selectedProject();
    if (!projectSlug) return;
    const payload: AiCapacityStorage = {
      capacity: this.capacity(),
      aiModels: this.aiModels(),
      operators: this.aiOperators(),
    };
    try {
      localStorage.setItem(this.aiCapacityStorageKey(projectSlug), JSON.stringify(payload));
    } catch {
      // Persisting config is optional.
    }

    this.aiCapacitySyncState.set('saving');
    try {
      await this.postAriadne(`/api/projects/${encodeURIComponent(projectSlug)}/ai-capacity-config`, payload);
      await this.persistAiOperatorsForProject(projectSlug);
      this.markAiCapacitySynced();
    } catch {
      // Keep local fallback when backend save fails.
      this.aiCapacitySyncState.set('local-only');
    }
  }

  private async loadAiOperatorsForProject(projectSlug: string): Promise<void> {
    try {
      const fromApi = await this.getAriadne<{ project: string; operators: AiOperatorConfig[] }>(
        `/api/projects/${encodeURIComponent(projectSlug)}/ai-operators`
      );
      const incoming = Array.isArray(fromApi?.operators) ? fromApi.operators : [];
      if (!incoming.length) return;
      const normalized = incoming
        .map((operator) => ({
          id: String(operator.id || '').trim(),
          name: String(operator.name || '').trim(),
          active: operator.active !== false,
          maxParallel: Math.max(1, Math.min(6, Number(operator.maxParallel) || 1)),
          hoursPerDay: Math.max(1, Math.min(24, Number(operator.hoursPerDay) || 8)),
        }))
        .filter((operator) => operator.id);
      if (normalized.length > 0) {
        this.aiOperators.set(normalized);
        this.aiModels.update((models) => this.syncAiModelOperators(models, normalized));
      }
    } catch {
      // Dedicated operators endpoint is optional; capacity payload remains source of truth fallback.
    }
  }

  private async persistAiOperatorsForProject(projectSlug: string): Promise<void> {
    try {
      await this.postAriadne(`/api/projects/${encodeURIComponent(projectSlug)}/ai-operators`, {
        operators: this.aiOperators(),
      });
    } catch {
      // Ignore to avoid blocking config save when operators endpoint is unavailable.
    }
  }

  private markAiCapacitySynced(): void {
    this.aiCapacitySyncState.set('synced');
    if (this.aiCapacityStatusResetHandle) clearTimeout(this.aiCapacityStatusResetHandle);
    this.aiCapacityStatusResetHandle = setTimeout(() => {
      this.aiCapacitySyncState.set('idle');
      this.aiCapacityStatusResetHandle = null;
    }, 3500);
  }

  private applyAiCapacityConfig(parsed: AiCapacityStorage): void {
    if (typeof parsed.capacity === 'number' && Number.isFinite(parsed.capacity)) {
      this.capacity.set(Math.max(1, Math.min(12, Math.round(parsed.capacity))));
    }
    if (Array.isArray(parsed.aiModels) && parsed.aiModels.length > 0) {
      const currentByKey = new Map(this.aiModels().map((model) => [model.key, model]));
      const merged = parsed.aiModels.map((model) => ({
        ...(currentByKey.get(model.key) ?? model),
        ...model,
        maxParallel: Math.max(1, Math.min(6, Number(model.maxParallel) || 1)),
        operatorId: String(model.operatorId || '').trim(),
      }));
      this.aiModels.set(this.syncAiModelOperators(merged, this.aiOperators()));
    }
    if (Array.isArray(parsed.operators)) {
      const normalized = parsed.operators
        .map((operator) => ({
          id: String(operator.id || '').trim(),
          name: String(operator.name || '').trim(),
          active: operator.active !== false,
          maxParallel: Math.max(1, Math.min(6, Number(operator.maxParallel) || 1)),
          hoursPerDay: Math.max(1, Math.min(24, Number(operator.hoursPerDay) || 8)),
        }))
        .filter((operator) => operator.id);
      if (normalized.length > 0) {
        this.aiOperators.set(normalized);
        this.aiModels.update((models) => this.syncAiModelOperators(models, normalized));
      }
    }
  }

  private syncAiModelOperators(models: AiModelConfig[], operators: AiOperatorConfig[]): AiModelConfig[] {
    const byId = new Map(operators.map((operator) => [operator.id, operator.name]));
    const byName = new Map(
      operators
        .filter((operator) => operator.name)
        .map((operator) => [operator.name.trim().toLowerCase(), operator.id])
    );

    return models.map((model) => {
      let operatorId = String(model.operatorId || '').trim();
      let operatorName = String(model.operatorName || '').trim();

      if (!operatorId && operatorName) {
        const recoveredId = byName.get(operatorName.toLowerCase());
        if (recoveredId) operatorId = recoveredId;
      }

      if (operatorId) operatorName = byId.get(operatorId) || operatorName;

      return {
        ...model,
        operatorId,
        operatorName,
      };
    });
  }

  private taskSlackIaHours(task: GanttTask): number {
    const tasksById = new Map(this.filteredTasks().map((item) => [item.id, item]));
    const successorStartHours = this.effectiveDependencyEdges()
      .filter((edge) => edge.fromId === task.id)
      .map((edge) => tasksById.get(edge.toId)?.startIaHour)
      .filter((value): value is number => Number.isFinite(value));

    if (successorStartHours.length > 0) {
      return Math.max(0, Math.min(...successorStartHours) - task.endIaHour);
    }

    const projectEndIaHour = this.filteredTasks().reduce(
      (max, item) => Math.max(max, item.endIaHour),
      task.endIaHour
    );
    return Math.max(0, projectEndIaHour - task.endIaHour);
  }

  private taskSlackCalendarDays(task: GanttTask): number {
    const tasksById = new Map(this.filteredTasks().map((item) => [item.id, item]));
    const successorStartDays = this.effectiveDependencyEdges()
      .filter((edge) => edge.fromId === task.id)
      .map((edge) => {
        const successor = tasksById.get(edge.toId);
        return successor ? this.taskStartDay(successor) : undefined;
      })
      .filter((value): value is number => Number.isFinite(value));

    if (successorStartDays.length > 0) {
      return Math.max(0, Math.min(...successorStartDays) - this.taskEndDay(task) - 1);
    }

    const projectEndCalendarDay = this.filteredTasks().reduce(
      (max, item) => Math.max(max, this.taskEndDay(item)),
      this.taskEndDay(task)
    );
    return Math.max(0, projectEndCalendarDay - this.taskEndDay(task));
  }

  private taskStartDay(task: GanttTask): number {
    if (task.startCalendarDay !== undefined && task.startCalendarDay !== null) return task.startCalendarDay;
    return this.businessDayToCalendarDay(task.startDay ?? 0);
  }

  private taskEndDay(task: GanttTask): number {
    if (task.endCalendarDay !== undefined && task.endCalendarDay !== null) return task.endCalendarDay;
    return this.businessDayToCalendarDay(task.endDay ?? task.startDay ?? 0);
  }

  private businessDayToCalendarDay(businessDay: number): number {
    const marker = this.dayTicks().find((tick) => tick.businessDayIndex === businessDay);
    return marker ? marker.dayIndex : businessDay;
  }

  private parseIsoDate(value: string): Date {
    const [year, month, day] = (value || '').split('-').map(Number);
    if (!year || !month || !day) {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    return new Date(year, month - 1, day);
  }

  private formatMonthLabel(date: Date): string {
    const month = new Intl.DateTimeFormat('es-CO', { month: 'short' }).format(date).replace('.', '');
    return `${month} ${date.getFullYear()}`;
  }

  protected updateIaHoursPerDay(value: string): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    this.iaHoursPerDay.set(Math.max(1, Math.min(24, Math.round(parsed))));
  }

  protected clearBulkTaskEdits(): void {
    this.bulkEstimateIaHours.set('');
    this.bulkEstimateDays.set('');
    this.bulkStartedDate.set('');
    this.bulkDueDate.set('');
    this.bulkAssignees.set('');
    this.bulkEditState.set('idle');
    this.bulkEditMessage.set('');
    this.bulkEditReport.set(null);
  }

  protected async runBulkTaskEdit(dryRun: boolean): Promise<void> {
    const projectSlug = this.selectedProject();
    if (!projectSlug) {
      this.bulkEditState.set('error');
      this.bulkEditMessage.set('Selecciona un proyecto antes de aplicar cambios masivos.');
      return;
    }

    const taskIds = this.bulkCandidateTasks().map((task) => task.id);
    if (!taskIds.length) {
      this.bulkEditState.set('error');
      this.bulkEditMessage.set('No hay tareas en el grupo seleccionado para editar.');
      return;
    }

    const updates: BulkTaskEditUpdates = {};

    const estimateIaText = this.bulkEstimateIaHours().trim();
    if (estimateIaText) {
      const estimateIa = Number(estimateIaText);
      if (!Number.isFinite(estimateIa) || estimateIa <= 0) {
        this.bulkEditState.set('error');
        this.bulkEditMessage.set('estimate_ia_hours debe ser un número mayor que cero.');
        return;
      }
      updates.estimateIaHours = Math.round(estimateIa);
    }

    const estimateDaysText = this.bulkEstimateDays().trim();
    if (estimateDaysText) {
      const estimateDays = Number(estimateDaysText);
      if (!Number.isFinite(estimateDays) || estimateDays <= 0) {
        this.bulkEditState.set('error');
        this.bulkEditMessage.set('estimate_days debe ser un número mayor que cero.');
        return;
      }
      updates.estimateDays = Math.round(estimateDays);
    }

    const startedDate = this.bulkStartedDate().trim();
    if (startedDate) updates.startedDate = startedDate;

    const dueDate = this.bulkDueDate().trim();
    if (dueDate) updates.dueDate = dueDate;

    const assigneesCsv = this.bulkAssignees().trim();
    if (assigneesCsv) {
      updates.assignees = assigneesCsv
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    }

    if (!Object.keys(updates).length) {
      this.bulkEditState.set('error');
      this.bulkEditMessage.set('Define al menos un campo antes de ejecutar edición masiva.');
      return;
    }

    this.bulkEditState.set('saving');
    this.bulkEditMessage.set(dryRun ? 'Simulando cambios...' : 'Aplicando cambios...');

    try {
      const path = `/api/projects/${encodeURIComponent(projectSlug)}/tasks/bulk-edit`;
      const report = await this.postAriadne<BulkTaskEditReport>(path, {
        taskIds,
        updates,
        dryRun,
      });

      const safeReport: BulkTaskEditReport = report ?? {
        project: projectSlug,
        dryRun,
        received: taskIds.length,
        updateKeys: Object.keys(updates),
        updatedCount: 0,
        skippedCount: taskIds.length,
        errorCount: 0,
        updated: [],
        skipped: taskIds.map((id) => ({ id, reason: 'unknown' })),
        errors: [],
      };

      this.bulkEditReport.set(safeReport);
      this.bulkEditState.set('done');
      this.bulkEditMessage.set(
        `${dryRun ? 'Preview' : 'Aplicación'}: ${safeReport.updatedCount} actualizadas, ${safeReport.skippedCount} sin cambio, ${safeReport.errorCount} con error.`
      );

      if (!dryRun && safeReport.updatedCount > 0) await this.refreshGantt();
    } catch (error) {
      this.bulkEditState.set('error');
      this.bulkEditMessage.set(error instanceof Error ? error.message : 'No se pudo aplicar la edición masiva');
    }
  }

  protected toggleIncludeDone(value: boolean): void {
    this.includeDone.set(value);
  }

  protected projectNameFromSlug(slug: string): string {
    return this.projects().find((project) => project.slug === slug)?.name || slug;
  }

  protected toggleColombiaHolidays(): void {
    this.useColombiaHolidays.set(!this.useColombiaHolidays());
    this.refreshGantt();
  }

  private effectiveHolidaysCsv(): string {
    const manual = this.holidaysInput()
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const auto = this.useColombiaHolidays() ? this.currentAutoHolidays() : [];
    return [...new Set([...manual, ...auto])].join(',');
  }

  private currentAutoHolidays(): string[] {
    const parsedYear = Number(this.startDate().slice(0, 4));
    const year = Number.isFinite(parsedYear) && parsedYear > 1900 ? parsedYear : new Date().getFullYear();
    return [...new Set([...this.colombiaHolidays(year), ...this.colombiaHolidays(year + 1)])].sort();
  }

  private colombiaHolidays(year: number): string[] {
    const fixed = [
      `${year}-01-01`,
      `${year}-05-01`,
      `${year}-07-20`,
      `${year}-08-07`,
      `${year}-12-08`,
      `${year}-12-25`,
    ];

    const emiliani = [
      this.moveToMonday(year, 1, 6),
      this.moveToMonday(year, 3, 19),
      this.moveToMonday(year, 6, 29),
      this.moveToMonday(year, 8, 15),
      this.moveToMonday(year, 10, 12),
      this.moveToMonday(year, 11, 1),
      this.moveToMonday(year, 11, 11),
    ];

    const easter = this.easterDate(year);
    const easterBased = [
      this.shiftDate(easter, -3),
      this.shiftDate(easter, -2),
      this.moveToMondayDate(this.shiftDateObj(easter, 43)),
      this.moveToMondayDate(this.shiftDateObj(easter, 64)),
      this.moveToMondayDate(this.shiftDateObj(easter, 71)),
    ];

    return [...fixed, ...emiliani, ...easterBased];
  }

  private moveToMonday(year: number, month: number, day: number): string {
    return this.moveToMondayDate(new Date(year, month - 1, day));
  }

  private moveToMondayDate(date: Date): string {
    const moved = new Date(date);
    while (moved.getDay() !== 1) moved.setDate(moved.getDate() + 1);
    return this.formatIsoDate(moved);
  }

  private shiftDate(date: Date, deltaDays: number): string {
    return this.formatIsoDate(this.shiftDateObj(date, deltaDays));
  }

  private shiftDateObj(date: Date, deltaDays: number): Date {
    const shifted = new Date(date);
    shifted.setDate(shifted.getDate() + deltaDays);
    return shifted;
  }

  private easterDate(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  private formatIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private ensureDefaultTimelineWindow(data: GanttResponse): void {
    if (this.timelineFrom() || this.timelineTo()) return;
    const ticks = data.dayMarkers ?? [];
    if (!ticks.length) return;

    const windowSize = Math.min(45, ticks.length);
    const todayIso = new Date().toISOString().slice(0, 10);
    const todayIndex = ticks.findIndex((tick) => tick.date === todayIso);
    const startIndex = todayIndex >= 0
      ? Math.max(0, Math.min(ticks.length - windowSize, todayIndex - Math.floor(windowSize / 2)))
      : 0;
    const endIndex = Math.min(ticks.length - 1, startIndex + windowSize - 1);

    this.timelineFrom.set(ticks[startIndex]?.date || '');
    this.timelineTo.set(ticks[endIndex]?.date || '');
    this.resetTimelineScrollToStart();
  }

  private resetTimelineScrollToStart(): void {
    const scrollers = document.querySelectorAll<HTMLElement>('.timeline-scroll, .timeline-modal-scroll');
    for (const scroller of scrollers) {
      scroller.scrollLeft = 0;
    }
  }

  private syncProjectQueryParam(projectSlug: string): void {
    const url = new URL(window.location.href);
    if (projectSlug) url.searchParams.set('project', projectSlug);
    else url.searchParams.delete('project');
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  private async getAriadne<T>(path: string): Promise<T | null> {
    const fromProxy = await this.http.get<T>(`${this.proxyBase}${path}`).toPromise().catch(() => null);
    if (fromProxy !== null && fromProxy !== undefined) return fromProxy;
    const direct = await this.http.get<T>(`${this.directBase}${path}`).toPromise();
    return direct ?? null;
  }

  private async postAriadne<TResponse>(path: string, payload: unknown): Promise<TResponse | null> {
    const fromProxy = await this.http
      .post<TResponse>(`${this.proxyBase}${path}`, payload)
      .toPromise()
      .catch(() => null);
    if (fromProxy !== null && fromProxy !== undefined) return fromProxy;
    const direct = await this.http.post<TResponse>(`${this.directBase}${path}`, payload).toPromise();
    return direct ?? null;
  }

  protected themeIconPath(): string {
    return this.isDarkTheme() ? 'assets/icons/brillo-alto.svg' : 'assets/icons/modo-oscuro.svg';
  }
}
