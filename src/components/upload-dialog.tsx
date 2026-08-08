"use client";

import React, { useState, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, X, File, AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { uploadObject } from "@/actions/s3";
import type { BucketWithPermission } from "@/context/BucketContext";
import { effectiveMaxUploadSize } from "@/lib/upload-limits";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bucketConfig: BucketWithPermission;
  currentPrefix: string;
  onUploadComplete: () => void;
}

interface UploadFile {
  file: File;
  key: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export default function UploadDialog({ 
  open, 
  onOpenChange, 
  bucketConfig, 
  currentPrefix, 
  onUploadComplete 
}: UploadDialogProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const maxSize = effectiveMaxUploadSize(bucketConfig.maxUploadSize);
  const maxSizeMb = (maxSize / (1024 * 1024)).toFixed(0);

  const validateFile = (file: File): string | null => {
    if (file.size > maxSize) {
      return `File "${file.name}" is too large. Maximum size is ${maxSizeMb}MB.`;
    }
    return null;
  };

  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newUploadFiles: UploadFile[] = [];

    fileArray.forEach(file => {
      const error = validateFile(file);
      const key = currentPrefix + file.name;
      
      // Check if file already exists in upload list
      const exists = uploadFiles.some(uf => uf.key === key);
      if (!exists) {
        newUploadFiles.push({
          file,
          key,
          progress: 0,
          status: error ? 'error' : 'pending',
          error: error || undefined
        });
      }
    });

    setUploadFiles(prev => [...prev, ...newUploadFiles]);
  }, [currentPrefix, uploadFiles]);

  const removeFile = (index: number) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
    }
  };

  const uploadFilesToS3 = async () => {
    const validFiles = uploadFiles.filter(uf => uf.status === 'pending');
    if (validFiles.length === 0) return;

    setIsUploading(true);

    for (let i = 0; i < validFiles.length; i++) {
      const uploadFile = validFiles[i];
      
      // Update status to uploading
      setUploadFiles(prev => prev.map(uf => 
        uf.key === uploadFile.key ? { ...uf, status: 'uploading' as const } : uf
      ));

      try {
        const result = await uploadObject(bucketConfig, uploadFile.file, uploadFile.key);
        
        if (result.success) {
          setUploadFiles(prev => prev.map(uf => 
            uf.key === uploadFile.key ? { ...uf, status: 'success' as const, progress: 100 } : uf
          ));
        } else {
          setUploadFiles(prev => prev.map(uf => 
            uf.key === uploadFile.key ? { ...uf, status: 'error' as const, error: result.message } : uf
          ));
        }
      } catch (error: any) {
        setUploadFiles(prev => prev.map(uf => 
          uf.key === uploadFile.key ? { ...uf, status: 'error' as const, error: error.message } : uf
        ));
      }
    }

    setIsUploading(false);
    onUploadComplete();
  };

  const clearAll = () => {
    setUploadFiles([]);
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'uploading':
        return <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />;
      default:
        return <File className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const validFilesCount = uploadFiles.filter(uf => uf.status === 'pending').length;
  const hasErrors = uploadFiles.some(uf => uf.status === 'error');

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!isUploading) onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>
            Upload files to {currentPrefix || 'root'} (Maximum {maxSizeMb}MB per file)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-primary bg-secondary'
                : 'border-input hover:border-muted-foreground'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground mb-2">
              Drag and drop files here, or click to select
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Maximum file size: {maxSizeMb}MB
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              Select Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileInput}
              className="hidden"
              disabled={isUploading}
            />
          </div>

          {/* File List */}
          {uploadFiles.length > 0 && (
            <div className="flex-1 overflow-y-auto">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-medium">Files to Upload ({uploadFiles.length})</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  disabled={isUploading}
                >
                  Clear All
                </Button>
              </div>
              
              <div className="space-y-2">
                {uploadFiles.map((uploadFile, index) => (
                  <div key={uploadFile.key} className="flex items-center gap-3 p-3 border rounded-lg">
                    {getStatusIcon(uploadFile.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{uploadFile.file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(uploadFile.file.size)}</p>
                      {uploadFile.status === 'uploading' && (
                        // Indeterminate bar — the server action doesn't report byte
                        // progress, so show continuous activity rather than a stuck 0%.
                        <div className="mt-2 h-1 w-full overflow-hidden rounded bg-muted">
                          <div className="h-full w-1/3 rounded bg-primary animate-indeterminate" />
                        </div>
                      )}
                      {uploadFile.error && (
                        <p className="text-xs text-destructive mt-1">{uploadFile.error}</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      disabled={isUploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Alert */}
          {hasErrors && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Some files have errors and cannot be uploaded. Please fix the issues or remove the files.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={uploadFilesToS3}
            disabled={validFilesCount === 0 || isUploading}
          >
            {isUploading ? 'Uploading...' : `Upload ${validFilesCount} File${validFilesCount !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
