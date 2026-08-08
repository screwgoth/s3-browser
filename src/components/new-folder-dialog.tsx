"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FolderPlus } from "lucide-react";
import { createFolder } from "@/actions/s3-mutations";
import { validateFolderName } from "@/lib/s3-keys";
import { useToast } from "@/hooks/use-toast";

interface NewFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bucketId: string;
  currentPrefix: string;
  onCreated: () => void;
}

export default function NewFolderDialog({
  open,
  onOpenChange,
  bucketId,
  currentPrefix,
  onCreated,
}: NewFolderDialogProps) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
    }
  }, [open]);

  // Client-side validation mirrors the server's; the server remains authoritative.
  const validation = validateFolderName(name);
  const canSubmit = validation.ok && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await createFolder(bucketId, currentPrefix, name);
      if (result.success) {
        toast({ title: "Folder created", description: result.message });
        onOpenChange(false);
        onCreated();
      } else {
        setError(result.message);
      }
    } catch {
      setError("Failed to create folder.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5" /> New Folder
          </DialogTitle>
          <DialogDescription>
            Creates an empty folder in the current location.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="folder-name">Folder name</Label>
          <Input
            id="folder-name"
            value={name}
            autoFocus
            placeholder="reports"
            onChange={(e) => { setName(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          />
          {name.length > 0 && !validation.ok && (
            <p className="text-sm text-destructive">{validation.message}</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
