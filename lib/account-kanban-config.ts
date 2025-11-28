import { createClientSupabase } from './supabase';

export interface KanbanColumn {
  id: string;
  name: string;
  color: string;
  order: number;
  [key: string]: unknown;
}

export interface AccountKanbanConfig {
  id: string;
  account_id: string;
  columns: KanbanColumn[];
  created_at: string;
  updated_at: string;
}

// Default Kanban columns
export const DEFAULT_KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'planned', name: 'Planned', color: '#6B7280', order: 1 },
  { id: 'in-progress', name: 'In Progress', color: '#3B82F6', order: 2 },
  { id: 'review', name: 'Review', color: '#F59E0B', order: 3 },
  { id: 'complete', name: 'Complete', color: '#10B981', order: 4 },
];

class AccountKanbanConfigService {
  private getSupabase() {
    const supabase = createClientSupabase();
    if (!supabase) {
      throw new Error('Supabase client not available');
    }
    return supabase;
  }

  // Test function to verify database access
  async testDatabaseAccess(): Promise<boolean> {
    try {
      const supabase = this.getSupabase();
      console.log('Testing database access...');
      
      // Test basic table access
      const { data, error } = await supabase
        .from('account_kanban_configs')
        .select('count')
        .limit(1);
      
      if (error) {
        console.error('Database access test failed:', error);
        return false;
      }
      
      console.log('Database access test successful');
      return true;
    } catch (error) {
      console.error('Exception in database access test:', error);
      return false;
    }
  }

