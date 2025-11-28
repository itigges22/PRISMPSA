/**
 * User Approval Service
 * Handles user approval workflow for new user registrations
 */

import { createClientSupabase } from './supabase';
import { logger, databaseQuery, databaseError, userAction, roleManagement } from './debug-logger';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  image: string | null;
  bio: string | null;
  skills: string[] | null;
  workload_sentiment: string | null;
  is_approved: boolean;
  approval_requested_at: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PendingUser extends UserProfile {
  current_roles: Array<{
    role_name: string;
    department_name: string;
  }>;
}

export interface ApprovalAction {
  userId: string;
  action: 'approve' | 'reject';
  approvedBy: string;
  reason?: string;
}

class UserApprovalService {
  private async getSupabase() {
    return createClientSupabase();
  }

  /**
   * Get all users pending approval
   */
  async getPendingUsers(): Promise<PendingUser[]> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) {
        logger.error('Supabase client not available', { action: 'getPendingUsers' });
        return [];
      }

      databaseQuery('SELECT', 'pending_user_approvals', { action: 'getPendingUsers' });

      const { data: pendingUsers, error } = await supabase
        .from('pending_user_approvals')
        .select('*')
        .order('approval_requested_at', { ascending: true });

      if (error) {
        databaseError('SELECT', 'pending_user_approvals', error, { action: 'getPendingUsers' });
        logger.error('Error fetching pending users', { action: 'getPendingUsers' }, error);
        return [];
      }

      logger.info(`Found ${pendingUsers?.length || 0} pending users`, { 
        action: 'getPendingUsers',
        count: pendingUsers?.length || 0
      });

      return pendingUsers || [];
    } catch (error) {
      logger.error('Exception in getPendingUsers', { action: 'getPendingUsers' }, error as Error);
      return [];
    }
  }

  /**
   * Approve a user
   */
  async approveUser(userId: string, approvedBy: string, reason?: string): Promise<boolean> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) {
        logger.error('Supabase client not available', { action: 'approveUser', userId });
        return false;
      }

      databaseQuery('UPDATE', 'user_profiles', { action: 'approveUser', userId, approvedBy });

      const { error } = await supabase
        .from('user_profiles')
        .update({
          is_approved: true,
          approved_by: approvedBy,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .eq('is_approved', false); // Only approve if not already approved

      if (error) {
        databaseError('UPDATE', 'user_profiles', error, { action: 'approveUser', userId });
        logger.error('Error approving user', { action: 'approveUser', userId }, error);
        return false;
      }

      userAction('approved', userId, { action: 'approveUser', approvedBy, reason });
      logger.info('User approved successfully', { 
        action: 'approveUser', 
        userId, 
        approvedBy,
        reason 
      });

      return true;
    } catch (error) {
      logger.error('Exception in approveUser', { action: 'approveUser', userId }, error as Error);
      return false;
    }
  }

  /**
   * Reject a user (delete their account)
   */
  async rejectUser(userId: string, rejectedBy: string, reason?: string): Promise<boolean> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) {
        logger.error('Supabase client not available', { action: 'rejectUser', userId });
        return false;
      }

      // First, remove any role assignments
      databaseQuery('DELETE', 'user_roles', { action: 'rejectUser', userId });

      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (roleError) {
        databaseError('DELETE', 'user_roles', roleError, { action: 'rejectUser', userId });
        logger.warn('Error removing user roles during rejection', { 
          action: 'rejectUser', 
          userId 
        });
      }

      // Then delete the user profile
      databaseQuery('DELETE', 'user_profiles', { action: 'rejectUser', userId });

      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId)
        .eq('is_approved', false); // Only delete if not approved

      if (error) {
        databaseError('DELETE', 'user_profiles', error, { action: 'rejectUser', userId });
        logger.error('Error rejecting user', { action: 'rejectUser', userId }, error);
        return false;
      }

      userAction('rejected', userId, { action: 'rejectUser', rejectedBy, reason });
      logger.info('User rejected successfully', { 
        action: 'rejectUser', 
        userId, 
        rejectedBy,
        reason 
      });

      return true;
    } catch (error) {
      logger.error('Exception in rejectUser', { action: 'rejectUser', userId }, error as Error);
      return false;
    }
  }

  /**
   * Request approval for a user (usually called on signup)
   */
  async requestApproval(userId: string): Promise<boolean> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) {
        logger.error('Supabase client not available', { action: 'requestApproval', userId });
        return false;
      }

      databaseQuery('UPDATE', 'user_profiles', { action: 'requestApproval', userId });

      const { error } = await supabase
        .from('user_profiles')
        .update({
          is_approved: false,
          approval_requested_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        databaseError('UPDATE', 'user_profiles', error, { action: 'requestApproval', userId });
        logger.error('Error requesting approval', { action: 'requestApproval', userId }, error);
        return false;
      }

      userAction('approval_requested', userId, { action: 'requestApproval' });
      logger.info('Approval requested successfully', { action: 'requestApproval', userId });

      return true;
    } catch (error) {
      logger.error('Exception in requestApproval', { action: 'requestApproval', userId }, error as Error);
      return false;
    }
  }

  /**
   * Check if a user is approved
   */
  async isUserApproved(userId: string): Promise<boolean> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) {
        logger.error('Supabase client not available', { action: 'isUserApproved', userId });
        return false;
      }

      databaseQuery('SELECT', 'user_profiles', { action: 'isUserApproved', userId });

      const { data: user, error } = await supabase
        .from('user_profiles')
        .select('is_approved')
        .eq('id', userId)
        .single();

      if (error) {
        databaseError('SELECT', 'user_profiles', error, { action: 'isUserApproved', userId });
        logger.error('Error checking user approval status', { action: 'isUserApproved', userId }, error);
        return false;
      }

      const isApproved = user?.is_approved || false;
      logger.debug('User approval status checked', { 
        action: 'isUserApproved', 
        userId, 
        isApproved 
      });

      return isApproved;
    } catch (error) {
      logger.error('Exception in isUserApproved', { action: 'isUserApproved', userId }, error as Error);
      return false;
    }
  }

  /**
   * Get approval statistics
   */
  async getApprovalStats(): Promise<{
    total_pending: number;
    total_approved: number;
    total_rejected: number;
    pending_by_date: Record<string, number>;
  }> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) {
        logger.error('Supabase client not available', { action: 'getApprovalStats' });
        return {
          total_pending: 0,
          total_approved: 0,
          total_rejected: 0,
          pending_by_date: {},
        };
      }

      databaseQuery('SELECT', 'user_profiles', { action: 'getApprovalStats' });

      const { data: users, error } = await supabase
        .from('user_profiles')
        .select('is_approved, approval_requested_at, created_at');

      if (error) {
        databaseError('SELECT', 'user_profiles', error, { action: 'getApprovalStats' });
        logger.error('Error fetching approval stats', { action: 'getApprovalStats' }, error);
        return {
          total_pending: 0,
          total_approved: 0,
          total_rejected: 0,
          pending_by_date: {},
        };
      }

      const stats = {
        total_pending: 0,
        total_approved: 0,
        total_rejected: 0,
        pending_by_date: {} as Record<string, number>,
      };

      users?.forEach((user: any) => {
        if (user.is_approved) {
          stats.total_approved++;
        } else {
          stats.total_pending++;
          
          // Group pending by date
          const date = new Date(user.approval_requested_at || user.created_at).toISOString().split('T')[0];
          stats.pending_by_date[date] = (stats.pending_by_date[date] || 0) + 1;
        }
      });

      logger.info('Approval stats retrieved', { 
        action: 'getApprovalStats',
        ...stats
      });

      return stats;
    } catch (error) {
      logger.error('Exception in getApprovalStats', { action: 'getApprovalStats' }, error as Error);
      return {
        total_pending: 0,
        total_approved: 0,
        total_rejected: 0,
        pending_by_date: {},
      };
    }
  }

  /**
   * Bulk approve multiple users
   */
  async bulkApproveUsers(userIds: string[], approvedBy: string, reason?: string): Promise<{
    successful: string[];
    failed: string[];
  }> {
    try {
      logger.info(`Starting bulk approval for ${userIds.length} users`, { 
        action: 'bulkApproveUsers',
        count: userIds.length,
        approvedBy
      });

      const results = {
        successful: [] as string[],
        failed: [] as string[],
      };

      // Process approvals in parallel with limited concurrency
      const batchSize = 5;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (userId) => {
          const success = await this.approveUser(userId, approvedBy, reason);
          if (success) {
            results.successful.push(userId);
          } else {
            results.failed.push(userId);
          }
        });

        await Promise.all(batchPromises);
      }

      logger.info('Bulk approval completed', { 
        action: 'bulkApproveUsers',
        successful: results.successful.length,
        failed: results.failed.length,
        approvedBy
      });

      return results;
    } catch (error) {
      logger.error('Exception in bulkApproveUsers', { action: 'bulkApproveUsers' }, error as Error);
      return {
        successful: [],
        failed: userIds,
      };
    }
  }

  /**
   * Get user approval history
   */
  async getUserApprovalHistory(userId: string): Promise<{
    approval_requested_at: string | null;
    approved_at: string | null;
    approved_by: string | null;
    approver_name: string | null;
  } | null> {
    try {
      const supabase = await this.getSupabase();
      if (!supabase) {
        logger.error('Supabase client not available', { action: 'getUserApprovalHistory', userId });
        return null;
      }

      databaseQuery('SELECT', 'user_profiles', { action: 'getUserApprovalHistory', userId });

      const { data: user, error } = await supabase
        .from('user_profiles')
        .select(`
          approval_requested_at,
          approved_at,
          approved_by,
          approver:approved_by(name)
        `)
        .eq('id', userId)
        .single();

      if (error) {
        databaseError('SELECT', 'user_profiles', error, { action: 'getUserApprovalHistory', userId });
        logger.error('Error fetching user approval history', { action: 'getUserApprovalHistory', userId }, error);
        return null;
      }

      const history = {
        approval_requested_at: user?.approval_requested_at || null,
        approved_at: user?.approved_at || null,
        approved_by: user?.approved_by || null,
        approver_name: user?.approver?.name || null,
      };

      logger.debug('User approval history retrieved', { 
        action: 'getUserApprovalHistory', 
        userId,
        hasApproval: !!history.approved_at
      });

      return history;
    } catch (error) {
      logger.error('Exception in getUserApprovalHistory', { action: 'getUserApprovalHistory', userId }, error as Error);
      return null;
    }
  }
}

// Export singleton instance
export const userApprovalService = new UserApprovalService();
