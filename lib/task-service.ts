import { addDays } from 'date-fns';

export interface User {
  id: string;
  name: string;
  image: string;
}

export interface TaskStatus {
  id: string;
  name: string;
  color: string;
}

export interface TaskGroup {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  name: string;
  description?: string;
  startAt: Date;
  endAt: Date;
  status: TaskStatus;
  column: string; // For Kanban
  lane: string; // For Gantt
  group: TaskGroup;
  owner: User;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskData {
  name: string;
  description?: string;
  startAt: Date;
  endAt?: Date;
  statusId: string;
  groupId: string;
  ownerId: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
}

export interface UpdateTaskData {
  id: string;
  name?: string;
  description?: string;
  startAt?: Date;
  endAt?: Date;
  statusId?: string;
  groupId?: string;
  ownerId?: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
}

// Sample data
export const statuses: TaskStatus[] = [
  { id: 'planned', name: 'Planned', color: '#6B7280' },
  { id: 'in-progress', name: 'In Progress', color: '#F59E0B' },
  { id: 'review', name: 'Review', color: '#8B5CF6' },
  { id: 'done', name: 'Done', color: '#10B981' },
  { id: 'blocked', name: 'Blocked', color: '#EF4444' },
];

export const groups: TaskGroup[] = [
  { id: 'frontend', name: 'Frontend Development' },
  { id: 'backend', name: 'Backend Development' },
  { id: 'devops', name: 'DevOps' },
  { id: 'qa', name: 'Quality Assurance' },
  { id: 'design', name: 'Design' },
];

export const users: User[] = [
  { 
    id: '1', 
    name: 'John Doe', 
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face' 
  },
  { 
    id: '2', 
    name: 'Jane Smith', 
    image: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=32&h=32&fit=crop&crop=face' 
  },
  { 
    id: '3', 
    name: 'Mike Johnson', 
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=32&h=32&fit=crop&crop=face' 
  },
  { 
    id: '4', 
    name: 'Sarah Wilson', 
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=32&h=32&fit=crop&crop=face' 
  },
  { 
    id: '5', 
    name: 'Alex Chen', 
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=32&h=32&fit=crop&crop=face' 
  },
];

// Kanban columns mapping
export const kanbanColumns = [
  { id: 'planned', name: 'Planned', color: '#6B7280' },
  { id: 'in-progress', name: 'In Progress', color: '#F59E0B' },
  { id: 'review', name: 'Review', color: '#8B5CF6' },
  { id: 'done', name: 'Done', color: '#10B981' },
];

class TaskService {
  private tasks: Task[] = [];
  private nextId = 1;

  constructor() {
    this.initializeSampleTasks();
  }