  async getAccountKanbanConfig(accountId: string): Promise<AccountKanbanConfig | null> {
    try {
      const supabase = this.getSupabase();
      
      console.log('Fetching kanban config for account:', accountId);
      
      const { data, error } = await supabase
        .from('account_kanban_configs')
        .select('*')
        .eq('account_id', accountId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No config found, return default
          console.log('No kanban config found in database for account:', accountId);
          return null;
        }
        console.error('Error fetching account kanban config:', error);
        return null;
      }

      console.log('Successfully loaded kanban config from database:', {
        id: data.id,
        account_id: data.account_id,
        columns: data.columns,
        columnCount: data.columns?.length || 0
      });

      return data;
    } catch (error) {
      console.error('Error in getAccountKanbanConfig:', error);
      return null;
    }
  }

  async createAccountKanbanConfig(accountId: string, columns: KanbanColumn[]): Promise<AccountKanbanConfig | null> {
    try {
      const supabase = this.getSupabase();
      
      const { data, error } = await supabase
        .from('account_kanban_configs')
        .insert({
          account_id: accountId,
          columns: columns,
        })
        .select()
        .single();

      if (error) {
        // This error is expected and OK - it happens when:
        // 1. RLS policies prevent the insert (user doesn't have permission)
        // 2. A config already exists (duplicate key)
        // We handle this gracefully by using an in-memory fallback config
        console.log('Could not create kanban config in database (using fallback instead):', {
          code: (error as any).code,
          reason: (error as any).code === '42501' ? 'RLS policy' : (error as any).code === '23505' ? 'Already exists' : 'Other'
        });
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in createAccountKanbanConfig:', error);
      return null;
    }
  }

  async updateAccountKanbanConfig(accountId: string, columns: KanbanColumn[]): Promise<AccountKanbanConfig | null> {
    try {
      const supabase = this.getSupabase();
      
      console.log('Updating kanban config for account:', accountId);
      console.log('Columns to save:', columns);
      
      // First, let's try to check if we can read from the table
      console.log('Testing table access...');
      const { data: testData, error: testError } = await supabase
        .from('account_kanban_configs')
        .select('*')
        .limit(1);
      
      if (testError) {
        console.error('Table access test failed:', testError);
        return null;
      }
      
      console.log('Table access test successful, proceeding with upsert...');
      
      // Check if record exists first, then update or insert accordingly
      const { data: existingRecord } = await supabase
        .from('account_kanban_configs')
        .select('id')
        .eq('account_id', accountId)
        .single();

      let { data, error } = { data: null, error: null };

      if (existingRecord) {
        console.log('Record exists, updating...');
        const result = await supabase
          .from('account_kanban_configs')
          .update({
            columns: columns,
            updated_at: new Date().toISOString(),
          })
          .eq('account_id', accountId)
          .select()
          .single();
        data = result.data;
        error = result.error;
      } else {
        console.log('No existing record, inserting...');
        const result = await supabase
          .from('account_kanban_configs')
          .insert({
            account_id: accountId,
            columns: columns,
          })
          .select()
          .single();
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error('Supabase error updating account kanban config:', {
          code: (error as any).code,
          message: (error as any).message,
          details: (error as any).details,
          hint: (error as any).hint
        });
        return null;
      }

      console.log('Successfully updated kanban config:', data);
      return data;
    } catch (error) {
      console.error('Exception in updateAccountKanbanConfig:', error);
      return null;
    }
  }

  async getOrCreateAccountKanbanConfig(accountId: string): Promise<AccountKanbanConfig> {
    try {
      let config = await this.getAccountKanbanConfig(accountId);
      
      console.log('Loaded kanban config from database:', config);
      
      if (!config) {
        // Create default config
        console.log('No kanban config found, creating default config for account:', accountId);
        config = await this.createAccountKanbanConfig(accountId, DEFAULT_KANBAN_COLUMNS);
        
        if (config) {
          console.log('Successfully created default kanban config');
        } else {
          console.warn('Failed to create kanban config in database (this is OK - may already exist or RLS issue)');
        }
      }
      
      if (!config) {
        // Fallback to default config in memory - this is OK and normal
        console.log('Using in-memory fallback kanban config (database insert failed but this is fine)');
        return {
          id: 'default',
          account_id: accountId,
          columns: DEFAULT_KANBAN_COLUMNS,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
      
      console.log('Final kanban config being returned:', {
        id: config.id,
        account_id: config.account_id,
        columns: config.columns,
        columnCount: config.columns.length
      });
      
      return config;
    } catch (error) {
      console.error('Error in getOrCreateAccountKanbanConfig:', error);
      // Return fallback config
      return {
        id: 'default',
        account_id: accountId,
        columns: DEFAULT_KANBAN_COLUMNS,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  }

  // Helper function to map project status to kanban column
  getKanbanColumnForStatus(status: string, columns: KanbanColumn[], customAssignments?: Record<string, string>): string {
    const statusToColumnMap: { [key: string]: string } = {
      'planning': 'planned',
      'in_progress': 'in-progress',
      'review': 'review',
      'complete': 'complete',
      'on_hold': 'planned', // Default on_hold to planned
    };
    
    const defaultColumn = statusToColumnMap[status] || 'planned';
    
    // Check if the mapped column exists in the account's columns
    const columnExists = columns.some(col => col.id === defaultColumn);
    if (columnExists) {
      return defaultColumn;
    }
    
    // If not, return the first column
    return columns[0]?.id || 'planned';
  }

  // Helper function to map kanban column to project status
  getStatusForKanbanColumn(columnId: string, columns: KanbanColumn[]): string {
    console.log('[KANBAN CONFIG] Mapping column to status:', {
      columnId,
      columns: columns.map(col => ({ id: col.id, name: col.name }))
    });
    
    const columnToStatusMap: { [key: string]: string } = {
      'planned': 'planning',
      'in-progress': 'in_progress',
      'review': 'review',
      'complete': 'complete',
    };
    
    // Check if this is a custom column
    const customColumn = columns.find(col => col.id === columnId);
    console.log('[KANBAN CONFIG] Custom column found:', customColumn);
    
    if (customColumn && !columnToStatusMap[columnId]) {
      // For custom columns, map to the closest valid database status
      // This ensures we only use valid database status values
      const customColumnName = customColumn.name.toLowerCase();
      console.log('[KANBAN CONFIG] Custom column name:', customColumnName);
      
      if (customColumnName.includes('review') && !customColumnName.includes('approved')) {
        console.log('[KANBAN CONFIG] Mapping to review status');
        return 'review'; // Map review columns to review status
      } else if (customColumnName.includes('approved') || customColumnName.includes('approval')) {
        console.log('[KANBAN CONFIG] Mapping to review status for approved (visual only)');
        return 'review'; // Map approved columns to review status (approved is visual only)
      } else if (customColumnName.includes('pending')) {
        console.log('[KANBAN CONFIG] Mapping to review status for pending');
        return 'review'; // Map pending columns to review status
      } else if (customColumnName.includes('blocked') || customColumnName.includes('hold')) {
        console.log('[KANBAN CONFIG] Mapping to on_hold status');
        return 'on_hold'; // Map blocked/hold columns to on_hold status
      } else if (customColumnName.includes('done') || customColumnName.includes('finished')) {
        console.log('[KANBAN CONFIG] Mapping to complete status');
        return 'complete'; // Map done/finished columns to complete status
      } else {
        console.log('[KANBAN CONFIG] Mapping to planning status (default)');
        return 'planning'; // Default custom columns to planning status
      }
    }
    
    const mappedStatus = columnToStatusMap[columnId] || 'planning';
    console.log('[KANBAN CONFIG] Final mapped status:', mappedStatus);
    return mappedStatus;
  }
}

export const accountKanbanConfigService = new AccountKanbanConfigService();
