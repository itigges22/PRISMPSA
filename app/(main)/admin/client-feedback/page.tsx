'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MessageSquare, Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistance } from 'date-fns';

interface Account {
  id: string;
  name: string;
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

export default function ClientFeedbackPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [feedback, setFeedback] = useState<ClientFeedback[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<ClientFeedback | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Load accounts
  useEffect(() => {
    void loadAccounts();
  }, []);

  // Load feedback when account is selected
  useEffect(() => {
    if (selectedAccount) {
      void loadFeedback(selectedAccount.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount]);

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

  const loadFeedback = async (accountId: string) => {
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
  };

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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Client Feedback</h1>
        <p className="text-muted-foreground mt-2">
          View client satisfaction scores and feedback comments
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

        {/* Feedback List */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Client Feedback
                  {selectedAccount && (
                    <span className="text-sm font-normal text-muted-foreground">
                      for {selectedAccount.name}
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  View satisfaction ratings and feedback from clients
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stats Summary */}
            {stats && stats.totalFeedback > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
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
                            {formatDistance(new Date(item.submitted_at), new Date(), { addSuffix: true })}
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
          </CardContent>
        </Card>
      </div>

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
                  {formatDistance(new Date(selectedFeedback.submitted_at), new Date(), { addSuffix: true })}
                  {' '}
                  ({new Date(selectedFeedback.submitted_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })})
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
