import { createClientSupabase } from './supabase';
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

export interface Milestone {
  id: string;
  name: string;
  description?: string;
  date: Date;
  color: string;
  createdAt: Date;
  updatedAt: Date;
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
  estimated_hours?: number;
  remaining_hours?: number;
  assigned_to?: string;
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

// Kanban columns mapping
export const kanbanColumns = [
  { id: 'planned', name: 'Planned', color: '#6B7280' },
  { id: 'in-progress', name: 'In Progress', color: '#F59E0B' },
  { id: 'review', name: 'Review', color: '#8B5CF6' },
  { id: 'done', name: 'Done', color: '#10B981' },
];

class SupabaseTaskService {
  private initialized = false;

  private getSupabase() {
    const supabase = createClientSupabase();
    if (!supabase) {
      throw new Error('Supabase client not available');
    }
    return supabase;
  }

  async initialize() {
    if (this.initialized) return;
    
    // Check if Supabase is available
    const supabase = this.getSupabase();
    if (!supabase) {
      this.initialized = true;
      return;
    }
    
    try {
      // Test the connection first
      await this.testSupabaseConnection();
      
      // Try to create tables if they don't exist
      await this.ensureTablesExist();
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing Supabase:', error);
      this.initialized = true;
    }
  }

  private async testSupabaseConnection() {
    try {
      console.log('Testing Supabase connection...');
      
      // Test basic connection
      const supabase = this.getSupabase();
      const { data, error } = await supabase
        .from('groups')
        .select('count')
        .limit(1);
        
      if (error) {
        console.error('Supabase connection test failed:', error);
        throw error;
      }
      
      console.log('✅ Supabase connection successful');
      return true;
    } catch (error) {
      console.error('❌ Supabase connection test failed:', error);
      throw error;
    }
  }

  private async ensureTablesExist() {
    try {
      // Try to query users table to see if it exists
      const supabase = this.getSupabase();
      const { error: usersError } = await supabase.from('users').select('id').limit(1);
      
      if (usersError && usersError.code === 'PGRST116') {
        console.log('Tables do not exist. Please run the SQL script in your Supabase dashboard.');
        console.log('Go to: https://supabase.com/dashboard -> SQL Editor');
        console.log('Copy and paste the contents of supabase-schema.sql');
      }
    } catch (error) {
      console.error('Error checking tables:', error);
    }
  }



