import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { _Object, CommonPrefix } from "@aws-sdk/client-s3";
import { formatBytes } from "@/lib/utils";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { getObjectContent, getFolderContentsAsZip } from "@/actions/s3";
import type { Bucket } from "@/context/BucketContext";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

type S3Item = (_Object | CommonPrefix) & { type: 'file' | 'folder' };

interface ObjectDetailsProps {
  item: S3Item | null;
  bucketConfig: Bucket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ObjectDetails({ item, bucketConfig, open, onOpenChange }: ObjectDetailsProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  if (!item) return null;

  const isFile = item.type === 'file';
  const name = isFile ? (item as _Object).Key?.split('/').pop() : (item as CommonPrefix).Prefix?.split('/').slice(-2, -1)[0];
  const fullPath = isFile ? (item as _Object).Key : (item as CommonPrefix).Prefix;

  const handleDownload = async () => {
    if (!fullPath) return;
    setIsDownloading(true);

    try {
        if (isFile) {
            const { base64, contentType } = await getObjectContent(bucketConfig, fullPath);
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length).fill(0).map((_, i) => byteCharacters.charCodeAt(i));
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: contentType });
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = blobUrl;
            link.setAttribute("download", name || "download");
            link.style.display = "none";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } else {
            // It's a folder, zip it
            const base64Zip = await getFolderContentsAsZip(bucketConfig, fullPath);
            const link = document.createElement('a');
            link.href = `data:application/zip;base64,${base64Zip}`;
            link.download = `${name}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        toast({ title: "Download Started", description: `Your download of "${name}" has started.` });
    } catch (error) {
        console.error("Download failed", error);
        toast({ variant: "destructive", title: "Download Failed", description: "Could not download the item. Please check the console for details." });
    } finally {
        setIsDownloading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader className="text-left">
          <SheetTitle className="break-all">{name}</SheetTitle>
          <SheetDescription>
            Details for {item.type} in s3://{bucketConfig.bucket}
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <Separator />
          <div className="grid grid-cols-3 items-center gap-4">
            <span className="text-muted-foreground col-span-1">Name</span>
            <span className="col-span-2 break-all">{name}</span>
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <span className="text-muted-foreground col-span-1">Type</span>
            <span className="capitalize col-span-2">{item.type}</span>
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <span className="text-muted-foreground col-span-1">Full Path</span>
            <span className="col-span-2 break-all">{fullPath}</span>
          </div>
          {isFile && (item as _Object).Size != null && (
            <div className="grid grid-cols-3 items-center gap-4">
              <span className="text-muted-foreground col-span-1">Size</span>
              <span className="col-span-2">{formatBytes((item as _Object).Size!)}</span>
            </div>
          )}
          {isFile && (item as _Object).LastModified && (
            <div className="grid grid-cols-3 items-center gap-4">
              <span className="text-muted-foreground col-span-1">Last Modified</span>
              <span className="col-span-2">{new Date((item as _Object).LastModified!).toLocaleString()}</span>
            </div>
          )}
           {isFile && (item as _Object).StorageClass && (
            <div className="grid grid-cols-3 items-center gap-4">
              <span className="text-muted-foreground col-span-1">Storage Class</span>
              <span className="col-span-2">{(item as _Object).StorageClass}</span>
            </div>
          )}
        </div>
        <SheetFooter className="flex-row justify-between sm:justify-between">
           <Button variant="default" onClick={handleDownload} disabled={isDownloading}>
                {isDownloading ? <Loader2 className="mr-2 animate-spin" /> : <Download className="mr-2" />}
                {isDownloading ? 'Processing...' : 'Download'}
            </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