  private initializeSampleTasks() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const sampleTasks: Task[] = [
      {
        id: '1',
        name: 'User Authentication System',
        description: 'Implement secure user authentication with JWT tokens',
        startAt: new Date(currentYear, currentMonth, 1),
        endAt: new Date(currentYear, currentMonth, 15),
        status: statuses[1], // In Progress
        column: 'in-progress',
        lane: 'Frontend Development',
        group: groups[0],
        owner: users[0],
        priority: 'high',
        tags: ['authentication', 'security', 'frontend'],
        createdAt: new Date(currentYear, currentMonth - 1, 20),
        updatedAt: new Date(currentYear, currentMonth, 5),
      },
      {
        id: '2',
        name: 'Database Schema Design',
        description: 'Design and implement the core database schema',
        startAt: new Date(currentYear, currentMonth, 5),
        endAt: new Date(currentYear, currentMonth, 20),
        status: statuses[1], // In Progress
        column: 'in-progress',
        lane: 'Backend Development',
        group: groups[1],
        owner: users[1],
        priority: 'high',
        tags: ['database', 'backend', 'schema'],
        createdAt: new Date(currentYear, currentMonth - 1, 25),
        updatedAt: new Date(currentYear, currentMonth, 8),
      },
      {
        id: '3',
        name: 'API Endpoints Development',
        description: 'Create RESTful API endpoints for the application',
        startAt: new Date(currentYear, currentMonth, 15),
        endAt: new Date(currentYear, currentMonth + 1, 5),
        status: statuses[0], // Planned
        column: 'planned',
        lane: 'Backend Development',
        group: groups[1],
        owner: users[1],
        priority: 'medium',
        tags: ['api', 'backend', 'rest'],
        createdAt: new Date(currentYear, currentMonth, 1),
        updatedAt: new Date(currentYear, currentMonth, 1),
      },
      {
        id: '4',
        name: 'React Components Library',
        description: 'Build reusable React components for the UI',
        startAt: new Date(currentYear, currentMonth, 10),
        endAt: new Date(currentYear, currentMonth + 1, 10),
        status: statuses[1], // In Progress
        column: 'in-progress',
        lane: 'Frontend Development',
        group: groups[0],
        owner: users[0],
        priority: 'medium',
        tags: ['react', 'components', 'frontend'],
        createdAt: new Date(currentYear, currentMonth - 1, 28),
        updatedAt: new Date(currentYear, currentMonth, 12),
      },
      {
        id: '5',
        name: 'Docker Containerization',
        description: 'Containerize the application using Docker',
        startAt: new Date(currentYear, currentMonth, 20),
        endAt: new Date(currentYear, currentMonth + 1, 15),
        status: statuses[0], // Planned
        column: 'planned',
        lane: 'DevOps',
        group: groups[2],
        owner: users[2],
        priority: 'medium',
        tags: ['docker', 'devops', 'containerization'],
        createdAt: new Date(currentYear, currentMonth, 5),
        updatedAt: new Date(currentYear, currentMonth, 5),
      },
      {
        id: '6',
        name: 'Unit Testing Suite',
        description: 'Write comprehensive unit tests for all components',
        startAt: new Date(currentYear, currentMonth + 1, 1),
        endAt: new Date(currentYear, currentMonth + 1, 20),
        status: statuses[0], // Planned
        column: 'planned',
        lane: 'Quality Assurance',
        group: groups[3],
        owner: users[3],
        priority: 'high',
        tags: ['testing', 'qa', 'unit-tests'],
        createdAt: new Date(currentYear, currentMonth, 8),
        updatedAt: new Date(currentYear, currentMonth, 8),
      },
      {
        id: '7',
        name: 'Performance Optimization',
        description: 'Optimize application performance and loading times',
        startAt: new Date(currentYear, currentMonth + 1, 10),
        endAt: new Date(currentYear, currentMonth + 1, 25),
        status: statuses[0], // Planned
        column: 'planned',
        lane: 'Frontend Development',
        group: groups[0],
        owner: users[0],
        priority: 'low',
        tags: ['performance', 'optimization', 'frontend'],
        createdAt: new Date(currentYear, currentMonth, 10),
        updatedAt: new Date(currentYear, currentMonth, 10),
      },
      {
        id: '8',
        name: 'Security Audit',
        description: 'Conduct comprehensive security audit of the application',
        startAt: new Date(currentYear, currentMonth + 1, 15),
        endAt: new Date(currentYear, currentMonth + 2, 5),
        status: statuses[0], // Planned
        column: 'planned',
        lane: 'Quality Assurance',
        group: groups[3],
        owner: users[3],
        priority: 'high',
        tags: ['security', 'audit', 'qa'],
        createdAt: new Date(currentYear, currentMonth, 12),
        updatedAt: new Date(currentYear, currentMonth, 12),
      },
      {
        id: '9',
        name: 'UI/UX Design System',
        description: 'Create a comprehensive design system for the application',
        startAt: new Date(currentYear, currentMonth, 8),
        endAt: new Date(currentYear, currentMonth, 25),
        status: statuses[2], // Review
        column: 'review',
        lane: 'Design',
        group: groups[4],
        owner: users[4],
        priority: 'medium',
        tags: ['design', 'ui', 'ux'],
        createdAt: new Date(currentYear, currentMonth - 1, 30),
        updatedAt: new Date(currentYear, currentMonth, 18),
      },
      {
        id: '10',
        name: 'Mobile Responsive Design',
        description: 'Ensure the application works perfectly on mobile devices',
        startAt: new Date(currentYear, currentMonth + 1, 5),
        endAt: new Date(currentYear, currentMonth + 1, 30),
        status: statuses[0], // Planned
        column: 'planned',
        lane: 'Frontend Development',
        group: groups[0],
        owner: users[0],
        priority: 'medium',
        tags: ['mobile', 'responsive', 'frontend'],
        createdAt: new Date(currentYear, currentMonth, 15),
        updatedAt: new Date(currentYear, currentMonth, 15),
      },
    ];

