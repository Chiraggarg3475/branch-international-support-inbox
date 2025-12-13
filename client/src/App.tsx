import { useEffect, useState, useCallback } from 'react';
import { MessageSquare, Search, User, AlertCircle, X, Moon, Sun, ChevronLeft, Info } from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { useInboxStore } from './store/inbox';
import { useTheme } from './hooks/useTheme';
import { useResizable } from './hooks/useResizable';

const API_BASE = 'http://127.0.0.1:3001/api';

// Types
interface Conversation {
    id: string;
    customerId: string;
    title: string;
    status: 'OPEN' | 'WAITING' | 'RESOLVED';
    urgencyScore: number;
    urgencyReasons: Array<{ rule: string; description: string }>;
    lastMessageAt: string;
    messages: Message[];
}

interface Message {
    id: string;
    senderType: 'CUSTOMER' | 'AGENT';
    content: string;
    timestamp: string;
}

function App() {
    // Global State
    const { searchQuery, statusFilter, minUrgency, activeId, actions } = useInboxStore();

    // Hooks
    const { theme, setTheme } = useTheme();
    const { leftWidth, rightWidth, startResizingLeft, startResizingRight, isResizingLeft, isResizingRight } = useResizable(320, 320);

    // Local Data State
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeDetails, setActiveDetails] = useState<Conversation | null>(null);
    const [loading, setLoading] = useState(true);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState<string | null>(null);
    const [isMobileInfoOpen, setIsMobileInfoOpen] = useState(false);

    // Fetch List on filter change
    useEffect(() => {
        let mounted = true;
        setLoading(true);
        const params = new URLSearchParams();
        if (searchQuery) params.append('q', searchQuery);
        if (statusFilter !== 'ALL') params.append('status', statusFilter);
        if (minUrgency > 0) params.append('minUrgency', minUrgency.toString());

        fetch(`${API_BASE}/conversations?${params.toString()}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch conversations');
                return res.json();
            })
            .then(data => {
                if (mounted) {
                    setConversations(data);
                    setLoading(false);
                }
            })
            .catch(err => {
                console.error(err);
                if (mounted) setLoading(false);
            });

        return () => { mounted = false; };
    }, [searchQuery, statusFilter, minUrgency]);

    // Fetch Details on Selection
    useEffect(() => {
        if (!activeId) {
            setActiveDetails(null);
            setIsMobileInfoOpen(false);
            setDetailsError(null);
            return;
        }

        let mounted = true;
        setDetailsLoading(true);
        setDetailsError(null);

        fetch(`${API_BASE}/conversations/${activeId}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to load conversation details');
                return res.json();
            })
            .then(data => {
                if (mounted) {
                    setActiveDetails(data);
                    setDetailsLoading(false);
                }
            })
            .catch(err => {
                console.error(err);
                if (mounted) {
                    setDetailsError('Failed to load conversation. Please try again.');
                    setDetailsLoading(false);
                }
            });

        return () => { mounted = false; };
    }, [activeId]);

    // Handlers
    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        actions.setSearch(e.target.value);
    };

    const handleResolve = useCallback((status: 'OPEN' | 'RESOLVED') => {
        if (!activeDetails) return;

        // Optimistic UI
        const prevDetails = activeDetails;
        const prevList = conversations;

        setActiveDetails(prev => prev ? ({ ...prev, status }) : null);
        setConversations(prev => prev.map(c => c.id === activeDetails.id ? { ...c, status } : c));

        fetch(`${API_BASE}/conversations/${activeDetails.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        }).catch(err => {
            console.error('Status update failed', err);
            // Revert
            setActiveDetails(prevDetails);
            setConversations(prevList);
        });
    }, [activeDetails, conversations]);

    const handleSendMessage = useCallback((content: string) => {
        if (!content.trim() || !activeDetails) return;

        const optimisticMessage: Message = {
            id: 'opt_' + Date.now(),
            senderType: 'AGENT',
            content,
            timestamp: new Date().toISOString()
        };

        // Optimistic Update
        setActiveDetails(prev => prev ? ({
            ...prev,
            messages: [...prev.messages, optimisticMessage],
            status: 'WAITING',
            lastMessageAt: new Date().toISOString()
        }) : null);

        // Update list view optimistically too
        setConversations(prev => prev.map(c =>
            c.id === activeDetails.id ? {
                ...c,
                status: 'WAITING',
                lastMessageAt: new Date().toISOString(),
                // note: we don't update list messages as list only shows metadata/preview usually
            } : c
        ));

        fetch(`${API_BASE}/conversations/${activeDetails.id}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        }).catch(err => {
            console.error('Send failed', err);
            // In a real app we'd mark message as failed
        });
    }, [activeDetails, conversations]);

    // Layout Helpers
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;

    return (
        <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-900 overflow-hidden text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">

            {/* LEFT SIDEBAR (INBOX) */}
            <div
                className={clsx(
                    "flex flex-col bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shrink-0",
                    !isDesktop && activeId ? "hidden" : "flex w-full lg:w-auto"
                )}
                style={{ width: isDesktop ? leftWidth : '100%' }}
            >
                {/* Header & Search */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col gap-3 bg-white dark:bg-slate-800">
                    <div className="flex items-center justify-between">
                        <h1 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <div className="bg-indigo-600 p-1.5 rounded-lg">
                                <MessageSquare className="w-4 h-4 text-white" />
                            </div>
                            Inbox
                        </h1>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                            >
                                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                            </button>
                            <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                {conversations.length}
                            </span>
                        </div>
                    </div>

                    <div className="relative group">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search messages..."
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:text-white"
                            value={searchQuery}
                            onChange={handleSearch}
                        />
                    </div>

                    <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
                        {(['ALL', 'OPEN', 'RESOLVED'] as const).map(f => (
                            <button
                                key={f}
                                type="button"
                                onClick={() => actions.setStatusFilter(f)}
                                className={clsx(
                                    "flex-1 text-[10px] font-semibold py-1.5 rounded-md transition-all",
                                    statusFilter === f
                                        ? "bg-white dark:bg-slate-600 text-indigo-700 dark:text-white shadow-sm"
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                )}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {/* List */}
                <div className="overflow-y-auto flex-1 p-2 space-y-1">
                    {loading ? (
                        <div className="p-4 text-center text-xs text-slate-400">Loading...</div>
                    ) : conversations.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
                            <Search className="w-8 h-8 opacity-20" />
                            <p className="text-xs">No conversations found.</p>
                        </div>
                    ) : (
                        conversations.map(convo => (
                            <button
                                key={convo.id}
                                type="button"
                                onClick={() => actions.selectConversation(convo.id)}
                                className={clsx(
                                    "w-full text-left p-3 rounded-xl transition-all border group relative",
                                    activeId === convo.id
                                        ? "bg-white dark:bg-slate-700 shadow-md border-indigo-100 dark:border-indigo-900/50 ring-1 ring-indigo-50 dark:ring-indigo-900/30 z-10"
                                        : "bg-transparent border-transparent hover:bg-white dark:hover:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700",
                                    convo.status === 'RESOLVED' && activeId !== convo.id ? "opacity-60 grayscale-[0.5]" : "opacity-100"
                                )}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className={clsx("font-semibold text-sm truncate pr-2 dark:text-slate-200", activeId === convo.id ? "text-indigo-900 dark:text-indigo-100" : "text-slate-700")}>
                                        {convo.customerId}
                                    </span>
                                    <span className="text-[10px] text-slate-400 whitespace-nowrap font-medium">
                                        {formatDistanceToNow(new Date(convo.lastMessageAt), { addSuffix: true })}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mb-2 leading-relaxed opacity-90">{convo.title}</p>

                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={clsx(
                                        "text-[10px] font-bold px-1.5 py-0.5 rounded-md border uppercase tracking-wider",
                                        convo.status === 'OPEN' ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-100 dark:border-red-900/30" :
                                            convo.status === 'WAITING' ? "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-100 dark:border-yellow-900/30" :
                                                "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/30"
                                    )}>
                                        {convo.status === 'WAITING' ? 'In Progress' : convo.status}
                                    </span>

                                    {convo.urgencyScore > 0 && (
                                        <span className={clsx(
                                            "text-[10px] font-bold px-1.5 py-0.5 rounded-md border flex items-center gap-1",
                                            convo.urgencyScore >= 70 ? "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border-rose-100 dark:border-rose-900/30" :
                                                convo.urgencyScore >= 40 ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900/30" :
                                                    "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900/30"
                                        )}>
                                            {convo.urgencyScore >= 70 && <AlertCircle className="w-3 h-3" />}
                                            {convo.urgencyScore}
                                        </span>
                                    )}
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* RESIZER (LEFT) */}
            <div
                className={clsx(
                    "w-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 items-center justify-center cursor-col-resize hidden lg:flex transition-colors z-20",
                    isResizingLeft && "bg-indigo-400 dark:bg-indigo-500"
                )}
                onMouseDown={startResizingLeft}
            >
                <div className="w-0.5 h-8 bg-slate-300 dark:bg-slate-600 rounded-full" />
            </div>

            {/* CENTER: CHAT */}
            <div className={clsx(
                "flex-1 flex flex-col bg-white dark:bg-slate-900 relative min-w-0 transition-colors",
                !isDesktop && !activeId ? "hidden" : "flex w-full"
            )}>
                {activeDetails ? (
                    <>
                        {/* Header */}
                        <div className="h-16 border-b border-slate-100 dark:border-slate-800 flex items-center px-4 md:px-6 justify-between shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur z-20">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => actions.selectConversation(null)}
                                    className="lg:hidden p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>

                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-sm ring-2 ring-white dark:ring-slate-800 shrink-0">
                                    {activeDetails.customerId.substring(0, 2)}
                                </div>
                                <div className="min-w-0">
                                    <h2 className="font-bold text-slate-800 dark:text-white text-sm truncate">{activeDetails.customerId}</h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                        Active now
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsMobileInfoOpen(!isMobileInfoOpen)}
                                    className={clsx(
                                        "lg:hidden p-2 rounded-full transition-colors",
                                        isMobileInfoOpen ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" : "text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                    )}
                                >
                                    <Info className="w-5 h-5" />
                                </button>

                                {activeDetails.status === 'RESOLVED' ? (
                                    <button
                                        type="button"
                                        onClick={() => handleResolve('OPEN')}
                                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap"
                                    >
                                        In Progress
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => handleResolve('RESOLVED')}
                                        className="px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap"
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        Resolve
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={() => actions.selectConversation(null)}
                                    className="hidden lg:block p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                    title="Close conversation"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                            {detailsLoading ? (
                                <div className="flex justify-center pt-10 text-slate-400">Loading history...</div>
                            ) : detailsError ? (
                                <div className="flex flex-col items-center justify-center pt-10 text-slate-400 gap-2">
                                    <AlertCircle className="w-8 h-8 text-rose-400" />
                                    <p>{detailsError}</p>
                                    <button
                                        type="button"
                                        onClick={() => actions.selectConversation(activeId)}
                                        className="text-indigo-500 hover:underline text-sm"
                                    >
                                        Retry
                                    </button>
                                </div>
                            ) : (
                                activeDetails.messages.map(msg => (
                                    <div key={msg.id} className={clsx("flex gap-3 max-w-2xl", msg.senderType === 'AGENT' ? "ml-auto flex-row-reverse" : "")}>
                                        <div className={clsx(
                                            "w-8 h-8 rounded-full flex shrink-0 items-center justify-center text-xs font-bold ring-2 ring-white dark:ring-slate-800 shadow-sm",
                                            msg.senderType === 'AGENT' ? "bg-indigo-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                                        )}>
                                            {msg.senderType === 'AGENT' ? "A" : "C"}
                                        </div>
                                        <div className={clsx(
                                            "p-3 md:p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
                                            msg.senderType === 'AGENT'
                                                ? "bg-indigo-600 text-white rounded-tr-sm"
                                                : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm border border-slate-200 dark:border-slate-700"
                                        )}>
                                            {msg.content}
                                        </div>
                                    </div>
                                ))
                            )}
                            {activeDetails.status === 'RESOLVED' && !detailsLoading && (
                                <div className="flex justify-center my-4">
                                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs px-3 py-1 rounded-full font-medium">
                                        This conversation was marked as resolved
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        {activeDetails.status === 'RESOLVED' ? (
                            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex items-center justify-between">
                                <p className="text-sm text-slate-400 italic flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    Conversation is resolved. Reopen to reply.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => handleResolve('OPEN')}
                                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                                >
                                    Reopen
                                </button>
                            </div>
                        ) : (
                            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                                <div className="max-w-4xl mx-auto relative">
                                    <input
                                        type="text"
                                        placeholder="Type a reply... (Enter to send)"
                                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 pl-4 pr-12 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none shadow-sm text-sm transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleSendMessage(e.currentTarget.value);
                                                e.currentTarget.value = '';
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/30 dark:bg-slate-900">
                        <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="absolute w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-full animate-pulse" />
                            <MessageSquare className="w-10 h-10 text-indigo-300 dark:text-indigo-600 relative z-10" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No conversation selected</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-500 max-w-xs text-center leading-relaxed">
                            Select a customer from the list on the left to view details and start chatting.
                        </p>
                    </div>
                )}
            </div>

            {/* RESIZER (RIGHT) */}
            {activeDetails && (
                <div
                    className={clsx(
                        "w-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 items-center justify-center cursor-col-resize hidden lg:flex transition-colors z-20",
                        isResizingRight && "bg-indigo-400 dark:bg-indigo-500"
                    )}
                    onMouseDown={startResizingRight}
                >
                    <div className="w-0.5 h-8 bg-slate-300 dark:bg-slate-600 rounded-full" />
                </div>
            )}

            {/* RIGHT SIDEBAR */}
            {activeDetails && (
                <div
                    className={clsx(
                        "bg-slate-50 dark:bg-slate-800 lg:border-l border-slate-200 dark:border-slate-700 p-6 overflow-y-auto shrink-0 transition-transform lg:translate-x-0 absolute lg:static inset-0 lg:inset-auto z-30 lg:z-auto",
                        isMobileInfoOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
                    )}
                    style={{ width: isDesktop ? rightWidth : '100%' }}
                >
                    <div className="flex items-center justify-between lg:hidden mb-6">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Details</h3>
                        <button type="button" onClick={() => setIsMobileInfoOpen(false)} className="p-2 -mr-2 text-slate-500">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Customer Context</h3>

                    <div className="space-y-6">
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                                    <User className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white">{activeDetails.customerId}</p>
                                    <p className="text-xs text-slate-500">Verified Borrower</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
                                Urgency Analysis
                            </h4>
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                                <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Score</span>
                                    <span className={clsx("text-sm font-bold",
                                        activeDetails.urgencyScore > 70 ? "text-rose-600 dark:text-rose-400" :
                                            activeDetails.urgencyScore > 40 ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"
                                    )}>{activeDetails.urgencyScore}/100</span>
                                </div>
                                <div className="p-3 space-y-3">
                                    {activeDetails.urgencyReasons.map((r, i) => (
                                        <div key={i} className="flex gap-2 items-start">
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0 shadow-sm" />
                                            <div>
                                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{r.rule}</p>
                                                <p className="text-[10px] text-slate-500 leading-relaxed">{r.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {activeDetails.urgencyReasons.length === 0 && <p className="text-xs text-slate-400 italic">No specific risk triggers found.</p>}
                                </div>
                            </div>
                        </div>

                        {/* Agent Tools Placeholder */}
                        <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-3">Agent Tools</h4>
                            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-center">
                                <p className="text-xs text-slate-400">Assignment & Notes coming soon.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