  // Get all tasks with related data
  async getAllTasks(): Promise<Task[]> {
    await this.initialize();
    
    // If Supabase is not available, use fallback data
    const supabase = this.getSupabase();
    if (!supabase) {
      return this.getFallbackTasks();
    }
    
    try {
      const { data, error } = await this.getSupabase()
        .from('tasks')
        .select(`
          *,
          statuses!inner(*),
          groups!inner(*),
          users!inner(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(this.mapDatabaseTaskToTask);
    } catch (error) {
      console.warn('Supabase not available, using fallback data');
      return this.getFallbackTasks();
    }
  }

  // Get tasks by status/column
  async getTasksByColumn(columnId: string): Promise<Task[]> {
    const tasks = await this.getAllTasks();
    return tasks.filter(task => task.column === columnId);
  }

  // Get tasks by group
  async getTasksByGroup(groupId: string): Promise<Task[]> {
    const tasks = await this.getAllTasks();
    return tasks.filter(task => task.group.id === groupId);
  }

  // Get task by ID
  async getTaskById(id: string): Promise<Task | null> {
    await this.initialize();
    
    try {
      const { data, error } = await this.getSupabase()
        .from('tasks')
        .select(`
          *,
          statuses!inner(*),
          groups!inner(*),
          users!inner(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data ? this.mapDatabaseTaskToTask(data) : null;
    } catch (error) {
      console.error('Error fetching task:', error);
      return null;
    }
  }

  // Create new task
  async createTask(data: CreateTaskData): Promise<Task | null> {
    await this.initialize();
    
    // If Supabase is not available, use fallback task creation
    const supabase = this.getSupabase();
    if (!supabase) {
      console.log('Supabase not available, using fallback task creation');
      return this.createFallbackTask(data);
    }
    
    console.log('Creating task in Supabase:', data);
    
    try {
      const { data: taskData, error } = await this.getSupabase()
        .from('tasks')
        .insert({
          name: data.name,
          description: data.description,
          start_at: data.startAt.toISOString(),
          end_at: (data.endAt || addDays(data.startAt, 7)).toISOString(),
          status_id: data.statusId,
          group_id: data.groupId,
          owner_id: data.ownerId,
          priority: data.priority || 'medium',
          tags: data.tags || [],
        })
        .select(`
          *,
          statuses!inner(*),
          groups!inner(*),
          users!inner(*)
        `)
        .single();

      if (error) {
        console.error('Database error creating task:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        console.error('Full error object:', JSON.stringify(error, null, 2));
        console.error('Task data being inserted:', JSON.stringify(data, null, 2));
        
        // Check if it's a table not found error
        if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.error('❌ Database tables do not exist. Please run the SQL setup script in your Supabase dashboard.');
          console.error('Go to: https://supabase.com/dashboard -> SQL Editor');
          console.error('Copy and paste the contents of simple-setup.sql');
        } else if (error.code === 'PGRST301' || error.message?.includes('permission')) {
          console.error('❌ Permission denied. Check your Supabase RLS policies.');
          console.error('Make sure the policies allow public access for development.');
        } else if (error.message?.includes('foreign key')) {
          console.error('❌ Foreign key constraint error. Check if referenced records exist.');
          console.error('Make sure users, groups, and statuses are properly inserted.');
        } else {
          console.error('❌ Unknown database error. Check the full error details above.');
        }
        
        return this.createFallbackTask(data);
      }
      
      console.log('Task created successfully in database:', taskData);
      return taskData ? this.mapDatabaseTaskToTask(taskData) : null;
    } catch (error) {
      console.error('Error creating task:', error);
      return this.createFallbackTask(data);
    }
  }

  // Update task
  async updateTask(data: UpdateTaskData): Promise<Task | null> {
    await this.initialize();
    
    // If Supabase is not available, return null (fallback mode)
    const supabase = this.getSupabase();
    if (!supabase) {
      console.log('Supabase not available, cannot update task');
      return null;
    }
    
    try {
      // First check if the task exists in the database
      const { data: existingTask, error: checkError } = await this.getSupabase()
        .from('tasks')
        .select('id')
        .eq('id', data.id)
        .single();
      
      if (checkError) {
        console.log('Task not found in database, skipping update:', data.id);
        return null;
      }
      const updateData: any = {};
      if (data.name) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.startAt) updateData.start_at = data.startAt.toISOString();
      if (data.endAt) updateData.end_at = data.endAt.toISOString();
      if (data.statusId) updateData.status_id = data.statusId;
      if (data.groupId) updateData.group_id = data.groupId;
      if (data.ownerId) updateData.owner_id = data.ownerId;
      if (data.priority) updateData.priority = data.priority;
      if (data.tags) updateData.tags = data.tags;
      updateData.updated_at = new Date().toISOString();

      const { data: taskData, error } = await this.getSupabase()
        .from('tasks')
        .update(updateData)
        .eq('id', data.id)
        .select(`
          *,
          statuses!inner(*),
          groups!inner(*),
          users!inner(*)
        `)
        .single();

      if (error) {
        console.error('Database error updating task:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        return null;
      }
      return taskData ? this.mapDatabaseTaskToTask(taskData) : null;
    } catch (error) {
      console.error('Error updating task:', error);
      return null;
    }
  }

  // Delete task
  async deleteTask(id: string): Promise<boolean> {
    await this.initialize();
    
    try {
      const { error } = await this.getSupabase()
        .from('tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      return false;
    }
  }

  // Move task to different column (for Kanban)
  async moveTaskToColumn(taskId: string, columnId: string): Promise<Task | null> {
    return this.updateTask({
      id: taskId,
      statusId: columnId,
    });
  }

  // Update task dates (for Gantt)
  async updateTaskDates(taskId: string, startAt: Date, endAt: Date): Promise<Task | null> {
    return this.updateTask({
      id: taskId,
      startAt,
      endAt,
    });
  }

      // Get all users
      async getUsers(): Promise<User[]> {
        await this.initialize();
        
        try {
          const { data, error } = await this.getSupabase()
            .from('users')
            .select('*')
            .order('name');

          if (error) throw error;
          return data || [];
        } catch (error) {
          console.error('Error fetching users:', error);
          return this.getFallbackUsers();
        }
      }

      // Create user
      async createUser(data: Omit<User, 'id'>): Promise<User | null> {
        await this.initialize();
        
        const supabase = this.getSupabase();
    if (!supabase) {
          console.log('Supabase not available, using fallback user creation');
          return this.createFallbackUser(data);
        }

        try {
          console.log('Creating user in Supabase:', data);
          const { data: userData, error } = await this.getSupabase()
            .from('users')
            .insert({
              id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: data.name,
              image: data.image,
            })
            .select()
            .single();

          if (error) {
            console.error('Database error creating user:', error);
            console.error('Error details:', {
              code: error.code,
              message: error.message,
              details: error.details,
              hint: error.hint
            });
            
            // Check for RLS policy issues
            if (Object.keys(error).length === 0 || error.message?.includes('policy') || error.message?.includes('permission')) {
              console.error('❌ This appears to be a Row Level Security (RLS) policy issue.');
              console.error('Please run the fix-rls-policies.sql script in your Supabase SQL Editor.');
              console.error('Go to: https://supabase.com/dashboard -> SQL Editor');
            }
            
            console.log('Falling back to local user creation');
            return this.createFallbackUser(data);
          }

          console.log('User created successfully:', userData);
          return userData;
        } catch (error) {
          console.error('Error creating user:', error);
          console.log('Falling back to local user creation');
          return this.createFallbackUser(data);
        }
      }

      // Delete user
      async deleteUser(id: string): Promise<boolean> {
        await this.initialize();
        
        // Prevent deletion of the default "Unassigned" user
        if (id === 'default-user') {
          console.log('Cannot delete the default "Unassigned" user');
          return false;
        }
        
        const supabase = this.getSupabase();
    if (!supabase) {
          return false;
        }

        try {
          // First, check if there are any tasks assigned to this user
          const { data: tasksAssignedToUser, error: checkError } = await this.getSupabase()
            .from('tasks')
            .select('id')
            .eq('owner_id', id)
            .limit(1);

          if (checkError) {
            console.error('Error checking tasks for user:', checkError);
            return false;
          }

          // If there are tasks assigned to this user, reassign them to a default user
          if (tasksAssignedToUser && tasksAssignedToUser.length > 0) {
            // Find or create a default user
            let defaultUserId = 'default-user';
            
            // Check if 'default-user' exists
            const { data: defaultUser } = await this.getSupabase()
              .from('users')
              .select('id')
              .eq('id', 'default-user')
              .single();

            if (!defaultUser) {
              // Create a default user
              const { data: newDefaultUser, error: createError } = await this.getSupabase()
                .from('users')
                .insert({ 
                  id: 'default-user', 
                  name: 'Unassigned',
                  image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face'
                })
                .select()
                .single();

              if (createError) {
                console.error('Error creating default user:', createError);
                console.error('Error details:', {
                  code: createError.code,
                  message: createError.message,
                  details: createError.details,
                  hint: createError.hint
                });
                return false;
              }
              defaultUserId = newDefaultUser.id;
            }

            // Reassign all tasks from this user to the default user
            const { error: updateError } = await this.getSupabase()
              .from('tasks')
              .update({ owner_id: defaultUserId })
              .eq('owner_id', id);

            if (updateError) {
              console.error('Error reassigning tasks to default user:', updateError);
              return false;
            }

            console.log(`Reassigned ${tasksAssignedToUser.length} tasks to default user before deleting user`);
          }

          // Now delete the user
          const { error } = await this.getSupabase()
            .from('users')
            .delete()
            .eq('id', id);

          if (error) {
            console.error('Database error deleting user:', error);
            return false;
          }

          return true;
        } catch (error) {
          console.error('Error deleting user:', error);
          return false;
        }
      }

      // Get all groups
      async getGroups(): Promise<TaskGroup[]> {
        await this.initialize();
        
        try {
          const { data, error } = await this.getSupabase()
            .from('groups')
            .select('*')
            .order('name');

          if (error) throw error;
          return data || [];
        } catch (error) {
          console.error('Error fetching groups:', error);
          return this.getFallbackGroups();
        }
      }

      // Create group
      async createGroup(data: Omit<TaskGroup, 'id'>): Promise<TaskGroup | null> {
        await this.initialize();
        
        const supabase = this.getSupabase();
    if (!supabase) {
          console.log('Supabase not available, using fallback group creation');
          return this.createFallbackGroup(data);
        }

        try {
          console.log('Creating group in Supabase:', data);
          console.log('Supabase client status:', {
            isConnected: !!supabase,
            url: process.env.NEXT_PUBLIC_SUPABASE_URL,
            hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          });
          
          const { data: groupData, error } = await this.getSupabase()
            .from('groups')
            .insert({
              id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: data.name,
            })
            .select()
            .single();

          if (error) {
            console.error('Database error creating group:', error);
            console.error('Error type:', typeof error);
            console.error('Error keys:', Object.keys(error));
            console.error('Error details:', {
              code: error.code,
              message: error.message,
              details: error.details,
              hint: error.hint
            });
            
            // Check for empty error objects (common with RLS issues)
            if (Object.keys(error).length === 0) {
              console.error('❌ Empty error object detected - this usually indicates:');
              console.error('1. Row Level Security (RLS) policy blocking the operation');
              console.error('2. Network connectivity issues');
              console.error('3. Supabase service unavailable');
              console.error('Please check your Supabase dashboard and RLS policies.');
            }
            
            // Check for RLS policy issues
            if (error.message?.includes('policy') || error.message?.includes('permission') || error.message?.includes('RLS')) {
              console.error('❌ This appears to be a Row Level Security (RLS) policy issue.');
              console.error('Please run the fix-rls-policies.sql script in your Supabase SQL Editor.');
              console.error('Go to: https://supabase.com/dashboard -> SQL Editor');
            }
            
            console.log('Falling back to local group creation');
            return this.createFallbackGroup(data);
          }

          console.log('Group created successfully:', groupData);
          return groupData;
        } catch (error) {
          console.error('Error creating group:', error);
          console.log('Falling back to local group creation');
          return this.createFallbackGroup(data);
        }
      }

      // Delete group
      async deleteGroup(id: string): Promise<boolean> {
        await this.initialize();
        
        // Prevent deletion of the default "General" group
        if (id === 'general') {
          console.log('Cannot delete the default "General" group');
          return false;
        }
        
        const supabase = this.getSupabase();
    if (!supabase) {
          return false;
        }

        try {
          // First, check if there are any tasks using this group
          const { data: tasksUsingGroup, error: checkError } = await this.getSupabase()
            .from('tasks')
            .select('id')
            .eq('group_id', id)
            .limit(1);

          if (checkError) {
            console.error('Error checking tasks for group:', checkError);
            return false;
          }

          // If there are tasks using this group, move them to a default group
          if (tasksUsingGroup && tasksUsingGroup.length > 0) {
            // Find or create a default group
            let defaultGroupId = 'general';
            
            // Check if 'general' group exists
            const { data: generalGroup } = await this.getSupabase()
              .from('groups')
              .select('id')
              .eq('id', 'general')
              .single();

            if (!generalGroup) {
              // Create a default 'general' group
              const { data: newDefaultGroup, error: createError } = await this.getSupabase()
                .from('groups')
                .insert({ 
                  id: 'general', 
                  name: 'General' 
                })
                .select()
                .single();

              if (createError) {
                console.error('Error creating default group:', createError);
                console.error('Error details:', {
                  code: createError.code,
                  message: createError.message,
                  details: createError.details,
                  hint: createError.hint
                });
                return false;
              }
              defaultGroupId = newDefaultGroup.id;
            }

            // Move all tasks from this group to the default group
            const { error: updateError } = await this.getSupabase()
              .from('tasks')
              .update({ group_id: defaultGroupId })
              .eq('group_id', id);

            if (updateError) {
              console.error('Error moving tasks to default group:', updateError);
              return false;
            }

            console.log(`Moved ${tasksUsingGroup.length} tasks to default group before deleting group`);
          }

          // Now delete the group
          const { error } = await this.getSupabase()
            .from('groups')
            .delete()
            .eq('id', id);

          if (error) {
            console.error('Database error deleting group:', error);
            return false;
          }

          return true;
        } catch (error) {
          console.error('Error deleting group:', error);
          return false;
        }
      }

  // Get all statuses
  async getStatuses(): Promise<TaskStatus[]> {
    await this.initialize();
    
    try {
      const { data, error } = await this.getSupabase()
        .from('statuses')
        .select('*')
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching statuses:', error);
      return [];
    }
  }

  // Get statistics
  async getTaskStats() {
    const tasks = await this.getAllTasks();
    const statuses = await this.getStatuses();
    
    const total = tasks.length;
    const byStatus = statuses.map(status => ({
      status: status.name,
      count: tasks.filter(task => task.status.id === status.id).length,
      color: status.color,
    }));
    const byPriority = ['high', 'medium', 'low'].map(priority => ({
      priority,
      count: tasks.filter(task => task.priority === priority).length,
    }));

    return {
      total,
      byStatus,
      byPriority,
    };
  }

  // Create fallback task
  private createFallbackTask(data: CreateTaskData): Task {
    const users = [
      { id: '1', name: 'John Doe', image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face' },
      { id: '2', name: 'Jane Smith', image: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=32&h=32&fit=crop&crop=face' },
      { id: '3', name: 'Mike Johnson', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=32&h=32&fit=crop&crop=face' },
      { id: '4', name: 'Sarah Wilson', image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=32&h=32&fit=crop&crop=face' },
    ];

    const groups = [
      { id: 'frontend', name: 'Frontend Development' },
      { id: 'backend', name: 'Backend Development' },
      { id: 'devops', name: 'DevOps' },
      { id: 'qa', name: 'Quality Assurance' },
      { id: 'design', name: 'Design' },
    ];

    const statuses = [
      { id: 'planned', name: 'Planned', color: '#6B7280' },
      { id: 'in-progress', name: 'In Progress', color: '#F59E0B' },
      { id: 'review', name: 'Review', color: '#8B5CF6' },
      { id: 'done', name: 'Done', color: '#10B981' },
    ];

    const user = users.find(u => u.id === data.ownerId) || users[0];
    const group = groups.find(g => g.id === data.groupId) || groups[0];
    const status = statuses.find(s => s.id === data.statusId) || statuses[0];

    return {
      id: `task-${Date.now()}`,
      name: data.name,
      description: data.description,
      startAt: data.startAt,
      endAt: data.endAt || addDays(data.startAt, 7),
      status,
      column: data.statusId,
      lane: group.name,
      group,
      owner: user,
      priority: data.priority || 'medium',
      tags: data.tags || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

      // Fallback data when Supabase is not available
      private getFallbackUsers(): User[] {
        return [
          { id: '1', name: 'John Doe', image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face' },
          { id: '2', name: 'Jane Smith', image: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=32&h=32&fit=crop&crop=face' },
          { id: '3', name: 'Mike Johnson', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=32&h=32&fit=crop&crop=face' },
          { id: '4', name: 'Sarah Wilson', image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=32&h=32&fit=crop&crop=face' },
        ];
      }

      private getFallbackGroups(): TaskGroup[] {
        return [
          { id: 'frontend', name: 'Frontend Development' },
          { id: 'backend', name: 'Backend Development' },
          { id: 'devops', name: 'DevOps' },
          { id: 'qa', name: 'Quality Assurance' },
          { id: 'design', name: 'Design' },
        ];
      }

      private createFallbackUser(data: Omit<User, 'id'>): User {
        return {
          id: `user-${Date.now()}`,
          name: data.name,
          image: data.image,
        };
      }

      private createFallbackGroup(data: Omit<TaskGroup, 'id'>): TaskGroup {
        return {
          id: `group-${Date.now()}`,
          name: data.name,
        };
      }

      private getFallbackTasks(): Task[] {
    const users = [
      { id: '1', name: 'John Doe', image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face' },
      { id: '2', name: 'Jane Smith', image: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=32&h=32&fit=crop&crop=face' },
      { id: '3', name: 'Mike Johnson', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=32&h=32&fit=crop&crop=face' },
      { id: '4', name: 'Sarah Wilson', image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=32&h=32&fit=crop&crop=face' },
    ];

    const groups = [
      { id: 'frontend', name: 'Frontend Development' },
      { id: 'backend', name: 'Backend Development' },
      { id: 'devops', name: 'DevOps' },
      { id: 'qa', name: 'Quality Assurance' },
      { id: 'design', name: 'Design' },
    ];

    const statuses = [
      { id: 'planned', name: 'Planned', color: '#6B7280' },
      { id: 'in-progress', name: 'In Progress', color: '#F59E0B' },
      { id: 'review', name: 'Review', color: '#8B5CF6' },
      { id: 'done', name: 'Done', color: '#10B981' },
    ];

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return [
      {
        id: '1',
        name: 'User Authentication System',
        description: 'Implement secure user authentication with JWT tokens',
        startAt: new Date(currentYear, currentMonth, 1),
        endAt: new Date(currentYear, currentMonth, 15),
        status: statuses[1], // in-progress
        column: 'in-progress',
        lane: groups[0].name,
        group: groups[0],
        owner: users[0],
        priority: 'high',
        tags: ['authentication', 'security', 'frontend'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        name: 'Database Schema Design',
        description: 'Design and implement the core database schema',
        startAt: new Date(currentYear, currentMonth, 5),
        endAt: new Date(currentYear, currentMonth, 20),
        status: statuses[1], // in-progress
        column: 'in-progress',
        lane: groups[1].name,
        group: groups[1],
        owner: users[1],
        priority: 'high',
        tags: ['database', 'backend', 'schema'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '3',
        name: 'API Endpoints Development',
        description: 'Create RESTful API endpoints for the application',
        startAt: new Date(currentYear, currentMonth, 15),
        endAt: new Date(currentYear, currentMonth + 1, 5),
        status: statuses[0], // planned
        column: 'planned',
        lane: groups[1].name,
        group: groups[1],
        owner: users[1],
        priority: 'medium',
        tags: ['api', 'backend', 'rest'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  // Helper method to map database task to Task interface
  private mapDatabaseTaskToTask(dbTask: any): Task {
    return {
      id: dbTask.id,
      name: dbTask.name,
      description: dbTask.description,
      startAt: new Date(dbTask.start_at),
      endAt: new Date(dbTask.end_at),
      status: dbTask.statuses,
      column: dbTask.status_id,
      lane: dbTask.groups.name,
      group: dbTask.groups,
      owner: dbTask.users,
      priority: dbTask.priority,
      tags: dbTask.tags || [],
      createdAt: new Date(dbTask.created_at),
      updatedAt: new Date(dbTask.updated_at),
      estimated_hours: dbTask.estimated_hours,
      remaining_hours: dbTask.remaining_hours,
      assigned_to: dbTask.assigned_to,
    };
  }

  // Get all milestones
  async getAllMilestones(): Promise<Milestone[]> {
    await this.initialize();
    
    const supabase = this.getSupabase();
    console.log('Getting milestones, supabase available:', !!supabase);
    if (!supabase) {
      console.log('No supabase, using fallback milestones');
      return this.getFallbackMilestones();
    }
    
    try {
      console.log('Querying milestones from database...');
      const { data, error } = await this.getSupabase()
        .from('milestones')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
        console.error('Database error getting milestones:', error);
        throw error;
      }

      console.log('Database milestones result:', data);
      return (data || []).map(this.mapDatabaseMilestoneToMilestone);
    } catch (error) {
      console.warn('Supabase not available, using fallback milestones', error);
      return this.getFallbackMilestones();
    }
  }

  // Create milestone
  async createMilestone(data: Omit<Milestone, 'id' | 'createdAt' | 'updatedAt'>): Promise<Milestone | null> {
    const supabase = this.getSupabase();
    if (!supabase) {
      return this.createFallbackMilestone(data);
    }

    try {
      const { data: milestoneData, error } = await this.getSupabase()
        .from('milestones')
        .insert({
          name: data.name,
          description: data.description,
          date: data.date.toISOString(),
          color: data.color,
        })
        .select()
        .single();

      if (error) {
        console.error('Database error creating milestone:', error);
        return this.createFallbackMilestone(data);
      }

      return this.mapDatabaseMilestoneToMilestone(milestoneData);
    } catch (error) {
      console.error('Error creating milestone:', error);
      return this.createFallbackMilestone(data);
    }
  }

  // Update milestone
  async updateMilestone(data: Partial<Milestone> & { id: string }): Promise<Milestone | null> {
    const supabase = this.getSupabase();
    if (!supabase) {
      return null;
    }

    try {
      const updateData: any = {};
      if (data.name) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.date) updateData.date = data.date.toISOString();
      if (data.color) updateData.color = data.color;

      const { data: milestoneData, error } = await this.getSupabase()
        .from('milestones')
        .update(updateData)
        .eq('id', data.id)
        .select()
        .single();

      if (error) {
        console.error('Database error updating milestone:', error);
        return null;
      }

      return this.mapDatabaseMilestoneToMilestone(milestoneData);
    } catch (error) {
      console.error('Error updating milestone:', error);
      return null;
    }
  }

  // Delete milestone
  async deleteMilestone(id: string): Promise<boolean> {
    const supabase = this.getSupabase();
    if (!supabase) {
      return false;
    }

    try {
      const { error } = await this.getSupabase()
        .from('milestones')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Database error deleting milestone:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error deleting milestone:', error);
      return false;
    }
  }

  // Fallback milestones
  private getFallbackMilestones(): Milestone[] {
    return [
      {
        id: 'fallback-milestone-1',
        name: 'Project Kickoff',
        description: 'Official project start date',
        date: new Date('2024-01-15'),
        color: '#10b981',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'fallback-milestone-2',
        name: 'Design Phase Complete',
        description: 'All design mockups and prototypes finished',
        date: new Date('2024-02-28'),
        color: '#f59e0b',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'fallback-milestone-3',
        name: 'Development Complete',
        description: 'All features implemented and tested',
        date: new Date('2024-04-15'),
        color: '#3b82f6',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'fallback-milestone-4',
        name: 'Project Launch',
        description: 'Public release and deployment',
        date: new Date('2024-05-01'),
        color: '#ef4444',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  private createFallbackMilestone(data: Omit<Milestone, 'id' | 'createdAt' | 'updatedAt'>): Milestone {
    return {
      id: `fallback-milestone-${Date.now()}`,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private mapDatabaseMilestoneToMilestone(dbMilestone: any): Milestone {
    return {
      id: dbMilestone.id,
      name: dbMilestone.name,
      description: dbMilestone.description,
      date: new Date(dbMilestone.date),
      color: dbMilestone.color,
      createdAt: new Date(dbMilestone.created_at),
      updatedAt: new Date(dbMilestone.updated_at),
    };
  }
}

// Export singleton instance
export const supabaseTaskService = new SupabaseTaskService();
