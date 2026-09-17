'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { 
    useUserMarketplaceListing, 
    useToggleFavorite, 
    useListingReviews, 
    usePostListingReview,
    useReportListing,
    useBlockUser,
} from '@/hooks/useUserMarketplace';
import { useStartConversation } from '@/hooks/useUserMessaging';
import { useAuthStore } from '@/store/authStore';
import { formatNaira } from '../../page';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
    Heart, 
    Share2,
    MapPin, 
    Calendar, 
    ShieldCheck, 
    MessageSquare, 
    AlertTriangle, 
    Star, 
    Zap,
    Check, 
    ChevronLeft, 
    Loader2, 
    User, 
    Wrench, 
    ArrowRight,
    Send,
    Play,
    Car,
    DollarSign,
    Phone,
    Globe,
    Building,
    Tag,
    Info,
    CheckCircle2,
    XCircle,
    X,
    Gauge,
    Settings,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function CarDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();
    const id = params.id as string;

    // State
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [isZoomOpen, setIsZoomOpen] = useState(false);
    const [reportReason, setReportReason] = useState('');
    const [reportDesc, setReportDesc] = useState('');
    const [isReporting, setIsReporting] = useState(false);
    const [showReportForm, setShowReportForm] = useState(false);
    
    // Review State
    const [reviewComment, setReviewComment] = useState('');
    const [reviewRating, setReviewRating] = useState(5);
    const [showReviewForm, setShowReviewForm] = useState(false);

    // Queries & Mutations
    const { data: listing, isLoading, isError } = useUserMarketplaceListing(id);
    const { data: reviewsResponse, isLoading: isLoadingReviews, refetch: refetchReviews } = useListingReviews(listing?.id || '');
    const toggleFavoriteMutation = useToggleFavorite();
    const postReviewMutation = usePostListingReview();
    const startConversationMutation = useStartConversation();
    const reportListingMutation = useReportListing();
    const blockUserMutation = useBlockUser();

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 pt-28 pb-20">
                <Loader2 className="h-10 w-10 animate-spin text-[#003399] mb-4" />
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Loading Vehicle details...</p>
            </div>
        );
    }

    if (isError || !listing) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 pt-28 pb-20 text-center px-6">
                <div className="p-4 bg-rose-50 text-rose-500 rounded-full mb-4">
                    <AlertTriangle size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Vehicle Not Found</h3>
                <p className="text-slate-500 font-semibold text-sm max-w-sm mb-6">
                    We could not locate this listing. It may have been sold or removed by the seller.
                </p>
                <Button onClick={() => router.push('/marketplace')} className="bg-[#003399]">
                    Back to Marketplace
                </Button>
            </div>
        );
    }

    // ── Data extraction with safe fallbacks ──────────────────────────────────
    const basicInfo = listing.basicInfo || {};
    const pricingAndLocation = listing.pricingAndLocation || {};
    const features = listing.features || {};
    const sellerContact = pricingAndLocation.sellerContact || listing.sellerInformation || {};
    const locationData = pricingAndLocation.location || {};
    const fees = pricingAndLocation.fees || listing.fees || null;

    // Images: support both `images` array and `media` array formats
    const images: any[] = listing.images?.length
        ? listing.images
        : listing.media?.length
        ? listing.media
        : [];
    
    const mainImageUrl =
        images[activeImageIndex]?.path ||
        images[activeImageIndex]?.url ||
        listing.primaryImage?.url ||
        '/c9x-logo.png';

    const isFavorite = listing.isFavorite || listing.isFavorited;
    
    // Check ownership
    const isOwner = isAuthenticated && user && (
        (user.id && user.id === listing.userId) ||
        (user.id && user.id === listing.vendorId) ||
        (user.email && user.email === listing.user?.email)
    );

    // Condition label helper
    const conditionLabel = (val?: string | null) => {
        if (!val) return null;
        const map: Record<string, { label: string; color: string }> = {
            excellent: { label: 'Excellent', color: 'bg-emerald-50 text-emerald-700' },
            good: { label: 'Good', color: 'bg-blue-50 text-blue-700' },
            fair: { label: 'Fair', color: 'bg-amber-50 text-amber-700' },
            poor: { label: 'Poor', color: 'bg-rose-50 text-rose-600' },
        };
        const key = val.toLowerCase();
        return map[key] || { label: val, color: 'bg-slate-100 text-slate-600' };
    };

    const handleFavoriteToggle = async () => {
        if (!isAuthenticated) {
            toast.error('Authentication Required', {
                description: 'Please sign in to save vehicles to your favorites.'
            });
            router.push('/login?redirect=/marketplace');
            return;
        }
        await toggleFavoriteMutation.mutateAsync(listing.id);
    };

    const handleContactSeller = async () => {
        if (!isAuthenticated) {
            toast.error('Authentication Required', {
                description: 'Please sign in to chat with the seller.'
            });
            router.push('/login?redirect=/marketplace');
            return;
        }

        try {
            const result = await startConversationMutation.mutateAsync({
                listingId: listing.id,
                message: `Hi, I am interested in your listing: ${listing.title}. Is it still available?`
            });
            toast.success('Conversation started!');
            
            // The API response usually wraps in 'data'
            const convId = result?.data?.id || result?.id;
            if (convId) {
                router.push(`/messages?id=${convId}`);
            } else {
                router.push('/messages');
            }
        } catch (error) {}
    };

    const handleBlockSeller = async () => {
        const sellerId =
            listing.userId ||
            listing.vendorId ||
            sellerContact?.vendorId ||
            sellerContact?.userId ||
            sellerContact?.id;
        if (!sellerId) {
            toast.error('Unable to block', { description: 'Seller identifier not found.' });
            return;
        }
        if (!isAuthenticated) {
            toast.error('Authentication Required', { description: 'Please sign in to block users.' });
            router.push('/login');
            return;
        }
        try {
            await blockUserMutation.mutateAsync(sellerId);
            router.push('/marketplace');
        } catch (error) {}
    };

    const handleReportSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reportReason || !reportDesc) {
            toast.error('Missing fields', { description: 'Please fill in all report fields.' });
            return;
        }
        setIsReporting(true);
        try {
            await reportListingMutation.mutateAsync({
                listingId: listing.id,
                reason: reportReason,
                description: reportDesc
            });
            setShowReportForm(false);
            setReportReason('');
            setReportDesc('');
        } catch (error) {
        } finally {
            setIsReporting(false);
        }
    };

    const handlePostReviewSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reviewComment.trim()) return;
        try {
            await postReviewMutation.mutateAsync({
                listingId: listing.id,
                rating: reviewRating,
                comment: reviewComment.trim()
            });
            setReviewComment('');
            setShowReviewForm(false);
            refetchReviews();
        } catch (error) {}
    };

    // ── Computed display values ───────────────────────────────────────────────
    const engineCond = conditionLabel(basicInfo.engineCondition);
    const transmissionCond = conditionLabel(basicInfo.transmissionCondition);
    const suspensionCond = conditionLabel(basicInfo.suspensionCondition);

    const specItems = [
        { label: 'Brand / Make', val: basicInfo.make },
        { label: 'Model', val: basicInfo.model },
        { label: 'Year', val: basicInfo.year },
        { label: 'Trim / Variant', val: basicInfo.trimVariant || basicInfo.variant },
        { label: 'Body Type', val: basicInfo.bodyType },
        { label: 'Transmission', val: basicInfo.transmission },
        { label: 'Fuel Type', val: basicInfo.fuelType },
        { label: 'Engine Type', val: basicInfo.engineType },
        { label: 'Exterior Color', val: basicInfo.bodyColor || basicInfo.exteriorColor },
        { label: 'Interior Color', val: basicInfo.interiorColor },
        { label: 'Condition', val: listing.condition || basicInfo.condition },
        { label: 'Reg. Status', val: basicInfo.registrationStatus },
        { label: 'VIN / Chassis', val: basicInfo.maskedVinChassisNumber || basicInfo.vinChassisNumber || basicInfo.vin || listing.maskedVinChassisNumber || listing.vinChassisNumber || listing.vin },
        { label: 'State', val: pricingAndLocation.state?.name },
        { label: 'City', val: locationData.city },
        { label: 'Area', val: locationData.area },
        { label: 'Landmark', val: locationData.landmark },
    ].filter(s => s.val);

    const keyFeatures: string[] = features.keyFeatures || listing.carFeatures || [];

    return (
        <div className="min-h-screen bg-slate-50 pb-20 pt-28">
            <div className="max-w-6xl mx-auto px-4 md:px-6">
                {/* Breadcrumbs Navigation */}
                <nav aria-label="Breadcrumb" className="mb-6">
                    <ol className="flex items-center space-x-2 text-xs font-bold text-slate-500">
                        <li>
                            <Link href="/" className="hover:text-slate-800 transition-colors">Home</Link>
                        </li>
                        <li className="flex items-center space-x-2">
                            <span className="text-slate-300">/</span>
                            <Link href="/marketplace" className="hover:text-slate-800 transition-colors">Marketplace</Link>
                        </li>
                        {(basicInfo.make || basicInfo.model) && (
                            <li className="flex items-center space-x-2">
                                <span className="text-slate-300">/</span>
                                <Link 
                                    href={`/marketplace?make=${basicInfo.make || ''}&model=${basicInfo.model || ''}`} 
                                    className="hover:text-slate-800 transition-colors"
                                >
                                    {basicInfo.make} {basicInfo.model}
                                </Link>
                            </li>
                        )}
                        <li className="flex items-center space-x-2">
                            <span className="text-slate-300">/</span>
                            <span className="text-slate-900 truncate max-w-[200px] md:max-w-none" aria-current="page">
                                {listing.title}
                            </span>
                        </li>
                    </ol>
                </nav>

                <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
                    {/* ─── Main Column ─────────────────────────────────────── */}
                    <div className="space-y-6 min-w-0">

                        {/* Title & Price Card */}
                        <div className="bg-white rounded-3xl p-4 md:p-8 border border-slate-100 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                <div className="space-y-2 flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {(listing.condition || basicInfo.condition) && (
                                            <Badge className="bg-[#003399] text-white border-0 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 shadow-sm">
                                                {listing.condition || basicInfo.condition}
                                            </Badge>
                                        )}
                                        {basicInfo.registrationStatus && (
                                            <Badge className="bg-slate-100 text-slate-600 border-0 text-[10px] font-black uppercase tracking-wider px-2 py-0.5">
                                                {basicInfo.registrationStatus}
                                            </Badge>
                                        )}
                                        {listing.isC9Collection && (
                                            <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black uppercase tracking-wider px-2 py-0.5">
                                                ★ C9 Collection
                                            </Badge>
                                        )}
                                        {listing.isFeatured && (
                                            <Badge className="bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 text-[10px] font-black uppercase tracking-wider px-2 py-0.5">
                                                <Star size={10} className="fill-fuchsia-500 text-fuchsia-500 inline mr-1 -mt-0.5" />
                                                Featured
                                            </Badge>
                                        )}
                                        {listing.isBoosted && (
                                            <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black uppercase tracking-wider px-2 py-0.5">
                                                <Zap size={10} className="fill-amber-500 text-amber-500 inline mr-1 -mt-0.5" />
                                                Boosted
                                            </Badge>
                                        )}
                                    </div>
                                    <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
                                        {listing.title}
                                    </h1>
                                    <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                                        <MapPin size={14} className="text-slate-400 flex-shrink-0" />
                                        <span>
                                            {locationData.city || pricingAndLocation.address || listing.address || 'Nigeria'}
                                            {pricingAndLocation.state?.name ? `, ${pricingAndLocation.state.name}` : ''}
                                        </span>
                                    </div>
                                </div>

                                <div className="text-left sm:text-right space-y-2 flex-shrink-0">
                                    <p className="text-2xl md:text-3xl font-black text-[#003399]">
                                        {formatNaira(pricingAndLocation.amount ?? listing.amount)}
                                    </p>
                                    <div className="flex gap-2 sm:justify-end flex-wrap">
                                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md inline-block ${
                                            pricingAndLocation.isNegotiable
                                                ? 'bg-emerald-50 text-emerald-700'
                                                : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {pricingAndLocation.isNegotiable ? 'Negotiable' : 'Fixed Price'}
                                        </span>
                                        {pricingAndLocation.inspectionAccepted !== undefined && (
                                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md inline-block ${
                                                pricingAndLocation.inspectionAccepted
                                                    ? 'bg-emerald-50 text-emerald-600'
                                                    : 'bg-rose-50 text-rose-500'
                                            }`}>
                                                {pricingAndLocation.inspectionAccepted ? 'Inspection OK' : 'No Inspection'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Media Gallery */}
                        <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm space-y-4">
                            <div 
                                className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-100 cursor-zoom-in group"
                                onClick={() => setIsZoomOpen(true)}
                            >
                                <img
                                    src={mainImageUrl}
                                    alt={listing.title}
                                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = '/c9x-logo.png';
                                    }}
                                />
                                <div className="absolute top-4 right-4 z-10 flex gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(window.location.href);
                                            toast.success('Link copied to clipboard!');
                                        }}
                                        className="w-11 h-11 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center border border-slate-100 shadow-sm text-slate-600 hover:text-[#003399] hover:scale-105 transition-all"
                                        title="Share Listing"
                                    >
                                        <Share2 size={18} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleFavoriteToggle(); }}
                                        className="w-11 h-11 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center border border-slate-100 shadow-sm text-slate-600 hover:text-rose-500 hover:scale-105 transition-all"
                                    >
                                        <Heart 
                                            size={20} 
                                            className={isFavorite ? 'fill-rose-500 text-rose-500' : ''} 
                                        />
                                    </button>
                                </div>

                                {images.length > 1 && (
                                    <div className="absolute bottom-3 right-3 bg-black/50 text-white text-[10px] font-bold px-2 py-1 rounded-lg backdrop-blur-sm">
                                        {activeImageIndex + 1} / {images.length}
                                    </div>
                                )}
                            </div>

                            {/* Thumbnails */}
                            {images.length > 1 && (
                                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                                    {images.map((img: any, idx: number) => (
                                        <button
                                            key={img.id || idx}
                                            onClick={() => setActiveImageIndex(idx)}
                                            className={`relative w-20 h-14 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${
                                                activeImageIndex === idx
                                                    ? 'border-[#003399] opacity-100'
                                                    : 'border-transparent opacity-60 hover:opacity-90'
                                            }`}
                                        >
                                            <img
                                                src={img.path || img.url}
                                                alt={`Thumbnail ${idx + 1}`}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = '/c9x-logo.png';
                                                }}
                                            />
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* No images fallback */}
                            {images.length === 0 && !listing.primaryImage?.url && (
                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-50 rounded-xl p-3">
                                    <Car size={16} />
                                    No images available for this listing.
                                </div>
                            )}

                            {/* Video Link */}
                            {basicInfo.videoUrl && (
                                <a 
                                    href={basicInfo.videoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-xs font-bold text-[#003399] bg-blue-50/50 hover:bg-blue-50 p-3 rounded-xl transition-all w-fit"
                                >
                                    <Play size={16} fill="currentColor" />
                                    Watch Walkthrough Video
                                </a>
                            )}
                        </div>

                        {/* Technical Specifications */}
                        {specItems.length > 0 && (
                            <div className="bg-white rounded-3xl p-4 md:p-8 border border-slate-100 shadow-sm space-y-6">
                                <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.15em] border-b border-slate-100 pb-3">
                                    Technical Specifications
                                </h2>
                                <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
                                    {specItems.map((spec) => (
                                        <div key={spec.label} className="space-y-0.5">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">{spec.label}</span>
                                            <span className="text-sm font-bold text-slate-800">{spec.val}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Condition Scores */}
                        {(engineCond || transmissionCond || suspensionCond) && (
                            <div className="bg-white rounded-3xl p-4 md:p-8 border border-slate-100 shadow-sm space-y-4">
                                <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.15em] border-b border-slate-100 pb-3">
                                    Mechanical Condition
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                                    {engineCond && (
                                        <div className="text-center space-y-2 p-4 rounded-2xl bg-slate-50">
                                            <Zap size={22} className="mx-auto text-[#003399]" />
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Engine</p>
                                            <span className={`text-xs font-black px-2 py-1 rounded-lg inline-block ${engineCond.color}`}>
                                                {engineCond.label}
                                            </span>
                                        </div>
                                    )}
                                    {transmissionCond && (
                                        <div className="text-center space-y-2 p-4 rounded-2xl bg-slate-50">
                                            <Settings size={22} className="mx-auto text-[#003399]" />
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Transmission</p>
                                            <span className={`text-xs font-black px-2 py-1 rounded-lg inline-block ${transmissionCond.color}`}>
                                                {transmissionCond.label}
                                            </span>
                                        </div>
                                    )}
                                    {suspensionCond && (
                                        <div className="text-center space-y-2 p-4 rounded-2xl bg-slate-50">
                                            <Gauge size={22} className="mx-auto text-[#003399]" />
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Suspension</p>
                                            <span className={`text-xs font-black px-2 py-1 rounded-lg inline-block ${suspensionCond.color}`}>
                                                {suspensionCond.label}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Key Features */}
                        {keyFeatures.length > 0 && (
                            <div className="bg-white rounded-3xl p-4 md:p-8 border border-slate-100 shadow-sm space-y-4">
                                <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.15em] border-b border-slate-100 pb-3">
                                    Key Features
                                </h2>
                                <div className="flex flex-wrap gap-2.5">
                                    {keyFeatures.map((feat: string, idx: number) => (
                                        <Badge key={`${feat}-${idx}`} className="bg-slate-50 text-slate-700 hover:bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                                            <Check size={12} className="text-emerald-500" />
                                            {feat}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        {basicInfo.description && (
                            <div className="bg-white rounded-3xl p-4 md:p-8 border border-slate-100 shadow-sm space-y-4">
                                <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.15em] border-b border-slate-100 pb-3">
                                    Description
                                </h2>
                                <p className="text-slate-600 font-medium text-sm leading-relaxed whitespace-pre-line">
                                    {basicInfo.description}
                                </p>
                            </div>
                        )}

                        {/* Fees Breakdown */}
                        {fees && Object.keys(fees).length > 0 && (
                            <div className="bg-white rounded-3xl p-4 md:p-8 border border-slate-100 shadow-sm space-y-4">
                                <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.15em] border-b border-slate-100 pb-3 flex items-center gap-2">
                                    <DollarSign size={16} className="text-[#003399]" />
                                    Fees & Additional Costs
                                </h2>
                                <div className="space-y-3">
                                    {fees.registrationFee !== undefined && fees.registrationFee !== null && (
                                        <div className="flex items-center justify-between py-2.5 border-b border-slate-50">
                                            <span className="text-xs font-bold text-slate-500">Registration Fee</span>
                                            <span className="text-sm font-black text-slate-800">{formatNaira(fees.registrationFee)}</span>
                                        </div>
                                    )}
                                    {fees.insurance !== undefined && fees.insurance !== null && (
                                        <div className="flex items-center justify-between py-2.5 border-b border-slate-50">
                                            <span className="text-xs font-bold text-slate-500">Insurance</span>
                                            <span className="text-sm font-black text-slate-800">{formatNaira(fees.insurance)}</span>
                                        </div>
                                    )}
                                    {fees.customDuty !== undefined && fees.customDuty !== null && (
                                        <div className="flex items-center justify-between py-2.5 border-b border-slate-50">
                                            <span className="text-xs font-bold text-slate-500">Custom Duty</span>
                                            <span className="text-sm font-black text-slate-800">{formatNaira(fees.customDuty)}</span>
                                        </div>
                                    )}
                                    {fees.inspectionFee !== undefined && fees.inspectionFee !== null && (
                                        <div className="flex items-center justify-between py-2.5 border-b border-slate-50">
                                            <span className="text-xs font-bold text-slate-500">Inspection Fee</span>
                                            <span className="text-sm font-black text-slate-800">{formatNaira(fees.inspectionFee)}</span>
                                        </div>
                                    )}
                                    {fees.transferFee !== undefined && fees.transferFee !== null && (
                                        <div className="flex items-center justify-between py-2.5 border-b border-slate-50">
                                            <span className="text-xs font-bold text-slate-500">Transfer Fee</span>
                                            <span className="text-sm font-black text-slate-800">{formatNaira(fees.transferFee)}</span>
                                        </div>
                                    )}
                                    {/* Render any other fee keys dynamically */}
                                    {Object.entries(fees)
                                        .filter(([k]) => !['registrationFee','insurance','customDuty','inspectionFee','transferFee'].includes(k))
                                        .map(([key, val]) => val !== undefined && val !== null ? (
                                            <div key={key} className="flex items-center justify-between py-2.5 border-b border-slate-50">
                                                <span className="text-xs font-bold text-slate-500 capitalize">
                                                    {key.replace(/([A-Z])/g, ' $1').trim()}
                                                </span>
                                                <span className="text-sm font-black text-slate-800">
                                                    {typeof val === 'number' ? formatNaira(val) : String(val)}
                                                </span>
                                            </div>
                                        ) : null)
                                    }
                                </div>
                            </div>
                        )}

                        {/* Reviews */}
                        <div className="bg-white rounded-3xl p-4 md:p-8 border border-slate-100 shadow-sm space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.15em]">
                                    Reviews ({reviewsResponse?.meta?.total ?? reviewsResponse?.data?.length ?? 0})
                                </h2>
                                {!isOwner && isAuthenticated && (
                                    <button 
                                        onClick={() => setShowReviewForm(!showReviewForm)}
                                        className="text-xs font-bold text-[#003399] hover:underline"
                                    >
                                        Write a Review
                                    </button>
                                )}
                            </div>

                            {showReviewForm && (
                                <form onSubmit={handlePostReviewSubmit} className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-600">Rating:</span>
                                        <div className="flex gap-1">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button
                                                    key={star}
                                                    type="button"
                                                    onClick={() => setReviewRating(star)}
                                                    className="p-1 hover:scale-110 transition-transform"
                                                >
                                                    <Star 
                                                        size={22} 
                                                        className={star <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} 
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600">Review Message</label>
                                        <Textarea
                                            placeholder="Write your review here..."
                                            value={reviewComment}
                                            onChange={(e) => setReviewComment(e.target.value)}
                                            className="h-24 bg-white rounded-xl"
                                        />
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => setShowReviewForm(false)}
                                            className="rounded-xl h-10 font-bold"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={postReviewMutation.isPending || !reviewComment.trim()}
                                            className="bg-[#003399] hover:bg-blue-800 rounded-xl h-10 font-bold text-white px-5"
                                        >
                                            {postReviewMutation.isPending ? 'Submitting...' : 'Post Review'}
                                        </Button>
                                    </div>
                                </form>
                            )}

                            {isLoadingReviews ? (
                                <div className="flex justify-center py-6">
                                    <Loader2 className="h-6 w-6 animate-spin text-[#003399]" />
                                </div>
                            ) : reviewsResponse?.data && reviewsResponse.data.length > 0 ? (
                                <div className="space-y-4">
                                    {reviewsResponse.data.map((rev: any) => (
                                        <div key={rev.id} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex flex-col gap-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center font-bold text-sm text-[#003399]">
                                                        {rev.user?.name?.charAt(0) || <User size={16} />}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-900">{rev.user?.name}</p>
                                                        <p className="text-[10px] font-bold text-slate-400">
                                                            {new Date(rev.createdAt || rev.created_at).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Badge className="bg-amber-50 text-amber-600 border-0 flex items-center gap-1 text-[10px] font-black px-2 py-0.5">
                                                    <Star size={10} className="fill-amber-500 text-amber-500" />
                                                    {rev.rating}
                                                </Badge>
                                            </div>
                                            <p className="text-xs font-semibold text-slate-600 leading-relaxed pl-1">
                                                {rev.comment}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 space-y-1.5">
                                    <MessageSquare className="mx-auto h-8 w-8 text-slate-300" />
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">No reviews yet</p>
                                    <p className="text-[11px] font-semibold text-slate-400">Be the first to review this vehicle listing!</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ─── Sidebar Column ───────────────────────────────────── */}
                    <aside className="space-y-5 lg:sticky lg:top-28">

                        {/* Seller / Contact Card */}
                        <Card className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                            <CardContent className="p-6 space-y-5">
                                <div 
                                    className="flex items-center gap-3 relative group cursor-pointer" 
                                    onClick={() => {
                                        const sellerId = listing.vendorId || sellerContact?.vendorId || listing.userId || sellerContact?.userId || sellerContact?.id;
                                        if (sellerId) router.push(`/vendor/${sellerId}`);
                                    }}
                                >
                                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#003399] flex items-center justify-center font-bold text-lg shadow-sm group-hover:bg-[#003399] group-hover:text-white transition-colors">
                                        {(sellerContact.businessName || sellerContact.contactPerson || listing.user?.name || 'S').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <h3 className="font-bold text-slate-900 text-sm group-hover:text-[#003399] transition-colors">
                                                {sellerContact.businessName || sellerContact.contactPerson || listing.user?.name || 'Seller'}
                                            </h3>
                                            {(sellerContact.isVerified || sellerContact.hasVerifiedBadge) && (
                                                <ShieldCheck size={15} className="text-emerald-500" />
                                            )}
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                            {sellerContact.sellerType || 'Private Seller'}
                                        </p>
                                        {sellerContact.phone && (
                                            <div 
                                                className="flex items-center gap-1 mt-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigator.clipboard.writeText(sellerContact.phone);
                                                    toast.success('Phone number copied to clipboard!');
                                                }}
                                                title="Copy Phone Number"
                                            >
                                                <Phone size={10} />
                                                {sellerContact.phone}
                                                <span className="text-[9px] bg-slate-100 rounded px-1 py-0.5 ml-1 border border-slate-200">Copy</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {!isOwner ? (
                                    <>
                                        <Button
                                            onClick={handleContactSeller}
                                            disabled={startConversationMutation.isPending}
                                            className="w-full bg-[#003399] hover:bg-blue-800 text-white rounded-xl font-bold h-12 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10"
                                        >
                                            {startConversationMutation.isPending ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <MessageSquare size={16} />
                                            )}
                                            Contact Seller
                                        </Button>

                                        <div className="flex gap-2">
                                            <Dialog open={showReportForm} onOpenChange={setShowReportForm}>
                                                <DialogTrigger render={
                                                    <Button
                                                        variant="outline"
                                                        className="flex-1 rounded-xl h-10 border-slate-200 text-slate-600 text-xs font-bold"
                                                    />
                                                }>
                                                    <AlertTriangle size={13} className="mr-1.5 text-amber-500" />
                                                    Report
                                                </DialogTrigger>
                                                <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
                                                    <DialogHeader>
                                                        <DialogTitle className="text-lg font-bold text-slate-900">Report Listing</DialogTitle>
                                                    </DialogHeader>
                                                    <form onSubmit={handleReportSubmit} className="space-y-4 mt-2">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Reason</label>
                                                            <select
                                                                value={reportReason}
                                                                onChange={(e) => setReportReason(e.target.value)}
                                                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#003399]"
                                                            >
                                                                <option value="">Select a reason</option>
                                                                <option value="Misleading Information">Misleading Info</option>
                                                                <option value="Suspicious Activity">Suspicious / Scam</option>
                                                                <option value="Item Unavailable">Sold or Unavailable</option>
                                                                <option value="Inappropriate Content">Inappropriate Content</option>
                                                            </select>
                                                        </div>
                
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Description</label>
                                                            <Textarea
                                                                placeholder="Provide details about the issue..."
                                                                value={reportDesc}
                                                                onChange={(e) => setReportDesc(e.target.value)}
                                                                className="h-24 bg-slate-50 rounded-xl focus:bg-white focus:border-[#003399]"
                                                            />
                                                        </div>
                
                                                        <Button
                                                            type="submit"
                                                            disabled={isReporting}
                                                            className="w-full bg-[#003399] hover:bg-blue-800 text-white rounded-xl h-11 font-bold text-sm shadow-md"
                                                        >
                                                            {isReporting ? 'Submitting...' : 'Submit Report'}
                                                        </Button>
                                                    </form>
                                                </DialogContent>
                                            </Dialog>
                                            
                                            <Button
                                                variant="outline"
                                                onClick={handleBlockSeller}
                                                disabled={blockUserMutation.isPending}
                                                className="flex-1 rounded-xl h-10 border-slate-200 text-slate-600 text-xs font-bold"
                                            >
                                                Block Seller
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-50 text-center space-y-1">
                                        <Car className="mx-auto h-6 w-6 text-[#003399]" />
                                        <p className="text-xs font-bold text-[#003399]">This is your listing</p>
                                        <p className="text-[10px] font-semibold text-slate-500">You cannot chat with yourself or review this ad.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Quick Details Card */}
                        <Card className="bg-white rounded-3xl border border-slate-100 shadow-sm">
                            <CardContent className="p-5 space-y-3">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Quick Details</h4>
                                <div className="space-y-2.5">
                                    {listing.viewsCount !== undefined && (
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-semibold text-slate-500">Views</span>
                                            <span className="font-black text-slate-800">{listing.viewsCount.toLocaleString()}</span>
                                        </div>
                                    )}
                                    {listing.averageRating !== undefined && (
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-semibold text-slate-500">Rating</span>
                                            <span className="font-black text-slate-800 flex items-center gap-1">
                                                <Star size={11} className="fill-amber-400 text-amber-400" />
                                                {listing.averageRating > 0 ? listing.averageRating.toFixed(1) : 'No ratings'}
                                            </span>
                                        </div>
                                    )}
                                    {listing.createdAt && (
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-semibold text-slate-500">Listed</span>
                                            <span className="font-black text-slate-800">
                                                {new Date(listing.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-semibold text-slate-500">Status</span>
                                        <Badge className={`text-[10px] font-black border-0 px-2 ${
                                            listing.status === 'available'
                                                ? 'bg-emerald-50 text-emerald-700'
                                                : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {listing.status}
                                        </Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>



                        {/* Safety Tips */}
                        <Card className="bg-amber-50/50 rounded-3xl border border-amber-100/50 shadow-sm">
                            <CardContent className="p-5 space-y-3">
                                <div className="flex items-center gap-2 text-amber-800">
                                    <AlertTriangle size={16} />
                                    <h4 className="font-bold text-xs uppercase tracking-wider">Trading Safely</h4>
                                </div>
                                <ul className="space-y-1.5 text-[11px] font-semibold text-slate-600 list-disc pl-4 leading-relaxed">
                                    <li>Meet in public places.</li>
                                    <li>Never pay upfront before inspection.</li>
                                    <li>Inspect the vehicle details & VIN thoroughly before signing.</li>
                                    <li>Trade offline directly. C9X is for listing placement only.</li>
                                </ul>
                            </CardContent>
                        </Card>
                    </aside>
                </div>
            </div>

            {/* Image Zoom Modal / Lightbox */}
            <AnimatePresence>
                {isZoomOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsZoomOpen(false)}
                        className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 md:p-10 select-none cursor-zoom-out"
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setIsZoomOpen(false)}
                            className="absolute top-6 right-6 z-[110] p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors border border-white/10 shadow-lg cursor-pointer"
                        >
                            <X size={24} />
                        </button>

                        {/* Main Zoomed Image Container */}
                        <div 
                            className="relative max-w-5xl max-h-[75vh] w-full flex items-center justify-center"
                            onClick={(e) => e.stopPropagation()} // Prevent clicking image from closing lightbox
                        >
                            <motion.img
                                key={activeImageIndex}
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                src={mainImageUrl}
                                alt={listing.title}
                                className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl border border-white/5"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = '/c9x-logo.png';
                                }}
                            />
                        </div>

                        {/* Lightbox Navigation & Caption */}
                        <div className="mt-8 flex flex-col items-center gap-4 text-white z-[110]" onClick={(e) => e.stopPropagation()}>
                            {images.length > 1 && (
                                <div className="flex items-center gap-6">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveImageIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
                                        }}
                                        className="p-3 bg-white/10 hover:bg-white/20 rounded-full border border-white/10 text-white transition-colors cursor-pointer"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <span className="text-xs font-bold uppercase tracking-widest text-slate-450">
                                        {activeImageIndex + 1} / {images.length}
                                    </span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveImageIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
                                        }}
                                        className="p-3 bg-white/10 hover:bg-white/20 rounded-full border border-white/10 text-white transition-colors cursor-pointer"
                                    >
                                        <ArrowRight size={20} />
                                    </button>
                                </div>
                            )}
                            <p className="text-xs font-bold text-slate-300 text-center max-w-md uppercase tracking-wider">
                                {listing.title} • {formatNaira(pricingAndLocation.amount ?? listing.amount)}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
