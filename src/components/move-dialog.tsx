"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, FolderInput, AlertCircle } from "lucide-react";
import { moveObjects, type MoveResult } from "@/actions/s3-mutations";
import FolderTree from "./folder-tree";
import type { BucketWithPermission } from "@/context/BucketContext";
import { useToast } from "@/hooks/use-toast";

interface MoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: BucketWithPermission;
  rootPrefix: string;
  currentPrefix: string;
  /** Keys of the selected files. Folders are filtered out by the caller. */
  fileKeys: string[];
  /** How many selected entries were folders, which v1 cannot move. */
  excludedFolderCount: number;
  onMoved: () => void;
}

export default function MoveDialog({
  open,
  onOpenChange,
  config,
  rootPrefix,
  currentPrefix,
  fileKeys,
  excludedFolderCount,
  onMoved,
}: MoveDialogProps) {
  const [destination, setDestination] = useState(currentPrefix);
  const [isMoving, setIsMoving] = useState(false);
  const [result, setResult] = useState<MoveResult | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setDestination(currentPrefix);
      setResult(null);
    }
  }, [open, currentPrefix]);

  const isSameFolder = destination === currentPrefix;
  const canMove = fileKeys.length > 0 && !isSameFolder && !isMoving;

  const handleMove = async () => {
    if (!canMove) return;
    setIsMoving(true);
    try {
      const res = await moveObjects(config.id, fileKeys, destination);
      setResult(res);
      if (res.moved.length > 0) {
        toast({ title: "Move complete", description: res.message });
        onMoved();
      }
      // Keep the dialog open when anything was skipped or failed so the user
      // can see which files did not move.
      if (res.skipped.length === 0 && res.failed.length === 0) {
        onOpenChange(false);
      }
    } catch {
      toast({ variant: "destructive", title: "Move failed", description: "Could not move the selected files." });
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderInput className="h-5 w-5" /> Move {fileKeys.length} file{fileKeys.length === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>Choose a destination folder in this bucket.</DialogDescription>
        </DialogHeader>

        {excludedFolderCount > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {excludedFolderCount} selected folder{excludedFolderCount === 1 ? "" : "s"} will not be
              moved — only files can be moved.
            </AlertDescription>
          </Alert>
        )}

        <FolderTree
          config={config}
          rootPrefix={rootPrefix}
          selected={destination}
          onSelect={setDestination}
        />

        {isSameFolder && (
          <p className="text-sm text-muted-foreground">
            These files are already in this folder. Pick a different destination.
          </p>
        )}

        {result && (result.skipped.length > 0 || result.failed.length > 0) && (
          <div className="max-h-40 overflow-y-auto space-y-1 text-sm">
            {result.skipped.map((s) => (
              <p key={s.key} className="text-muted-foreground">
                Skipped <span className="font-medium">{s.key.split("/").pop()}</span> — {s.reason}
              </p>
            ))}
            {result.failed.map((f) => (
              <p key={f.key} className="text-destructive">
                Failed <span className="font-medium">{f.key.split("/").pop()}</span> — {f.error}
              </p>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isMoving}>
            {result ? "Close" : "Cancel"}
          </Button>
          <Button onClick={handleMove} disabled={!canMove}>
            {isMoving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Move here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
