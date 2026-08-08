"use client";

import { useBucket } from "@/context/BucketContext";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useParams } from "next/navigation";
import S3Browser from "@/components/s3-browser";
import { AppSidebar } from "@/components/app-sidebar";
import { useEffect, useState } from "react";
import { Loader2, HardDrive } from "lucide-react";

export default function BucketBrowserPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;
    const { getBucketById } = useBucket();
    const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
    const [isReady, setIsReady] = useState(false);

    const bucketId = typeof id === 'string' ? id : '';
    const bucket = getBucketById(bucketId);

    useEffect(() => {
        if (!isAuthLoading) {
            if (!isAuthenticated) {
                router.push('/login');
            } else if (!bucket) {
                // If bucket not found after auth check, go to home
                router.push('/');
            } else {
                // Auth and bucket are ready
                setIsReady(true);
            }
        }
    }, [isAuthenticated, isAuthLoading, bucket, router]);


    const handleDisconnect = () => {
        router.push('/');
    };

    if (!isReady || !bucket) {
        return (
            <div className="w-screen h-screen flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <div className="min-h-screen skeu-bg app-content flex flex-col">
            <AppSidebar title={bucket.name} titleIcon={<HardDrive className="h-5 w-5 text-primary" />} />
            <main className="flex-1 flex flex-col min-h-0 p-4 md:p-6">
                <S3Browser config={bucket} onDisconnect={handleDisconnect} />
            </main>
        </div>
    );
}
