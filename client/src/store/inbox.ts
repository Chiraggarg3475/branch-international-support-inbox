import { create } from 'zustand';

interface InboxState {
    searchQuery: string;
    statusFilter: 'ALL' | 'OPEN' | 'RESOLVED' | 'WAITING';
    minUrgency: number;

    activeId: string | null;

    actions: {
        setSearch: (q: string) => void;
        setStatusFilter: (status: 'ALL' | 'OPEN' | 'RESOLVED' | 'WAITING') => void;
        setUrgencyFilter: (score: number) => void;
        selectConversation: (id: string | null) => void;
    }
}

export const useInboxStore = create<InboxState>((set) => ({
    searchQuery: '',
    statusFilter: 'ALL',
    minUrgency: 0,
    activeId: null,

    actions: {
        setSearch: (q) => set({ searchQuery: q }),
        setStatusFilter: (status) => set({ statusFilter: status }),
        setUrgencyFilter: (score) => set({ minUrgency: score }),
        selectConversation: (id) => set({ activeId: id }),
    },
}));
