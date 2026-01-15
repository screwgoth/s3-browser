"use client";

import { S3Client, ListObjectsV2Command, _Object, CommonPrefix, S3ClientConfig } from "@aws-sdk/client-s3";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBytes } from "@/lib/utils";
import { Folder, File, HardDrive, LogOut, Home, Loader2, FileImage, FileText, Music, Video, Search, Download, Upload } from "lucide-react";
import ObjectDetails from "./object-details";
import UploadDialog from "./upload-dialog";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { useToast } from "@/hooks/use-toast";
import type { Bucket } from "@/context/BucketContext";
import { ToastAction } from "@/components/ui/toast";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { getItemsAsZip } from "@/actions/s3";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from "./ui/pagination";

type S3Item = (_Object | CommonPrefix) & { type: 'file' | 'folder' };

const getFileIcon = (key?: string) => {
  if (!key) return <File className="h-5 w-5 text-muted-foreground" />;
  const extension = key.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      return <FileImage className="h-5 w-5 text-blue-500" />;
    case 'mp3':
    case 'wav':
      return <Music className="h-5 w-5 text-purple-500" />;
    case 'mp4':
    case 'mov':
    case 'avi':
      return <Video className="h-5 w-5 text-red-500" />;
    case 'txt':
    case 'md':
    case 'docx':
    case 'pdf':
      return <FileText className="h-5 w-5 text-green-500" />;
    default:
      return <File className="h-5 w-5 text-muted-foreground" />;
  }
};

interface S3BrowserProps {
  config: Bucket;
  onDisconnect: () => void;
}

