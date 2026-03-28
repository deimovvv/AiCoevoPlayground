import { useEffect, useState } from "react";
import { Loader2, X, Search, CheckCircle2 } from "lucide-react";
import { fetchTalkingPhotos, type TalkingPhoto } from "../lib/api";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

interface HeygenAvatarSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (photo: TalkingPhoto) => void;
}

export function HeygenAvatarSelector({ isOpen, onClose, onSelect }: HeygenAvatarSelectorProps) {
    const [photos, setPhotos] = useState<TalkingPhoto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        setError(null);
        fetchTalkingPhotos()
            .then(data => setPhotos(data || []))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [isOpen]);

    if (!isOpen) return null;

    const filteredPhotos = photos.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

    const handleConfirm = () => {
        const photo = photos.find(p => p.id === selectedId);
        if (photo) {
            onSelect(photo);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-surface-0 border border-edge rounded-[var(--radius-lg)] shadow-lg w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between p-5 border-b border-edge shrink-0">
                    <div>
                        <h2 className="text-[16px] font-semibold text-fg">Select HeyGen Avatar</h2>
                        <p className="text-[12px] text-fg-muted mt-0.5">Choose from your existing HeyGen talking photos.</p>
                    </div>
                    <button onClick={onClose} className="cursor-pointer w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-2 text-fg-muted hover:text-fg transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-5 border-b border-edge shrink-0">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
                        <Input
                            placeholder="Search avatars by name..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>

                <div className="p-5 overflow-y-auto flex-1 bg-surface-1/30">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 size={24} className="animate-spin text-fg-muted mb-3" />
                            <p className="text-[13px] text-fg-muted">Loading your HeyGen avatars...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-12 text-error text-center">
                            <p className="text-[13px] font-medium mb-1">Failed to load avatars</p>
                            <p className="text-[12px] opacity-80 max-w-sm">{error}</p>
                        </div>
                    ) : filteredPhotos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-fg-muted text-center">
                            <p className="text-[13px]">No avatars found.</p>
                            <p className="text-[11px] mt-1">If you just uploaded one to HeyGen, it might take a moment to appear.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                            {filteredPhotos.map((photo) => {
                                const isSelected = selectedId === photo.id;
                                return (
                                    <button
                                        key={photo.id}
                                        onClick={() => setSelectedId(photo.id)}
                                        className={`group relative aspect-square rounded-[var(--radius-md)] overflow-hidden border-2 transition-all cursor-pointer ${isSelected ? "border-accent ring-2 ring-accent/20" : "border-edge hover:border-fg-muted/50"
                                            }`}
                                    >
                                        {photo.preview ? (
                                            <img src={photo.preview} alt={photo.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-surface-2 flex items-center justify-center text-[10px] text-fg-muted text-center p-2">
                                                No Preview
                                            </div>
                                        )}
                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent pt-6 pb-2 px-2">
                                            <p className="text-white text-[10px] truncate max-w-full font-medium" title={photo.name}>{photo.name}</p>
                                        </div>
                                        {isSelected && (
                                            <div className="absolute top-1.5 right-1.5 bg-accent text-white rounded-full p-0.5 shadow-sm">
                                                <CheckCircle2 size={12} strokeWidth={3} />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-5 border-t border-edge flex justify-end gap-3 bg-surface-0 shrink-0">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        variant="default"
                        disabled={!selectedId}
                        onClick={handleConfirm}
                    >
                        Select Avatar
                    </Button>
                </div>
            </div>
        </div>
    );
}
