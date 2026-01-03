import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { simData, type SimInvitation } from '@/lib/simulationData';

export type { SimInvitation as Invitation };

export function useInvitations() {
  const [invitations, setInvitations] = useState<SimInvitation[]>([]);
  const { toast } = useToast();

  // Load invitations from persistent storage
  useEffect(() => {
    setInvitations(simData.getInvitations());
  }, []);

  const acceptInvitation = useCallback((id: number) => {
    const result = simData.acceptInvitation(id);
    if (result) {
      setInvitations(simData.getInvitations());
      toast({
        title: "Invitation Accepted",
        description: "You have accepted the invitation.",
      });
    }
  }, [toast]);

  const rejectInvitation = useCallback((id: number) => {
    const result = simData.rejectInvitation(id);
    if (result) {
      setInvitations(simData.getInvitations());
      toast({
        title: "Invitation Declined",
        description: "You have declined the invitation.",
      });
    }
  }, [toast]);

  const pendingCount = invitations.filter(inv => inv.status === 'pending').length;

  return {
    invitations,
    acceptInvitation,
    rejectInvitation,
    pendingCount
  };
}