    this.tasks = sampleTasks;
    this.nextId = 11;
  }

  // Get all tasks
  getAllTasks(): Task[] {
    return [...this.tasks];
  }

  // Get tasks by status/column
  getTasksByColumn(columnId: string): Task[] {
    return this.tasks.filter(task => task.column === columnId);
  }

  // Get tasks by group
  getTasksByGroup(groupId: string): Task[] {
    return this.tasks.filter(task => task.group.id === groupId);
  }

  // Get task by ID
  getTaskById(id: string): Task | undefined {
    return this.tasks.find(task => task.id === id);
  }

  // Create new task
  createTask(data: CreateTaskData): Task {
    const status = statuses.find(s => s.id === data.statusId) || statuses[0];
    const group = groups.find(g => g.id === data.groupId) || groups[0];
    const owner = users.find(u => u.id === data.ownerId) || users[0];
    
    const newTask: Task = {
      id: this.nextId.toString(),
      name: data.name,
      description: data.description,
      startAt: data.startAt,
      endAt: data.endAt || addDays(data.startAt, 7),
      status,
      column: data.statusId,
      lane: group.name,
      group,
      owner,
      priority: data.priority || 'medium',
      tags: data.tags || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.tasks.push(newTask);
    this.nextId++;
    return newTask;
  }

  // Update task
  updateTask(data: UpdateTaskData): Task | null {
    const taskIndex = this.tasks.findIndex(task => task.id === data.id);
    if (taskIndex === -1) return null;

    const existingTask = this.tasks[taskIndex];
    const status = data.statusId ? statuses.find(s => s.id === data.statusId) || existingTask.status : existingTask.status;
    const group = data.groupId ? groups.find(g => g.id === data.groupId) || existingTask.group : existingTask.group;
    const owner = data.ownerId ? users.find(u => u.id === data.ownerId) || existingTask.owner : existingTask.owner;

    const updatedTask: Task = {
      ...existingTask,
      name: data.name || existingTask.name,
      description: data.description !== undefined ? data.description : existingTask.description,
      startAt: data.startAt || existingTask.startAt,
      endAt: data.endAt || existingTask.endAt,
      status,
      column: data.statusId || existingTask.column,
      lane: group.name,
      group,
      owner,
      priority: data.priority || existingTask.priority,
      tags: data.tags || existingTask.tags,
      updatedAt: new Date(),
    };

    this.tasks[taskIndex] = updatedTask;
    return updatedTask;
  }

  // Delete task
  deleteTask(id: string): boolean {
    const taskIndex = this.tasks.findIndex(task => task.id === id);
    if (taskIndex === -1) return false;

    this.tasks.splice(taskIndex, 1);
    return true;
  }

  // Move task to different column (for Kanban)
  moveTaskToColumn(taskId: string, columnId: string): Task | null {
    const task = this.getTaskById(taskId);
    if (!task) return null;

    const status = statuses.find(s => s.id === columnId) || task.status;
    
    return this.updateTask({
      id: taskId,
      statusId: columnId,
    });
  }

  // Update task dates (for Gantt)
  updateTaskDates(taskId: string, startAt: Date, endAt: Date): Task | null {
    return this.updateTask({
      id: taskId,
      startAt,
      endAt,
    });
  }

  // Get statistics
  getTaskStats() {
    const total = this.tasks.length;
    const byStatus = statuses.map(status => ({
      status: status.name,
      count: this.tasks.filter(task => task.status.id === status.id).length,
      color: status.color,
    }));
    const byPriority = ['high', 'medium', 'low'].map(priority => ({
      priority,
      count: this.tasks.filter(task => task.priority === priority).length,
    }));

    return {
      total,
      byStatus,
      byPriority,
    };
  }
}

// Export singleton instance
export const taskService = new TaskService();
