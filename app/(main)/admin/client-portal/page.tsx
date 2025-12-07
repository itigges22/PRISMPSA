'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UserPlus, Mail, Check, X, Clock, MessageSquare, Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistance, isValid } from 'date-fns';

interface Account {
  id: string;
  name: string;
  client_count?: number;
}

interface ClientInvitation {
  id: string;
  email: string;
  status: 'pending' | 'accepted' | 'expired';
  created_at: string;
  expires_at: string;
  accepted_at?: string;
  invited_by_user?: {
    name: string;
    email: string;
  };
}

interface ClientFeedback {
  id: string;
  project_id: string;
  satisfaction_score: number | null;
  what_went_well: string | null;
  what_needs_improvement: string | null;
  submitted_at: string;
  projects: {
    id: string;
    name: string;
  };
  user_profiles: {
    id: string;
    name: string;
    email: string;
  };
}

interface FeedbackStats {
  totalFeedback: number;
  averageSatisfaction: number;
  feedbackByScore: Record<number, number>;
}

export default function ClientPortalPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [activeTab, setActiveTab] = useState('invitations');

  // Invitations state
  const [invitations, setInvitations] = useState<ClientInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteExpiryDays, setInviteExpiryDays] = useState('7');
  const [sending, setSending] = useState(false);

  // Feedback state
  const [feedback, setFeedback] = useState<ClientFeedback[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<ClientFeedback | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Load accounts
  useEffect(() => {
    void loadAccounts();
  }, []);

  // Load data when account or tab changes
  useEffect(() => {
    if (selectedAccount) {
      if (activeTab === 'invitations') {
        void loadInvitations(selectedAccount.id);
      } else if (activeTab === 'feedback') {
        void loadFeedback(selectedAccount.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount, activeTab]);

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const response = await fetch('/api/accounts');
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts || []);
        // Auto-select first account
        if (data.accounts && data.accounts.length > 0) {
          setSelectedAccount(data.accounts[0]);
        }
      } else {
        toast.error('Failed to load accounts');
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
      toast.error('Error loading accounts');
    } finally {
      setLoadingAccounts(false);
    }
  };

  const loadInvitations = useCallback(async (accountId: string) => {
    setLoadingInvitations(true);
    try {
      const response = await fetch(`/api/accounts/${accountId}/client-invites`);
      if (response.ok) {
        const data = await response.json();
        setInvitations(data.invitations || []);
      } else {
        toast.error('Failed to load invitations');
      }
    } catch (error) {
      console.error('Error loading invitations:', error);
      toast.error('Error loading invitations');
    } finally {
      setLoadingInvitations(false);
    }
  }, []);

  const loadFeedback = useCallback(async (accountId: string) => {
    setLoadingFeedback(true);
    try {
      const response = await fetch(`/api/accounts/${accountId}/client-feedback`);
      if (response.ok) {
        const data = await response.json();
        setFeedback(data.feedback || []);
        calculateStats(data.feedback || []);
      } else {
        toast.error('Failed to load feedback');
      }
    } catch (error) {
      console.error('Error loading feedback:', error);
      toast.error('Error loading feedback');
    } finally {
      setLoadingFeedback(false);
    }
  }, []);

  const calculateStats = (feedbackData: ClientFeedback[]) => {
    const withScores = feedbackData.filter(f => f.satisfaction_score !== null);

    if (withScores.length === 0) {
      setStats({
        totalFeedback: feedbackData.length,
        averageSatisfaction: 0,
        feedbackByScore: {},
      });
      return;
    }

    const scores = withScores.map(f => f.satisfaction_score as number);
    const averageSatisfaction = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    const feedbackByScore: Record<number, number> = {};
    for (const score of scores) {
      feedbackByScore[score] = (feedbackByScore[score] || 0) + 1;
    }

    setStats({
      totalFeedback: feedbackData.length,
      averageSatisfaction: Math.round(averageSatisfaction * 10) / 10,
      feedbackByScore,
    });
  };

  const handleSendInvitation = async () => {
    if (!selectedAccount) {
      toast.error('Please select an account');
      return;
    }

    if (!inviteEmail?.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    const expiryDays = parseInt(inviteExpiryDays);
    if (isNaN(expiryDays) || expiryDays < 1 || expiryDays > 365) {
      toast.error('Expiry days must be between 1 and 365');
      return;
    }

    setSending(true);
    try {
      const response = await fetch(`/api/accounts/${selectedAccount.id}/invite-client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          expires_in_days: expiryDays
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`Invitation sent to ${inviteEmail}`);
        setInviteDialogOpen(false);
        setInviteEmail('');
        setInviteExpiryDays('7');
        // Reload invitations
        await loadInvitations(selectedAccount.id);
      } else {
        toast.error(data.error || 'Failed to send invitation');
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast.error('Error sending invitation');
    } finally {
      setSending(false);
    }
  };

  const getStatusBadge = (invitation: ClientInvitation) => {
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);

    if (invitation.status === 'accepted') {
      return <Badge className="bg-green-100 text-green-800 flex items-center gap-1"><Check className="w-3 h-3" />Accepted</Badge>;
    } else if (invitation.status === 'expired' || expiresAt < now) {
      return <Badge className="bg-gray-100 text-gray-800 flex items-center gap-1"><X className="w-3 h-3" />Expired</Badge>;
    } else {
      return <Badge className="bg-yellow-100 text-yellow-800 flex items-center gap-1"><Clock className="w-3 h-3" />Pending</Badge>;
    }
  };

  const getSatisfactionBadge = (score: number | null) => {
    if (score === null) {
      return <Badge variant="outline" className="gap-1"><Minus className="w-3 h-3" />No Score</Badge>;
    }

    if (score >= 8) {
      return (
        <Badge className="bg-green-100 text-green-800 gap-1">
          <TrendingUp className="w-3 h-3" />
          {score}/10
        </Badge>
      );
    } else if (score >= 5) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 gap-1">
          <Minus className="w-3 h-3" />
          {score}/10
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-red-100 text-red-800 gap-1">
          <TrendingDown className="w-3 h-3" />
          {score}/10
        </Badge>
      );
    }
  };

  const viewDetails = (item: ClientFeedback) => {
    setSelectedFeedback(item);
    setDetailsDialogOpen(true);
  };

  const renderStars = (score: number | null) => {
    if (score === null) return null;

    const fullStars = Math.floor(score);
    const stars = [];

    for (let i = 0; i < 10; i++) {
      stars.push(
        <Star
          key={i}
          className={`w-4 h-4 ${
            i < fullStars ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
          }`}
        />
      );
    }

    return <div className="flex gap-0.5">{stars}</div>;
  };

  // Helper function to safely format dates
  const safeFormatDistance = (dateString: string | null | undefined) => {
    if (!dateString) return '-';

    const date = new Date(dateString);
    if (!isValid(date)) return 'Invalid date';

    try {
      return formatDistance(date, new Date(), { addSuffix: true });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Client Portal</h1>
        <p className="text-muted-foreground mt-2">
          Manage client invitations, access, and feedback
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Account Selector */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Accounts</CardTitle>
            <CardDescription>Select an account</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAccounts ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading...</p>
              </div>
            ) : accounts.length === 0 ? (
              <p className="text-sm text-gray-500">No accounts found</p>
            ) : (
              <div className="space-y-2">
                {accounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => { setSelectedAccount(account); }}
                    className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                      selectedAccount?.id === account.id
                        ? 'bg-blue-100 text-blue-900 font-medium'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    {account.name}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Content with Tabs */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Client Management
                  {selectedAccount && (
                    <span className="text-sm font-normal text-muted-foreground">
                      for {selectedAccount.name}
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Invite clients to access the portal and view their feedback
                </CardDescription>
              </div>
              {activeTab === 'invitations' && (
                <Button
                  onClick={() => { setInviteDialogOpen(true); }}
                  disabled={!selectedAccount}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Send Invitation
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="invitations" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Invitations
                  {invitations.length > 0 && <Badge variant="secondary">{invitations.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="feedback" className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Feedback
                  {feedback.length > 0 && <Badge variant="secondary">{feedback.length}</Badge>}
                </TabsTrigger>
              </TabsList>

              {/* Invitations Tab */}
              <TabsContent value="invitations">
                {!selectedAccount ? (
                  <div className="text-center py-8 text-gray-400">
                    <Mail className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Select an account to view invitations</p>
                  </div>
                ) : loadingInvitations ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Loading invitations...</p>
                  </div>
                ) : invitations.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <UserPlus className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No invitations sent yet</p>
                    <p className="text-xs mt-1">Click &quot;Send Invitation&quot; to invite a client</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Invited By</TableHead>
                          <TableHead>Sent</TableHead>
                          <TableHead>Expires</TableHead>
                          <TableHead>Accepted</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invitations.map((invitation) => (
                          <TableRow key={invitation.id}>
                            <TableCell className="font-medium">{invitation.email}</TableCell>
                            <TableCell>{getStatusBadge(invitation)}</TableCell>
                            <TableCell>
                              {invitation.invited_by_user ? (
                                <div className="text-sm">
                                  <p className="font-medium">{invitation.invited_by_user.name}</p>
                                  <p className="text-xs text-muted-foreground">{invitation.invited_by_user.email}</p>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">Unknown</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {safeFormatDistance(invitation.created_at)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {safeFormatDistance(invitation.expires_at)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {safeFormatDistance(invitation.accepted_at)}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              {/* Feedback Tab */}
              <TabsContent value="feedback">
                {/* Stats Summary */}
                {stats && stats.totalFeedback > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Feedback</p>
                      <p className="text-2xl font-bold">{stats.totalFeedback}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Average Satisfaction</p>
                      <div className="flex items-center gap-2">
                        <p className="text-2xl font-bold">
                          {stats.averageSatisfaction > 0 ? `${stats.averageSatisfaction}/10` : 'N/A'}
                        </p>
                        {stats.averageSatisfaction >= 8 && (
                          <TrendingUp className="w-5 h-5 text-green-600" />
                        )}
                        {stats.averageSatisfaction < 5 && stats.averageSatisfaction > 0 && (
                          <TrendingDown className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Feedback with Scores</p>
                      <p className="text-2xl font-bold">
                        {Object.values(stats.feedbackByScore).reduce((a, b) => a + b, 0)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Feedback Table */}
                {!selectedAccount ? (
                  <div className="text-center py-8 text-gray-400">
                    <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Select an account to view feedback</p>
                  </div>
                ) : loadingFeedback ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Loading feedback...</p>
                  </div>
                ) : feedback.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No feedback submitted yet</p>
                    <p className="text-xs mt-1">Clients can submit feedback from their project view</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Project</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Satisfaction</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {feedback.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.projects.name}</TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <p className="font-medium">{item.user_profiles.name}</p>
                                <p className="text-xs text-muted-foreground">{item.user_profiles.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>{getSatisfactionBadge(item.satisfaction_score)}</TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {safeFormatDistance(item.submitted_at)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <button
                                onClick={() => { viewDetails(item); }}
                                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                View Details
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Send Invitation Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Client Invitation</DialogTitle>
            <DialogDescription>
              Invite a client to access the portal for {selectedAccount?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Client Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="client@example.com"
                value={inviteEmail}
                onChange={(e) => { setInviteEmail(e.target.value); }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiry">Invitation Valid For (days) *</Label>
              <Input
                id="expiry"
                type="number"
                min="1"
                max="365"
                value={inviteExpiryDays}
                onChange={(e) => { setInviteExpiryDays(e.target.value); }}
              />
              <p className="text-xs text-muted-foreground">
                The invitation link will expire after this many days (1-365)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setInviteDialogOpen(false); }} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={handleSendInvitation} disabled={sending}>
              {sending ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Feedback Details</DialogTitle>
            <DialogDescription>
              Submitted by {selectedFeedback?.user_profiles.name} for {selectedFeedback?.projects.name}
            </DialogDescription>
          </DialogHeader>
          {selectedFeedback && (
            <div className="space-y-6 py-4">
              {/* Satisfaction Score */}
              <div>
                <label className="text-sm font-semibold text-muted-foreground">Satisfaction Score</label>
                <div className="mt-2 flex items-center gap-4">
                  {getSatisfactionBadge(selectedFeedback.satisfaction_score)}
                  {renderStars(selectedFeedback.satisfaction_score)}
                </div>
              </div>

              {/* What Went Well */}
              {selectedFeedback.what_went_well && (
                <div>
                  <label className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    What Went Well
                  </label>
                  <div className="mt-2 p-4 bg-green-50 rounded-md border border-green-200">
                    <p className="text-sm whitespace-pre-wrap">{selectedFeedback.what_went_well}</p>
                  </div>
                </div>
              )}

              {/* What Needs Improvement */}
              {selectedFeedback.what_needs_improvement && (
                <div>
                  <label className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-orange-600" />
                    What Needs Improvement
                  </label>
                  <div className="mt-2 p-4 bg-orange-50 rounded-md border border-orange-200">
                    <p className="text-sm whitespace-pre-wrap">{selectedFeedback.what_needs_improvement}</p>
                  </div>
                </div>
              )}

              {/* Submitted Date */}
              <div>
                <label className="text-sm font-semibold text-muted-foreground">Submitted</label>
                <p className="text-sm mt-1">
                  {safeFormatDistance(selectedFeedback.submitted_at)}
                  {' '}
                  {selectedFeedback.submitted_at && isValid(new Date(selectedFeedback.submitted_at)) && (
                    <>
                      ({new Date(selectedFeedback.submitted_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })})
                    </>
                  )}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
