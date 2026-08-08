"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, Loader2, Home } from "lucide-react";
import { listObjects } from "@/actions/s3";
import type { BucketWithPermission } from "@/context/BucketContext";
import { cn } from "@/lib/utils";

interface FolderTreeProps {
  config: BucketWithPermission;
  /** Bucket root prefix ('' or a value ending in '/'). */
  rootPrefix: string;
  selected: string;
  onSelect: (prefix: string) => void;
}

interface NodeProps extends FolderTreeProps {
  prefix: string;
  label: React.ReactNode;
  depth: number;
  defaultOpen?: boolean;
}

function FolderNode({ config, rootPrefix, prefix, label, depth, selected, onSelect, defaultOpen }: NodeProps) {
  const [isOpen, setIsOpen] = useState(!!defaultOpen);
  const [children, setChildren] = useState<string[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadChildren = useCallback(async () => {
    if (children !== null || isLoading) return;
    setIsLoading(true);
    try {
      // Children are fetched lazily on expand, so a deep bucket costs nothing
      // until the user actually navigates into it.
      const result = await listObjects(config, prefix);
      setChildren(result.folders.map((f) => f.Prefix));
    } catch {
      setChildren([]);
    } finally {
      setIsLoading(false);
    }
  }, [config, prefix, children, isLoading]);

  useEffect(() => {
    if (isOpen) loadChildren();
  }, [isOpen, loadChildren]);

  const isSelected = selected === prefix;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 rounded-md px-2 py-1.5 cursor-pointer text-sm hover:bg-accent",
          isSelected && "bg-accent font-medium"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(prefix)}
      >
        <button
          type="button"
          className="shrink-0 p-0.5 hover:text-primary"
          onClick={(e) => { e.stopPropagation(); setIsOpen((v) => !v); }}
          aria-label={isOpen ? "Collapse" : "Expand"}
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
        {isOpen ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-primary" />
        )}
        <span className="truncate">{label}</span>
      </div>

      {isOpen && children?.map((child) => (
        <FolderNode
          key={child}
          config={config}
          rootPrefix={rootPrefix}
          prefix={child}
          label={child.slice(prefix.length).replace(/\/$/, "")}
          depth={depth + 1}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
      {isOpen && children?.length === 0 && (
        <p
          className="text-xs text-muted-foreground py-1"
          style={{ paddingLeft: `${(depth + 1) * 16 + 30}px` }}
        >
          No subfolders
        </p>
      )}
    </div>
  );
}

/** Folder picker rooted at the bucket's visible root. */
export default function FolderTree(props: FolderTreeProps) {
  return (
    <div className="border rounded-md max-h-72 overflow-y-auto py-1">
      <FolderNode
        {...props}
        prefix={props.rootPrefix}
        label={<span className="flex items-center gap-1.5"><Home className="h-3.5 w-3.5" /> Home</span>}
        depth={0}
        defaultOpen
      />
    </div>
  );
}
