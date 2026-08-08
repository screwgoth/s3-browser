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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { SiteLogo } from "@/components/site-logo";
import { getBrandingSettings } from "@/actions/settings";

// Defaults match the previous hardcoded copy so there's no flash before the
// configured branding loads from the server action.
const DEFAULT_BRANDING = {
  title: "S3 Navigator",
  subtitle: "Secure S3 bucket management",
  footer: "Secure S3 Bucket Management",
};

const formSchema = z.object({
  username: z.string().min(1, { message: "Username is required." }),
  password: z.string().min(1, { message: "Password is required." }),
});

type LoginFormValues = z.infer<typeof formSchema>;

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    getBrandingSettings().then(setBranding).catch(() => { /* keep defaults */ });
  }, []);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginFormValues) {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
        credentials: 'include', // Required to receive cookies
      });

      const data = await response.json();

      if (response.ok) {
        console.log("[LOGIN] Login successful, user:", data.user);

        // The session cookie is already set by the time the fetch resolves, so
        // redirect immediately — no artificial delay. A full-page navigation
        // ensures the cookie is in place before the next page's auth check.
        const redirectPath = data.user.must_change_password ? '/change-password' : '/';
        window.location.href = redirectPath;
      } else {
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: data.error || "Invalid username or password.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 skeu-bg">
      {/* Site Logo */}
      <div className="mb-6 flex flex-col items-center gap-3">
        <SiteLogo size="lg" />
      </div>

      {/* Product title */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{branding.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{branding.subtitle}</p>
      </div>

      <Card className="w-full max-w-sm skeu-login-card border-0">
        <CardHeader className="space-y-1 border-b">
          <CardTitle className="text-2xl font-bold text-center">Login</CardTitle>
          <CardDescription className="text-center">Enter your credentials to continue</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter username" 
                        {...field}
                        autoComplete="username"
                        className="bg-card"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter password"
                          autoComplete="current-password"
                          {...field}
                          className="bg-card"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute inset-y-0 right-0 h-full"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full skeu-btn border-0"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Subtle footer text */}
      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>{branding.footer}</p>
      </div>
    </main>
  );
}
