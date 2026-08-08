"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import { previewDelete, deleteItems, type MutableItem, type DeletePreview } from "@/actions/s3-mutations";
import { formatBytes } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bucketId: string;
  items: MutableItem[];
  onDeleted: () => void;
}

/** The folder name an admin must type to confirm a recursive delete. */
function folderNameOf(key: string): string {
  return key.replace(/\/$/, "").split("/").pop() ?? key;
}

export default function DeleteDialog({
  open,
  onOpenChange,
  bucketId,
  items,
  onDeleted,
}: DeleteDialogProps) {
  const [preview, setPreview] = useState<DeletePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [typed, setTyped] = useState("");
  const { toast } = useToast();

  const folders = items.filter((i) => i.type === "folder");
  // Typing the folder name is required only for recursive folder deletes,
  // whose blast radius is unbounded.
  const requiresTypedConfirmation = folders.length > 0;
  const expectedText = folders.length === 1 ? folderNameOf(folders[0].key) : "DELETE";

  useEffect(() => {
    if (!open) return;
    setTyped("");
    setPreview(null);
    setPreviewError(null);
    setIsLoading(true);
    previewDelete(bucketId, items)
      .then((res) => {
        if (res.success && res.preview) setPreview(res.preview);
        else setPreviewError(res.message ?? "Could not inspect the selection.");
      })
      .catch(() => setPreviewError("Could not inspect the selection."))
      .finally(() => setIsLoading(false));
  }, [open, bucketId, items]);

  const confirmed = !requiresTypedConfirmation || typed.trim() === expectedText;
  const canDelete = confirmed && !isDeleting && !isLoading && !previewError;

  const handleDelete = async () => {
    if (!canDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteItems(bucketId, items);
      toast({
        variant: res.success ? undefined : "destructive",
        title: res.success ? "Deleted" : "Delete incomplete",
        description: res.message,
      });
      onOpenChange(false);
      onDeleted();
    } catch {
      toast({ variant: "destructive", title: "Delete failed", description: "Could not delete the selection." });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" /> Delete {items.length} item{items.length === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            This cannot be undone from this app.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-32 overflow-y-auto text-sm space-y-1">
          {items.map((i) => (
            <p key={i.key} className="truncate font-mono text-xs text-muted-foreground">
              {i.type === "folder" ? "📁" : "📄"} {i.key}
            </p>
          ))}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Calculating what will be deleted…
          </p>
        ) : previewError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{previewError}</AlertDescription>
          </Alert>
        ) : preview ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This will permanently delete <strong>{preview.objectCount}</strong> object
              {preview.objectCount === 1 ? "" : "s"} ({formatBytes(preview.totalBytes)}).
            </AlertDescription>
          </Alert>
        ) : null}

        {requiresTypedConfirmation && !previewError && (
          <div className="space-y-2">
            <Label htmlFor="delete-confirm">
              Type <span className="font-mono font-semibold">{expectedText}</span> to confirm
            </Label>
            <Input
              id="delete-confirm"
              value={typed}
              autoComplete="off"
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={!canDelete}>
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