export default function S3Browser({ config, onDisconnect }: S3BrowserProps) {
  // Ensure root folder ends with /
  const rootFolder = useMemo(() => {
    if (!config.folder) return "";
    return config.folder.endsWith('/') ? config.folder : `${config.folder}/`;
  }, [config.folder]);

  const [prefix, setPrefix] = useState(rootFolder);
  const [items, setItems] = useState<S3Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<S3Item | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [s3Client, setS3Client] = useState<S3Client | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // Reset prefix if config changes
  useEffect(() => {
    setPrefix(rootFolder);
  }, [rootFolder]);

  useEffect(() => {
    const s3ClientOptions: S3ClientConfig = {
      region: config.region,
    };
    if (config.accessKeyId && config.secretAccessKey) {
      s3ClientOptions.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      }
    }
    setS3Client(new S3Client(s3ClientOptions));
  }, [config]);

  const fetchItems = useCallback(async (currentPrefix: string) => {
    if (!s3Client) return;
    setIsLoading(true);

    try {
      const command = new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: currentPrefix,
        Delimiter: "/",
      });
      const response = await s3Client.send(command);

      const folders: S3Item[] = (response.CommonPrefixes || []).map(p => ({ ...p, type: 'folder' }));
      const files: S3Item[] = (response.Contents || []).filter(c => c.Key !== currentPrefix && c.Size! > 0).map(c => ({ ...c, type: 'file' }));

      setItems([...folders, ...files]);
      setSelectedKeys(new Set()); // Clear selection on navigation
    } catch (e: any) {
      let description = e.message || "Failed to fetch bucket contents. Please check credentials and bucket name.";
      if (e.name === 'NetworkError' || (e.message && e.message.toLowerCase().includes('failed to fetch'))) {
        description = "This might be a CORS issue. Your S3 bucket needs to be configured to allow requests from this web application's domain. Please check your bucket's CORS settings.";
      }
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: description,
        action: description.includes('CORS') ?
          <ToastAction altText="Learn More" onClick={() => window.open('https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html', '_blank')}>Learn More</ToastAction> : undefined,
        duration: description.includes('CORS') ? 20000 : 5000,
      });
      console.error(e);
      onDisconnect();
    } finally {
      setIsLoading(false);
    }
  }, [config.bucket, s3Client, toast, onDisconnect]);

  useEffect(() => {
    if (s3Client) {
      fetchItems(prefix);
    }
  }, [prefix, s3Client, fetchItems]);

  const handleItemClick = (item: S3Item, e: React.MouseEvent) => {
    // prevent navigation if a checkbox or the row itself was clicked, but allow opening details
    if ((e.target as HTMLElement).closest('[role="checkbox"]') || (e.target as HTMLElement).closest('tr.selected')) {
      return;
    }

    if (item.type === 'folder' && (item as CommonPrefix).Prefix) {
      if (selectedKeys.has((item as CommonPrefix).Prefix!)) return;
      setPrefix((item as CommonPrefix).Prefix!);
      setSearchQuery(""); // Reset search when navigating folders
    } else {
      setSelectedItem(item);
    }
  };

  const handleBreadcrumbClick = (path: string) => {
    setPrefix(path);
    setSearchQuery(""); // Reset search when navigating folders
  };

  const handleSelect = (key: string, checked: boolean | "indeterminate") => {
    setSelectedKeys(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(key);
      } else {
        newSet.delete(key);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean | "indeterminate") => {
    if (checked) {
      const allVisibleKeys = paginatedItems.map(item => item.type === 'folder' ? (item as CommonPrefix).Prefix! : (item as _Object).Key!);
      setSelectedKeys(new Set(allVisibleKeys));
    } else {
      setSelectedKeys(new Set());
    }
  };

  const handleDownloadSelected = async () => {
    if (selectedKeys.size === 0) return;
    setIsDownloading(true);
    try {
      const itemsToDownload = items
        .filter(item => selectedKeys.has(item.type === 'folder' ? (item as CommonPrefix).Prefix! : (item as _Object).Key!))
        .map(item => ({
          key: (item.type === 'folder' ? (item as CommonPrefix).Prefix : (item as _Object).Key)!,
          type: item.type
        }));

      const base64Zip = await getItemsAsZip(config, itemsToDownload);

      const link = document.createElement('a');
      link.href = `data:application/zip;base64,${base64Zip}`;
      link.download = `${config.bucket}-selection.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: "Download Started", description: `Your download of ${itemsToDownload.length} items has started.` });
      setSelectedKeys(new Set()); // Clear selection after download
    } catch (error) {
      console.error("Download failed", error);
      toast({ variant: "destructive", title: "Download Failed", description: "Could not download the selected items. Please check the console for details." });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUploadComplete = () => {
    // Refresh the items list after upload
    fetchItems(prefix);
    setUploadDialogOpen(false);
  };

  // Logic to display breadcrumbs relative to the root folder
  const relativePrefix = prefix.startsWith(rootFolder) ? prefix.slice(rootFolder.length) : prefix;
  const breadcrumbParts = ['home', ...relativePrefix.split('/').filter(Boolean)];

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    return items.filter(item => {
      const name = item.type === 'folder'
        ? (item as CommonPrefix).Prefix?.replace(prefix, '').replace('/', '')
        : (item as _Object).Key?.replace(prefix, '');
      return name?.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [items, searchQuery, prefix]);

  // Pagination logic
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, endIndex);

  // Reset to first page when search query, prefix, or items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, prefix, itemsPerPage]);

  const areAllVisibleSelected = paginatedItems.length > 0 && selectedKeys.size === paginatedItems.length && paginatedItems.every(item => selectedKeys.has((item.type === 'folder' ? (item as CommonPrefix).Prefix : (item as _Object).Key)!));
  const isAnyVisibleSelected = paginatedItems.some(item => selectedKeys.has((item.type === 'folder' ? (item as CommonPrefix).Prefix : (item as _Object).Key)!));

  return (
    <Card className="w-full h-[95vh] max-w-7xl shadow-lg flex flex-col">
      <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between border-b p-4 gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <HardDrive className="h-6 w-6 text-primary" />
          <div className="flex flex-col gap-1">
            <CardTitle className="text-xl font-headline">{config.name} (s3://{config.bucket})</CardTitle>
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbParts.map((part, index) => {
                  const isLast = index === breadcrumbParts.length - 1;
                  // Construct path relative to rootFolder
                  const relativePath = index === 0 ? '' : breadcrumbParts.slice(1, index + 1).join('/') + '/';
                  const fullPath = rootFolder + relativePath;

                  return (
                    <React.Fragment key={index}>
                      <BreadcrumbItem>
                        {isLast ? (
                          <BreadcrumbPage className="font-normal">{part === 'home' ? <Home className="h-4 w-4" /> : part}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <button onClick={() => handleBreadcrumbClick(fullPath)} className="hover:text-primary transition-colors">
                              {part === 'home' ? <Home className="h-4 w-4" /> : part}
                            </button>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                      {!isLast && <BreadcrumbSeparator />}
                    </React.Fragment>
                  )
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Button onClick={() => setUploadDialogOpen(true)} variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Upload Files
          </Button>
          {selectedKeys.size > 0 && (
            <Button onClick={handleDownloadSelected} disabled={isDownloading}>
              {isDownloading ? <Loader2 className="mr-2 animate-spin" /> : <Download className="mr-2" />}
              Download Selected ({selectedKeys.size})
            </Button>
          )}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search in this folder..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={onDisconnect}><LogOut className="mr-2 h-4 w-4" /> Back</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-grow overflow-y-auto relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-card/50 backdrop-blur-sm z-20">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    onCheckedChange={handleSelectAll}
                    checked={areAllVisibleSelected ? true : isAnyVisibleSelected ? "indeterminate" : false}
                    aria-label="Select all"
                    disabled={paginatedItems.length === 0}
                  />
                </TableHead>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Last Modified</TableHead>
                <TableHead className="text-right">Size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.length > 0 ? paginatedItems.map((item, index) => {
                const key = item.type === 'folder' ? (item as CommonPrefix).Prefix! : (item as _Object).Key!;
                const isSelected = selectedKeys.has(key);
                return (
                  <TableRow
                    key={key || index}
                    onClick={(e) => handleItemClick(item, e)}
                    data-state={isSelected ? 'selected' : undefined}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked: boolean) => handleSelect(key, checked)}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        aria-label={`Select ${key}`}
                      />
                    </TableCell>
                    <TableCell>
                      {item.type === 'folder' ? (
                        <Folder className="h-5 w-5 text-primary" />
                      ) : (
                        getFileIcon((item as _Object).Key)
                      )}
                    </TableCell>
                    <TableCell className="font-medium" onClick={(e) => {
                      if (isSelected) {
                        e.stopPropagation();
                        setSelectedItem(item);
                      }
                    }}>
                      {item.type === 'folder' ? (item as CommonPrefix).Prefix?.replace(prefix, '').replace('/', '') : (item as _Object).Key?.replace(prefix, '')}
                    </TableCell>
                    <TableCell>
                      {item.type === 'file' && (item as _Object).LastModified ? new Date((item as _Object).LastModified!).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.type === 'file' && (item as _Object).Size != null ? formatBytes((item as _Object).Size!) : '—'}
                    </TableCell>
                  </TableRow>
                )
              }) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                    {searchQuery ? `No results for "${searchQuery}"` : "This folder is empty."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Pagination Controls */}
      {filteredItems.length > 10 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 py-3 border-t gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredItems.length)} of {filteredItems.length} items
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Items per page:</span>
              <Select value={itemsPerPage.toString()} onValueChange={(value: string) => setItemsPerPage(parseInt(value))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 1) {
                        setCurrentPage(currentPage - 1);
                      }
                    }}
                    className={currentPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>

                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage(pageNum);
                        }}
                        isActive={currentPage === pageNum}
                        className="cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}

                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage < totalPages) {
                        setCurrentPage(currentPage + 1);
                      }
                    }}
                    className={currentPage >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}

      <ObjectDetails
        item={selectedItem}
        bucketConfig={config}
        open={!!selectedItem}
        onOpenChange={(open) => !open && setSelectedItem(null)}
      />

      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        bucketConfig={config}
        currentPrefix={prefix}
        onUploadComplete={handleUploadComplete}
      />
    </Card>
  );
}
