"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Bucket } from "@/context/BucketContext";

// Max configurable per-bucket limit in MB (mirrors MAX_CONFIGURABLE_UPLOAD_SIZE).
const MAX_UPLOAD_SIZE_MB = 50;

const formSchema = z.object({
  name: z.string().min(1, { message: "Bucket alias is required." }),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  sessionToken: z.string().optional(),
  region: z.string().min(1, { message: "Region is required." }),
  bucket: z.string().min(1, { message: "Bucket name is required." }),
  folder: z.string().optional(),
  // MB in the UI; converted to bytes (maxUploadSize) on save. Blank = default.
  maxUploadSizeMb: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z
      .number({ invalid_type_error: "Enter a number." })
      .positive({ message: "Must be greater than 0." })
      .max(MAX_UPLOAD_SIZE_MB, { message: `Cannot exceed ${MAX_UPLOAD_SIZE_MB}MB.` })
      .optional()
  ),
});

export type S3Config = Omit<Bucket, 'id' | 'status'>;

type FormValues = z.infer<typeof formSchema>;

interface CredentialsFormProps {
  onSave: (config: S3Config) => void;
  onCancel: () => void;
  initialData?: S3Config;
  isEditing?: boolean;
  isAdmin?: boolean;
}

export function CredentialsForm({ onSave, onCancel, initialData, isEditing = false, isAdmin = false }: CredentialsFormProps) {
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData
      ? {
          ...initialData,
          maxUploadSizeMb: initialData.maxUploadSize
            ? Math.round(initialData.maxUploadSize / (1024 * 1024))
            : undefined,
        }
      : {
          name: "",
          accessKeyId: "",
          secretAccessKey: "",
          sessionToken: "",
          region: "",
          bucket: "",
          folder: "",
          maxUploadSizeMb: undefined,
        },
  });

  function onSubmit(values: FormValues) {
    const { maxUploadSizeMb, ...rest } = values;
    const config: S3Config = {
      ...rest,
      // Only admins can change the limit; for others send undefined so the
      // server keeps the existing value (edit) or applies the default (create).
      maxUploadSize: isAdmin
        ? (maxUploadSizeMb ? Math.round(maxUploadSizeMb * 1024 * 1024) : null)
        : undefined,
    };
    onSave(config);
    toast({
      title: isEditing ? "Bucket Updated" : "Bucket Added",
      description: `Successfully saved "${values.name}".`,
      duration: 500,
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Alias</FormLabel>
              <FormControl>
                <Input placeholder="My Work Bucket" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bucket"
          render={({ field }) => (
            <FormItem>
              <FormLabel>S3 Bucket Name</FormLabel>
              <FormControl>
                <Input placeholder="my-awesome-bucket" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="region"
          render={({ field }) => (
            <FormItem>
              <FormLabel>AWS Region</FormLabel>
              <FormControl>
                <Input placeholder="us-east-1" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="folder"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Root Folder <span className="text-muted-foreground">(optional)</span></FormLabel>
              <FormControl>
                <Input placeholder="users/john/" {...field} />
              </FormControl>
              <div className="text-xs text-muted-foreground">
                Limit access to a specific folder. Leave empty for root access.
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="accessKeyId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>AWS Access Key ID <span className="text-muted-foreground">(optional)</span></FormLabel>
              <FormControl>
                <Input placeholder="AKIA..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="secretAccessKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>AWS Secret Access Key <span className="text-muted-foreground">(optional)</span></FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showSecret ? "text" : "password"}
                    placeholder="Your secret key"
                    {...field}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute inset-y-0 right-0 h-full"
                    onClick={() => setShowSecret(!showSecret)}
                    aria-label={showSecret ? "Hide secret key" : "Show secret key"}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="sessionToken"
          render={({ field }) => (
            <FormItem>
              <FormLabel>AWS Session Token <span className="text-muted-foreground">(optional)</span></FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showToken ? "text" : "password"}
                    placeholder="Your session token"
                    {...field}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute inset-y-0 right-0 h-full"
                    onClick={() => setShowToken(!showToken)}
                    aria-label={showToken ? "Hide session token" : "Show session token"}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </FormControl>
              <div className="text-xs text-muted-foreground">
                Required for temporary credentials (AWS STS, IAM roles, SSO)
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        {isAdmin && (
          <FormField
            control={form.control}
            name="maxUploadSizeMb"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Upload Size (MB) <span className="text-muted-foreground">(admin only)</span></FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={MAX_UPLOAD_SIZE_MB}
                    placeholder="10"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <div className="text-xs text-muted-foreground">
                  Per-file limit for this bucket. Leave empty for the default (10MB). Max {MAX_UPLOAD_SIZE_MB}MB.
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">
            {isEditing ? 'Save Changes' : 'Add Bucket'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
